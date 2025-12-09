export async function openSerial() { //background.js
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
export async function commandSerial( //background.js
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

