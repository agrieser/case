#!/bin/bash

echo "🚀 Setting up Case - Slack Incident Management App"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update .env with your Slack app credentials and database URL"
    echo ""
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run prisma:generate

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update your .env file with Slack app credentials"
echo "2. Set up your PostgreSQL database"
echo "3. Run 'npm run prisma:migrate' to create database tables"
echo "4. Run 'npm run dev' to start the development server"
echo ""
echo "For Slack app setup:"
echo "- Use the manifest.yml file to configure your Slack app"
echo "- Enable Socket Mode in your Slack app settings"
echo "- Install the app to your workspace"