// Global variables for password visibility
let currentPassword = "";
let isPasswordVisible = false;
let isEditMode = false;
let isBulkMode = true;
let isMenuOpen = false;

// Helper function to handle sendMessage responses, ignoring specific errors
function handleSendMessageResponse(response) {
    if (chrome.runtime.lastError) {
        // Ignore "The message port closed before a response was received." error
        if (chrome.runtime.lastError.message === "The message port closed before a response was received.") {
            // console.log("Ignored message port closed error."); // For debugging, you can uncomment this
        } else {
            console.error("Message failed:", chrome.runtime.lastError.message);
        }
    } else {
        console.log("Message sent successfully, response:", response);
    }
}

function textToHex(input) {
  return Array.from(new TextEncoder().encode(input))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function promptForBackupKey() {
  const keyText = window.prompt("Enter your backup key");
  if (keyText === null) {
    return null;
  }

  if (!keyText.trim()) {
    alert("Backup key is required.");
    return null;
  }

  return textToHex(keyText);
}

function parseBackupState(response) {
  const normalized = response.trim();
  if (normalized === "backup_key: True") {
    return true;
  }

  if (normalized === "backup_key: False") {
    return false;
  }

  throw new Error(`Unexpected backup state response: ${normalized}`);
}

function isBackupError(response) {
  return response.startsWith("❌") || response.startsWith("ERROR:");
}

function readBackupFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pluto";

  return new Promise((resolve, reject) => {
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const textContent = (await file.text()).trim();
        if (!textContent) {
          reject(new Error("Selected backup file is empty."));
          return;
        }
        resolve(textContent);
      } catch (error) {
        reject(error);
      }
    }, { once: true });

    input.addEventListener("cancel", () => resolve(null), { once: true });

    input.click();
  });
}

function downloadBackupBlob(backupBlob) {
  const blob = new Blob([backupBlob], { type: "application/x-pluto-backup" });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const filename = `backup-${yyyy}-${mm}-${dd}.pluto`;

  chrome.downloads.download(
    { url, filename, saveAs: true },
    () => {
      URL.revokeObjectURL(url);

      if (chrome.runtime.lastError) {
        console.error("Download error:", chrome.runtime.lastError.message);
        alert(`Create backup failed: ${chrome.runtime.lastError.message}`);
      }
    }
  );
}

function getActiveTabId() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!tabs[0] || typeof tabs[0].id !== "number") {
        reject(new Error("No active tab found."));
        return;
      }

      resolve(tabs[0].id);
    });
  });
}

async function runBackupCommand(command) {
  const tabId = await getActiveTabId();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      reject(new Error("Timed out waiting for backup response."));
    }, 10000);

    function cleanup() {
      clearTimeout(timeoutId);
      chrome.runtime.onMessage.removeListener(listener);
    }

    function listener(message) {
      if (message.action !== "backupResponse") {
        return;
      }

      cleanup();
      resolve((message.data || "").trim());
    }

    chrome.runtime.onMessage.addListener(listener);

    chrome.tabs.sendMessage(
      tabId,
      { action: "backupPluto", backupCommand: command },
      (response) => {
        if (chrome.runtime.lastError) {
          cleanup();
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response && typeof response.data === "string") {
          cleanup();
          resolve(response.data.trim());
        }
      }
    );
  });
}

async function getBackupState() {
  const response = await runBackupCommand("backup --state");
  if (isBackupError(response)) {
    throw new Error(response);
  }

  return parseBackupState(response);
}

async function createBackup() {
  try {
    const hasStoredKey = await getBackupState();
    let command = "backup";

    if (!hasStoredKey) {
      const hexKey = promptForBackupKey();
      if (!hexKey) {
        return;
      }
      command = `backup ${hexKey}`;
    }

    const response = await runBackupCommand(command);
    if (isBackupError(response)) {
      throw new Error(response);
    }

    downloadBackupBlob(response);
  } catch (error) {
    console.error("Error in createBackup:", error);
    alert(`Create backup failed: ${error.message}`);
  }
}

