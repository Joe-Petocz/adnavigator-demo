#!/bin/bash
npx serve dist -s -n -l tcp://0.0.0.0:${PORT:-8080}
