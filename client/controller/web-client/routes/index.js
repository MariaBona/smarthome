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
var controller = new smarthome_proto.ControllerService("0.0.0.0:40000", grpc.credentials.createInsecure());

var name = "Controller";
var id = -1;
var devices
var lights = []
var thermos = []
var status_call
var controller_status
var pending_res

/* Called when opening home page */
router.get('/', function(req, res, next) {
  // helper function to render the index page in full
  function render(res) {
    // update lights and thermostats lists with updated status
    lights = []
    thermos = []
    for (const id of Object.keys(devices)) {
      const type = devices[id].type;
      if (type == "DEVICE_LIGHT") {
        lights.push({
          id: id,
          name: devices[id].name,
          type: type,
          on: devices[id].status.on == 1 ? 'ON' : 'OFF'
        })
      } else if (type == "DEVICE_THERMOSTAT") {
        thermos.push({
          id: id,
          name: devices[id].name,
          type: type,
          current_temp: devices[id].status.current_temp,
          target_temp: devices[id].status.target_temp,
          requesting_heat: devices[id].status.requesting_heat == 'false' ? 'NOT HEATING' : 'HEATING ON'
        })
      }
    }

    // render light and thermostat devices on the index page
    res.render('index', {
      title: "GRPC Smarthome",
      controller_status: controller_status,
      lights: lights,
      thermos: thermos 
    });
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
          console.log("Controller registered", devices)
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

          // subscribe to all devices
          //for (const id of Object.keys(devices)) 
          {
            var sub_call = sub.subscribe({id: 0});
            sub_call.on('data', function(sub_response) {
              console.log("sub_call data: ", sub_response);
              // when subscribe returns response stream, update the device status
              let dev = devices[sub_response.id]
              dev.status = sub_response.status;
              // render the page with updated statuses
              if (pending_res) {
                render(pending_res);
                // set the pending_res back to null as it's no longer usable after rendering this update
                pending_res = null
              }
            });

            sub_call.on("error", function(e) {
              console.log("Error occured on subscribe: " + e);
            });

            sub_call.on("end", function() {
                console.log("Server closed the subscribe connection");
            });
          }

          //res.render('index', { title: "GRPC Smarthome", controller_status: "Controller registered: " + response.new_name + ", id: " + response.id, lights: lights })
          render(res);
      });
    } else if ('light_id' in req.query) {
      // query says this is a request to trigger the lights on or off
      let light_id = parseInt(req.query.light_id);
      let on = parseInt(req.query.on);
      // call controlLight on the ControllerService
      controller.controlLight({
        id: light_id,
        on: on
      }, function(error, response) {
        console.log(response);
        // save he pending res to pending_res so we can render the page when subcribe response is received
        pending_res = res
        // if we try to render here, we will not have updated the light's status ON or OFF in the GUI
        //render(res);
      });
    } else if ('therm_id' in req.query) {
      // query says this is a request to control the thermostat target temparature
      let therm_id = parseInt(req.query.therm_id);
      let temperature = parseFloat(req.query.temperature);
      console.log(req.query, therm_id, temperature);
      // call controlLight on the ControllerService
      controller.setTemp({
        id: therm_id,
        temperature: temperature
      }, function(error, response) {
        console.log("Control response", error, response);
        // save he pending res to pending_res so we can render the page when subcribe response is received
        pending_res = res
        // if we try to render here, we will not have updated the light's status ON or OFF in the GUI
        //render(res);
      });

    } else {
      // just render the page if controller is already registered and we don't control anything this time
      res.render('index', {
        title: "GRPC Smarthome",
        controller_status: "Controller registered: " + response.new_name + ", id: " + response.id,
        lights: lights,
        thermos: thermos 
      });
    }
  } catch(e) {
    console.log(e)
    res.render('error', {title: 'GRPC Smarthome', error: e, message: "smarthome server is not available at the moment"})
    //render(res);
  }
});

module.exports = router;
