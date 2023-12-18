var grpc = require("@grpc/grpc-js")
var protoLoader = require("@grpc/proto-loader")
var PROTO_PATH = __dirname + "/../protos/smarthome.proto"
var packageDefinition = protoLoader.loadSync(PROTO_PATH, {enums: String})
var smarthome_proto = grpc.loadPackageDefinition(packageDefinition).smarthome

// device dictionary
const devices = new Array()

function registerDevice(call, callback) {
    try {
        var name = call.request.name.toString()
        var type = call.request.device.toString()
        var newDevice = {
            name: name+devices.length,
            id: devices.length
        }
        console.log("Got a new device: " + newDevice.name + ", type: " + type + ", id:" + newDevice.id)
        // add new device to list of connected devices
        devices.push(newDevice)
        callback(null,  {
            newName: newDevice.name,
            id: newDevice.id,
        })
    } catch(e) {
        callback(null, {
            message: "An error occured during device registration"
        })
    }
}

function setTemp(call, callback) {

}

var server = new grpc.Server()
server.addService(smarthome_proto.RegistryService.service, { registerDevice: registerDevice })
server.addService(smarthome_proto.ThermostatService.service, { setTemp: setTemp })
server.bindAsync("0.0.0.0:40000", grpc.ServerCredentials.createInsecure(), function() {
    server.start()
})