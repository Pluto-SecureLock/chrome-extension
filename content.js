let openedPort = null;

async function openSerial(){
    try {
        const port = await navigator.serial.requestPort({
            filters: [{ usbVendorId: 0x239A }] // Optional: specific to your board
        });

        await port.open({ baudRate: 9600 });

        return port;
    } catch (err) {
        console.error("Serial error:", err);
    }
}

// Modify commandSerial to accept 'secrets', 'username', and 'password' for relevant commands
async function commandSerial(port, action, domain = "", secrets = "", username = "", password = "") { // Add new parameters
    try {
        const writer = port.writable.getWriter();
        const reader = port.readable.getReader();

        // focus input field for type commands
        if (action == "typeKeyPluto") {
            const input = document.querySelector('input[type="text"], input[type="email"], input[type="password"]'); // select password field separately for security
            if (input) input.select();
        }
        console.log(action, "Updating key for domain:", domain, "with username:", username, "and password:", password);
        
        let command = "";
        if (action == "showKeysPluto"){
            command = "showkeys \n";
        } else if (action == "getKeyPluto") {
            command = "get " + domain + "\n";
        } else if (action == "typeKeyPluto"){
            command = "type " + domain + "\n";
        } else if (action == "bulkAddPluto") {
            command = "bulkadd " + secrets + "\n"; // Correctly use the passed 'secrets'
        } else if (action == "updateKeyPluto") {
            //modify example.com[username:alice_wonder,password:newP@ss,note:2FA enabled]
            command = `update ${domain}[username:${username},password:${password}]\n`;
        } else {
            throw new Error("Unknown action: " + action);
        }

        const encoder = new TextEncoder();
        await writer.write(encoder.encode(command));

        let response = "";
        let temp = 0;
        const decoder = new TextDecoder();
        
        // different reading logic based on command
        if (action == "showKeysPluto") {
            // showKeys returns multiple lines
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    const text = decoder.decode(value);
                    response += text;
                    
                    if (text.includes("\n") && temp == 0) {
                        temp = 1;
                    } else if(temp == 1 && text.includes("\n")) {
                        break;
                    }
                }
            }
        } else if (action == "getKeyPluto" || action === "typeKeyPluto" || action === "updateKeyPluto") { // Group common single-line responses, include update
            // for get, type, and update commands, read until first newline
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for get
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    const text = decoder.decode(value);
                    response += text;
                    
                    if (text.includes("\n")) {
                        break;
                    }
                }
            }
        } else if (action == "bulkAddPluto") {
            // For bulkAdd, read until the stream is done to ensure all lines are captured.
            let fullResponse = ""; // Accumulate all chunks
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    const text = decoder.decode(value);
                    fullResponse += text;
                }
            }
            response = fullResponse; // Assign the complete response
        }

        console.log("Device response:", response.trim());

        // Release locks
        writer.releaseLock();
        reader.releaseLock();
        return response.trim();

    } catch (err) {
        console.error("Serial error:", err);
        return "ERROR: " + err.message; // Return an error message for better feedback
    }
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log(message);
  if (message.action === "PlutoInit") {
    openedPort = await openSerial();
    sendResponse({ status: "InitReceived OK" });
    return true;
  } else {
    if (!openedPort) {
      sendResponse({ status: "Error: Device not connected." });
      return true;
    }

    // Pass message.secrets, message.username, message.password to commandSerial
    const result = await commandSerial(
        openedPort, 
        message.action, 
        message.domain || '', 
        message.secrets || '',
        message.username || '', // Pass username
        message.password || ''  // Pass password
    );

    // Dynamically determine the response action based on the original message action
    let responseAction;
    if (message.action === "showKeysPluto") {
        responseAction = "showKeysResponse";
    } else if (message.action === "getKeyPluto") {
        responseAction = "getKeyResponse";
    } else if (message.action === "bulkAddPluto") {
        responseAction = "bulkAddResponse"; // New action for bulkAdd
    } else if (message.action === "updateKeyPluto") { // NEW: Action for update
        responseAction = "updateKeyResponse";
    } else {
        // For other actions like "typeKeyPluto", if index.js doesn't need a specific data response,
        // we can simply send a success status and return.
        sendResponse({ status: message.action + " OK" });
        return true; 
    }

    // Send the response back to the extension popup (index.js)
    chrome.runtime.sendMessage({
      action: responseAction,
      data: result
    });

    sendResponse({ status: message.action + " OK" });
    return true;
  }
});