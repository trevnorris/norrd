var app = require('http').createServer(handler),
	net = require('net'),
	fs = require('fs'),
	cli = require('commander'),
	io = require('socket.io').listen(app),
	partData = '',
	netClient, tmp;

io.set('log level', 1);

cli.version('0.1.0')
	.option('-f, --file [file]', 'Location of collector.js socket file', '/tmp/norrd-collector.sock')
	.option('-p, --port [port]', 'Port to listen for incoming HTTP requests', Number, 8331)
	.parse(process.argv);

app.listen(cli.port);
netClient = net.connect(cli.file);

function handler(req, res) {
	fs.readFile(__dirname + '/index.html', function(err, data) {
		if (err) {
			res.writeHead(500);
			return res.end('Error loading index.html');
		}
		res.writeHead(200);
		res.end(data);
	});
}

netClient.on('data', function(data) {
	tmp = data.toString();
	if (tmp.charCodeAt(tmp.length - 1) !== 10) {
		partData += tmp;
		return;
	}
	partData += tmp.substr(0, tmp.length - 1);
	io.sockets.emit('feed', partData);
	// cleanup
	partData = '';
});
