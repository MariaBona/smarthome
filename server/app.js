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
            connected_devs[dev.id] = {
                id: dev.id,
                name: dev.name,
                type: dev.type,
                status: dev.status
            }
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
        // write SubscribeResponse message to the subscriber's call object
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

        // helper function to find subscriber's id by it's call object
        function getSubId(c) {
            return [...subscribers].find(([key, value]) => c === value)[0];
        }

        // remove subscriber's call object from the map when the call is cancelled
        call.on("cancelled", function() {
            let id = getSubId(call);
            subscribers.delete(id);
            console.log("Subscription cancelled for " + id);
        });

        // remove subscriber's call object from the map when the call is ended
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

function controlLight(call, callback) {
    try {
        console.log(call.request);
        let id = call.request.id;
        let on = call.request.on;
        // helper function to find the light's status_call call object
        function getStatusCallById(id) {
            return [...status_calls].find(([key, value]) => id === value)[0];
        }
        const status_call = getStatusCallById(id);
        // write StatusResponse message back with the 'on' value
        status_call.write({
            commands: {
                on: on
            }
        });
        
        // respond with empty message when everything is ok
        // the light status will be updated on with the status call by the light device itself
        callback(null, {});
    } catch(e) {
        callback(null, {
            message: "An error occured during device registration"
        });
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
server.addService(smarthome_proto.ControllerService.service, {
    controlLight: controlLight
})
server.bindAsync("0.0.0.0:40000", grpc.ServerCredentials.createInsecure(), function() {
    server.start()
})