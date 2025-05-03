// let port = null;

// async function autoConnect() {
//   const ports = await navigator.serial.getPorts();
//   if (ports.length > 0) {
//     // Optionally, you could loop over ports if there are multiple and choose one matching criteria.
//     port = ports[0];
//     // Open the port if not already open.
//     if (!port.readable || !port.writable) {
//       await port.open({ baudRate: 9600 });
//     }
//     console.log("Auto-connected to Pluto USB:", port);
//     return true;
//   }
//   return false;
// }

// async function sendCredentials(domain, isFirstTime) {
//   const statusBanner = document.createElement("div");
//   // [Set banner styles…]
//   statusBanner.innerText = "🔍 Sending to Pluto...";
//   document.body.appendChild(statusBanner);

//   try {
//     // If no port, try auto-connecting.
//     if (!port) {
//       const connected = await autoConnect();
//       if (!connected) {
//         statusBanner.innerText = "❌ Pluto not connected. Click the Pluto icon.";
//         return;
//       }
//     }
    
//     const encoder = new TextEncoderStream();
//     const writableStreamClosed = encoder.readable.pipeTo(port.writable);
//     const writer = encoder.writable.getWriter();

//     if (isFirstTime) {
//       console.log("Writing auth key...");
//       await writer.write("auth ALOJHOMORE24\n");
//       console.log("Auth key sent.");
//       statusBanner.innerText = "✅ Pluto authenticated";
//       sessionStorage.setItem(`pluto-sent-${domain}`, "true");
      
//       // Short delay to ensure the device processes the auth command
//       await new Promise(resolve => setTimeout(resolve, 100));
//     }
              
//     statusBanner.innerText = `Sending get ${domain} command…`;
//     await writer.write(`get ${domain}\r\n`);
//     writer.releaseLock();

//     await writableStreamClosed;
    
//     // Option: keep the port open for future use if you don't require closing it here.
//     await port.close(); // Uncomment if you want to close it.
//     port = null;

//     statusBanner.innerText = `✅ Pluto sent credentials for ${domain}`;
//     setTimeout(() => document.body.removeChild(statusBanner), 4000);

//   } catch (err) {
//     console.error("🔌 Failed to send to Pluto device:", err);
//     statusBanner.innerText = "❌ Pluto error: " + err.message;
//     setTimeout(() => document.body.removeChild(statusBanner), 5000);
//   }
// }

// (async () => {
//   const username = document.querySelector('input[autocomplete*="username"]');
//   const password = document.querySelector('input[autocomplete*="current-password"]');
//   if (!(username && password)) return;

//   let domain = window.location.hostname;
//   if (domain === "") {
//       domain = "facebook"; // For localhost, use a different identifier.
//   }
  
//   const isFirstTime = !sessionStorage.getItem(`pluto-sent-${domain}`);

//   // Auto-connect attempt on page load, if possible.
//   await autoConnect();

