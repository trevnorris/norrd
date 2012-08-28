#!/bin/bash

mkdir -p /tmp/norrd-receiver-in
chmod a+w /tmp/norrd-receiver-in

mkdir -p /tmp/norrd-receiver-out
chmod a+w /tmp/norrd-receiver-out

for i in {1..6}
do
	node receiver -p /tmp/norrd-receiver-in/multiserv${i}.sock -f /tmp/norrd-receiver-out/receiver${i}.sock &
done
