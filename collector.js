/* Aggregate Collector
 * Connects to each socket file created by receiver.js and aggregates data sent out
 */


var http = require( 'http' ),
	net = require( 'net' ),
	fs = require( 'fs' ),
	cli = require( 'commander' ),
	// list of emmiters that will need to receive the data
	eList = {},
	// list of receiver socket connections
	rList = {},
	// path of socket files that are currently active
	rPath = [],
	// aggregated object that will be broadcast at interval
	bobj = {},
	// bobj is first stringified and stored before broadcast
	stringified = '',
	// don't read in new sockets when aggregating data
	isAgg = false,
	aggCounter = 0,
	gtime = 0,
	ptime, ci, hdata, hi;

cli.version( '0.1.0' )
	.option( '-f, --dir [dir]', 'Directory containing the receiver.js socket files', String, './sockets' )
	.option( '-p, --port [port]', 'Port or path to broadcast aggregated data', 7331 )
	.option( '-s, --scan [numb]', 'Time to rescan socket dir for new socket files', Number, 30000 )
	.option( '-t, --time [numb]', 'Time interval (in milliseconds) between data broadcasts', Number, 1000 )
	.parse( process.argv );


// extend the bobj object from another
function objExtend( data ) {
	for ( var i in data ) {
		if ( !bobj[i] ) bobj[i] = 0;
		bobj[i] += data[i];
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


// create connection to receive socket file and add to rList
function socketConnect( path ) {
	// create a uid for the given socket queue
	var uid = ( Math.random() * 1e17 ).toString( 36 );
	// create connection to socket file
	rList[ uid ] = net.connect( path );
	// cleanup if socket dies for whatever reason
	rList[ uid ].on( 'end', function() {
		// remove socket connection from list
		delete rList[ uid ];
		// shouldn't happen often, so not worried about memory hit
		rPath.splice( rPath.indexOf( path ), 1 );
	});
	// aggregate data when it's received
	rList[ uid ].on( 'data', function( data ) {
		isAgg = true;
		if ( !data ) return;
		var tdata = data.toString();
		objExtend( JSON.parse( data.toString() ));
		// check if all socket callbacks have fired
		if ( ++aggCounter === rPath.length ) {
			aggCounter = 0;
			isAgg = false;
			// emit data here
			emitter();
		}
	});
	// add path to global path list
	rPath.push( path );
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
			if ( rPath.indexOf( files[i] ) === -1 ) {
				// send path to receiver socket connector
				socketConnect( cli.dir + '/' + files[i] );
			}
		}
	});
	setTimeout( folderCheck, cli.scan );
}());


// aggregate data from receivers at interval then broadcast to all listeners
//gtime = ptime = Date.now() - cli.time;
(function aggregate() {
	// make sure aggregation is still not happening
	if ( isAgg ) {
		setTimeout( aggregate, 15 );
		return;
	}

	// get current time
	//ptime = Date.now();

	// loop through rList and get data from all sockets
	for ( var i in rList ) {
		rList[i].write( '\n' );
	}

	// call aggregation at time interval
	// TODO: fix the timer in setTimeout for more reliable intervals
	setTimeout( aggregate, cli.time );
	// adjust fire time for small extra lapse
	//setTimeout( interval, cli.time + cli.time + gtime - ptime );
	//gtime = ptime;
}());


// broadcast JSON as string through socket file
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
