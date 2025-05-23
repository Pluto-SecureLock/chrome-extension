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


document.getElementById("pairBtn").addEventListener("click", async function () {
    try {
        const port = await navigator.serial.requestPort({
            filters: [{ usbVendorId: 0x239A }] // Optional: specific to your board
        });

        await port.open({ baudRate: 9600 });

        // Prepare to send data
        const encoder = new TextEncoderStream();
        const writableStreamClosed = encoder.readable.pipeTo(port.writable);
        const writer = encoder.writable.getWriter();

        const input = document.querySelector('input[type="text"], input[type="email"], input[type="password"]');
        if (input) input.focus();

        await writer.write("type gmail.com\n");

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
        await port.close();
    } catch (err) {
        console.error("Serial error:", err);
    }
});