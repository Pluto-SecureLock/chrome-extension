// Global variables for password visibility
let currentPassword = "";
let isPasswordVisible = false;
let isEditMode = false;

// Populate currentMission with the current website hostname on load
document.addEventListener("DOMContentLoaded", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url) {
            try {
                const url = new URL(tabs[0].url);
                let displayHostname = url.hostname;

                // Check for the specific file URL to display example.com
                if (url.protocol === 'file:' && url.pathname.includes('/pluto-secure/shared-library/login.html')) {
                    displayHostname = "example.com";
                }

                document.getElementById("currentSite").textContent = displayHostname;
            } catch (e) {
                console.error("Invalid URL:", tabs[0].url, e);
                document.getElementById("currentSite").textContent = "N/A";
            }
        } else {
            document.getElementById("currentSite").textContent = "No active tab";
        }
    });

    // Initialize tab visibility
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            // Deactivate all buttons and hide all content
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.querySelector('span').classList.remove('text-mindaro');
                btn.querySelector('span').classList.add('text-gray-subtle');
                if (btn.querySelector('svg path')) { // For SVGs with paths
                  btn.querySelector('svg path').setAttribute('fill', 'none');
                  btn.querySelector('svg path').setAttribute('stroke', 'currentColor');
                }
                btn.querySelector('svg').classList.remove('text-mindaro');
                btn.querySelector('svg').classList.add('opacity-60');
            });
            tabContents.forEach(content => {
                content.classList.add('hidden');
            });

            // Activate the clicked button and show its content
            button.classList.add('active');
            button.querySelector('span').classList.remove('text-gray-subtle');
            button.querySelector('span').classList.add('text-mindaro');
            if (button.querySelector('svg path')) { // For SVGs with paths
                button.querySelector('svg path').setAttribute('fill', 'currentColor');
                button.querySelector('svg path').removeAttribute('stroke');
            }
            if (button.querySelector('svg image')) { // For SVGs with image href
                button.querySelector('svg image').setAttribute('href', button.querySelector('svg image').getAttribute('href').replace('_inactive.png', '.png')); // Placeholder for active image
            }
            button.querySelector('svg').classList.remove('opacity-60');
            button.querySelector('svg').classList.add('text-mindaro');


            document.getElementById(`${targetTab}View`).classList.remove('hidden');
        });
    });

    // Set initial active tab (The Core)
    document.querySelector('.tab-button[data-tab="core"]').click();
});

// Event listener for pairBtn
document.getElementById("pairBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "PlutoInit" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log("Message failed:", chrome.runtime.lastError.message);
                    } else {
                        console.log("Message sent successfully, response:", response);
    }});
    });
  });
  
// Event listener for showKeysBtn
document.getElementById("showKeysBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "showKeysPluto" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log("Message failed:", chrome.runtime.lastError.message);
                    } else {
                        console.log("Message sent successfully, response:", response);
    }}); 
    });
  }); 

// Event listener for getBtn
document.getElementById("getBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      let domainToSend = document.getElementById("currentSite").textContent;
      if (domainToSend === "N/A" || domainToSend === "No active tab" || !domainToSend) {
        domainToSend = "gmail.com"; // Fallback to gmail.com as requested
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: "getKeyPluto", domain: domainToSend}, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Message failed:", chrome.runtime.lastError.message);
                    } else {
                        console.log("Message sent successfully, response:", response);
    }});
    });
  }); 

  // Event listener for typeBtn
document.getElementById("typeBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      let domainToSend = document.getElementById("currentSite").textContent;
      if (domainToSend === "N/A" || domainToSend === "No active tab" || !domainToSend) {
        domainToSend = "gmail.com"; // Fallback to gmail.com as requested
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: "typeKeyPluto", domain: domainToSend}, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Message failed:", chrome.runtime.lastError.message);
                    } else {
                        console.log("Message sent successfully, response:", response);
    }});
    });
    window.close(); //need it, otherwise the extension window is focused and the HID inputs are misinterpreted
  });