async function loadBackup() {
  try {
    const backupBlob = await readBackupFile();
    if (!backupBlob) {
      return;
    }

    const hasStoredKey = await getBackupState();
    let command = `backup --load ${backupBlob}`;

    if (!hasStoredKey) {
      const hexKey = promptForBackupKey();
      if (!hexKey) {
        return;
      }
      command = `backup --load ${hexKey}:${backupBlob}`;
    }

    const response = await runBackupCommand(command);
    if (isBackupError(response)) {
      throw new Error(response);
    }

    alert(`Backup loaded successfully: ${response}`);
  } catch (error) {
    console.error("Error in loadBackup:", error);
    alert(`Load backup failed: ${error.message}`);
  }
}


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
    // Initialize bulk upload functionality
    initBulkUpload();

    // Initialize dark mode toggle
    initDarkMode();

    // Initialize tab visibility
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            // Deactivate all buttons and hide all content
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.querySelector('svg').classList.add('opacity-60');
            });
            tabContents.forEach(content => {
                content.classList.add('hidden');
            });

            // Activate the clicked button and show its content
            button.classList.add('active');
            button.querySelector('svg').classList.remove('opacity-60');


            document.getElementById(`${targetTab}View`).classList.remove('hidden');
        });
    });

    // Set initial active tab (The Core)
    document.querySelector('.tab-button[data-tab="core"]').click();

    // Ensure credential fields are hidden on load
    document.getElementById("credentialDisplay").classList.add("hidden");
    document.getElementById("clickToRetrieveMessage").classList.remove("hidden");

    // Settings (backup buttons) - view only for now
    const createBackupBtn = document.getElementById("createBackupBtn");
    if (createBackupBtn) {
      createBackupBtn.addEventListener("click", createBackup);
      console.log("Create backup button event listener attached");
    } else {
      console.warn("createBackupBtn not found in DOM");
    }

    const loadBackupBtn = document.getElementById("loadBackupBtn");
    if (loadBackupBtn) {
      loadBackupBtn.addEventListener("click", loadBackup);
      console.log("Load backup button event listener attached");
    } else {
      console.warn("loadBackupBtn not found in DOM");
    }
});

const menuBtn = document.getElementById('menuBtn');
const menuOptionsCard = document.getElementById('menuOptionsCard');
menuBtn.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevent document click from closing it immediately
    if (isEditMode) { // If already in edit mode (upload icon visible)
        // This means the user clicked the upload/save icon
        exitEditModeAndSave();
    } else if (!isMenuOpen) { // If menu is closed, open it
        menuOptionsCard.classList.remove('hidden');
        isMenuOpen = true;
    } else { // If menu is open, close it (if clicking menu button again)
        menuOptionsCard.classList.add('hidden');
        isMenuOpen = false;
    }
});  //NEEDS TO BE CHANGED

const menuIcon = document.getElementById('menuIcon');
const uploadIcon = document.getElementById('uploadIcon');
const modifyOptionBtn = document.getElementById('modifyOptionBtn');
modifyOptionBtn.addEventListener('click', () => {
    menuOptionsCard.classList.add('hidden'); // Hide the options card
    isMenuOpen = false;
    enterEditMode(); // Enter edit mode
});


const deleteIcon = document.getElementById('deleteIcon');
const deleteOptionBtn = document.getElementById('deleteOptionBtn');
deleteOptionBtn.addEventListener('click', () => {
    menuOptionsCard.classList.add('hidden'); // Hide the options card
    isMenuOpen = false;
    confirmAndDelete(); // Handle delete action
});

// Close edit menu if clicked outside
document.addEventListener('click', (event) => {
    if (isMenuOpen && !menuOptionsCard.contains(event.target) && !menuBtn.contains(event.target)) {
        menuOptionsCard.classList.add('hidden');
        isMenuOpen = false;
    }
});

// // Event listener for pairBtn
// document.getElementById("pairBtn").addEventListener("click", () => {
//     chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//       if (!tabs[0]) return;
//       chrome.tabs.sendMessage(tabs[0].id, { action: "PlutoInit" }, handleSendMessageResponse);
//       console.log("Pairing request sent to content script.");
//     });
//   });

