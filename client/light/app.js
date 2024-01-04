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

var name = "Light";
var id = -1;
var switch_id;
var on = 0;
var status_call;
var sub_call;

// calling register RPC function to get my device ID from the server
client.register({name: name, type: "DEVICE_LIGHT"}, function(error, response) {
    try {
        console.log("Register?: ", error, response)
        if (response.message) {
            console.log(response.message)
        } else {
            console.log("My new name: " + response.new_name + ", id: " + response.id)
            name = response.new_name;
            id = response.id;

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

            function writeAndUpdateStatus(switch_on) {
                on = switch_on
                // update the status of the switch
                status_call.write({
                    id: id,
                    name: name,
                    type: "DEVICE_LIGHT",
                    status: {
                        on: on,
                    }
                });
            }

            writeAndUpdateStatus(on);

            status_call.on("data", function(status_response) {
                console.log(status_response);
                // TODO: allow turning on the light from controller
            });

            function listSwitches() {
                console.log("Select a light switch ('q' to Quit, 'switch' to select different switch)")
                for (const id of Object.keys(response.devices)) {
                    const type = response.devices[id];
                    if (type == "DEVICE_SWITCH") {
                        console.log("Switch", id)
                    }
                }
            }
            listSwitches();
            var rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            // update thermostat status on entry from the command line from user
            rl.on("line", function(message) {
                if (message.toLowerCase() === "q") {
                    status_call.end();
                    rl.close();
                    return;
                }

                // TODO: allow cancellation of sub and change the switch button?
                if(message.toLowerCase() === "switch" ) {
                    // check if subscription is already open afterall
                    if (sub_call) {
                        // cancel the switch subscription
                        sub_call.cancel();
                        sub_call = null;
                        listSwitches();
                    } else {
                        listSwitches();
                        return;
                    }
                }

                // if there is no subscription for a light switch select one
                if(!sub_call) {
                    // Get user input
                    switch_id = parseInt(message);
                    if(!isNaN(switch_id)) {
                        // TODO: subscribe
                        console.log("subscribe?")
                    } else {
                        console.log("Needs to be a valid switch id");
                    }
                } else {
                    console.log("'q' to Quit or 'switch' to select different switch)")
                }
            });
        }
    } catch(e) {
        console.log("Could not connect to server " + e)
    }
});

