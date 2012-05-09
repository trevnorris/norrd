var net = require( 'net' ),
	redis = require( 'redis' ),
	cli = require( 'commander' ),
	tmpDoc = '',
	bobj, conn, client;

require( '../utils' );

cli.option( '-s, --sock [socket]', 'Location of socket file where collector is broadcasting', '/tmp/norrd-collector.sock' )
	.option( '-p, --port [port]', 'Port number of redis instance', 6379 )
	.option( '-h, --host [host]', 'Host of redis instance', 'localhost' )
	.option( '-d, --debug', 'Enable debugging' )
	.parse( process.argv );

function sendData() {
}

client = redis.createClient( cli.port, cli.host );
client.on( 'error', function( err ) {
	if ( cli.debug ) {
		debugLog( err );
	}
});


conn = net.connect( cli.sock );
conn.on( 'data', function( data ) {
	data = data.toString();
	if ( data.charCodeAt( data.length - 1 ) !== 0 ) {
		tmpDoc += data;
		return;
	} else {
		tmpDoc += data.substr( 0, data.length - 1 );
	}
	bobj = JSON.parse( tmpDoc );
	tmpDoc = '';
	sendData();
});
