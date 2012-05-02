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
	stringified = '',
	queue = {},
	bobj = {},
	gtime = 0,
	ptime, ci, hdata, hi;

cli.version( '0.1.0' )
	.option( '-t, --time [numb]', 'Time interval (in milliseconds) between data broadcasts', Number, 1000 )
	.option( '-f, --file [file]', 'Location to write the socket file', String, 'sockets/receiver.sock' )
	// can also specify a socket file, if running behind a proxy or the like
	.option( '-p, --port [port]', 'Port for the http server to run on', 7331 )
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


// send data to listeners every cli.time interval
gtime = ptime = Date.now() - cli.time;
(function interval() {
	ptime = Date.now();
	// store data in string
	stringified = JSON.stringify( bobj );
	// loop through net queue and fire each function
	for ( ci in queue ) //if ( queue.hasOwnProperty( i ))
		queue[ci]();
	// clear all items in broadcast object
	for ( ci in bobj ) //if ( bobj.hasOwnProperty( i ))
		delete bobj[ci];
	// clear string memory
	stringified = '';
	// adjust fire time for small extra lapse
	//setTimeout( interval, cli.time );
	setTimeout( interval, cli.time + cli.time + gtime - ptime );
	gtime = ptime;
}());


// broadcast JSON as string through socket file
net.createServer(function( socket ) {
	// generate random key for message queue
	var key = ( Math.random() * 1e17 ).toString( 17 );
	// add function to message queue to be fired when data needs to be sent
	queue[ key ] = function() {
		socket.write( stringified );
	};
	// remove function from queue if connection closes
	socket.on( 'end', function() {
		delete queue[ key ];
	});
	socket.pipe( socket );
}).listen( cli.file );


// create http server to listen for hits
http.createServer(function( req, res ) {
	res.writeHead( 202, { 'Connection' : 'close' });
	res.end();
	// don't like using try/catch to grab parsing errors
	try {
		hdata = url.parse( req.url, true ).query.d;
		for ( hi = 0; hi < hdata.length; hi++ ) {
			if ( !bobj[hdata[hi]] ) bobj[hdata[hi]] = 0;
			bobj[hdata[hi]]++;
		}
	} catch( e ) {
		if ( cli.debug ) {
			debugLog( e );
		}
	};
}).listen( cli.port );
