#!/usr/bin/env node

/**
 * Module dependencies.
 */

var app = require('../app');
var debug = require('debug')('MqttTest:server');
var http = require('http');
require('date-utils');
var mqtt = require('mqtt');
const Influx = require('influx');
var geohash = require('ngeohash');

var options = {
  port: '8883',
  clientId: 'mqttjs',
  username: "aptj",
  password: "aptj-mqtt",
};

const influx = new Influx.InfluxDB({
  host: '52.38.23.147',
  port: '8086',
  username: 'drone_user',
  password: 'aptj_dev',
  database: 'drone_log_test'
  // schema: [{
  //   measurement: 'measurement_test',
  //   tags: ['systemID'],
  //   fields: {
  //     alt: Influx.FieldType.INTEGER,
  //     lon: Influx.FieldType.INTEGER,
  //     lat: Influx.FieldType.INTEGER
  //   }
  // }]
})

var mqttClient = mqtt.connect('http://160.16.96.11', options);

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);
var io = require('socket.io').listen(server);
var userIDList = {};
var roomID = "browser";
io.sockets.on('connection', function(socket){

	console.log('browser connected: ' + socket.id);
	socket.join(roomID);

	socket.emit('connectionInitial', {message: 'server init'}, function(data){
		console.log('Browser linked : ' + data);
	});

	// Codr for MQTT
	//---------------------------------------------------------------
	socket.on( 'mqttConnectionRequest', function(  ) {
		//mqttHost = "mqtt://160.16.96.11";
		//mqttPort = "8883";
		//mqttUserName = "aptj";
		//mqttPassword = "aptj-mqtt";
        //
		//console.log('host : ' + mqttHost + ' port : ' + mqttPort + ' name : ' + mqttUserName + ' password : ' + mqttPassword);
		//mqttClient = mqtt.connect(mqttHost, {port : mqttPort, username : mqttUserName, password : mqttPassword });
	});

	socket.on( 'mqttPublish', function( data ) {

		var id = userIDList[socket.id];

		if(id != undefined){
			var value = data.value.split("::");
			var command = value[0];
			var message = value[1];
			//console.log("socket id : " + socket.id + " command : " + command + " message : " + message);
			if(mqttClient != undefined){
				console.log('command : ' + command + ' message : ' + message);
				mqttClient.publish("\$ardupilot/copter/quad/command/"+id+"\/" + command, message);
			}
		}

	});

	socket.on( 'mqttConnect', function( data ) {

		var systemID = data.value;

		if(mqttClient != undefined){

			userIDList[socket.id] = systemID;
			console.log("systemnID registered :" + systemID);
			var subscribeTopic = "\$ardupilot\/copter\/quad\/\+/" + systemID + "\/\#";
			console.log("subcribed : " + subscribeTopic);
			mqttClient.subscribe(subscribeTopic);
			mqttClient.on('message', function(topic, message) {
				var systemID = userIDList[socket.id];
				var value = topic.split("\/");
				if(value[4] == systemID){
					console.log("received topic : " + topic + " message : " + message);
					sendLogData(topic+"::"+message, socket.id);
          if(value[3] == "log"){
            saveLogDB(message);
          }
        }
			});

		}

	});

});

function saveLogDB(data){
  var message = buffer_to_string(data);
  var item = message.split(',');
  var log_id = item[0].split(":")[1];
  var time = item[1].split(":");
  var log_lat = item[2].split(":")[1]/10000000;
  var log_lon = item[3].split(":")[1]/10000000;
  var log_alt = item[4].split(":")[1];

  influx.writePoints([
    {
      measurement: 'measurement_test',
      tags: {
        systemID: log_id,
        geohash: geohash.encode(log_lat, log_lon)
       },
      fields: {
        alt: Number(log_alt),
        lat: log_lat,
        lon: log_lon
      }
    }
  ]).catch(err => {
    console.error(`Error saving data to InfluxDB! ${err.stack}`)
  })
  influx.query(`
    select * from measurement_test
    order by time desc
    limit 1
    `).then(result => {
      console.log("DATABASE RECORD >>> " + JSON.stringify(result));
    }).catch(err => {
      console.error(`Error getting to InfluxDB! ${err.stack}`)
 })
}

function sendLogData(logData, id){
	var data = buffer_to_string(logData);
	console.log("send to web : " + logData + "(" + id + ")");
	io.sockets.to(id).emit('roomLogData', {message:logData});
}

function sendBroadcastLogData(logData){
	var data = buffer_to_string(logData);
	console.log("send broadcast to web : " + data);
	io.sockets.to(roomID).emit('broadcastLogData',{message:data});
}

function buffer_to_string(buf) {
  return String.fromCharCode.apply("", new Uint16Array(buf))
}

function large_buffer_to_string(buf) {
  var tmp = [];
  var len = 1024;
  for (var p = 0; p < buf.byteLength; p += len) {
    tmp.push(buffer_to_string(buf.slice(p, p + len)));
  }
  return tmp.join("");
}


/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
