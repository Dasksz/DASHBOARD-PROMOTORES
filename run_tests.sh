#!/bin/bash
node -c js/app/utils.js
if [ $? -ne 0 ]; then exit 1; fi
node -c js/app/app.js
if [ $? -ne 0 ]; then exit 1; fi
echo "Tests passed."
