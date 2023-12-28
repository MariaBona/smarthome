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
            })

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

            // Start updating the server with values set by user from command line
            var user_input
            var i = 0;
            (async () => {
                do {
                    i++;
                    user_input = readlineSync.question("What is the target temperature( q to Quit ): ")
                    try {
                        if (user_input.toLowerCase() === "q") {
                            break;
                        }
                        targetTemp = parseFloat(user_input)
                        if (isNaN(targetTemp)) {
                            console.log("Temperature must be a number")
                            continue
                        } else {
                            // update status of requestingHeat
                            requestingHeat = currentTemp < targetTemp;
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
                            await new Promise(done => setTimeout(() => done(), 100));
                        }
                    } catch(e) {
                        console.log("Error occured" + e)
                    }
                } while(user_input != "q");

                status_call.end();
            })();
        }
    } catch(e) {
        console.log("Could not connect to server")
    }
});

