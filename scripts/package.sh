#!/usr/bin/env bash
set -euo pipefail
UUID="maximise-to-workspace@ardenn.github.io"
zip -j "${UUID}.zip" extension.js metadata.json
echo "Created ${UUID}.zip"
