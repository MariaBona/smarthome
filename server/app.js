var grpc = require("@grpc/grpc-js")
var protoLoader = require("@grpc/proto-loader")
var PROTO_PATH = __dirname + "/../protos/smarthome.proto"
var packageDefinition = protoLoader.loadSync(PROTO_PATH, {enums: String, keepCase: true})
var smarthome_proto = grpc.loadPackageDefinition(packageDefinition).smarthome

// device dictionary (id: { name, id, type, status, status_call })
const devices = new Map()
// calls mapped to a device (call: id)
const status_calls = new Map()
// publisher's calls (call: id)
const publishers = new Map()
// current subscribers (id: call)
const subscribers = new Map()
// last commands from controller to devices by their id
const commands = new Map()

// use a unique id for all connecting devices
let currentId = 0
function nextId() {
    return currentId++;
}

// handle register (unary) calls
function register(call, callback) {
    try {
        var name = call.request.name.toString()
        var type = call.request.type.toString()
        var id = nextId()
        var newDevice = {
            name: name+id,
            id: id,
            type: type,
            status: {},
            status_call: null
        }
        console.log("Got a new device: " + newDevice.name + ", type: " + type + ", id:" + newDevice.id)
        // add new device to list of connected devices
        devices.set(newDevice.id, newDevice)
        const connected_devs = new Object()
        for(const dev of devices.values()) {
            connected_devs[dev.id] = dev.type;
        }
        callback(null, {
            new_name: newDevice.name,
            id: newDevice.id,
            devices: connected_devs,
        });
    } catch(e) {
        callback(null, {
            message: "An error occured during device registration"
        })
    }
}

// handle status (bi-directional streaming) calls
function status(call) {
    call.on('data', function(request) {
        console.log(request)
        try {
            let id = parseInt(request.id)
            if(!isNaN(id)) {
                var device = devices.get(id)
                if (!status_calls.has(call)) {
                    status_calls.set(call, id)
                }
                if(device.name == request.name) {
                    console.log(request.status)
                    device.status = request.status
                    if (subscribers.has(id)) {
                        subscribers.get(id).write({
                            id: id,
                            status: device.status
                        });
                    }
                } else {
                    console.log("device names don't match")
                }
            } else {
                console.log("status needs a valid id")
            }
        } catch(e) {
            console.log( "An error occured when parsing deviceStatus")
        }
    });

    call.on("end", function() {
        let id = status_calls.get(call)
        devices.delete(id)
        status_calls.delete(id)
        if (subscribers.has(id)) {
            subscribers.get(id).end();
            subscribers.delete(id)
        }
        console.log("Client " + id + " closed the connection")
        call.end()
    });

    call.on("error", function(e) {
        console.log("status resulted in error: ", e);
    });
}

// handle publish (client streaming) calls
function publish(call) {
    call.on("data", function(request) {
        let id = request.id;
        if (!publishers.has(call)) {
            publishers.set(call, id)
        }
        const event = request.event;
        if (subscribers.has(id)) {
            subscribers.get(id).write({
                id: id,
                status: event
            });
        }
    });

    call.on("error", function(e) {
        console.log("publish resulted in error: ", e);
    });

    call.on("end", function() {
        let id = publishers.get(call)
        publishers.delete(call)
        console.log("Publisher " + id + " closed the connection")
    });
}

// handle subscribe (server streaming) calls
function subscribe(call, callback) {
    try {
        let id = call.request.id;
        subscribers.set(id, call);

        function getSubId(val) {
            return [...subscribers].find(([key, value]) => val === value)[0];
        }

        call.on("cancelled", function() {
            let id = getSubId(call);
            subscribers.delete(id);
            console.log("Subscription cancelled for " + id);
        });

        call.on("end" , function() {
            let id = getSubId(call);
            subscribers.delete(id);
            console.log("Subscription ended for " + id);
        });

        call.on("error", function(e) {
            console.log("subscribe resulted in error: ", e);
        });
    } catch(e) {
        call.write({
            message: "An error occured during device registration"
        })
    }
}

var server = new grpc.Server()
server.addService(smarthome_proto.RegistryService.service, {
    register: register,
})
server.addService(smarthome_proto.StatusService.service, {
    status: status,
    publish: publish,
    subscribe: subscribe,
})
server.bindAsync("0.0.0.0:40000", grpc.ServerCredentials.createInsecure(), function() {
    server.start()
})