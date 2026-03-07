# Contributing to Krab

🦀 Thank you for your interest in contributing to Krab!

## Getting Started

### Prerequisites
- Node.js 22+
- pnpm (recommended) or npm
- Git

### Development Setup

```bash
# Clone the repository
git clone https://github.com/OpenKrab/Krab.git
cd Krab

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run in development mode
pnpm dev
```

## Project Structure

```
Krab/
├── src/
│   ├── core/           # Agent core, config, types
│   ├── mcp/           # MCP Client/Server
│   ├── memory/        # Conversation & vector memory
│   ├── providers/     # LLM providers
│   ├── tools/         # Built-in tools
│   ├── channels/      # Messaging channels
│   ├── gateway/       # WebSocket gateway
│   └── cli/           # CLI commands
├── desktop/           # Electron desktop app
├── web/              # Web UI
└── docs/              # Documentation
```

## Making Changes

### 1. Create a Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes
- Follow the existing code style
- Add comments for complex logic
- Keep functions focused and small

### 3. Test Your Changes
```bash
# Run tests
pnpm test

# Build to check for errors
pnpm build
```

### 4. Commit Your Changes
```bash
git add .
git commit -m "feat: add your feature description"
```

## Code Style

- Use TypeScript with strict mode
- Use ESM imports (no CommonJS)
- Follow existing naming conventions
- Add types for all function parameters

## Submitting a Pull Request

1. Push your branch to GitHub
2. Open a Pull Request
3. Describe your changes
4. Wait for review

## Reporting Issues

Use GitHub Issues to report:
- Bugs
- Feature requests
- Documentation improvements

## License

By contributing to Krab, you agree that your contributions will be licensed under the MIT License.
