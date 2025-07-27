#!/bin/bash

echo "🚀 Setting up Case development environment..."

# Install Claude Code
echo "🤖 Installing Claude Code..."
npm install -g @anthropic-ai/claude-code
echo "✅ Claude Code installed"

# Copy devcontainer env if .env doesn't exist
if [ ! -f /workspace/.env ]; then
    cp /workspace/.env.devcontainer /workspace/.env
    echo "✅ Created .env file from devcontainer template"
fi

# Install dependencies
echo "📦 Installing dependencies..."
cd /workspace
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run prisma:generate

# Wait for database to be ready
echo "⏳ Waiting for database..."
until pg_isready -h db -U case; do
    sleep 2
done

# Run migrations
echo "🗄️ Running database migrations..."
npm run prisma:migrate -- --name init || echo "Migrations may already exist"

echo ""
echo "✅ Development environment ready!"
echo ""
echo "Quick commands:"
echo "  npm run dev          - Start the development server"
echo "  npm run prisma:studio - Open Prisma Studio (database GUI)"
echo "  npm test            - Run tests"
echo ""
echo "Claude Code commands:"
echo "  claude              - Start Claude Code interactive mode"
echo "  claude -c 'task'    - Run a quick command"
echo "  claude --help       - Show Claude Code help"
echo ""