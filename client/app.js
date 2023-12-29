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
var current_temp = 21.5;
var target_temp = 19;
var requesting_heat = false;
var status_call

// calling registerDevice RPC function to get my device ID from the server
client.registerDevice({name: name, type: "DEVICE_THERMOSTAT"}, function(error, response) {
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

            status_call.on("data", function(commands) {
                console.log(commands)

            });

            // update status of requesting_heat
            requesting_heat = current_temp < target_temp;
            status_call.write({
                id: id,
                name: name,
                type: "DEVICE_THERMOSTAT",
                status: {
                    current_temp: current_temp,
                    target_temp: target_temp,
                    requesting_heat: requesting_heat,
                }
            })

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
                target_temp = parseFloat(message)
                if (isNaN(target_temp)) {
                    console.log("Temperature must be a number")
                    return
                } else {
                    // update the status of requesting_heat
                    requesting_heat = current_temp < target_temp;
                    console.log("Current temp: " + current_temp + ", set temp: " + target_temp +
                        ", heating: " + requesting_heat)
                    //console.log("What is the target temperature(q to Quit):")
                    status_call.write({
                        id: id,
                        name: name,
                        type: "DEVICE_THERMOSTAT",
                        status: {
                            current_temp: current_temp,
                            target_temp: target_temp,
                            requesting_heat: current_temp < target_temp,
                        }
                    })
                }
            })
        }
    } catch(e) {
        console.log("Could not connect to server " + e)
    }
});

