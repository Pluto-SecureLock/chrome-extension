

let openedPort = null;
let showKeys_response = new Promise((resolve, reject) => {
    
})

async function openSerial(){
try {
        const port = await navigator.serial.requestPort({
            filters: [{ usbVendorId: 0x239A }] // Optional: specific to your board
        });

        await port.open({ baudRate: 9600 });

        return port;
        // await port.close();
    } catch (err) {
        console.error("Serial error:", err);
    }
           }



async function commandSerial(port, action, domain = ""){
    try {
     
        const writer = port.writable.getWriter();
        const reader = port.readable.getReader();

        // focus input field for type commands
        if (action == "typeKeyPluto") {
            const input = document.querySelector('input[type="text"], input[type="email"], input[type="password"]'); // select password field separately for security
            if (input)   input.select();
        }

        let command = "";
        if (action == "showKeysPluto"){
            command = "showkeys \n";
        } else if (action == "getKeyPluto") {
            command = "get " + domain + "\n";
        } else if (action == "typeKeyPluto"){
            command = "type " + domain + "\n";
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
        } else if (action == "getKeyPluto") {
            // for get commands, wait a bit longer to ensure we get the actual data
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
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
        } else if (action == "typeKeyPluto") {
            // for type commands, just read until first newline
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
        }

        console.log("Device response:", response.trim());

        // Release locks
        writer.releaseLock();
        reader.releaseLock();
        return response.trim();

    } catch (err) {
        console.error("Serial error:", err);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(message);
  
  if (message.action === "PlutoInit") {
    openSerial().then(port => {
      openedPort = port;
      sendResponse({ status: "InitReceived OK" });
    }).catch(err => {
      sendResponse({ status: "Error", error: err.message });
    });

    return true; // Keep channel open
  }

  if (!openedPort) {
    sendResponse({ status: "Error: Device not connected." });
    return false;
  }

  commandSerial(openedPort, message.action, message.domain || '')
    .then(result => {
      chrome.runtime.sendMessage({
        action: "showKeysResponse",
        data: result
      });
      sendResponse({ status: message.action + " OK" });
    })
    .catch(err => {
      sendResponse({ status: "Error", error: err.message });
    });

  return true; // Keep channel open
});
