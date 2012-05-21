/* Hit Receiver
 * Use this to hit a URL with parameters that need to be aggregated.
 * This will aggregate those items by a set time interval then broadcast
 * the results to a socket file that will be read by a collector.
 * The URL parameters should look like the following:
 * http://mysite.com?d=val1,val2,val3,val4
 *
 * --port option can also be given a path to a socket file. So this
 * can be load balanced behind nginx or the like.
 *
 * --file can be given a port to broadcast data. Doesn't require socket file.
 */


var http = require( 'http' ),
	url = require( 'url' ),
	net = require( 'net' ),
	cli = require( 'commander' ),
	bobj = {},
	tmpobj = {},
	current = 0,
	writtenTo = false,
	tmptime, ci, hdata, htime, hi;

require( './utils' );

cli.option( '-f, --file [file]', 'Location to write the socket file', 'sockets/receiver.sock' )
	.option( '-p, --port [port]', 'Port or path for http server to run on', 7331 )
	.option( '-i, --intv [numb]', 'Time interval for data aggregation', Number, 1000 )
	.option( '-d, --debug', 'Enable debugging' )
	.parse( process.argv );


// broadcast JSON as string through specified parameter
net.createServer(function( socket ) {
	if ( cli.debug ) {
		debugLog( 'server connected' );
		socket.on( 'end', function() {
			debugLog( 'server disconnected' );
		});
	}
	socket.on( 'data', function() {
		tmptime = Date.now();
		// check if need to transfer data from tmpobj to bobj
		if ( current + cli.intv < tmptime ) {
			if ( writtenTo ) {
				bobj[ current ] = tmpobj;
				tmpobj = {};
				writtenTo = false;
			}
			current = tmptime - ( tmptime % cli.intv );
		}
		// send JSON and append null so can indentify end of feed
		socket.write( JSON.stringify( bobj ) + '\n' );
		// clear all items in broadcast object
		for ( ci in bobj )
			delete bobj[ci];
	});
}).listen( cli.file );


// create http server to listen for hits
http.createServer(function( req, res ) {
	res.writeHead( 202, { 'Connection' : 'close' });
	res.end();
	tmptime = Date.now();
	// check if current interval should be incremented
	if ( current + cli.intv < tmptime ) {
		// yes, so need to store tmpobj into bobj
		if ( writtenTo ) {
			bobj[ current ] = tmpobj;
			tmpobj = {};
			writtenTo = false;
		}
		current = tmptime - ( tmptime % cli.intv );
	}
	// don't like using try/catch to grab parsing errors
	try {
		// grab URL query parameters
		hdata = url.parse( req.url, true ).query;
		// split aggregates into individual entries
		hdata.d = hdata.d.split( ',' );
	} catch( e ) {
		if ( cli.debug ) {
			debugLog( 'hdata Parse Error: ' + e );
		}
		return;
	}
	// set interval time if timestamp was sent
	if ( hdata.t ) htime = hdata.t - ( hdata.t % cli.intv );
	// no timestamp was sent so use current interval
	else htime = current;
	// cleanup for looping later
	delete hdata.t;
	// write to tmpobj if full interval hasn't passed
	if ( htime + cli.intv > current ) {
		if ( hdata.d.length >= 1 && !writtenTo ) {
			writtenTo = true;
		}
		for ( hi = 0; hi < hdata.d.length; hi++ ) {
			if ( !tmpobj[ hdata.d[ hi ]] ) tmpobj[ hdata.d[ hi ]] = 0;
			tmpobj[ hdata.d[ hi ]]++;
		}
		// cleanup d data
		delete hdata.d;
		// loop through remaining values in hdata
		for ( hi in hdata ) {
			if ( !tmpobj[ hi ]) tmpobj[ hi ] = 0;
			// cast hdata as Number
			tmpobj[ hi ] += +hdata[ hi ];
		}
	} else {
		// backfill data based on passed timestamp
		// ensure htime exists in bobj
		if ( !bobj[ htime ] ) bobj[ htime ] = {};
		// write each entry to interval's bobj entry
		for ( hi = 0; hi < hdata.d.length; hi++ ) {
			if ( !bobj[ htime ][ hdata.d[ hi ]]) bobj[ htime ][ hdata.d[ hi ]] = 0;
			bobj[ htime ][ hdata.d[ hi ]]++;
		}
		// cleanup d data
		delete hdata.d;
		// loop through remaining values in hdata
		for ( hi in hdata ) {
			if ( !bobj[ htime ][ hi ]) bobj[ htime ][ hi ] = 0;
			// cast hdata as Number
			bobj[ htime ][ hi ] += +hdata[ hi ];
		}
	}
}).listen( cli.port );
