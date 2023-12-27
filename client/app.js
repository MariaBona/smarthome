var readlineSync = require('readline-sync')
var grpc = require("@grpc/grpc-js")
var protoLoader = require("@grpc/proto-loader")
var PROTO_PATH = __dirname + "/../protos/smarthome.proto"
var packageDefinition = protoLoader.loadSync(PROTO_PATH, {enums: String})

var smarthome_proto = grpc.loadPackageDefinition(packageDefinition).smarthome
var client = new smarthome_proto.RegistryService("0.0.0.0:40000",
grpc.credentials.createInsecure());

var name = "Thermostat";
var id = -1;
var currentTemp = 21.5;
var targetTemp = 19;
var requestingHeat = false;

var status_call = null;

client.registerDevice({name: name, device: "DEVICE_THERMOSTAT"}, function(error, response) {
    try {
        console.log(error, response)
        if (response.message) {
            console.log(response.message)
        } else {
            console.log("My new name: " + response.newName + ", id: " + response.id)
            name = response.newName
            id = response.id
            status_call = client.deviceStatus(function(error, response) {
                if(error) {
                    console.log("An error occured: " + error)
                } else {
                    console.log("Server closed the connection")
                }
            });

            status_call.on("error", function(e) {
                console.log("Error occured: " + e)
            });

            var user_input
            var i = 0;
            do {
                i++;
                user_input = i.toString()//readlineSync.question("What is the target temperature( q to Quit ): ")
                try {
                    if (user_input.toLowerCase() === "q") {
                        break;
                    }
                    targetTemp = i//parseFloat(user_input)
                    if (isNaN(targetTemp)) {
                        console.log("Temperature must be a number")
                        continue
                    } else {
                        console.log("writing request" + targetTemp)
                        status_call.write({
                            deviceId: id,
                            deviceName: name,
                            deviceType: "DEVICE_THERMOSTAT",
                            status: new Map([
                                ["currentTemp", currentTemp ],
                                ["targetTemp", targetTemp ],
                                ["requestingHeat", requestingHeat],
                            ]),
                        })
                    }
                } catch(e) {
                    console.log("Error occured" + e)
                }
            } while(i < 10);//user_input != "q");
            user_input = readlineSync.question("What is the target temperature( q to Quit ): ")

            status_call.end()
        }
    } catch(e) {
        console.log("Could not connect to server")
    }
});