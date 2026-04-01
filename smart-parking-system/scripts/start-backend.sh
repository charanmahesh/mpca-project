#!/bin/bash
# Start backend server with MQTT broker

set -e

BACKEND_DIR="backend"
NODE_ENV="${1:-development}"

echo "=========================================="
echo "Smart Parking - Backend Startup Manager"
echo "=========================================="
echo "Environment: $NODE_ENV"

case "${2:-start}" in
  start)
    echo "🚀 Starting backend server..."
    echo "   Environment: $NODE_ENV"
    echo "   Port: 3000"
    echo "   Database: $BACKEND_DIR/data/parking.db"
    echo ""
    
    cd "$BACKEND_DIR"
    NODE_ENV="$NODE_ENV" npm start
    ;;

  dev)
    echo "🔄 Starting backend in development mode..."
    echo "   Auto-reload: ON"
    echo "   Debug: ON"
    
    cd "$BACKEND_DIR"
    NODE_ENV="$NODE_ENV" npm run dev
    ;;

  test)
    echo "🧪 Running backend tests..."
    cd "$BACKEND_DIR"
    npm test
    ;;

  lint)
    echo "🔍 Running linter..."
    cd "$BACKEND_DIR"
    npm run lint
    ;;

  setup)
    echo "⚙️  Setting up backend..."
    echo "   1. Installing dependencies..."
    cd "$BACKEND_DIR"
    npm install
    echo ""
    echo "   2. Initializing database..."
    npm start &
    sleep 3
    kill %1
    cd ..
    echo "✅ Backend setup complete!"
    echo "   Start: npm run backend:start"
    ;;

  *)
    echo "Usage: $0 [environment] {start|dev|test|lint|setup}"
    echo ""
    echo "Environments: development, production (default: development)"
    echo ""
    echo "Commands:"
    echo "  start - Start server (default)"
    echo "  dev   - Start with auto-reload (nodemon)"
    echo "  test  - Run test suite"
    echo "  lint  - Check code quality"
    echo "  setup - Initialize backend (install + DB init)"
    echo ""
    echo "Examples:"
    echo "  npm run backend:start              (dev mode)"
    echo "  ./scripts/start-backend.sh production"
    ;;
esac
