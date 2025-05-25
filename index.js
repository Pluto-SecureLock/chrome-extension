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
document.getElementById("pairBtn").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "PlutoInit" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Message failed:", chrome.runtime.lastError.message);
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
                        console.error("Message failed:", chrome.runtime.lastError.message);
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
                        console.log("Message sent successfully, response:", response);
    }});
    });
    window.close(); //need it, otherwise the extension window is focused and the HID inputs are misinterpreted
  }); 