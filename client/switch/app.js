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

var name = "Switch";
var id = -1;
var status_call

// calling register RPC function to get my device ID from the server
client.register({name: name, type: "DEVICE_SWITCH"}, function(error, response) {
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
                rl.close();
            });

            status_call.on("end", function() {
                console.log("Server closed the connection");
                rl.close();
            });
            
            status_call.on("data", function(status_response) {
                // Ignore commands for a light switch
                console.log(status_response);
            });

            publish_call = sub.publish(function(response) {
                if (response.message) {
                    console.log(response.message)
                }
            });
            publish_call.on("error", function(e) {
                console.log("Error occured: " + e);
                rl.close();
            });

            publish_call.on("end", function() {
                console.log("Server closed the publish connection");
                rl.close();
            });

            // Get the switch input from the command line
            console.log("Switch ON: 1 or OFF: 0 (q to Quit):")
            var rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            // update the ready status of the switch by sending StatusResponse to the StatusService on the server
            status_call.write({
                id: id,
                name: name,
                type: "DEVICE_SWITCH",
                status: {
                    ready: true,
                }
            });

            // update thermostat status on Enter from the command line from user
            rl.on("line", function(message) {
                if (message.toLowerCase() === "q") {
                    publish_call.end();
                    status_call.end();
                    rl.close();
                    return;
                }
                // Get user input
                switch_on = parseInt(message);
                if (!isNaN(switch_on) && (switch_on == 0 || switch_on == 1)) {
                    publish_call.write({
                        id: id,
                        name: name,
                        type: "DEVICE_SWITCH",
                        event: {
                            on: switch_on,
                        }
                    });
                } else {
                    console.log("Need 1 or 0");
                }
            });
        }
    } catch(e) {
        console.log("Could not connect to server " + e)
    }
});

