#!/usr/bin/env bash
# Start the labs: an ssh tunnel to llama.cpp on the Jetson (127.0.0.1:18080 -> orin:8080),
# then the dev server (one port per lab, see labs/devserver.py). Ctrl-C stops both.
# Off the personal tailnet, use the LAN host instead:  ORIN_HOST=orin-lan labs/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${ORIN_HOST:-orin}"
if ! (exec 3<>/dev/tcp/127.0.0.1/18080) 2>/dev/null; then
    ssh -f -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 18080:127.0.0.1:8080 "$HOST"
    echo "tunnel: 127.0.0.1:18080 -> $HOST:8080"
fi
exec python3 -u labs/devserver.py
