#!/bin/bash

DIR="$( cd -P "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

mkdir -p /tmp/norrd-receiver-in
chmod a+w /tmp/norrd-receiver-in

mkdir -p /tmp/norrd-receiver-out
chmod a+w /tmp/norrd-receiver-out

for i in {1..6}
do
	# use some cli args to run multiple instances
	node $DIR/../server/receiver -p /tmp/norrd-receiver-in/multiserv${i}.sock -f /tmp/norrd-receiver-out/receiver${i}.sock &
done

# run collector with defaults in config file
node $DIR/../server/collector &
