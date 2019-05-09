#!/bin/bash

# chmod u+x run.sh

/usr/bin/mongod --dbpath=/home/ubuntu/at-todra-data/data/
/usr/bin/node /home/ubuntu/at-todra-data/binanceImporter.js