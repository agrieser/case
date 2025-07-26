# Development with DevContainer

This project includes a DevContainer configuration for a consistent development environment with PostgreSQL.

## Quick Start

### VS Code / GitHub Codespaces

1. Open the project in VS Code
2. Install the "Dev Containers" extension if not already installed
3. When prompted, click "Reopen in Container" or use Command Palette: "Dev Containers: Reopen in Container"
4. Wait for the container to build (first time takes a few minutes)
5. The database and development environment will be automatically set up

### Manual Setup

If you prefer to run the containers manually:

```bash
cd .devcontainer
docker-compose up -d
docker-compose exec app bash
```

## What's Included

- **Node.js 20** development environment
- **PostgreSQL 17** database running as a separate container
- **Claude Code** for AI-powered development assistance
- **Prisma CLI** and database tools
- **PostgreSQL client** tools via devcontainer features
- **Test database** configuration
- **VS Code extensions** for TypeScript, Prisma, and PostgreSQL

## Database Access

The PostgreSQL database is automatically configured with:
- Host: `db` (from within containers) or `localhost:5432` (from host)
- Database: `trace`
- User: `trace`
- Password: `trace_password`

### Prisma Studio

To view and edit your database visually:

```bash
npm run prisma:studio
```

Then open http://localhost:5555 in your browser.

## Running Tests

The devcontainer is configured with a test database. Run tests with:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Environment Variables

The devcontainer automatically uses `.env.devcontainer` settings. Your Slack credentials still need to be added:

1. Copy your Slack app credentials into `.env`:
   - `SLACK_BOT_TOKEN`
   - `SLACK_SIGNING_SECRET`  
   - `SLACK_APP_TOKEN`

## Troubleshooting

### Database Connection Issues

If you encounter database connection issues:

```bash
# Check if PostgreSQL is running
docker-compose ps

# View PostgreSQL logs
docker-compose logs db

# Restart the database
docker-compose restart db
```

### Reset Database

To completely reset your development database:

```bash
# Drop all tables and re-run migrations
npx prisma migrate reset
```

## Docker Compose Services

- **app**: Main development container with Node.js 20
- **db**: PostgreSQL 17 database