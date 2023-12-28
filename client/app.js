var readline = require('readline')
var readlineSync = require('readline-sync')
var grpc = require("@grpc/grpc-js")
var protoLoader = require("@grpc/proto-loader")
var PROTO_PATH = __dirname + "/../protos/smarthome.proto"
var packageDefinition = protoLoader.loadSync(PROTO_PATH, {enums: String})

var smarthome_proto = grpc.loadPackageDefinition(packageDefinition).smarthome

var client = new smarthome_proto.RegistryService("0.0.0.0:40000", grpc.credentials.createInsecure());

var name = "Thermostat";
var id = -1;
var currentTemp = 21.5;
var targetTemp = 19;
var requestingHeat = false;
var status_call

// calling registerDevice RPC function to get my device ID from the server
client.registerDevice({name: name, device: "DEVICE_THERMOSTAT"}, function(error, response) {
    try {
        console.log(error, response)
        if (response.message) {
            console.log(response.message)
        } else {
            console.log("My new name: " + response.newName + ", id: " + response.id)
            name = response.newName
            id = response.id
            status_call = client.deviceStatus()

            status_call.on("error", function(e) {
                console.log("Error occured: " + e)
            });

            status_call.on("data", function(response) {
                console.log(response)
            });

            // update status of requestingHeat
            requestingHeat = currentTemp < targetTemp;
            status_call.write({
                deviceId: id,
                deviceName: name,
                deviceType: "DEVICE_THERMOSTAT",
                status: {
                    currentTemp: currentTemp,
                    targetTemp: targetTemp,
                    requestingHeat: requestingHeat,
                }
            })

            // TODO: create a config call to accept remote temperature settings

            console.log("What is the target temperature(q to Quit):")
            var rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            // update thermostat status on entry from from the user
            rl.on("line", function(message) {
                if (message.toLowerCase() === "q") {
                    status_call.end();
                    rl.close();
                    return;
                }
                // Get user requested temperature
                targetTemp = parseFloat(message)
                if (isNaN(targetTemp)) {
                    console.log("Temperature must be a number")
                    return
                } else {
                    // update the status of requestingHeat
                    requestingHeat = currentTemp < targetTemp;
                    console.log("Current temp: " + currentTemp + ", set temp: " + targetTemp +
                        ", heating: " + requestingHeat)
                    //console.log("What is the target temperature(q to Quit):")
                    status_call.write({
                        deviceId: id,
                        deviceName: name,
                        deviceType: "DEVICE_THERMOSTAT",
                        status: {
                            currentTemp: currentTemp,
                            targetTemp: targetTemp,
                            requestingHeat: currentTemp < targetTemp,
                        }
                    })
                }
            })
        }
    } catch(e) {
        console.log("Could not connect to server " + e)
    }
});

