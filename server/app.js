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
    // this function will receive stream of StatusRequest messages that contain status of device
    // we need to save the call object and map it to the the device id for later use
    call.on('data', function(request) {
        console.log(request)
        try {
            let id = parseInt(request.id)
            if(!isNaN(id)) {
                var device = devices.get(id)
                // save the call object and map it to the sender id for later
                // so that we can send it the StatusResponse with commands from the controller
                if (!status_calls.has(call)) {
                    status_calls.set(call, id)
                }
                // verify if the device name matches our device list
                if(device.name == request.name) {
                    console.log(request.status)
                    device.status = request.status
                    // if there are any subscribers to our device id, write status to their
                    // respective subscribe call object
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
        // get the device id that ended this status_call
        let id = status_calls.get(call)
        // cleanup the devices, status_calls and subscribers arrays for this device id
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
        console.log(request);
        // get the id of device publishing the data
        let id = request.id;
        // map the call to id so that we know which publisher's call has 'end'ed below
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
        // find the id of the device so we can display a correct log message
        let id = publishers.get(call)
        // delete this call from publishers array
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

// GUI can call this to controll the lights
function controlLight(call, callback) {
    try {
        console.log(call.request);
        let id = call.request.id;
        let on = call.request.on;
        // helper function to find the light's status_call call object
        function getStatusCallById(id) {
            return [...status_calls].find(([key, value]) => id === value)[0];
        }
        // get the status_call for this light
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
            message: "An error occured during controlLight"
        });
    }
}

// GUI can call this to controll the thermostat
function setTemp(call, callback) {
    try {
        console.log("setTemp: ", call.request);
        let id = call.request.id;
        let temperature = call.request.temperature;
        // helper function to find the light's status_call call object
        function getStatusCallById(id) {
            return [...status_calls].find(([key, value]) => id === value)[0];
        }
        // get the status_call for this thermostat
        const status_call = getStatusCallById(id);
        // write StatusResponse message back with the 'on' value
        status_call.write({
            commands: {
                temperature: temperature
            }
        });
        
        // respond with empty message when everything is ok
        // the light status will be updated on with the status call by the light device itself
        callback(null, {});
    } catch(e) {
        callback(null, {
            message: "An error occured during setTemp"
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
    controlLight: controlLight,
    setTemp: setTemp,
})
server.bindAsync("0.0.0.0:40000", grpc.ServerCredentials.createInsecure(), function() {
    server.start()
})