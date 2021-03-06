/* Hit Receiver
 * Use this to hit a URL with parameters that need to be aggregated.
 * This will aggregate those items by a set time interval then broadcast
 * the results to a socket file that will be read by a collector.
 * The URL parameters should look like the following:
 * http://mysite.com?_=val1,val2,val3,val4
 *
 * --port option can also be given a path to a socket file. So this
 * can be load balanced behind nginx or the like.
 *
 * --file can be given a port to broadcast data. Doesn't require socket file.
 */


var http = require('http'),
	url = require('url'),
	net = require('net'),
	cli = require('commander'),
	bobj = {},          // base object serialized and sent out after aggregation
	tmpobj = {},        // tmp store data to ensure proper data backfill
	current = 0,        // store current epoch to check if data needs to be backfilled
	writtenTo = false,  // think used to check if values have been written to tmpobj
	tmptime, tmpref, ci, hdata, htime, hi;

require('./utils');

// set umask for socket files
process.umask(0);

// parse command line options
cli.option('-f, --file [file]', 'Location to write the socket file', '/tmp/norrd-receiver-out/receiver.sock')
	.option('-p, --port [port]', 'Port or path for http server to run on', 7331)
	.option('-i, --intv [numb]', 'Time interval for data aggregation', Number, 1000)
	.option('-d, --debug', 'Enable debugging')
	.parse(process.argv);


// broadcast JSON as string through specified parameter
net.createServer(function(socket) {
	if (cli.debug) {
		debugLog('server connected');
		socket.on('end', function() {
			debugLog('server disconnected');
		});
	}
	socket.on('data', function() {
		tmptime = Date.now();
		// check if need to transfer data from tmpobj to bobj
		if (current + cli.intv < tmptime) {
			if (writtenTo) {
				bobj[ current ] = tmpobj;
				tmpobj = {};
				writtenTo = false;
			}
			current = tmptime - (tmptime % cli.intv);
		}
		// send JSON and append null so can indentify end of feed
		socket.write(JSON.stringify(bobj) + '\n');
		// clear all items in broadcast object
		for (ci in bobj)
			delete bobj[ci];
	});
}).listen(cli.file);


// create http server to listen for hits
http.createServer(function(req, res) {
	res.writeHead(202, { 'Connection' : 'close' });
	res.end();
	tmptime = Date.now();
	// check if current interval should be incremented
	if (current + cli.intv < tmptime) {
		// yes, so need to store tmpobj into bobj
		if (writtenTo) {
			bobj[ current ] = tmpobj;
			tmpobj = {};
			writtenTo = false;
		}
		current = tmptime - (tmptime % cli.intv);
	}
	// don't like using try/catch to grab parsing errors
	try {
		// grab URL query parameters
		hdata = url.parse(req.url, true).query;
		// split aggregates into individual entries
		hdata._ = hdata._.split(',');
	} catch(e) {
		if (cli.debug) {
			debugLog('hdata Parse Error: ' + e);
		}
		return;
	}
	// set interval time if timestamp was sent
	if (hdata.t) htime = hdata.t - (hdata.t % cli.intv);
	// no timestamp was sent so use current interval
	else htime = current;
	// cleanup for looping later
	delete hdata.t;
	// set tmpref to tmpobj if full interval hasn't passed
	if (htime + cli.intv > current) {
		if (hdata._.length >= 1 && !writtenTo) {
			writtenTo = true;
		}
		tmpref = tmpobj;
	} else {
		// backfill data based on passed timestamp
		if (!bobj[ htime ]) bobj[ htime ] = {};
		tmpref = bobj[ htime ];
	}
	for (hi = 0; hi < hdata._.length; hi++) {
		if (!tmpref[ hdata._[ hi ]]) tmpref[ hdata._[ hi ]] = 0;
		tmpref[ hdata._[ hi ]]++;
	}
	// cleanup d data
	delete hdata._;
	// loop through remaining values in hdata
	for (hi in hdata) {
		if (!tmpref[ hi ]) tmpref[ hi ] = 0;
		// cast hdata as Number
		tmpref[ hi ] += +hdata[ hi ];
	}
}).listen(cli.port);
