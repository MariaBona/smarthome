var grpc = require("@grpc/grpc-js")
var protoLoader = require("@grpc/proto-loader")
var PROTO_PATH = __dirname + "/../protos/smarthome.proto"
var packageDefinition = protoLoader.loadSync(
    PROTO_PATH
)

var smarthome_proto = grpc.loadPackageDefinition(packageDefinition).smarthome

function setTemp(call, callback) {

}

var server = new grpc.Server()
server.addService(smarthome_proto.ThermostatService.service, { setTemp: setTemp })
server.bindAsync("0.0.0.0:40000", grpc.ServerCredentials.createInsecure(), function() {
    server.start()
})