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
var devices
var lights = []
var status_call
var controller_status

/* Called when opening home page */
router.get('/', function(req, res, next) {
  // helper function to render the index page in full
  function render(res) {
    res.render('index', {
      title: "GRPC Smarthome",
      controller_status: controller_status,
      lights: lights })
  }
  try {
    // get query keys (like: localhost:8080?light_id=1&on=0) -> [light_id, on]
    const keys = Object.keys(req.query)
    // Render home page and register the Controller client when there are no query items in the req    
    if (!keys.length) {
      // don't do anything if we already have registered
      if (status_call) {
        render(res);
        return
      }
      client.register({name: name, type: "DEVICE_CONTROLLER"}, function(error, response) {
          name = response.new_name;
          id = response.id;
          devices = response.devices
          controller_status = "Controller registered: " + response.new_name + ", id: " + response.id,

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

          // render light devices on the index page
          for (const id of Object.keys(devices)) {
            const type = devices[id].type;
            if (type == "DEVICE_LIGHT") {
              lights.push({
                id: id,
                name: devices[id].name,
                type: type,
                on: devices[id].status.on == 1 ? 'ON' : 'OFF'
              })
            }
          }
          //res.render('index', { title: "GRPC Smarthome", controller_status: "Controller registered: " + response.new_name + ", id: " + response.id, lights: lights })
          render(res);
      });
    } else if ('light_id' in req.query) {
      // query says this is a request to trigger the lights on or off
      let light_id = parseInt(req.query.light_id);
      let on = req.query.on
      //res.render('index', { title: "GRPC Smarthome", controller_status: "Controller registered: " + response.new_name + ", id: " + response.id, lights: lights })
      render(res);
    } else {
      //res.render('index', { title: "GRPC Smarthome", controller_status: "Controller registered: " + response.new_name + ", id: " + response.id, lights: lights })
      render(res);
    }
  } catch(e) {
    console.log(e)
    //res.render('error', {title: 'GRPC Smarthome', error: e, message: "smarthome server is not available at the moment"})
    render(res);
  }
});

module.exports = router;
