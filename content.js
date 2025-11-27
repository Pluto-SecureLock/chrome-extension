let openedPort = null;

async function openSerial() { //background.js
  try {
    const port = await navigator.serial.requestPort({
      filters: [{ usbVendorId: 0x239A }], // Optional: specific to your board
    });

    await port.open({ baudRate: 9600 });

    return port;
  } catch (err) {
    console.error("Serial error:", err);
  }
}

// Modify commandSerial to accept 'secrets', 'username', and 'password' for relevant commands
async function commandSerial( //background.js
  port,
  action,
  domain = "",
  secrets = "",
  username = "",
  password = ""
) {
  // Add new parameters
  let writer; // Declare writer outside try block to be accessible in finally
  let reader; // Declare reader outside try block to be accessible in finally
  try {
    writer = port.writable.getWriter();
    reader = port.readable.getReader();

    // focus input field for type commands
    if (action == "typeKeyPluto") {
      const input = document.querySelector(
        'input[type="text"], input[type="email"], input[type="password"]'
      ); // select password field separately for security
      if (input) input.select();
    }
    console.log(
      action,
      "Updating key for domain:",
      domain,
      "with username:",
      username,
      "and password:",
      password
    );

    let command = "";
    if (action == "showKeysPluto") {
      command = "showkeys \n";
    } else if (action == "getKeyPluto") {
      command = "get " + domain + "\n";
    } else if (action == "typeKeyPluto") {
      command = "type " + domain + "\n";
    } else if (action === "bulkAddPluto") {
      // For bulkAdd, the secrets string is the command itself
      command = "bulkadd " + secrets + "\n";
    } else if (action === "singleAddPluto") {
      command = "add " + secrets + "\n";
		} else if (action === "deleteKeyPluto") {
      command = "delete " + domain + "\n";
    } else if (action === "updateKeyPluto") {
      // Format: update domain:[username,"password","note"]
      const note = ""; // Assuming note is not part of update for now
      command = `update ${domain}[username:${username},password:"${password}",note:${note}]\n`;
    } else if (action === "generatePasswordPluto") {
      //password Gen
      command = `passwd len=30,lvl=2\n`;
    } else if (action === "PlutoInit") {
      // This is just to initialize the connection
      command = "status\n"; // Sending a simple command to confirm connection
    } else {
      console.error("Unknown action:", action);
      return "ERROR: Unknown action";
    }

    console.log("Sending command:", command.trim());
    const data = new TextEncoder().encode(command);
    await writer.write(data);

    // Read response only for actions that expect one
    if (
      action === "showKeysPluto" ||
      action === "getKeyPluto" ||
      action === "updateKeyPluto" ||
      action === "bulkAddPluto" ||
      action === "singleAddPluto" ||
      action === "generatePasswordPluto" ||
			action === "deleteKeyPluto"
    ) {
      let receivedData = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        receivedData += new TextDecoder().decode(value);
        if (receivedData.includes("\n")) {
          // Assuming each response ends with a newline
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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => { //background.js
  (async () => {
    // Use an async IIFE to allow await inside the listener
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
      message.domain || "",
      message.secrets || "",
      message.username || "", // Pass username
      message.password || "" // Pass password
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
    } else if (message.action === "deleteKeyPluto") {
            responseAction = "deleteKeyResponse";
    } else {
      // For other actions like "typeKeyPluto", if index.js doesn't need a specific data response,
      // we can simply send a success status and return.
      sendResponse({ status: message.action + " OK" });
      return true;
    }

    // Send the response back to the extension popup (index.js)
    chrome.runtime.sendMessage({
      action: responseAction,
      data: result, // Send the result from commandSerial
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

const randPassword = "aKrteads!23"; // temnporary random password
const signUpArray = ["up", "create", "register", "join", "start", "new"]; //words that indicate signup forms
let passwordFields;
let generatedPassword = null;
let signUpFormDetected = false;

// function detectSignupForm() {
//     passwordFields = document.querySelectorAll('input[type="password"]');
//     console.log(passwordFields);
//     return passwordFields?true:false;
// }

// if (detectSignupForm()) {
//     console.log("Signup form detected");

// }

function setupSignupObserver() { //content.js
  // check if theres a passwsord field already on the page
  document
    .querySelectorAll('input[type="password"]')
    .forEach(handlePasswordField); //need to do the same checks here as below for signup form

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
          const inputFields = node.querySelectorAll("input");
          const submitButtons = node.querySelectorAll('button[type="submit"]');
          if(submitButtons.length!=0){
          let submitButtonText = submitButtons[0].textContent
            .trim()
            .toLowerCase();
          const isSignupButton = signUpArray.some((keyword) =>
            submitButtonText.includes(keyword)
          );
          console.log(
            inputFields,
            inputFields.length,
            submitButtons,
            submitButtonText,
            isSignupButton
          ); //move all this into a function
          if (inputFields.length > 2 && isSignupButton) {
            //checks if more than 2 input fields are present
              console.log("Signup form detected in added node");
              if (!signUpFormDetected) {
                signUpFormDetected = true;
                generatedPassword = null;   // reset for new form
              }
            const passwordFields = node.querySelectorAll(
              'input[type="password"]'
            );

            if (openedPort && !generatedPassword) {
              passwordFields[0].focus(); //focus the first password field before typing. Change if we have a confirmation field as well
              console.log("Generating password for signup form");
              (async () => {
                const generatedPassword = await commandSerial(
                  openedPort,
                  "generatePasswordPluto"
                );
                console.log("Generated password:", generatedPassword);
              })();
            }

            passwordFields.forEach(handlePasswordField); //this might generate different passwords for password and confirm password fields

        }}}
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("Password field observer started");
}

function handlePasswordField(input) {//content.js
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
      width: rect.width,
    };

    console.log("Password field position:", position);
    showPasswordSuggestionBox(input, position);
  });

  input.addEventListener("blur", () =>{
    hidePasswordSuggestionBox();
    if (![...document.querySelectorAll('input[type="password"]')]
          .some(el => el === document.activeElement)) {
        generatedPassword = null;
        signUpFormDetected = false;
    }
  }
    ); //hidePasswordSuggestionBox
}

// init when ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupSignupObserver);
} else {
  setupSignupObserver();
}

function showPasswordSuggestionBox(input, position) { //content.js
  // Remove any existing suggestion box
  hidePasswordSuggestionBox();

  // Create the suggestion box
  const suggestionBox = document.createElement("div");
  suggestionBox.id = "password-suggestion-box";
  suggestionBox.style.position = "absolute";
  suggestionBox.style.top = `${position.top}px`;
  suggestionBox.style.left = `${position.left}px`;
  //   suggestionBox.style.width = `${position.width}px`;
  //   suggestionBox.style.height = '50px';
  //   suggestionBox.style.backgroundColor = 'red';
  suggestionBox.style.zIndex = "9999";
  //   suggestionBox.style.marginTop = '5px'; // Small gap below the input

  document.body.appendChild(suggestionBox);
  //shadow needed to have styles applied correctly or else the website's styles may override ours
  const shadow = suggestionBox.attachShadow({ mode: "open" });
  shadow.innerHTML =
    `
  <style>
    .suggestion-box {
      background: white;
      border: 1px solid #ccc;
      padding: 6px 10px;
      border-radius: 6px;
      font-family: sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
      .suggestion-box:hover {
      background: #DDDDDD;
      cursor: pointer;
    }
  </style>
  <div class="suggestion-box">Use Pluto Suggested Password: // +
   
    </div>`; //replace with a generated password from the device
 // randPassword +
  const suggestionDiv = shadow.querySelector('.suggestion-box');
  // const suggestionDiv = document.querySelector('.suggestion-box');

  suggestionDiv.addEventListener("mousedown", (e) => {
    e.preventDefault(); //prevent blur on input field
    console.log("Suggestion clicked");
    
    //generatefunction here
});
}

function hidePasswordSuggestionBox() {  //content.js
  const existingBox = document.getElementById("password-suggestion-box");
  if (existingBox) {
    existingBox.remove();
  }

}

