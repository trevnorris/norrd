/* Aggregate Collector
 * Connects to each socket file created by receiver.js and aggregates data sent out
 *
 * Broadcast data will always end with a new line character, so anything listening
 * for data will know when it has reached the end of a transmission.
 */


var http = require('http'),
	net = require('net'),
	fs = require('fs'),
	cli = require('commander'),
	eList = {},        // list of emmiters that will need to receive the data
	sList = {},        // list of receiver socket connections
	sPath = [],        // path of socket files that are currently active
	bobj = {},         // aggregated object that will be broadcast at interval
	flip = {},         // if data is flipped, store here
	stringified = '',  // bobj is first stringified and stored before broadcast
	isAgg = false,     // don't read in new sockets when aggregating data
	tmpStore = {},     // each receiver has a uid where data is stores, in case of large JSON
	aggCounter = 0,
	config;            // default configuration imported from config.json

require('./utils');

cli.option('-c, --config [loc]', 'Location of config.json', String, __dirname + '/config.json')
	.option('-d, --debug', 'Enable debugging')
	.option('-f, --flip', 'Flip data and broadcast by id, instead of by timestamp')
	.option('-m, --multi', 'Set if this is a collection of collectors')
	.option('-p, --port [port]', 'Port or path to broadcast aggregated data')
	.option('-r, --rescan [numb]', 'If connection to receiver fails, time interval to attempt reconnect', Number)
	//.option('-s, --scan [numb]', 'time interval to rescan the config.json for changes', Number)
	.option('-t, --time [numb]', 'Time interval (in milliseconds) between data broadcasts', Number)
	.parse(process.argv);


// open and parse the config file
config = JSON.parse(fs.readFileSync(cli.config, 'utf8')).collector;

// command line parameters will override config.json
if (cli.debug) config.debug = cli.debug;
if (cli.flip) config.flip = cli.flip;
if (cli.multi) config.multi = cli.multi;
if (cli.port) config.port = cli.port;
if (cli.rescan) config.rescan = cli.rescan;
//if (cli.scan) config.scan = cli.scan;
if (cli.time) config.time = cli.time;


// extend the bobj object from a set of data
function objExtend(data) {
	var i, j;
	for (i in data) {
		if (!bobj[i]) bobj[i] = {};
		for (j in data[i]) {
			if (!bobj[i][j]) bobj[i][j] = 0;
			bobj[i][j] += data[i][j];
		}
	}
}


// emit data to all listed connections
function emitter() {
	var i, j;
	// check if going to flip data
	if (config.flip) {
		flip = bobj;
		bobj = {};
		for (i in flip) {
			for (j in flip[i]) {
				if (!bobj[j]) bobj[j] = {};
				bobj[j][i] = flip[i][j];
			}
		}
		for (i in flip)
			delete flip[i];
	}
	// store stringified data
	// append new line character so can determine end of JSON object
	stringified = JSON.stringify(bobj) + '\n';
	// emit data on every socket connection in eList
	for (i in eList)
		eList[i].write(stringified);
	// cleanup
	stringified = '';
	for (i in bobj)
		delete bobj[i];
}


// loop through and attempt connection to all listed receivers
for (var i in config.receivers) {
	receiverConnect(config.receivers[i]);
}


// create connection to receive socket file and add to sList
function receiverConnect(rec) {
	var conn;
	// create connection to socket file
	if (rec.port) {
		conn = net.connect(rec.port, rec.host);
	} else {
		conn = net.connect(rec.sock);
	}
	// setup listeners if the connection succeeds
	conn.on('connect', function() {
		// create a uid
		var uid = Math.random().toString(36).substr(2);
		// add connection to socket list
		sList[ uid ] = conn;
		// add uid entry to where JSON strings will be temporarily written
		tmpStore[ uid ] = '';
		// cleanup if dies for whatever reason
		conn.on('end', function() {
			// remove connection from list
			delete sList[ uid ];
			delete tmpStore[ uid ];
			// shouldn't happen often, so not worried about memory hit
			sPath.splice(sPath.indexOf(uid), 1);
			// attempt reconnect at rescan interval
			setTimeout(function() {
				receiverConnect(rec);
			}, config.rescan);
		});
		// aggregate data when it's received
		conn.on('data', function(data) {
			isAgg = true;
			// ensure there is actually data
			if (!data) return;
			var tdata = data.toString();
			// temporarily store data if only part of the string has been sent
			// check for entire JSON string by null char at end
			if (tdata.charCodeAt(tdata.length - 1) !== 10) {
				tmpStore[ uid ] += tdata;
				return;
			} else {
				// remove null character at the end of the JSON data
				tmpStore[ uid ] += tdata.substr(0, tdata.length - 1);
			}
			// extend the bobj with the stored data
			objExtend(JSON.parse(tmpStore[ uid ]));
			// cleanup tmpStore
			tmpStore[ uid ] = '';
			// check if all socket callbacks have fired
			if (++aggCounter === sPath.length) {
				aggCounter = 0;
				isAgg = false;
				// emit data if all socket callbacks have fired
				emitter();
			}
		});
		// add path to global path list
		sPath.push(uid);
		// send debug message that connection was successful
		if (config.debug)
			debugLog('connected to service ' + (rec.sock || rec.port + ':' + rec.host));
	});
	// if the connection fails, retry after rescan time
	conn.on('error', function(err) {
		if (cli.debug) debugLog(err);
		// attempt reconnect at rescan interval
		setTimeout(function() {
			receiverConnect(rec);
		}, config.rescan);
	});
}


// aggregate data from receivers at interval then broadcast to all listeners
// if collector of collectors, then no need to broadcast
if (!config.multi) (function aggregate() {
	// make sure aggregation is still not happening
	if (isAgg) {
		setTimeout(aggregate, 15);
		return;
	}
	// loop through sList and get data from all sockets
	for (var i in sList) {
		sList[i].write('\n');
	}
	// call aggregation at time interval
	setTimeout(aggregate, config.time);
}());


// broadcast JSON as string through socket file or port
net.createServer(function(socket) {
	// generate random key for message queue
	var key = Math.random().toString(36).substr(2);
	// add function to message queue to be fired when data needs to be sent
	eList[ key ] = socket;
	// remove function from queue if connection closes
	socket.on('end', function() {
		delete eList[ key ];
	});
}).listen(config.port);
