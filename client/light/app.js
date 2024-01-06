var readline = require('readline')
var grpc = require("@grpc/grpc-js")
var protoLoader = require("@grpc/proto-loader")
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
        if (response.message) {
            console.log(response.message)
        } else {
            console.log("My new name: " + response.new_name + ", id: " + response.id)
            name = response.new_name;
            id = response.id;

            status_call = sub.status()

            status_call.on("error", function(e) {
                console.log("Error occured: " + e);
                rl.close();
            });

            status_call.on("end", function() {
                console.log("Server closed the status connection");
                rl.close();
            });

            function writeAndUpdateStatus(switch_on) {
                console.log("Light is turned ", switch_on == 1 ? "ON" : "OFF" )
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
                // update 'on' status and write StatusRequest to status_call of StatusService
                writeAndUpdateStatus(status_response.commands.on);
            });

            function listSwitches() {
                console.log("Select a light switch ('q' to Quit, 'switch' to select different switch)")
                for (const id of Object.keys(response.devices)) {
                    const device = response.devices[id];
                    if (device.type == "DEVICE_SWITCH") {
                        console.log(id + ":", device.name)
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
                    // if subsctiption is open cancel it
                    if (sub_call) {
                        sub_call.cancel();
                    }
                    // close the command line interface and exit the client
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
                    }
                    listSwitches();
                    return;
                }

                // if there is no subscription for a light switch, select it from list
                if(!sub_call) {
                    // Get user input
                    switch_id = parseInt(message);
                    if(!isNaN(switch_id)) {
                        // subscribe to a device with selected id
                        sub_call = sub.subscribe({id: switch_id});

                        // read stream and turn on or off the light
                        sub_call.on("data", function(sub_response) {
                            console.log("data: ", sub_response);
                            writeAndUpdateStatus(sub_response.status.on);
                        });

                        sub_call.on("error", function(e) {
                            // code 1 (Cancelled) is expected, otherwise log error
                            if (e.code != 1) {
                                console.log("Error occured: " + e.code);
                            }
                        });
            
                        sub_call.on("end", function() {
                            console.log("Server closed the subscription connection");
                        });
                    } else {
                        console.log("Needs to be a valid switch id");
                    }
                } else {
                    console.log("'q' to Quit or 'switch' to select different switch")
                }
            });
        }
    } catch(e) {
        console.log("Could not connect to server " + e)
    }
});