function initDarkMode() {
  const toggleBtn = document.getElementById("DarkMode");
  const body = document.body;
  const moon = document.getElementById("moonIcon");
  const sun  = document.getElementById("sunIcon");
  const logo = document.getElementById("plutoLogo");

  const LIGHT_LOGO = "./sources/Asset 3.svg";
  const DARK_LOGO  = "./sources/Asset 4.svg";

  // Load saved theme (if any)
  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    body.classList.add("darkmode");
    logo.src = DARK_LOGO;
    moon.classList.add("hidden");
    sun.classList.remove("hidden");
  }

  toggleBtn.addEventListener("click", () => {
    const dark = body.classList.toggle("darkmode");
    moon.classList.toggle("hidden", dark);
    sun.classList.toggle("hidden", !dark);
    logo.src = dark ? DARK_LOGO : LIGHT_LOGO;
    localStorage.setItem("theme", dark ? "dark" : "light");
  });
}

// Event listener for showKeysBtn
document.getElementById("showKeysBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "showKeysPluto" }, handleSendMessageResponse);
    });
  });

// Event listener for getBtn (This button is now inside credentialDisplay, so it will only be visible after credentials are shown)
document.getElementById("getBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      let domainToSend = document.getElementById("currentSite").textContent;
      chrome.tabs.sendMessage(tabs[0].id, { action: "getKeyPluto", domain: domainToSend}, handleSendMessageResponse);
    });
  });

  // Event listener for typeBtn
document.getElementById("typeBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      let domainToSend = document.getElementById("currentSite").textContent;
      chrome.tabs.sendMessage(tabs[0].id, { action: "typeKeyPluto", domain: domainToSend}, handleSendMessageResponse);
    });
    window.close(); //need it, otherwise the extension window is focused and the HID inputs are misinterpreted
  });

// Event listener for bulkAddBtn (Send Secrets)
document.getElementById("sendSecretsBtn").addEventListener("click", async () => {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return alert("Select a .csv or .txt file first.");

  const text = await file.text();
  console.log("📄 Sending secrets:", text.slice(0, 100) + "...");

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, { action: "bulkAddPluto", secrets: text }, (res) => {
      if (chrome.runtime.lastError) return alert("Error: " + chrome.runtime.lastError.message);
      alert("✅ Secrets sent!");
      document.getElementById("fileInput").value = "";
      document.getElementById("fileInfo").classList.add("hidden");
      document.getElementById("fileName").textContent = "";
      document.getElementById("sendSecretsBtn").disabled = true;
    });
  });
});

// Event listener for “Add Credential” (Single Add)
document.getElementById("AddCredentialBtn").addEventListener("click", () => {
  // 1 ▸ Tomar los valores del formulario
  const host     = document.getElementById("singleHostField").value.trim();
  const username = document.getElementById("singleUsernameField").value.trim();
  const password = document.getElementById("singlePasswordField").value.trim();
  const note     = document.getElementById("singleNotesField").value.trim();

  // (opcional) Validación rápida
  if (!host || !password) {
    alert("Host & Password are mandatory");
    return;
  }

  // 2 ▸ Armar el string en el mismo formato que espera Pluto:
  //     modify example.com[username:...,password:...,note:...]
  const secretsToSend =
    `${host}:${host},${username},"${password}","${note}"`;

  // 3 ▸ Enviar al content-script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;

    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "singleAddPluto", secrets: secretsToSend },
      (response) => { // Using a direct callback here to manage form clearing specifically
        handleSendMessageResponse(response); // Still use the general handler for error checking
        if (!chrome.runtime.lastError || chrome.runtime.lastError.message === "The message port closed before a response was received.") {
            // Clean the form
            ["singleHostField",
             "singleUsernameField",
             "singlePasswordField",
             "singleNotesField"].forEach(id => document.getElementById(id).value = "");
        }
      }
    );
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

