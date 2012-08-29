var net = require('net'),
	redis = require('redis'),
	cli = require('commander'),
	tmpDoc = '',
	bobj, conn, client;

require('../server/utils');

cli.option('-d, --debug', 'Enable debugging')
	.option('-e, --expire', 'Hash expire time in sec. Set to zero for indefinite.', Number, 21600)
	.option('-o, --host [host]', 'Host of redis instance', 'localhost')
	.option('-p, --port [port]', 'Port number of redis instance', 6379)
	.option('-s, --sock [socket]', 'Location of socket file where collector is broadcasting', '/tmp/norrd-collector.sock')
	.parse(process.argv);

// increment values in redis server, and create if doesn't exist
function sendData() {
	var i, j;
	// loop through timestamps in bobj
	for (i in bobj) {
		// now loop though entries in each timestamp
		for (j in bobj[i]) {
			client.hincrby(i, j, bobj[i][j]);
			// set expiration time on data
			if (cli.expire > 0) {
				client.expire(i, cli.expire);
			}
		}
	}
}

// connect to redis instance
client = redis.createClient(cli.port, cli.host);
client.on('error', function(err) {
	if (cli.debug) {
		debugLog(err);
	}
});

// connect to collector
conn = net.connect(cli.sock);
conn.on('data', function(data) {
	data = data.toString();
	// check end of string for end of data
	if (data.charCodeAt(data.length - 1) !== 10)
		return tmpDoc += data;
	else
		tmpDoc += data.substr(0, data.length - 1);
	// parse the completed serialized data
	bobj = JSON.parse(tmpDoc);
	tmpDoc = '';
	sendData();
});
