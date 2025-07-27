# Contributing to Trace

Thank you for your interest in contributing to Trace! We welcome contributions from the community.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a new branch for your feature/fix
4. Make your changes
5. Submit a pull request

## Development Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up test database**
   ```bash
   createdb trace_test
   ```

3. **Configure test environment**
   ```bash
   cp .env.example .env.test
   # Edit .env.test with your test database URL
   ```

4. **Run tests**
   ```bash
   npm test
   ```

## Code Standards

- **TypeScript**: All code must be written in TypeScript
- **Testing**: New features must include tests
- **Linting**: Code must pass ESLint checks
- **Coverage**: Maintain or improve test coverage (currently 80%+)

## Pull Request Guidelines

1. **One feature per PR**: Keep pull requests focused
2. **Clear description**: Explain what and why
3. **Tests required**: Include tests for new functionality
4. **Documentation**: Update README if adding features
5. **Conventional commits**: Use clear commit messages

## Testing

Run the test suite:
```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

## Code Style

We use ESLint and Prettier. Your code will be automatically formatted on commit.

```bash
npm run lint      # Check for issues
npm run lint:fix  # Auto-fix issues
```

## Reporting Issues

- Use GitHub Issues
- Include reproduction steps
- Provide error messages/logs
- Mention your environment (Node version, OS, etc.)

## Security

If you discover a security vulnerability, please email security@your-org.com instead of using the issue tracker.

## Questions?

Feel free to open a discussion in GitHub Discussions for any questions about contributing.

## License

By contributing, you agree that your contributions will be licensed under the same MIT License that covers this project.