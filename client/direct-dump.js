var app = require( 'http' ).createServer( handler ),
	net = require( 'net' ),
	fs = require( 'fs' ),
	cli = require( 'commander' ),
	io = require( 'socket.io' ).listen( app ),
	netClient;

io.set( 'log level', 1 );

cli.version( '0.1.0' )
	.option( '-f, --file [file]', 'Location of collector.js socket file', '/tmp/norrd-collector.sock' )
	.option( '-p, --port [port]', 'Port to listen for incoming HTTP requests', Number, 8331 )
	.parse( process.argv );

app.listen( cli.port );
netClient = net.connect( cli.file );

function handler( req, res ) {
	fs.readFile( __dirname + '/index.html', function( err, data ) {
		if ( err ) {
			res.writeHead( 500 );
			return res.end( 'Error loading index.html' );
		}
		res.writeHead( 200 );
		res.end( data );
	});
}

netClient.on( 'data', function( data ) {
	io.sockets.emit( 'feed', data.toString() );
});

io.sockets.on( 'connection', function( socket ) {
	//io.sockets.emit( 'feed', { will : 'be received by everyone' });

	socket.on( 'disconnect', function() {
		io.sockets.emit( 'user disconnected' );
	});
});