//   // Listen for manual connection requests (in case auto-connection fails or first-time connection is needed)
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (msg.action === "connectPluto") {
//       console.log("connectPluto message received.");
//       navigator.serial.requestPort().then(async (userPort) => {
//         port = userPort;
//         console.log("Port selected manually:", port);
//         await port.open({ baudRate: 9600 });
//         alert("✅ Pluto USB connected!");

//         // Now send credentials
//         sendCredentials(domain, true);
//       }).catch((e) => {
//         console.error("Error connecting to Pluto:", e);
//         alert("❌ Could not connect to Pluto: " + e.message);
//       });
//     }
//   });
// })();

let port = null;

async function sendCredentials(domain) {
    const statusBanner = document.createElement("div");
    // Set banner styles as before...
    statusBanner.style.position = "fixed";
    statusBanner.style.bottom = "10px";
    statusBanner.style.right = "10px";
    statusBanner.style.padding = "10px 14px";
    statusBanner.style.backgroundColor = "#1a73e8";
    statusBanner.style.color = "white";
    statusBanner.style.borderRadius = "8px";
    statusBanner.style.fontFamily = "Arial, sans-serif";
    statusBanner.style.zIndex = 9999;
    statusBanner.style.boxShadow = "0 0 8px rgba(0,0,0,0.2)";
    statusBanner.innerText = "🔍 Sending to Pluto...";
    document.body.appendChild(statusBanner);

    try {
        if (!port) {
            statusBanner.innerText = "❌ Pluto not connected. Click the Pluto icon.";
            return;
        }

        // Ensure port is open
        if (!port.readable || !port.writable) {
            await port.open({ baudRate: 9600 });
        }

        // Create an encoder stream to write to the device
        const encoder = new TextEncoderStream();
        const writableClosed = encoder.readable.pipeTo(port.writable);
        const writer = encoder.writable.getWriter();

        // Create a decoder stream to read the device response
        const decoder = new TextDecoderStream();
        const readableClosed = port.readable.pipeTo(decoder.writable);
        const reader = decoder.readable.getReader();

        // Request authentication status by sending "auth ?" command
        console.log("Requesting auth status from Pluto...");
        await writer.write("auth ?\n");

        // Wait briefly to give the device time to respond
        await new Promise(resolve => setTimeout(resolve, 100));

        // Read the response from the device (assume single-chunk response)
        const { value } = "True"//await reader.read("\n");
        reader.releaseLock();
        const authResponse = value ? value.trim() : "";
        console.log("Device auth response:", authResponse);

        // If the device is not authenticated, then send the auth key
        if (authResponse === "False") {
            console.log("Device not authenticated. Sending auth key...");
            await writer.write("auth ALOJHOMORE24\n");

            // Optionally, wait for a short delay so the device can process the auth command
            await new Promise(resolve => setTimeout(resolve, 100));
            statusBanner.innerText = "✅ Pluto authenticated";
        } else if (authResponse === "True") {
            statusBanner.innerText = "✅ Pluto already authenticated";
        } else {
            statusBanner.innerText = "❌ Unknown auth response: " + authResponse;
            writer.releaseLock();
            await writableClosed;
            await port.close();
            port = null;
            return;
        }

        // Send the "get" command with the domain
        statusBanner.innerText = `Sending get ${domain} command…`;
        await writer.write(`get ${domain}\r\n`);

        // Release the writer lock and wait for stream closure
        writer.releaseLock();
        await writableClosed;
        
        // Optionally, close the port. If you want to keep it for future use, comment out the next two lines.
        await port.close();
        port = null;

        setTimeout(() => document.body.removeChild(statusBanner), 4000);
    } catch (err) {
        console.error("🔌 Failed to send to Pluto device:", err);
        statusBanner.innerText = "❌ Pluto error: " + err.message;
        setTimeout(() => document.body.removeChild(statusBanner), 5000);
    }
}

async function autoConnect() {
  const ports = await navigator.serial.getPorts();
  if (ports.length > 0) {
    port = ports[0];
    // Open port if not already open
    if (!port.readable || !port.writable) {
      await port.open({ baudRate: 9600 });
    }
    console.log("Auto-connected to Pluto USB:", port);
    return true;
  }
  return false;
}

(async () => {
    const username = document.querySelector('input[autocomplete*="username"]');
    const password = document.querySelector('input[autocomplete*="current-password"]');
    if (!(username && password)) return;

    let domain = window.location.hostname;
    if (domain === "") { 
        // If hostname is empty, assume it's localhost.
        domain = "facebook"; // For localhost, use a different identifier.
    }

    // Attempt auto-connection on page load
    await autoConnect();

    // Listen for manual connection requests (if auto-connect did not work or the device was disconnected)
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === "connectPluto") {
            console.log("connectPluto message received.");
            navigator.serial.requestPort().then(async (userPort) => {
                port = userPort;
                console.log("Port selected manually:", port);
                await port.open({ baudRate: 9600 });
                alert("✅ Pluto USB connected!");

                // Now send credentials after obtaining auth response from the device
                sendCredentials(domain);
            }).catch((e) => {
                console.error("Error connecting to Pluto:", e);
                alert("❌ Could not connect to Pluto: " + e.message);
            });
        }
    });
})();