// Event listener for sendSecretsBtn (Modified)
document.getElementById("sendSecretsBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const secretsToSend = document.getElementById("bulkSecretsTextarea").value; // Get the value
      chrome.tabs.sendMessage(tabs[0].id, { action: "bulkAddPluto", secrets: secretsToSend }, (response) => { // Send it in the message
                    if (chrome.runtime.lastError) {
                        console.log("Message failed:", chrome.runtime.lastError.message);
                    } else {
                        console.log("Message sent successfully, response:", response);
                        // Optionally provide feedback to the user, e.g., clear the textarea
                        document.getElementById("bulkSecretsTextarea").value = ''; // Clear textarea on success
                    }
    });
    });
  });
// Event listener for openWindow
document.getElementById('openWindow').addEventListener('click', function() {
  chrome.windows.create({
    url: 'window.html',   // This is the standalone page you want to open
    type: 'popup',
    width: 800,
    height: 600
  });
});

// Event listener for viewPasswordBtn
document.getElementById("viewPasswordBtn").addEventListener("click", () => {
    const passwordField = document.getElementById("passwordField");
    if (isPasswordVisible) {
        passwordField.textContent = "••••••••••••";
        // You can also change the SVG icon here to an 'eye-closed' icon
    } else {
        passwordField.textContent = currentPassword;
        // You can also change the SVG icon here to an 'eye-open' icon
    }
    isPasswordVisible = !isPasswordVisible;
});

// NEW: Event listener for modifyBtn
document.getElementById("modifyBtn").addEventListener("click", () => {
    const usernameField = document.getElementById("usernameField");
    const passwordField = document.getElementById("passwordField");
    const modifyIcon = document.getElementById("modifyIcon");
    const uploadIcon = document.getElementById("uploadIcon");
    const currentDomain = document.getElementById("currentSite").textContent;

    if (!isEditMode) {
        // Enter Edit Mode
        isEditMode = true;
        modifyIcon.classList.add("hidden");
        uploadIcon.classList.remove("hidden");

        usernameField.contentEditable = "true";
        passwordField.contentEditable = "true";
        
        // Show actual password for editing
        if (!isPasswordVisible) {
            passwordField.textContent = currentPassword;
            // Optionally, toggle the viewPasswordBtn icon to 'open eye' if it's not already
        }
        
        // Add a visual cue for editable fields TODO: looks bad, fix it
        usernameField.classList.add("border", "border-mindaro", "rounded", "px-1");
        passwordField.classList.add("border", "border-mindaro", "rounded", "px-1");

        // Focus on username field
        usernameField.focus();

    } else {
        // Exit Edit Mode and Save Changes
        isEditMode = false;
        modifyIcon.classList.remove("hidden");
        uploadIcon.classList.add("hidden");

        usernameField.contentEditable = "false";
        passwordField.contentEditable = "false";

        // Hide actual password if it was not visible before entering edit mode
        if (!isPasswordVisible) {
            passwordField.textContent = "••••••••••••";
        }
        
        // Remove visual cue
        usernameField.classList.remove("border", "border-mindaro", "rounded", "px-1");
        passwordField.classList.remove("border", "border-mindaro", "rounded", "px-1");


        const newUsername = usernameField.textContent.trim();
        const newPassword = passwordField.textContent.trim();

        // Send update command to device
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            chrome.tabs.sendMessage(tabs[0].id, { 
                action: "updateKeyPluto", 
                domain: currentDomain, // The current domain
                username: newUsername,
                password: newPassword
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log("Update message failed:", chrome.runtime.lastError.message);
                } else {
                    console.log("Update message sent successfully, response:", response);
                    // Update currentPassword in case it was changed
                    currentPassword = newPassword; 
                }
            });
        });
    }
});

