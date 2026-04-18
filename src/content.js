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
  password = "",
  backupCommand = ""
) {
  // Add new parameters
  let writer; // Declare writer outside try block to be accessible in finally
  let reader; // Declare reader outside try block to be accessible in finally
  try {
    writer = port.writable.getWriter();
    reader = port.readable.getReader();

    // focus input field for type commands
    if (action == "typeKeyPluto") {
      const activeInput =
        document.activeElement instanceof HTMLInputElement ? document.activeElement : null;

      const isTypeableActiveInput =
        activeInput &&
        !activeInput.disabled &&
        !activeInput.readOnly &&
        ["text", "email", "password", "search", "tel", "url", ""].includes(
          (activeInput.type || "").toLowerCase()
        );

      const input =
        isTypeableActiveInput
          ? activeInput
          : document.querySelector(
              'input[type="text"], input[type="email"], input[type="password"]'
            ); // fallback if focus is not on an editable input

      if (input) {
        input.focus({ preventScroll: true });
        if (typeof input.select === "function") {
          input.select();
        }
      }
    }

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
    } else if (action === "samePasswordPluto") {
      //password Gen
      command = `passwd --same\n`;
    } else if (action === "x25519GenPluto") {
      // Key exchange and secure end-to-end communication
      command = "x25519_gen\n";
    } else if (action === "getPubKeyPluto") {
      // Get public identity key for authentication
      command = "id_pub\n";
    } else if (action === "signChallengePluto") {
      // Sign challenge payload with identity key.
      command = "id_sign " + domain + "\n";
    } else if (action === "x25519ClearPluto") {
      // Clear X25519 session when message is received and decrypted
      command = "x25519_clear\n";
    } else if (action === "backupPluto") {
      command = `${backupCommand.trim()}\n`;
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
      action === "generatePasswordPluto" ||
      action === "samePasswordPluto" ||
      action === "deleteKeyPluto" ||
      action === "x25519GenPluto" ||
      action === "getPubKeyPluto" ||
      action === "signChallengePluto" ||
      action === "x25519ClearPluto" ||
      action === "backupPluto"
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
      message.password || "", // Pass password
      message.backupCommand || "" // Pass backup command
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
    } else if (message.action === "x25519GenPluto") {
      responseAction = "x25519GenResponse";
    } else if (message.action === "getPubKeyPluto") {
      responseAction = "getPubKeyResponse";
    } else if (message.action === "signChallengePluto") {
      responseAction = "signChallengeResponse";
    } else if (message.action === "x25519ClearPluto") {
      responseAction = "x25519ClearResponse";
    } else if (message.action === "backupPluto") {
      responseAction = "backupResponse";
    } else {
      // For other actions like "typeKeyPluto", if index.js doesn't need a specific data response,
      // we can simply send a success status and return.
      sendResponse({ status: message.action + " OK" });
      return true;
    }

    // Send the response back to the extension popup (index.js)
    const payload = {
      action: responseAction,
      data: result, // Send the result from commandSerial
    };

    if (message.action === "getPubKeyPluto") {
      payload.publicKey = typeof result === "string" ? result.trim() : "";
    } else if (message.action === "signChallengePluto") {
      payload.signatureHex = typeof result === "string" ? result.trim() : "";
    }

    chrome.runtime.sendMessage(payload);

    const directResponse = { status: "OK", data: result };
    if (message.action === "getPubKeyPluto") {
      directResponse.publicKey = typeof result === "string" ? result.trim() : "";
    } else if (message.action === "signChallengePluto") {
      directResponse.signatureHex = typeof result === "string" ? result.trim() : "";
    }
    sendResponse(directResponse); // Send the result back to the popup

    // This return true is important for sendResponse to work asynchronously
    // It signals that you will send a response later.
    return true;
  })(); // End of async IIFE
  return true; // Keep this return true for the main listener to signal async response
});