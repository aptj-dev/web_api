#!/usr/bin/env node

/**
 * Module dependencies.
 */

var app = require('../app');
var debug = require('debug')('MqttTest:server');
var http = require('http');
require('date-utils');
var mqtt = require('mqtt');

var options = {
  port: '8883',
  clientId: 'mqttjs',
  username: "aptj",
  password: "aptj-mqtt",
};

var mqttClient = mqtt.connect('http://160.16.96.11', options);

//mqttClient.subscribe('drone/flight/accel');

//mqttClient.on('message', function(topic, message) {
//	console.log("received mqtt : " + topic + ':' + message);
//});

//client.subscribe('presence');
//client.publish('presence', 'Hello mqtt');
//
//client.on('message', function (topic, message) {
//  // message is Buffer
//  console.log(message.toString());
//});
//
//client.end();

//var mqttClient;
//var mqttHost = "http://160.16.96.11";
//var mqttPort = "8883";
//var mqttPassword = "aptj-mqtt";
//var mqttUserName = "aptj";
//
//mqttClient = mqtt.connect(mqttPort, mqttHost, { username : mqttUserName, password : mqttPassword });

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

		mqttHost = "mqtt://160.16.96.11";
		mqttPort = "8883";
		mqttUserName = "aptj";
		mqttPassword = "aptj-mqtt";

		console.log('host : ' + mqttHost + ' port : ' + mqttPort + ' name : ' + mqttUserName + ' password : ' + mqttPassword);
		//mqttClient = mqtt.connect(mqttHost, { username : mqttUserName, password : mqttPassword });
		mqttClient = mqtt.connect(mqttHost, {port : mqttPort, username : mqttUserName, password : mqttPassword });
	});

	socket.on( 'mqttPublish', function( data ) {
		
		var id = userIDList[socket.id];
		if(id != undefined){
			value = data.value.split(":");
			var command = value[0];
			var message = value[1];
			console.log("socket id : " + socket.id );
			if(mqttClient != undefined){
				console.log('command : ' + command + ' message : ' + message);
				mqttClient.publish("\/ardupilot/copter/quad/command/"+id+"\/" + command, message);
			}
		}

	});

	socket.on( 'mqttSubscribe', function( data ) {

		var systemID = data.value;

		if(mqttClient != undefined){

			//console.log("subscribed :" + topic);
			//mqttClient.subscribe("\/"+socket.id+"\/\#");
			//mqttClient.on('message', function(topic, message) {
			//	console.log("received topic :" + topic);
			//	sendLogData(message, socket.id);
			//});

			userIDList[socket.id] = systemID;
			console.log("systemnID registered :" + systemID);
			mqttClient.unsubscribe("/#");
			mqttClient.subscribe("\/ardupilot/copter/quad/+/" + systemID + "\/\#");
			mqttClient.on('message', function(topic, message) {
				console.log("received topic : " + topic + " message : " + message);
				sendLogData(message, socket.id);
			});

		}
	});

});


function sendLogData(logData, id){
	var data = buffer_to_string(logData);
	console.log("send to web : " + data);
	io.sockets.to(id).emit('roomLogData', {message:data});
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