// Event listener for Add View
const tabSingleAdd = document.getElementById("tabSingleAdd");
const tabBulkAdd = document.getElementById("tabBulkAdd");
const singleAddBox = document.getElementById("singleAddBox");
const bulkAddBox = document.getElementById("bulkAddBox");

tabSingleAdd.addEventListener("click", () => {
  tabSingleAdd.classList.add("custom-tab-active", "text-rio-blue", "bg-white", "border-b-4", "border-rio-blue");
  tabBulkAdd.classList.remove("custom-tab-active", "text-rio-blue", "bg-white", "border-b-4", "border-rio-blue");
  tabBulkAdd.classList.add("text-gray-500", "bg-gray-100");
  singleAddBox.classList.remove("hidden");
  bulkAddBox.classList.add("hidden");
});

tabBulkAdd.addEventListener("click", () => {
  tabBulkAdd.classList.add("custom-tab-active", "text-rio-blue", "bg-white", "border-b-4", "border-rio-blue");
  tabSingleAdd.classList.remove("custom-tab-active", "text-rio-blue", "bg-white", "border-b-4", "border-rio-blue");
  tabSingleAdd.classList.add("text-gray-500", "bg-gray-100");
  bulkAddBox.classList.remove("hidden");
  singleAddBox.classList.add("hidden");
});

// Event listener for current-mission-card click
document.getElementById("currentMissionClickableArea").addEventListener("click", (event) => {
    // Only trigger if not in edit mode, not clicking modifyBtn/typeBtn, AND credentials are not yet shown
    if (!isEditMode && !event.target.closest('#modifyBtn') && !event.target.closest('#typeBtn') && document.getElementById("credentialDisplay").classList.contains("hidden")) {
        const domainToSend = document.getElementById("currentSite").textContent;
        if (domainToSend && domainToSend !== "Loading..." && domainToSend !== "N/A" && domainToSend !== "No active tab") {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs[0]) return;
                chrome.tabs.sendMessage(tabs[0].id, { action: "getKeyPluto", domain: domainToSend }, handleSendMessageResponse);
            });
        } else {
            console.log("Cannot retrieve credentials: Invalid domain or domain not loaded.");
        }
    } else if (!document.getElementById("credentialDisplay").classList.contains("hidden")) {
        // Optionally, add a log here if you want to know when a click is prevented
        console.log("Click on current-mission-card prevented because credentials are already displayed.");
    }
});

