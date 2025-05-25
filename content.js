

let openedPort = null;

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

// async function typeSerial(port, domain){
// try {
//         // const port = await navigator.serial.requestPort({
//         //     filters: [{ usbVendorId: 0x239A }] // Optional: specific to your board
//         // });

//         // await port.open({ baudRate: 9600 });

//         // Prepare to send data
//         const encoder = new TextEncoderStream();
//         const writableStreamClosed = encoder.readable.pipeTo(port.writable);
//         const writer = encoder.writable.getWriter();


//         const input = document.querySelector('input[type="text"], input[type="email"], input[type="password"]');
//         if (input) input.focus();

//         await writer.write("type "+domain+ "\n");

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
//         // await port.close();
//     } catch (err) {
//         console.error("Serial error:", err);
//     }
//            }


// async function getSerial(port, domain){
// try {
//         // const port = await navigator.serial.requestPort({
//         //     filters: [{ usbVendorId: 0x239A }] // Optional: specific to your board
//         // });

//         // await port.open({ baudRate: 9600 });

//         // Prepare to send data
//         const encoder = new TextEncoderStream();
//         const writableStreamClosed = encoder.readable.pipeTo(port.writable);
//         const writer = encoder.writable.getWriter();


//         const input = document.querySelector('input[type="text"], input[type="email"], input[type="password"]');
//         if (input) input.focus();

//         await writer.write("get "+domain+ "\n");

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
//         // await port.close();
//     } catch (err) {
//         console.error("Serial error:", err);
//     }
//            }

// async function showKeysSerial(port){
// try {
//         // const port = await navigator.serial.requestPort({
//         //     filters: [{ usbVendorId: 0x239A }] // Optional: specific to your board
//         // });

//         // await port.open({ baudRate: 9600 });

//         // Prepare to send data
//         const encoder = new TextEncoderStream();
//         const writableStreamClosed = encoder.readable.pipeTo(port.writable);
//         const writer = encoder.writable.getWriter();


//         // const input = document.querySelector('input[type="text"], input[type="email"], input[type="password"]');
//         // if (input) input.focus();

//         await writer.write("showkeys \n");

//         // await writer.write("showkeys gmail.com\r\n");
//         writer.releaseLock();

//         // Prepare to read response
//         const decoder = new TextDecoderStream();
//         const readableStreamClosed = port.readable.pipeTo(decoder.writable);
//         const reader = decoder.readable.getReader();

//         let response = "";
//         let temp = 0;
//         while (true) {
//             const { value, done } = await reader.read();
//             if (done) break;
//             if (value) {
//                 response += value;
                
//                 if (value.includes("\n") && temp == 0) {temp = 1}
//                 else if(temp == 1 && value.includes("\n"))
//                     break; // stop after full line received. This has problems since we receive device response first needs modification
//             }
//         }

//         console.log("Device response:", response.trim());

//         reader.releaseLock();
//         await readableStreamClosed;
//         await writableStreamClosed;
//         // await port.close();
//     } catch (err) {
//         console.error("Serial error:", err);
//     }
//            }

// async function typeSerial(port){
// try {
//         // const port = await navigator.serial.requestPort({
//         //     filters: [{ usbVendorId: 0x239A }] // Optional: specific to your board
//         // });

//         // await port.open({ baudRate: 9600 });

//         // Prepare to send data
//         const encoder = new TextEncoderStream();
//         const writableStreamClosed = encoder.readable.pipeTo(port.writable);
//         const writer = encoder.writable.getWriter();


//         const input = document.querySelector('input[type="text"], input[type="email"], input[type="password"]');
//         if (input) input.focus();

//         await writer.write("type gmail.com \n");

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
//         // await port.close();
//     } catch (err) {
//         console.error("Serial error:", err);
//     }
//            }


async function commandSerialStream(port, action, domain = ""){
try {
        // const port = await navigator.serial.requestPort({
        //     filters: [{ usbVendorId: 0x239A }] // Optional: specific to your board
        // });

        // await port.open({ baudRate: 9600 });

        // Prepare to send data
        const encoder = new TextEncoderStream();
        const writableStreamClosed = encoder.readable.pipeTo(port.writable);
        const writer = encoder.writable.getWriter();


        // const input = document.querySelector('input[type="text"], input[type="email"], input[type="password"]');
        // if (input) input.focus();
        if (action == "showKeysPluto"){
            await writer.write("showkeys \n");
        } else if (action == "getKeyPluto")
        {
            await writer.write("get "+domain+"\n");
        } else if (action == "typeKeyPluto"){
            const input = document.querySelector('input[type="text"], input[type="email"], input[type="password"]');
            if (input) input.focus();
            await writer.write("type "+domain+"\n");
        }
        

        // await writer.write("showkeys gmail.com\r\n");
        writer.releaseLock();

        // Prepare to read response
        const decoder = new TextDecoderStream();
        const readableStreamClosed = port.readable.pipeTo(decoder.writable);
        const reader = decoder.readable.getReader();


        let response = "";
        let temp = 0;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
                response += value;
                
                if (value.includes("\n") && temp == 0) {temp = 1}
                else if(temp == 1 && value.includes("\n"))
                    break; // stop after full line received. This has problems since we receive device response first needs modification
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

async function commandSerial(port, action, domain = ""){
try {
        // const port = await navigator.serial.requestPort({
        //     filters: [{ usbVendorId: 0x239A }] // Optional: specific to your board
        // });

        // await port.open({ baudRate: 9600 });

        // Prepare to send data
        const writer = port.writable.getWriter();
        const reader = port.readable.getReader();

        // const input = document.querySelector('input[type="text"], input[type="email"], input[type="password"]');
        // if (input) input.focus();
        let command = "";
        if (action == "showKeysPluto"){
            command = "showkeys \n";
        } else if (action == "getKeyPluto") {
            command = "get " + domain + "\n";
        } else if (action == "typeKeyPluto"){
            const input = document.querySelector('input[type="text"], input[type="email"], input[type="password"]');
            if (input) input.focus();
            command = "type " + domain + "\n";
        }
        

        // await writer.write("showkeys gmail.com\r\n");
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(command));

        // Prepare to read response
        

        let response = "";
        let temp = 0;
        const decoder = new TextDecoder();
        
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
                const text = decoder.decode(value);
                response += text;
                
                if (text.includes("\n") && temp == 0) {
                    temp = 1;
                } else if(temp == 1 && text.includes("\n")) {
                    break;
                }
            }
        }

        console.log("Device response:", response.trim());

        // Release locks
        writer.releaseLock();
        reader.releaseLock();
        // await port.close();
    } catch (err) {
        console.error("Serial error:", err);
    }
           }

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log(message);
    if (message.action === "PlutoInit") { 
        console.log("Received request to pair device");
        await sendResponse({ status: "InitReceived OK" });
        openedPort = await openSerial();
        // await typeSerial(openedPort, message.domain);
        
    }
    else {
        console.log("Received request to "+message.action);
        await sendResponse({ status: message.action+" OK" });
        await commandSerial(openedPort, message.action, message.domain || '');
        // if (message.action == "showKeysPluto"){
        //     await showKeysSerial(openedPort);
        // }
        // else if (message.action == "typeKeyPluto"){
        //     await typeSerial(openedPort, message.domain);
        // }
        // else if (message.action == "getKeyPluto"){
        //     await getSerial(openedPort, message.domain);

        // }
        
    }
});