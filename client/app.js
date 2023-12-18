var readlineSync = require('readline-sync')
var grpc = require("@grpc/grpc-js")
var protoLoader = require("@grpc/proto-loader")
var PROTO_PATH = __dirname + "/../protos/smarthome.proto"
var packageDefinition = protoLoader.loadSync(PROTO_PATH, {enums: String})

var smarthome_proto = grpc.loadPackageDefinition(packageDefinition).smarthome
var client = new smarthome_proto.RegistryService("0.0.0.0:40000",
grpc.credentials.createInsecure());

client.registerDevice({name: "Thermostat", device: "DEVICE_THERMOSTAT"}, function(error, response) {
    try {
        console.log(error, response)
        if (response.message) {
            console.log(response.message)
        } else {
            console.log("My new name: " + response.newName + ", id: " + response.id)
        }
    } catch(e) {
        console.log("Could not connect to server")
    }
})
