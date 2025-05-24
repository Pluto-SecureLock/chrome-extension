// document.getElementById("pairBtn").addEventListener("click", async function () {
//     try {
//         const port = await navigator.serial.requestPort({
//             filters: [{ usbVendorId: 0x239A }] // Optional: specific to your board
//         });

//         await port.open({ baudRate: 9600 });

//         // Prepare to send data
//         const encoder = new TextEncoderStream();
//         const writableStreamClosed = encoder.readable.pipeTo(port.writable);
//         const writer = encoder.writable.getWriter();


//         const input = document.querySelector('input[type="text"], input[type="email"], input[type="password"]');
//         if (input) input.focus();

//         await writer.write("get gmail.com\n");

//         // await writer.write("showkeys gmail.com\r\n");
//         writer.releaseLock();

//         // Prepare to read response
//         const decoder = new TextDecoderStream();
//         const readableStreamClosed = port.readable.pipeTo(decoder.writable);
//         const reader = decoder.readable.getReader();

//         let response = "";
//         while (true) {
//             const { value, done } = await reader.read();
//             if (done) break;
//             if (value) {
//                 response += value;
//                 if (value.includes("\n")) break; // stop after full line received
//             }
//         }

//         console.log("Device response:", response.trim());

//         reader.releaseLock();
//         await readableStreamClosed;
//         await writableStreamClosed;
//         await port.close();
//     } catch (err) {
//         console.error("Serial error:", err);
//     }
// });

async function openSerial(){
try {
        const port = await navigator.serial.requestPort({
            filters: [{ usbVendorId: 0x239A }] // Optional: specific to your board
        });

        await port.open({ baudRate: 9600 });

        return port;
        // await port.close();
    } catch (err) {
        console.error("Serial error:", err);
    }
           }

async function communicateSerial(port){
try {
        // const port = await navigator.serial.requestPort({
        //     filters: [{ usbVendorId: 0x239A }] // Optional: specific to your board
        // });

        // await port.open({ baudRate: 9600 });

        // Prepare to send data
        const encoder = new TextEncoderStream();
        const writableStreamClosed = encoder.readable.pipeTo(port.writable);
        const writer = encoder.writable.getWriter();


        const input = document.querySelector('input[type="text"], input[type="email"], input[type="password"]');
        if (input) input.focus();

        await writer.write("type gmail.com \n");

        // await writer.write("showkeys gmail.com\r\n");
        writer.releaseLock();

        // Prepare to read response
        const decoder = new TextDecoderStream();
        const readableStreamClosed = port.readable.pipeTo(decoder.writable);
        const reader = decoder.readable.getReader();

        let response = "";
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
                response += value;
                if (value.includes("\n")) break; // stop after full line received
            }
        }

        console.log("Device response:", response.trim());

        reader.releaseLock();
        await readableStreamClosed;
        await writableStreamClosed;
        // await port.close();
    } catch (err) {
        console.error("Serial error:", err);
    }
           }

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log(message);
    if (message.action === "PlutoInit") {
        console.log("Received request to pair device");
        sendResponse({ status: "InitReceived OK" });
        const openedPort = await openSerial();
       await communicateSerial(openedPort);
        
    }
});