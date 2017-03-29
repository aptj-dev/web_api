#!/usr/bin/env node

/**
 * Module dependencies.
 */

var app = require('../app');
var debug = require('debug')('MqttTest:server');
var http = require('http');
require('date-utils');
var mqtt = require('mqtt');

//var options = {
//  port: '8883',
//  clientId: 'mqttjs',
//  username: "aptj",
//  password: "aptj-mqtt",
//};
//
//var mqttClient = mqtt.connect('http://160.16.96.11', options);

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
var mqttClientList = {};
var systemID = {};
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
		
		var id = systemID[socket.id];
		var mqttClient = mqttClientList[socket.id];

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

	socket.on( 'mqttConnect', function( data ) {

		var mqttHost = "mqtt://160.16.96.11";
		var mqttPort = "8883";
        
		value = data.value.split(":");
		var mqttUserName = value[0];
		var mqttPassword = value[1];
		var mqttSystemid = value[2];
        
		mqttUserName = "aptj";
		mqttPassword = "aptj-mqtt";

		console.log('host : ' + mqttHost + ' port : ' + mqttPort + ' name : ' + mqttUserName + ' password : ' + mqttPassword);
		var mqttClient = mqtt.connect(mqttHost, {port : mqttPort, username : mqttUserName, password : mqttPassword, clientId : socket.id});

		mqttClientList[socket.id] = mqttClient;
		systemID[socket.id] = mqttSystemid;

		console.log("systemnID registered :" + mqttSystemid);
		mqttClient.unsubscribe("/#");
		mqttClient.subscribe("\/ardupilot/copter/quad/+/" + mqttSystemid + "\/\#");
		mqttClient.on('message', function(topic, message) {
			console.log("received topic : " + topic + " message : " + message);
			sendLogData(topic + ":" + message, socket.id);
		});

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
