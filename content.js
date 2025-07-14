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
            command = `update ${domain}[username:${username},password:"${password}"]\n`;
        } else if (action == "singleAddPluto") {
            //add amazon:https://amazon.com,alice,"pa55,word",shopping account
            command = "add " + secrets + "\n"; // Use the passed 'secrets' for single add
        } else {
            throw new Error("Unknown action: " + action);
        }

        const encoder = new TextEncoder();
        await writer.write(encoder.encode(command));

        let response = "";
        let temp = 0;
        const decoder = new TextDecoder();

        // Helper function to read a single line or until a specific condition
        const readUntilNewlineOrDone = async (reader) => {
            let buffer = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    return { text: buffer, done: true };
                }
                const text = decoder.decode(value);
                buffer += text;
                if (buffer.includes("\n")) {
                    return { text: buffer, done: false };
                }
            }
        };

        // First, try to read and discard any "Ready to receive" messages that might come immediately
        // after sending a command, but before the actual response.
        // We'll give it a small timeout to allow the device to send its "ready" message first,
        // if it's designed to do so.
        let firstRead = await Promise.race([
            readUntilNewlineOrDone(reader),
            new Promise(resolve => setTimeout(() => resolve({ text: '', done: false }), 200)) // Adjust delay as needed
        ]);

        if (firstRead.text.includes("Ready to receive commands over USB Serial")) {
            console.log("Discarded initial 'Ready' message:", firstRead.text.trim());
            // Now, read the actual response
            response = (await readUntilNewlineOrDone(reader)).text;
        } else {
            // If the first read didn't contain "Ready", it might be the actual response or just a part of it.
            // If it's a multi-line response (like showKeys), or the full single-line response.
            response = firstRead.text;

            // Handle multi-line responses (like showKeysPluto)
            if (action == "showKeysPluto") {
                let temp = 0; // Renaming temp to avoid confusion, it's a state flag
                if (response.includes("\n")) {
                    temp = 1; // First newline encountered
                }
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    if (value) {
                        const text = decoder.decode(value);
                        response += text;
                        if (text.includes("\n") && temp == 0) {
                            temp = 1;
                        } else if(temp == 1 && text.includes("\n")) {
                            break; // Second newline, end of showKeys response
                        }
                    }
                }
            } else if (action === "bulkAddPluto") {
                // For bulkAdd, read until the stream is done to ensure all lines are captured.
                let fullResponse = response; // Start with what we've already read
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    if (value) {
                        const text = decoder.decode(value);
                        fullResponse += text;
                    }
                }
                response = fullResponse; // Assign the complete response
            } else {
                // For other single-line responses, ensure we have the full line
                while (!response.includes("\n") && !firstRead.done) {
                    const nextRead = await readUntilNewlineOrDone(reader);
                    response += nextRead.text;
                    firstRead.done = nextRead.done; // Update done status
                }
            }
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
    } else if (message.action === "updateKeyPluto") {
        responseAction = "updateKeyResponse";
    } else if (message.action === "singleAddPluto") {
        responseAction = "singleAddResponse";
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