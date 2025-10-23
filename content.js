

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