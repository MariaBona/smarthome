var express = require('express');
var router = express.Router();
var grpc = require("@grpc/grpc-js")
var protoLoader = require("@grpc/proto-loader")
var PROTO_PATH = __dirname + "/../../protos/smarthome.proto"
// load proto with enums as strings and keepCase to prevent removal of underscores
var packageDefinition = protoLoader.loadSync(PROTO_PATH, {enums: String, keepCase: true})

var smarthome_proto = grpc.loadPackageDefinition(packageDefinition).smarthome

var client = new smarthome_proto.RegistryService("0.0.0.0:40000", grpc.credentials.createInsecure());
var sub = new smarthome_proto.StatusService("0.0.0.0:40000", grpc.credentials.createInsecure());

/* GET home page. */
router.get('/', function(req, res, next) {
  //res.render('index', { title: 'Express' });
});

module.exports = router;
