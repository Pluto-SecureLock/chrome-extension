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

document.getElementById("getBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "getKeyPluto", domain: "gmail"}, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Message failed:", chrome.runtime.lastError.message);
                    } else {
                        console.log("Message sent successfully, response:", response);
    }});
    });
  }); 

  document.getElementById("typeBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "typeKeyPluto", domain: "gmail"}, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Message failed:", chrome.runtime.lastError.message);
                    } else {
                        //items
                        console.log("Message sent successfully, response:", response);
    }});
    });
    window.close(); //need it, otherwise the extension window is focused and the HID inputs are misinterpreted
  }); 

  document.getElementById('openWindow').addEventListener('click', function() {
  chrome.windows.create({
    url: 'window.html',   // This is the standalone page you want to open
    type: 'popup',
    width: 800,
    height: 600
  });
});



chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "showKeysResponse") {
    console.log("Received showKeys data from content script:", message.data);

    
const rawData = message.data.trim().split("\n");
const listLine = rawData.find(line => line.startsWith("[") && line.endsWith("]"));

if (listLine) {
  const keys = JSON.parse(listLine.replace(/'/g, '"')); // Convert Python-style to JSON
  updateKeyList(keys);
} else {
  console.error("No valid key list found in response.");
}




    
  }
});

const searchInput = document.getElementById('searchInput');
const suggestionsList = document.getElementById('suggestions');
let keys = [];  // global keys list


// Listener for showKeysResponse
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
  }
});

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


function updateKeyList(newKeys) {
  keys = newKeys;
  const tableBody = document.getElementById('keyTableBody');
  tableBody.innerHTML = '';

  newKeys.forEach(key => {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.textContent = key;
    row.appendChild(cell);
    tableBody.appendChild(row);
  });
}
