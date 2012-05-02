/* Hit Receiver
 * Use this to hit a URL with parameters that need to be aggregated.
 * This will aggregate those items by a set time interval then broadcast
 * the results to a socket file that will be read by a collector.
 * The URL parameters should look like the following:
 * http://mysite.com?d=val0&d=val1
 */


var http = require( 'http' ),
	url = require( 'url' ),
	net = require( 'net' ),
	cli = require( 'commander' ),
	queue = {},
	bobj = {},
	ci, hdata, hi;

cli.version( '0.1.0' )
	.option( '-f, --file [file]', 'Location to write the socket file', String, 'sockets/receiver.sock' )
	.option( '-p, --port [port]', 'Port or path for http server to run on', 7331 )
	.option( '-d, --debug', 'Enable debugging' )
	.parse( process.argv );


// output stuff to debug log
function debugLog( msg ) {
	var time = new Date();
	console.log( '[' +
		( time.getMonth() + 1 ) +
		'/' + time.getDate() +
		'/' + time.getFullYear() +
		'-' + time.getHours() +
		':' + time.getMinutes() +
		':' + time.getSeconds() +
	']', msg );
}


// broadcast JSON as string through socket file
net.createServer(function( socket ) {
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
		hdata = url.parse( req.url, true ).query.d;
		// check if is String or an Array
		if ( hdata instanceof Array ) {
			for ( hi = 0; hi < hdata.length; hi++ ) {
				if ( !bobj[hdata[hi]] ) bobj[hdata[hi]] = 0;
				bobj[hdata[hi]]++;
			}
		} else {
			if ( !bobj[hdata] ) bobj[hdata] = 0;
			bobj[hdata]++;
		}
	} catch( e ) {
		if ( cli.debug ) {
			debugLog( e );
		}
	};
}).listen( cli.port );
