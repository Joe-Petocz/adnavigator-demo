#!/bin/bash
echo "PORT is set to: $PORT"
npx serve dist -s -n -l tcp://0.0.0.0:$PORT
