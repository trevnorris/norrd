norrd - Node Data Aggregator

This project is still in way early stages.

`scripts/start-norrd.sh` - start the collector/receiver

`script/kill-norrd.sh` - for now, kills all node processes and rm's dead socket files

`client/` - socket.io service to stream data to browser real-time

`conf/` - example configuration files

`db/` - redis service to store values

`server/` - contains necessities for collector/receiver


**Note:** use the following command to cat out data from socket file: `nc -U <socket_file>`
