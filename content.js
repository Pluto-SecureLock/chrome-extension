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
    } else {
      console.error("Unknown action:", action);
      return "ERROR: Unknown action";
    }

    console.log("Sending command:", command.trim()); //TODO: Just for debugging, remove later
    const data = new TextEncoder().encode(command);
    await writer.write(data);

    // Read response only for actions that expect one
    if (
      action === "showKeysPluto" ||
      action === "getKeyPluto" ||
      action === "updateKeyPluto" ||
      action === "bulkAddPluto" ||
      action === "singleAddPluto" ||
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

const signUpArray = ["up", "create", "register", "join", "start", "new", "sign",]; //words that indicate signup forms
let passwordFields;
let generatedPassword = null;
let signUpFormDetected = false;

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
          let submitButton = submitButtons[0];
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
            // Attach the handler ONLY ONCE
            if (!submitButton.dataset.plutoSubmitHandler) {
                submitButton.dataset.plutoSubmitHandler = 'true';
                // Attach the listener to the submit button
                submitButton.addEventListener("click", handleSignupSubmit);
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
    );
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
  suggestionBox.style.zIndex = "9999";

  document.body.appendChild(suggestionBox);
  //shadow needed to have styles applied correctly or else the website's styles may override ours
  const shadow = suggestionBox.attachShadow({ mode: "open" });
  shadow.innerHTML = //Move this to some CSS file later
    `
  <style>
    /* Basic Reset and Global Styles */
    :host {
      display: block; /* Ensure the shadow host behaves correctly */
    }
    /* --- Container Style --- */
    .pluto-suggestion-box {
      /* Use the bright primary color for the base gradient */
      background: linear-gradient(135deg, #054FF0 0%, #DCFC73 100%); 
      
      /* Overall Box Styling */
      padding: 1px; /* Creates the visible gradient border */
      border-radius: 8px; /* Slightly more modern curve */
      font-family: 'Inter', 'Segoe UI', sans-serif; /* Use a modern, clean font */
      box-shadow: 0 4px 12px rgba(5, 79, 240, 0.4); /* Blue glow/shadow */
      max-width: 250px;
      transition: transform 0.1s ease;
    }
    /* --- Inner Content Style --- */
    .inner-content {
      background: white; /* Inner white background for contrast */
      padding: 8px 12px;
      border-radius: 7px; /* Matches outer radius minus the 1px border */
      display: flex;
      flex-direction: column;
      gap: 4px;
      cursor: pointer;
    }
    .label-container {
    display: flex;
    align-items: center; /* Vertically align icon and text */
    gap: 6px; /* Space between icon and text */
    }
    /* --- Text Styles --- */
    .label {
      font-size: 11px;
      color: #054FF0; /* Use the primary blue for the label */
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .password {
      font-family: 'Raleway'; /* Monospace for passwords */
      font-size: 14px;
      font-weight: 600;
      color: #333;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* --- Key Icon Styling --- */
    .key-icon {
      width: 14px; /* Adjust size as needed */
      height: 14px;
      fill: #f0bd05ff; /* Match the label text color */
      flex-shrink: 0; /* Prevent icon from shrinking */
    }
    /* --- Hover Effect --- */
    .pluto-suggestion-box:hover {
      transform: translateY(-1px); /* Subtle lift on hover */
      box-shadow: 0 6px 16px rgba(5, 79, 240, 0.6); /* Enhanced shadow on hover */
    }
  </style>

  <div class="pluto-suggestion-box" title="Click to use this password">
    <div class="inner-content">
      <div class="label-container">
        <svg class="key-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 7a5 5 0 1 1 3.61 4.804l-1.903 1.903A1 1 0 0 1 9 14H8v1a1 1 0 0 1-1 1H6v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 .293-.707L8.196 8.39A5.002 5.002 0 0 1 8 7Zm5-3a.75.75 0 0 0 0 1.5A1.5 1.5 0 0 1 14.5 7 .75.75 0 0 0 16 7a3 3 0 0 0-3-3Z"/>
          </svg>
          <div class="label">Pluto Suggested Password</div>
      </div>
    </div>
  </div>`;

  const suggestionDiv = shadow.querySelector('.pluto-suggestion-box');

  suggestionDiv.addEventListener("mousedown", async (e) => {
    e.preventDefault(); // Prevent blur on input field
    console.log("Pluto Suggestion Box clicked. Generating and typing password...");
    hidePasswordSuggestionBox(); 
    input.focus(); // Set focus back to the input field before typing

    try {
        if (!openedPort) {
          openedPort = await openSerial();
        }
        generatedPassword = await commandSerial(openedPort, "generatePasswordPluto");
    } catch (error) {
          console.error("Error generating password:", error);
          return;
    }
  });
}

function hidePasswordSuggestionBox() {
  const existingBox = document.getElementById("password-suggestion-box");
  if (existingBox) {
    existingBox.remove();
  }
}

function handleSignupSubmit(event) {

  console.log("Signup button clicked. Capturing data and sending message to background...");
  const formElement = event.target.closest('form');

  const domain = window.location.hostname;
  const formContainer = formElement || document;
  const emailField = formContainer.querySelector('input[type="email"], input[name*="user"], input[name*="email"]');

  const username = emailField ? emailField.value : '';

  if (!username || !domain) {
    console.error("Host or username is empty. Cannot save credential.");
    return;
  }

  // Construct the secrets string (using the format from your previous code)
  const secretsToSend = `${domain}:${domain},${username},,"Signup generated by Pluto"`;

  (async () => {
      try {
          if (!openedPort) {
            openedPort = await openSerial();
            if (!openedPort) {
              sendResponse({ status: "ERROR: Could not open serial port." });
              return; // Exit if port couldn't be opened
            }
          }
          console.log("Prepared secrets to send to Pluto:", secretsToSend);
          // Send the singleAddPluto command
          let result = await commandSerial(openedPort, "singleAddPluto","", secretsToSend);
          console.log("Credential added to Pluto. Result:", result);
          // After successful addition, manually submit the form
          if (result && !result.includes('ERROR')) {
              // Remove the event listener to prevent recursion
              event.target.removeEventListener("click", handleSignupSubmit);
          }
      } catch (error) {
          console.error("Error during SingleAddPluto command:", error);
      }
  })();
}