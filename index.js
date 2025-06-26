// document.getElementById("pairBtn").addEventListener("click", ()=> navigator.usb.requestDevice({ filters: [] }) //potentially need to change if we swap to a different MC
// { vendorId: 0x239A }

// .then(device => {
//   console.log('Selected device:', device); //remove 
//   device.open().then(()=>{
//     console.log(navigator.usb.getDevices());
//     let endPoint = device.configuration.interfaces[0].alternates[0].endpoints[0].endpointNumber;
//   console.log(endPoint); //our device endpoint

//   device.selectConfiguration(1).then(()=>{
//     device.configuration.interfaces.forEach(iface => {
//         console.log(`Interface ${iface.interfaceNumber}:`);
//         iface.alternates.forEach(alt => {
//           console.log(`  Alternate ${alt.alternateSetting}`);
//           alt.endpoints.forEach(endpoint => {
//             console.log(`    Endpoint ${endpoint.endpointNumber} - ${endpoint.direction}`);
//           });
//         });
//       });
//     device.claimInterface(2).then(()=>{
//         device.transferOut(endPoint, new ArrayBuffer('test123')).then(result => {
//             console.log("Transfer result:", result);
//           });
//     });
  
//   });
  
//   }

//   )
  


// })
// .catch(error => {
//   console.error('Device selection failed:', error); //remove
// }));

//^WebUSB implementation

//v Serial API implementation
// document.getElementById("pairBtn").addEventListener("click", () => {
//     try {
//         chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//             if (!tabs[0]) return; // if theres no active tab exit
            
//             // Try to inject content script first, then send message
//             chrome.scripting.executeScript({
//                 target: { tabId: tabs[0].id },
//                 files: ['content.js']
//             }, () => {
//                 chrome.tabs.sendMessage(tabs[0].id, { action: "PlutoInit" }, (response) => {
//                     if (chrome.runtime.lastError) {
//                         console.error("Message failed:", chrome.runtime.lastError.message);
//                     } else {
//                         console.log("Message sent successfully, response:", response);
//                     }
//                 });
//             });
//         });
//     } catch (err) {
//         console.error("Error connecting:", err);
//     }



// });



chrome.storage.local.get("plutonConnected", (result) => {
  if (result.plutonConnected) {
    console.log("inside ")
    navigator.serial.getPorts().then(ports => {
      console.log(ports)
  if (ports.length > 0) {
    console.log("again inside")
    // Still paired
    document.querySelector(".InitBox").classList.add("hidden");
                        document.querySelectorAll(".ActiveBox").forEach(el => {
  el.classList.remove("hidden");
});
const body = document.querySelector("body");
body.classList.remove("min-h-[280px]", "w-[360px]");
body.classList.add("h-[600px]", "w-[400px]");
    
  } else {
    chrome.storage.local.set({ plutonConnected: false });
  }
});

  }
});


document.getElementById("pairBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "PlutoInit" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log("Message failed:", chrome.runtime.lastError.message);
                    } else {
                        console.log("Message sent successfully, response:", response);
                        chrome.storage.local.set({ plutonConnected: true }, () => {
          // Update the UI immediately
          document.querySelector(".InitBox").classList.add("hidden");
          document.querySelectorAll(".ActiveBox").forEach(el => {
            el.classList.remove("hidden");
          });

          const body = document.querySelector("body");
          body.classList.remove("min-h-[280px]", "w-[360px]");
          body.classList.add("h-[600px]", "w-[400px]");
        });
                        

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
      chrome.tabs.sendMessage(tabs[0].id, { action: "getKeyPluto", domain: "gmail.com"}, (response) => {
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
      chrome.tabs.sendMessage(tabs[0].id, { action: "typeKeyPluto", domain: "gmail.com"}, (response) => {
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
