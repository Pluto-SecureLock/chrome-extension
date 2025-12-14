(function() {
    let _port = null;

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
    password = ""
    ) {
    // Add new parameters
    let writer; // Declare writer outside try block to be accessible in finally
    let reader; // Declare reader outside try block to be accessible in finally
    try {
        writer = port.writable.getWriter();
        reader = port.readable.getReader();

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

        switch (action) {

        case "typeKeyPluto":
            // focus input field for type commands
            const input = document.querySelector(
            'input[type="text"], input[type="email"], input[type="password"]'
            ); // select password field separately for security
            if (input) input.select();
            command = "type " + domain + "\n";
            break

        case "showKeysPluto":
            command = "showkeys \n";
            break;

        case "getKeyPluto":
            command = "get " + domain + "\n";
            break;

        case "typeKeyPluto":
            command = "type " + domain + "\n";
            break;

        case "bulkAddPluto":
            // For bulkAdd, the secrets string is the command itself
            command = "bulkadd " + secrets + "\n";
            break;

        case "singleAddPluto":
            command = "add " + secrets + "\n";
            break;

        case "deleteKeyPluto":
            command = "delete " + domain + "\n";
            break;

        case "updateKeyPluto": {
            // Format: update domain:[username,"password","note"]
            const note = ""; // Assuming note is not part of update for now
            command = `update ${domain}[username:${username},password:"${password}",note:${note}]\n`;
            break;
        }

        case "generatePasswordPluto":
            // password Gen
            command = `passwd len=30,lvl=2\n`;
            break;

        default:
            console.error("Unknown action:", action);
            command = "ERROR: Unknown action";
            break;
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

    // Bridge-API am globalen Namespace bereitstellen
    self.PLUTO = { openSerial, commandSerial, getPort: () => _port, setPort: (p) => { _port = p; } };
})();
