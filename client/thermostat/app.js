var readline = require('readline')
var grpc = require("@grpc/grpc-js")
var protoLoader = require("@grpc/proto-loader")
const { stat } = require('fs')
var PROTO_PATH = __dirname + "/../../protos/smarthome.proto"
// load proto with enums as strings and keepCase to prevent removal of underscores
var packageDefinition = protoLoader.loadSync(PROTO_PATH, {enums: String, keepCase: true})

var smarthome_proto = grpc.loadPackageDefinition(packageDefinition).smarthome

var client = new smarthome_proto.RegistryService("0.0.0.0:40000", grpc.credentials.createInsecure());
var sub = new smarthome_proto.StatusService("0.0.0.0:40000", grpc.credentials.createInsecure());

var name = "Thermostat";
var id = -1;
var current_temp = 21.5;
var target_temp = 19;
var requesting_heat = false;
var quit = false;
// temperature update interval of 5 seconds
const interval = 5 * 1000;
var status_call

// calling register RPC function to get my device ID from the server
client.register({name: name, type: "DEVICE_THERMOSTAT"}, function(error, response) {
    try {
        console.log(error, response)
        if (response.message) {
            console.log(response.message)
        } else {
            console.log("My new name: " + response.new_name + ", id: " + response.id)
            name = response.new_name
            id = response.id
            status_call = sub.status()

            status_call.on("error", function(e) {
                console.log("Error occured: " + e);
                quit = true;
                rl.close();
            });

            status_call.on("end", function() {
                console.log("Server closed the connection");
                quit = true;
                rl.close();
            });

            function writeAndUpdateStatus(temperature, verbose=true) {
                // update the status of requesting_heat
                target_temp = temperature
                requesting_heat = current_temp < target_temp;
                if (verbose)
                    console.log("Current temp: " + current_temp + ", set temp: " + target_temp +
                        ", heating: " + requesting_heat);
                status_call.write({
                    id: id,
                    name: name,
                    type: "DEVICE_THERMOSTAT",
                    status: {
                        current_temp: current_temp,
                        target_temp: target_temp,
                        requesting_heat: current_temp < target_temp,
                    }
                });
            }

            status_call.on("data", function(status_response) {
                console.log(status_response);
                temperature = parseFloat(status_response.commands.temperature);
                console.log("Target temperature from controller received:" + temperature);
                if (!isNaN(temperature)) {
                    writeAndUpdateStatus(temperature);
                } else {
                    console.log("Temperature must be a number");
                }
            });

            console.log("What is the target temperature(q to Quit):")
            var rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            // update thermostat status on entry from the command line from user
            rl.on("line", function(message) {
                if (message.toLowerCase() === "q") {
                    status_call.end();
                    rl.close();
                    quit = true;
                    return;
                }
                // Get user requested temperature
                temperature = parseFloat(message);
                if (!isNaN(temperature)) {
                    writeAndUpdateStatus(temperature);
                } else {
                    console.log("Temperature must be a number");
                }
            });

            // Start generating current temperature for demo
            (async () => { // asif self calling async function not block the client with timeout
                while(!quit) {
                    // calculate temperature change between -0.5 and 0.5 degrees
                    change = -0.5 + Math.round(Math.random()*2) * 0.5
                    // update current_temp by the change value
                    if (change != 0) {
                        current_temp = current_temp + change;
                        writeAndUpdateStatus(target_temp, false);
                    }
                    // wait until next update
                    await new Promise(done => setTimeout(() => done(), interval));
                } 
            })();
        }
    } catch(e) {
        console.log("Could not connect to server " + e)
    }
});

