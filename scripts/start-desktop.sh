#!/bin/bash
set -e

# Start Xvfb
Xvfb :1 -screen 0 768x576x24 &
sleep 1

# Start Fluxbox window manager
fluxbox &
sleep 1

# Start VNC server
x11vnc -display :1 -forever -nopw -shared -rfbport 5900 &
sleep 1

# Start noVNC web client
websockify --web=/usr/share/novnc/ 6080 localhost:5900 &

# Setup fixtures for tasks
/usr/local/bin/setup-fixtures.sh

echo "Desktop environment ready"
echo "VNC: port 5900"
echo "noVNC: http://localhost:6080/vnc.html"

# Keep container running
wait
