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
    let writer; // Declare writer outside try block to be accessible in finally
    let reader; // Declare reader outside try block to be accessible in finally
    try {
        writer = port.writable.getWriter();
        reader = port.readable.getReader();

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
        } else if (action == "typeKeyPluto") {
            command = "type " + domain + "\n";
        } else if (action === "bulkAddPluto") {
            // For bulkAdd, the secrets string is the command itself
            command = secrets + "\n";
        } else if (action === "singleAddPluto") {
            // For singleAdd, the secrets string is the command itself
            command = "add " + secrets + "\n";
        } else if (action === "updateKeyPluto") {
            // New command for updating an existing key
            // Format: update [domain]:[username],[password],[note]
            const note = ""; // Assuming note is not part of update for now
            command = `update ${domain}[username:${username},password:"${password}",note:${note}]\n`;
        } else if (action === "PlutoInit") {
            // This is just to initialize the connection
            command = "status\n"; // Sending a simple command to confirm connection
        } else {
            console.error("Unknown action:", action);
            return "ERROR: Unknown action";
        }

        const data = new TextEncoder().encode(command);
        await writer.write(data);

        // Read response only for actions that expect one
        if (action === "showKeysPluto" || action === "getKeyPluto" || action === "updateKeyPluto" || action === "bulkAddPluto" || action === "singleAddPluto") {
            let receivedData = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                receivedData += new TextDecoder().decode(value);
                if (receivedData.includes("\n")) { // Assuming each response ends with a newline
                    break;
                }
            }
            return receivedData.trim();
        }

        return "Command sent successfully"; // For commands that don't expect a response
    } catch (err) {
        console.error("Serial error:", err);
        return "ERROR: " + err.message;
    } finally {
        // Ensure the writer and reader are released
        if (writer) {
            writer.releaseLock();
        }
        if (reader) {
            reader.releaseLock();
        }
    }
}

// Listen for messages from the extension popup (index.js)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => { // Use an async IIFE to allow await inside the listener
        if (!openedPort) {
            openedPort = await openSerial();
            if (!openedPort) {
                sendResponse({ status: "ERROR: Could not open serial port." });
                return; // Exit if port couldn't be opened
            }
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
          data: result // Send the result from commandSerial
        });
        sendResponse({ status: "OK", data: result }); // Send the result back to the popup

        // This return true is important for sendResponse to work asynchronously
        // It signals that you will send a response later.
        return true; 
    })(); // End of async IIFE
    return true; // Keep this return true for the main listener to signal async response
});



//Password suggestion popup
// to detect the sign up form, most consistent way would be to look for password input fields
// to differentiate between login and signup, we can check if there are two password fields 
// for now we will check for presence of the password field and if the domain is not in our list of passwords in the password manager, we will suggest a password

const randPassword = 'aKrteads!23'; // temnporary random password
let passwordFields;

// function detectSignupForm() {
//     passwordFields = document.querySelectorAll('input[type="password"]');
//     console.log(passwordFields);
//     return passwordFields?true:false;
// }

// if (detectSignupForm()) {
//     console.log("Signup form detected");
   
// }

function setupSignupObserver() {
  // check if theres a passwsord field already on the page
  document.querySelectorAll('input[type="password"]').forEach(handlePasswordField);
  
  // set up the observer for when the DOM changes   
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        
        // if the node itself is a password field
        if (node.matches && node.matches('input[type="password"]')) {
          handlePasswordField(node);
        }
        
        // Check for password fields within node
        if (node.querySelectorAll) {
          const passwordFields = node.querySelectorAll('input[type="password"]');
          passwordFields.forEach(handlePasswordField);
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  console.log("Password field observer started");
}

function handlePasswordField(input) {
  // prevent duplicate handlers????
  if (input.dataset.passwordHandlerAttached) return;
  input.dataset.passwordHandlerAttached = "true";
  
  console.log("Detected password field:", input);
  
  input.addEventListener("focus", () => {
    console.log("Password field focused");
    const rect = input.getBoundingClientRect();
    const position = {
      top: rect.bottom + window.scrollY, // Position below the input
      left: rect.left + window.scrollX,
      width: rect.width
    };
    
    console.log("Password field position:", position);
    showPasswordSuggestionBox(input, position);
  });
    
  input.addEventListener("blur", hidePasswordSuggestionBox); //hidePasswordSuggestionBox
}

// init when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupSignupObserver);
} else {
  setupSignupObserver();
}

function showPasswordSuggestionBox(input, position) {
  // Remove any existing suggestion box
  hidePasswordSuggestionBox();
  
  // Create the suggestion box
  const suggestionBox = document.createElement('div');
  suggestionBox.id = 'password-suggestion-box';
  suggestionBox.style.position = 'absolute';
  suggestionBox.style.top = `${position.top}px`;
  suggestionBox.style.left = `${position.left}px`;
//   suggestionBox.style.width = `${position.width}px`;
//   suggestionBox.style.height = '50px';
//   suggestionBox.style.backgroundColor = 'red';
  suggestionBox.style.zIndex = '9999';
//   suggestionBox.style.marginTop = '5px'; // Small gap below the input
  
  document.body.appendChild(suggestionBox);
  //shadow needed to have styles applied correctly or else the website's styles may override ours
  const shadow = suggestionBox.attachShadow({ mode: "open" });
  shadow.innerHTML = `
  <style>
    .suggestion-box {
      background: white;
      border: 1px solid #ccc;
      padding: 6px 10px;
      border-radius: 6px;
      font-family: sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
  </style>
  <div class="suggestion-box">Suggested: `+randPassword+`</div>`
;
}

function hidePasswordSuggestionBox() {
  const existingBox = document.getElementById('password-suggestion-box');
  if (existingBox) {
    existingBox.remove();
  }
}