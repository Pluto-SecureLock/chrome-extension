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

        // Create a TextEncoderStream to write data to the device
        const encoder = new TextEncoderStream();
        const writableClosed = encoder.readable.pipeTo(port.writable);
        const writer = encoder.writable.getWriter();

        // Send "auth ?" command to the device
        console.log("Requesting auth status from Pluto...");
        await writer.write("auth ?\n");

        // Set up a reader to get the device response
        const decoder = new TextDecoderStream();
        const readableClosed = port.readable.pipeTo(decoder.writable);
        const reader = decoder.readable.getReader();

        // Read one chunk from the device. Assume response comes in a single chunk.
        const { value, done } = await reader.read();
        reader.releaseLock();

        // Check the authentication response
        const authResponse = value ? value.trim() : "";
        console.log("Device auth response:", authResponse);

        if (authResponse === "True") {
            statusBanner.innerText = "✅ Pluto authenticated";
            
            // Optional short delay to ensure the device processes the command
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Send the "get" command with the domain
            statusBanner.innerText = `Sending get ${domain} command…`;
            await writer.write(`get ${domain}\r\n`);
        } else {

            console.log("Writing auth key...");
            await writer.write("auth ALOJHOMORE24\n");
            console.log("Auth key sent.");
            statusBanner.innerText = "✅ Pluto authenticated";
            sessionStorage.setItem(`pluto-sent-${domain}`, "true");
            
            // Short delay to ensure the device processes the auth command
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Release the writer lock and wait for stream closure
        writer.releaseLock();
        await writableClosed;
        // Optionally, keep the port open for auto-reconnection or close it:
        await port.close();
        port = null;

        setTimeout(() => document.body.removeChild(statusBanner), 4000);
    } catch (err) {
        console.error("🔌 Failed to send to Pluto device:", err);
        statusBanner.innerText = "❌ Pluto error: " + err.message;
        setTimeout(() => document.body.removeChild(statusBanner), 5000);
    }
}