#!/bin/bash

mkdir -p /tmp/socket-test
chmod a+w /tmp/socket-test

for i in {1..5}
do
	node receiver -p /tmp/socket-test/multiserv${i}.sock -f sockets/receiver${i}.sock &
done