// Consolidated chrome.runtime.onMessage.addListener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "showKeysResponse") {
    console.log("Received showKeys data from content script:", message.data);

    const rawData = message.data.trim().split("\n");
    const listLine = rawData.find(line => line.startsWith("[") && line.endsWith("]"));

    if (listLine) {
      keys = JSON.parse(listLine.replace(/'/g, '"'));  // Update global keys
      updateKeyList(keys);
    } else {
      console.error("No valid key list found in response.");
    }
  } else if (message.action === "bulkAddResponse") { // New action to handle bulkAdd response
    console.log("Received bulkAdd response from content script:", message.data);
  } else if (message.action === "getKeyResponse") { // New action to handle getBtn response
        console.log("Received getKey data from content script:", message.data);

        const dataString = message.data.trim();
        // Expected format: "domain: {'username': '...', 'password': '...'}"
        const colonIndex = dataString.indexOf(':');
        if (colonIndex !== -1) {
            let jsonPart = dataString.substring(colonIndex + 1).trim();
            try {
                // Replace single quotes with double quotes for valid JSON parsing
                jsonPart = jsonPart.replace(/'/g, '"');

                // Specific fix for ""value"" becoming "value" for string properties that might be malformed
                // This regex targets properties where the value is enclosed in double-double quotes, e.g., "key": ""value""
                // and transforms it to "key": "value"
                jsonPart = jsonPart.replace(/: ""([^\"]*)\""/g, ': "$1"');

                const keyData = JSON.parse(jsonPart);

                // Populate fields
                document.getElementById("usernameField").textContent = keyData.username || "N/A";
                currentPassword = keyData.password || ""; // Store actual password
                document.getElementById("passwordField").textContent = "••••••••••••"; // Display hidden initially
                isPasswordVisible = false; // Reset visibility state

            } catch (e) {
                console.error("Error parsing getKeyResponse data:", e, jsonPart);
                document.getElementById("usernameField").textContent = "Error";
                document.getElementById("passwordField").textContent = "Error";
            }
        } else {
            console.error("getKeyResponse data format invalid:", dataString);
            document.getElementById("usernameField").textContent = "N/A";
            document.getElementById("passwordField").textContent = "N/A";
        }
    }
    else if (message.action === "updateKeyResponse") {
        console.log("Received updateKey response from content script:", message.data);
        // You might want to update the UI further or just confirm success
    }
});

const searchInput = document.getElementById('searchInput');
const suggestionsList = document.getElementById('suggestions');
let keys = [];  // global keys list


searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  suggestionsList.innerHTML = '';

  if (query === '') return; // No query, no suggestions

  const filtered = keys.filter(item => item.toLowerCase().includes(query));

  filtered.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    suggestionsList.appendChild(li);
  });
});


/**
 * Updates the list of displayed keys in a card-based format.
 * Each key from the newKeys array will be rendered as a separate card.
 * @param {Array<string>} newKeys - An array of strings, where each string is a key to display.
 */
function updateKeyList(newKeys) {
  keys = newKeys; // Update the global keys list
  const keyCardsContainer = document.getElementById('keyCardsContainer');
  keyCardsContainer.innerHTML = ''; // Clear existing cards

  newKeys.forEach(key => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'bg-white p-3 rounded-md shadow-sm border border-light-gray flex items-center justify-between hover:bg-gray-50 transition-colors duration-200';
    cardDiv.innerHTML = `
        <div class="flex items-center">
            <div class="w-7 h-7 rounded-full bg-rio-blue flex items-center justify-center mr-3 flex-shrink-0">
                <!-- Lock icon for security -->
                <svg class="h-4 w-4 text-mindaro" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 2a4 4 0 00-4 4v2H5a2 2 0 00-2 2v8a2 2 0 002 2h10a2 2 0 002-2v-8a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm-4 4a4 4 0 018 0v2H6V6z" clip-rule="evenodd"></path></svg>
            </div>
            <div>
                <!-- Display the key as the main title -->
                <p class="text-sm font-semibold text-eerie-black">${key}</p>
                <!-- Using key as a placeholder for a 'username' or secondary info -->
                <p class="text-xs text-gray-600">${key}</p>
            </div>
        </div>
        <!-- Button to copy the key (or perform another action) -->
        <button class="text-gray-500 hover:text-mindaro">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
        </button>
    `;
    keyCardsContainer.appendChild(cardDiv);
  });
}
