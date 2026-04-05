#!/bin/bash
# ─── TeamChatX HTTPS Tunnel Setup ─────────────────────────
# Creates HTTPS tunnels for both backend and frontend
# so video call, screen share, etc. work on any device
#
# Usage: bash start-tunnel.sh
# ──────────────────────────────────────────────────────────

echo ""
echo "=========================================="
echo "  TeamChatX HTTPS Tunnel Setup"
echo "=========================================="
echo ""

# Start backend tunnel (port 5000)
echo "[1/2] Starting backend tunnel (port 5000)..."
npx localtunnel --port 5000 --subdomain teamchatx-api &
BACKEND_PID=$!
sleep 3

# Start frontend tunnel (port 5173)
echo "[2/2] Starting frontend tunnel (port 5173)..."
npx localtunnel --port 5173 --subdomain teamchatx-app &
FRONTEND_PID=$!
sleep 3

echo ""
echo "=========================================="
echo "  TUNNELS READY!"
echo "=========================================="
echo ""
echo "  Backend:  https://teamchatx-api.loca.lt"
echo "  Frontend: https://teamchatx-app.loca.lt"
echo ""
echo "  Share this link with anyone:"
echo "  https://teamchatx-app.loca.lt"
echo ""
echo "  Press Ctrl+C to stop tunnels"
echo "=========================================="
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
