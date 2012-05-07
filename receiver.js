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
	ci, hdata, hi;

require( './utils' );

cli.version( '0.1.0' )
	.option( '-f, --file [file]', 'Location to write the socket file', 'sockets/receiver.sock' )
	.option( '-p, --port [port]', 'Port or path for http server to run on', 7331 )
	.option( '-d, --debug', 'Enable debugging' )
	.parse( process.argv );


// broadcast JSON as string through specified parameter
net.createServer(function( socket ) {
	socket.setNoDelay( true );
	if ( cli.debug ) {
		debugLog( 'server connected' );
		socket.on( 'end', function() {
			debugLog( 'server disconnected' );
		});
	}
	socket.on( 'data', function() {
		socket.write( JSON.stringify( bobj ));
		// clear all items in broadcast object
		for ( ci in bobj )
			delete bobj[ci];
	});
	//socket.pipe( socket );
}).listen( cli.file );


// create http server to listen for hits
http.createServer(function( req, res ) {
	res.writeHead( 202, { 'Connection' : 'close' });
	res.end();
	// don't like using try/catch to grab parsing errors
	try {
		hdata = url.parse( req.url, true ).query.d.split( ',' );
		for ( hi = 0; hi < hdata.length; hi++ ) {
			if ( !bobj[hdata[hi]] ) bobj[hdata[hi]] = 0;
			bobj[hdata[hi]]++;
		}
	} catch( e ) {
		if ( cli.debug ) {
			debugLog( 'hdata Parse Error: ' + e );
		}
	}
}).listen( cli.port );
