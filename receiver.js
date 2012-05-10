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
	ci, hdata, htime, hi;

require( './utils' );

cli.option( '-f, --file [file]', 'Location to write the socket file', 'sockets/receiver.sock' )
	.option( '-p, --port [port]', 'Port or path for http server to run on', 7331 )
	.option( '-i, --intv [numb]', 'Time interval for data aggregation', 1000 )
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
	// don't like using try/catch to grab parsing errors
	try {
		hdata = url.parse( req.url, true ).query;
	} catch( e ) {
		if ( cli.debug ) {
			debugLog( 'hdata Parse Error: ' + e );
		}
		return;
	}
	// get time from broadcast if exists
	htime = hdata.t || Date.now();
	//set htime for given time interval
	htime -= htime % cli.intv;
	// split aggregates into individual entries
	hdata = hdata.d.split( ',' );
	// ensure htime exists in bobj
	if ( !bobj[ htime ] ) bobj[ htime ] = {};
	// write each entry to interval's bobj entry
	for ( hi = 0; hi < hdata.length; hi++ ) {
		if ( !bobj[ htime ][ hdata[ hi ]]) bobj[ htime ][ hdata[ hi ]] = 0;
		bobj[ htime ][ hdata[ hi ]]++;
	}
}).listen( cli.port );