///////////////////////////////////////////////////
// Message listener from content script
///////////////////////////////////////////////////
// Consolidated chrome.runtime.onMessage.addListener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "showKeysResponse") {
    console.log("Received showKeys data from content script:", message.data);

    const rawData = message.data.trim().split("\n");
    const listLine = rawData.find(line => line.startsWith("[") && line.endsWith("]"));

    if (listLine) {
      keys = JSON.parse(listLine.replace(/'/g, '"'));  // Update global keys
      updateKeyList(keys);
      document.getElementById("showKeysBtn").classList.add('hidden');
    } else {
      console.error("No valid key list found in response.");
    }
  } else if (message.action === "bulkAddResponse") { // New action to handle bulkAdd response
        const rawData = message.data.trim().split("\n");
        console.log("Received Bulkadd response from content script:", rawData);
  } else if (message.action === "backupResponse") {
        console.log("Received backup response from content script:", message.data);
  } else if (message.action === "getKeyResponse") { // New action to handle getBtn response
        console.log("Received getKey data from content script:", message.data);

        // Hide the "Click to retrieve" message and show the credential fields
        document.getElementById("clickToRetrieveMessage").classList.add("hidden");
        document.getElementById("credentialDisplay").classList.remove("hidden");

        const dataString = message.data.trim();
        // Expected format: "domain: {'username': '...', 'password': '...'}"
        const colonIndex = dataString.indexOf(':');
        if (colonIndex !== -1) {
            let jsonPart = dataString.substring(colonIndex + 1).trim(); // This is the original jsonPart with potential trailing chars

            // --- START OF NEW CODE FOR JSON PARSING FIX ---
            const firstBraceIndex = jsonPart.indexOf('{');
            const lastBraceIndex = jsonPart.lastIndexOf('}');

            if (firstBraceIndex !== -1 && lastBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
                // Extract only the part that looks like a complete JSON object
                jsonPart = jsonPart.substring(firstBraceIndex, lastBraceIndex + 1);
            } else {
                // If a valid JSON object structure isn't found, log an error and
                // allow the JSON.parse to fail gracefully in the catch block.
                console.error("No complete JSON object structure found in the received data part:", jsonPart);
                // Keep jsonPart as is, so the next JSON.parse will likely throw an error which is caught.
            }

            try {
                // Replace single quotes with double quotes for valid JSON parsing
                jsonPart = jsonPart.replace(/'/g, '"');

                // Specific fix for ""value"" becoming "value" for string properties that might be malformed
                // This regex targets properties where the value is enclosed in double-double quotes, e.g., "key": ""value""
                // and transforms it to "key": "value"
                jsonPart = jsonPart.replace(/: ""([^\"]*)\""/g, ': "$1"');

                const keyData = JSON.parse(jsonPart); // This is line 350.

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
            console.error("getKeyResponse data format invalid: No colon found separating domain and JSON.", dataString);
            document.getElementById("usernameField").textContent = "N/A";
            document.getElementById("passwordField").textContent = "N/A";
        }
    }
    else if (message.action === "updateKeyResponse") {
        const rawData = message.data.trim().split("\n");
        console.log("Received updateKey response from content script:", rawData);
        // You might want to update the UI further or just confirm success
    }
    else {
        console.warn("Received action from content script:", message.action);
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
    cardDiv.className = 'bg-white p-3 rounded-md shadow-sm border border-light-gray flex items-center justify-between hover:bg-gray-200 transition-colors duration-200';
    cardDiv.dataset.domain = key; // Store the domain on the card

    cardDiv.innerHTML = `
        <div class="flex items-center">
            <div class="w-7 h-7 rounded-full bg-rio-blue flex items-center justify-center mr-3 flex-shrink-0">
                <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#FFFF" viewBox="0 0 24 24">
                <path fill-rule="evenodd" d="M12 20a7.966 7.966 0 0 1-5.002-1.756l.002.001v-.683c0-1.794 1.492-3.25 3.333-3.25h3.334c1.84 0 3.333 1.456 3.333 3.25v.683A7.966 7.966 0 0 1 12 20ZM2 12C2 6.477 6.477 2 12 2s10 4.477 10 10c0 5.5-4.44 9.963-9.932 10h-.138C6.438 21.962 2 17.5 2 12Zm10-5c-1.84 0-3.333 1.455-3.333 3.25S10.159 13.5 12 13.5c1.84 0 3.333-1.455 3.333-3.25S13.841 7 12 7Z" clip-rule="evenodd"/>
                </svg>

            </div>
            <div>
                <p class="text-sm font-semibold text-eerie-black">${key}</p>
                <p class="text-xs text-gray-600">${key}</p>
            </div>
        </div>
        <button class="type-button text-gray-500 hover:scale-110 transition-transform duration-200">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
        </button>
    `;
    keyCardsContainer.appendChild(cardDiv);

    // Event listener for the card itself (to display in current mission)
    cardDiv.addEventListener('click', (event) => {
        const clickedDomain = event.currentTarget.dataset.domain;
        document.getElementById("currentSite").textContent = clickedDomain;

        // Trigger getKeyPluto to populate username/password fields for the clicked domain
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            chrome.tabs.sendMessage(tabs[0].id, { action: "getKeyPluto", domain: clickedDomain }, handleSendMessageResponse);
        });
    });

    // Event listener for the copy button (typekey action)
    const copyButton = cardDiv.querySelector('.type-button');
    copyButton.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent the card's click event from firing
        const domainToType = event.currentTarget.closest('[data-domain]').dataset.domain;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            chrome.tabs.sendMessage(tabs[0].id, { action: "typeKeyPluto", domain: domainToType }, handleSendMessageResponse);
        });
        window.close(); // Close the extension window after typing
    });
  });
}

