var grpc = require("@grpc/grpc-js")
var protoLoader = require("@grpc/proto-loader")
var PROTO_PATH = __dirname + "/../protos/smarthome.proto"
var packageDefinition = protoLoader.loadSync(PROTO_PATH, {enums: String})
var smarthome_proto = grpc.loadPackageDefinition(packageDefinition).smarthome

// device dictionary
const devices = new Map()
let currentId = 0
function nextId() {
    return currentId++;
}

function registerDevice(call, callback) {
    try {
        var name = call.request.name.toString()
        var type = call.request.device.toString()
        var id = nextId()
        var newDevice = {
            name: name+id,
            id: id,
            type: type,
            status: {}
        }
        console.log("Got a new device: " + newDevice.name + ", type: " + type + ", id:" + newDevice.id)
        // add new device to list of connected devices
        devices.set(newDevice.id, newDevice)
        callback(null, {
            newName: newDevice.name,
            id: newDevice.id,
        })
    } catch(e) {
        callback(null, {
            message: "An error occured during device registration"
        })
    }
}

function deviceStatus(call, callback) {
    call.on('data', async function(request) {
        console.log(request)
        try {
            var id = parseInt(request.deviceId)
            if(!isNaN(id)) {
                var device = devices[id]
                console.log("device: " + device)
                if(device["name"] == request.deviceName) {
                    console.log(request.status)
                    device.status = request.status
                } else {
                    console.log("deviceName don't match")
                }
            } else {
                console.log("deviceStatus needs a valid deviceId")
            }
        } catch(e) {
            console.log( "An error occured when parsing deviceStatus")
        }
    });

    call.on("end", function() {
        console.log("Client closed the connection")
    });

    call.on("error", function(e) {
        console.log(e)
    });
}

function setTemp(call, callback) {

}

var server = new grpc.Server()
server.addService(smarthome_proto.RegistryService.service, {
    registerDevice: registerDevice,
    deviceStatus: deviceStatus,
 })
server.addService(smarthome_proto.ThermostatService.service, { setTemp: setTemp })
server.bindAsync("0.0.0.0:40000", grpc.ServerCredentials.createInsecure(), function() {
    server.start()
})