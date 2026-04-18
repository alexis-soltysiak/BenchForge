# Frontend

Vite + React + TypeScript frontend for BenchForge.

For the full local setup flow, including PostgreSQL, backend startup, migrations,
and first MVP test steps, use the repository root README:
[README.md](/Users/alexis/Documents/GitHub/BenchForge/README.md:1).

## Local frontend workflow

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the dev server:

   ```bash
   npm run dev
   ```

Or from the repository root:

```bash
./scripts/dev-frontend.sh
```

The app expects the backend API to be available at `VITE_API_URL`, which defaults
to `http://localhost:8000/api` in `.env.example`.

## Frontend baseline

- typed React app shell
- Tailwind CSS setup
- ShadCN-ready configuration
- ESLint and Prettier
- `@tanstack/react-query` dependency for upcoming data flows

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```
