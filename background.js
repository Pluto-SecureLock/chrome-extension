
// Listen for messages from the extension popup (index.js)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => { //background.js
  (async () => {
    try {
      let port = self.PLUTO.getPort();
      if (!port) {

        port = await self.PLUTO.openSerial();
        self.PLUTO.setPort(port);
      }
      const result = await self.PLUTO.commandSerial(port, message.action, message.domain || "", message.secrets || "", message.username || "", message.password || "");
      sendResponse({ status: "OK", data: result });
    } catch (e) {
      sendResponse({ status: "ERROR: Could not open serial port.", message: e.message });
    }

    // Pass message.secrets, message.username, message.password to commandSerial
    const result = await self.PLUTO.commandSerial(
      openedPort,
      message.action,
      message.domain || "",
      message.secrets || "",
      message.username || "", // Pass username
      message.password || "" // Pass password
    );

    // Dynamically determine the response action based on the original message action
    let responseAction;

    switch (message.action) {
    case "showKeysPluto":
        responseAction = "showKeysResponse";
        break;
    case "getKeyPluto":
        responseAction = "getKeyResponse";
        break;
    case "bulkAddPluto":
        responseAction = "bulkAddResponse"; // New action for bulkAdd
        break;
    case "updateKeyPluto":
        responseAction = "updateKeyResponse";
        break;
    case "singleAddPluto":
        responseAction = "singleAddResponse";
        break;
    case "deleteKeyPluto":
        responseAction = "deleteKeyResponse";
        break;
    default:
        // Für andere Aktionen wie "typeKeyPluto"
        // Falls index.js keine spezifische Datenantwort braucht, senden wir einfach OK
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