function enterEditMode() {
    isEditMode = true;
    menuIcon.classList.add("hidden");
    deleteIcon.classList.add("hidden"); // Ensure delete icon is hidden
    uploadIcon.classList.remove("hidden"); // Show upload icon

    const usernameField = document.getElementById("usernameField");
    const passwordField = document.getElementById("passwordField");

    usernameField.contentEditable = "true";
    passwordField.contentEditable = "true";

    // Show actual password for editing
    if (!isPasswordVisible) {
        passwordField.textContent = currentPassword;
    }

    usernameField.classList.add("border", "border-mindaro", "rounded", "px-1");
    passwordField.classList.add("border", "border-mindaro", "rounded", "px-1");

    usernameField.focus();
}

function exitEditModeAndSave() {
    isEditMode = false;
    menuIcon.classList.remove("hidden");
    uploadIcon.classList.add("hidden");
    deleteIcon.classList.add("hidden"); // Ensure delete icon is hidden after saving

    const usernameField = document.getElementById("usernameField");
    const passwordField = document.getElementById("passwordField");
    const currentDomain = document.getElementById("currentSite").textContent;

    usernameField.contentEditable = "false";
    passwordField.contentEditable = "false";

    usernameField.classList.remove("border", "border-mindaro", "rounded", "px-1");
    passwordField.classList.remove("border", "border-mindaro", "rounded", "px-1");

    const newUsername = usernameField.textContent.trim();
    const newPassword = passwordField.textContent.trim();

    if (!isPasswordVisible) {
        passwordField.textContent = "••••••••••••";
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        chrome.tabs.sendMessage(tabs[0].id, {
            action: "updateKeyPluto",
            domain: currentDomain,
            username: newUsername,
            password: newPassword
        }, handleSendMessageResponse);
    });
}

function confirmAndDelete() {
    const currentDomain = document.getElementById("currentSite").textContent;
    if (confirm(`Are you sure you want to delete credentials for ${currentDomain}?`)) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "deleteKeyPluto", // NEW action for content script
                domain: currentDomain
            }, (response) => {
                handleSendMessageResponse(response);
                // After deletion, clear the displayed credentials
                document.getElementById("usernameField").textContent = "N/A";
                document.getElementById("passwordField").textContent = "••••••••••••";
                currentPassword = "";
                document.getElementById("credentialDisplay").classList.add("hidden");
                document.getElementById("clickToRetrieveMessage").classList.remove("hidden");
                // Optionally, reset the icon to menuIcon after deletion.
                menuIcon.classList.remove("hidden");
                uploadIcon.classList.add("hidden");
                deleteIcon.classList.add("hidden");
            });
        });
    }
}

// === Bulk Upload Setup ===
function initBulkUpload() {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const fileInfo  = document.getElementById("fileInfo");
  const fileName  = document.getElementById("fileName");
  const uploadBtn = document.getElementById("sendSecretsBtn");

  const handleFile = (file) => {
    fileName.textContent = file.name;
    fileInfo.classList.remove("hidden");
    uploadBtn.disabled = false;
  };

  // Click → open file picker
  dropZone.addEventListener("click", () => fileInput.click());

  // Input selection
  fileInput.addEventListener("change", e => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });

  // Drag & drop visuals
  ["dragover", "dragleave", "drop"].forEach(ev =>
    dropZone.addEventListener(ev, e => e.preventDefault())
  );

  dropZone.addEventListener("dragover", () =>
    dropZone.classList.add("border-rio-blue", "bg-blue-50")
  );

  ["dragleave", "drop"].forEach(ev =>
    dropZone.addEventListener(ev, () =>
      dropZone.classList.remove("border-rio-blue", "bg-blue-50")
    )
  );

  // Drop handler
  dropZone.addEventListener("drop", e => {
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!/(\.csv|\.txt)$/i.test(file.name))
      return alert("Please upload a .csv or .txt file");
    handleFile(file);
  });
}
