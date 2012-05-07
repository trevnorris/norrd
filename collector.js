/* Aggregate Collector
 * Connects to each socket file created by receiver.js and aggregates data sent out
 */


var http = require( 'http' ),
	net = require( 'net' ),
	fs = require( 'fs' ),
	cli = require( 'commander' ),
	eList = {},        // list of emmiters that will need to receive the data
	sList = {},        // list of receiver socket connections
	sPath = [],        // path of socket files that are currently active
	bobj = {},         // aggregated object that will be broadcast at interval
	stringified = '',  // bobj is first stringified and stored before broadcast
	isAgg = false,     // don't read in new sockets when aggregating data
	tmpStore = {},     // each receiver has a uid where data is stores, in case of large JSON
	rSock = /\.(sock|socket)$/,
	aggCounter = 0,
	gtime = 0,
	ptime, ci, hdata, hi;

cli.version( '0.1.0' )
	.option( '-f, --dir [dir]', 'Directory containing the receiver.js socket files', String, './sockets' )
	.option( '-p, --port [port]', 'Port or path to broadcast aggregated data', 7331 )
	.option( '-s, --scan [numb]', 'Time to rescan socket dir for new socket files', Number, 30000 )
	.option( '-t, --time [numb]', 'Time interval (in milliseconds) between data broadcasts', Number, 1000 )
	.parse( process.argv );


// extend the bobj object from a set of data
function objExtend( data ) {
	var i, j;
	for ( i in data ) {
		if ( !bobj[i] ) bobj[i] = {};
		for ( j in data[i] ) {
			if ( !bobj[i][j] ) bobj[i][j] = 0;
			bobj[i][j] += data[i][j];
		}
	}
}


// emit data to all listed connections
function emitter() {
	// store stringified data
	stringified = JSON.stringify( bobj );
	// emit data
	for ( var i in eList )
		eList[i].write( stringified );
	// cleanup
	stringified = '';
	for ( i in bobj )
		delete bobj[i];
}


// create connection to receive socket file and add to sList
function socketConnect( path ) {
	// create a uid for the given socket queue
	var uid = Math.random().toString( 36 ).substr( 2 );
	// add uid entry to where JSON strings will be temporarily written
	tmpStore[ uid ] = '';
	// create connection to socket file
	sList[ uid ] = net.connect( path );
	// cleanup if socket dies for whatever reason
	sList[ uid ].on( 'end', function() {
		// remove socket connection from list
		delete sList[ uid ];
		delete tmpStore[ uid ];
		// shouldn't happen often, so not worried about memory hit
		sPath.splice( sPath.indexOf( path ), 1 );
	});
	// aggregate data when it's received
	sList[ uid ].on( 'data', function( data ) {
		isAgg = true;
		// ensure there is actually data
		if ( !data ) return;
		var tdata = data.toString();
		// temporarily store data if only part of the string has been sent
		// check for entire JSON string by null char at end
		if ( tdata.charCodeAt( tdata.length - 1 ) !== 0 ) {
			tmpStore[ uid ] += tdata;
			return;
		} else {
			// remove null character at the end of the JSON data
			tmpStore[ uid ] += tdata.substr( 0, tdata.length - 1 );
		}
		// extend the bobj with the stored data
		objExtend( JSON.parse( tmpStore[ uid ]));
		// cleanup tmpStore
		tmpStore[ uid ] = '';
		// check if all socket callbacks have fired
		if ( ++aggCounter === sPath.length ) {
			aggCounter = 0;
			isAgg = false;
			// emit data if all socket callbacks have fired
			emitter();
		}
	});
	// add path to global path list
	sPath.push( path );
}


// execute immediately on startup, then rerun based on user parameters
(function folderCheck() {
	// if currently aggregating data, don't check for new socket files
	if ( isAgg ) {
		setTimeout( folderCheck, 15 );
		return;
	}
	// scan folder for new socket files
	fs.readdir( cli.dir, function( e, files ) {
		for ( var i = 0; i < files.length; i++ ) {
			if ( sPath.indexOf( files[i] ) === -1 && rSock.test( files[i] )) {
				// send path to receiver socket connector
				socketConnect( cli.dir + '/' + files[i] );
			}
		}
	});
	setTimeout( folderCheck, cli.scan );
}());


// aggregate data from receivers at interval then broadcast to all listeners
gtime = ptime = Date.now() - cli.time;
(function aggregate() {
	// make sure aggregation is still not happening
	if ( isAgg ) {
		setTimeout( aggregate, 15 );
		return;
	}
	// get current time
	ptime = Date.now();
	// loop through sList and get data from all sockets
	for ( var i in sList ) {
		sList[i].write( '\n' );
	}
	// call aggregation at time interval and adjust fire time for small extra lapse
	setTimeout( aggregate, cli.time + cli.time + gtime - ptime );
	gtime = ptime;
}());


// broadcast JSON as string through socket file or port
net.createServer(function( socket ) {
	// generate random key for message queue
	var key = ( Math.random() * 1e17 ).toString( 17 );
	// add function to message queue to be fired when data needs to be sent
	eList[ key ] = socket;
	// remove function from queue if connection closes
	socket.on( 'end', function() {
		delete eList[ key ];
	});
}).listen( cli.port );
