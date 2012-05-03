var net = require( 'net' ),
	nano = require( 'nano' )( 'http://localhost:5984' ),
	db = nano.db.use( 'norrd-data' ),
	netClient = net.connect( '/tmp/norrd-collector.sock' );

function receiveDbData( er, ok ) {
	if ( er ) console.log( 'ERROR:', er );
}

function onNetData( data ) {
	db.insert( JSON.parse( data.toString()), Date.now(), receiveDbData );
}

netClient.on( 'data', onNetData );

console.log( 'server started' );
