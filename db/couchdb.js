var net = require( 'net' ),
	cli = require( 'commander' ),
	nano = require( 'nano' ),
	netClient, db;

require( './utils' );

cli.option( '-b, --db [name]', 'Name of CouchDB database to use', String, 'norrd-data' )
	.option( '-c, --conn [url]', 'Location of the CouchDB instance', String, 'http://localhost' )
	.option( '-p, --port [port]', 'Port number of the CouchDB instance', 5984 )
	.option( '-n, --net [loc]', 'Location (URL or socket) of collector', '/tmp/norrd-collector.sock' )
	.option( '-d, --debug', 'Enable debugging' )
	.parse( process.argv );

nano = nano( cli.conn + ':' + cli.port );
db = nano.db.use( cli.db );
netClient = net.connect( cli.net );

function receiveDbData( er, ok ) {
	if ( cli.debug ) {
		if ( er ) debugLog( 'ERROR:', er );
	}
}

function onNetData( data ) {
	db.insert( JSON.parse( data.toString()), Date.now(), receiveDbData );
}

netClient.on( 'data', onNetData );

console.log( 'server started' );
