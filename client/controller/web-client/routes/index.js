var express = require('express');
var router = express.Router();
var grpc = require("@grpc/grpc-js")
var protoLoader = require("@grpc/proto-loader")
var PROTO_PATH = __dirname + "/../../../../protos/smarthome.proto"
// load proto with enums as strings and keepCase to prevent removal of underscores
var packageDefinition = protoLoader.loadSync(PROTO_PATH, {enums: String, keepCase: true})

var smarthome_proto = grpc.loadPackageDefinition(packageDefinition).smarthome

var client = new smarthome_proto.RegistryService("0.0.0.0:40000", grpc.credentials.createInsecure());
var sub = new smarthome_proto.StatusService("0.0.0.0:40000", grpc.credentials.createInsecure());

var name = "Controller";
var id = -1;

/* Called when opening home page */
router.get('/', function(req, res, next) {
  //res.render('index', { title: 'Express' });
  try {
    client.register({name: name, type: "DEVICE_CONTROLLER"}, function(error, response) {
        res.render('index', {
          title: "GRPC Smarthome",
          error: error,
          result: "Controller registered: " + response.new_name + ", id: " + response.id,
        });
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

        // update the status of the controller
        status_call.write({
            id: id,
            name: name,
            type: "DEVICE_CONTROLLER",
            status: {
                ready: true,
            }
        });

        const lights = []
        // render light devices on the index page
        for (const id of Object.keys(response.devices)) {
          const type = response.devices[id];
          if (type == "DEVICE_LIGHT") {
            lights.push({ id: id, type: type})
          }
        }
        res.render('index', { title: "GRPC Smarthome", lights: lights })
    });
  } catch(e) {
    console.log(e)
    res.render('index', {title: 'GRPC Smarthome', error: "smarthome server is not available at the moment"})
  }
});

module.exports = router;
