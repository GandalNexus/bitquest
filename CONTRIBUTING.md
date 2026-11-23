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

- Use **Prisma** ORM for all queries (schema in `prisma/schema.prisma`).
- Create migrations additively (no DROP / no rename) for backward compat.
- All existing migrations ship with CI — see `prisma/migrations/`.
- Index composites on hot paths (cf. LOT 39, 41).

## Project Structure (actuel)

```
bitquest/
├── src/app/             # Next.js 16 pages + API routes
│   ├── (admin)/         # Admin + Studio route groups
│   ├── (app)/           # Pages apprenants (layout AppShell)
│   ├── api/             # API handlers (REST-ish)
│   └── academy/         # Catalogue académie public
├── src/components/       # Composants réutilisables (shadcn-like)
├── src/lib/              # Business logic, helpers, protocole BitLab
├── prisma/              # Schema + migrations + seed.ts
├── tests/e2e/           # Playwright scenarios
├── scripts/             # Bash helpers (setup-dev, smoke, backup-postgres…)
└── docs/                # 6 livrables publics (voir ci-dessous)
```

## Development Setup

**Chemin rapide** (recommandé, Docker) :

```bash
git clone <repo>
cd bitquest
./scripts/setup-dev.sh         # 6 étapes idempotentes, ~2 min
# Variables optionnelles : SKIP_SEED=1, BASE=<url>
```

Le script :
1. Vérifie Docker + compose v2.
2. Lance `docker-compose.dev.yml` (postgres + redis + app Next.js).
3. Attend postgres healthy (polling jusqu'à 60s).
4. Applique les migrations Prisma.
5. Seed idempotent (users, quêtes, académie, ChapterQuest, flags).
6. Smoke test routes (22 routes publiques).

## Testing

```bash
# Unit (vitest) : 898 tests
docker exec bitquest-dev npx vitest run

# Typecheck
docker exec bitquest-dev npx tsc --noEmit

# Lint
docker exec bitquest-dev npx eslint src/

# E2E Playwright (API-level, 23 scénarios)
docker exec bitquest-dev npx playwright test tests/e2e/

# Smoke HTTP (22 routes)
./scripts/smoke-routes.sh
```

Before submitting a PR, **all four must pass** (vitest + tsc + eslint +
smoke). L'ajout d'une nouvelle route de mutation **sans CSRF** sera
détecté par le gel de propriété (`src/lib/auth/csrf-coverage.test.ts`).

## Documents publics (6 livrables)

- `docs/FEATURES-INVENTORY.md` — matrice DONE/PARTIAL/VERIFY/TODO.
- `docs/IMPLEMENTATION-STATUS.md` — critères d'acceptation P0→P3.
- `docs/BITQUEST-BITLAB-INTEGRATION.md` — protocole bout-en-bout.
- `docs/TECHNICAL-DEBT.md` — dette classée.
- `docs/RELEASE-READINESS.md` — checklist prod + env vars.
- `docs/CERTIFICATES_V1.md` — spec Certificate v1 HMAC.

## License

By contributing to BitQuest, you agree that your contributions will be licensed
under AGPL-3.0.

---

Thank you for helping make Bitcoin education accessible to everyone! ⚡
