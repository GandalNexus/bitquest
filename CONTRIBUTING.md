# Contributing to BitQuest

Thank you for your interest in contributing to BitQuest!

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct. Be
respectful, inclusive, and constructive in all your interactions.

## How to Contribute

### Report Bugs

If you find a bug:

1. First check that the bug hasn't already been reported in
   [Issues](https://github.com/your-username/bitquest/issues)
2. Open a new issue with the "Bug Report" template
3. Include:
   - A clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (OS, Node version, etc.)
   - Screenshots if relevant

### Propose Features

To propose a new feature:

1. Open an issue with the "Feature Request" template
2. Clearly describe the feature and its usefulness
3. Explain how it fits into the project vision
4. Wait for feedback before starting development

### Submit Pull Requests

1. **Fork** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```
3. **Make your changes** following code conventions
4. **Commit** with clear messages:
   ```bash
   git commit -m "feat: add notification system"
   ```
5. **Push** to your fork:
   ```bash
   git push origin feature/my-feature
   ```
6. **Open a Pull Request** to the `main` branch

### Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting, missing semicolons, etc.
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance, dependencies, etc.

Examples:

```
feat: add badge system
fix: correct XP calculation
docs: update README
```

## Code Standards

### TypeScript

- Use strict TypeScript
- Type all functions and variables
- Avoid `any`, prefer `unknown` if necessary
- Use interfaces for complex objects

### React

- Use functional components with hooks
- Prefer Server Components when possible
- Use `'use client'` only when necessary
- Name components in PascalCase

### Style

- Use Tailwind CSS for styling
- Follow existing naming conventions
- Keep components small and reusable
- Comment complex code

### Database

- Use Drizzle ORM for all queries
- Create migrations for schema changes
- Test migrations locally before committing

## Project Structure

```
bitquest/
├── app/              # Next.js pages and routes
│   ├── actions/      # Server Actions
│   ├── dashboard/    # Dashboard pages
│   └── ...
├── components/       # Reusable React components
├── db/              # Database configuration and schema
├── public/          # Static assets
└── middleware.ts    # Next.js middleware
```

## Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/bitquest.git
   cd bitquest
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with your information
   ```

4. **Setup database**

   ```bash
   createdb bitquest
   npx drizzle-kit generate
   npx drizzle-kit push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## Testing

Before submitting a PR:

1. Check that code compiles without errors

   ```bash
   npm run build
   ```

2. Check linting

   ```bash
   npm run lint
   ```

3. Manually test your changes

## License

By contributing to BitQuest, you agree that your contributions will be licensed
under AGPL-3.0.

---

Thank you for helping make Bitcoin education accessible to everyone! ⚡
