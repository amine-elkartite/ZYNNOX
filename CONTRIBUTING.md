# Contributing

## Install

Use Node.js 22 and install from the repo root:

```bash
npm install
```

## Development

Run both apps:

```bash
npm run dev
```

Run one workspace:

```bash
npm run dev:server
npm run dev:client
```

## Tests

```bash
npm run test
npm run test:server
npm run test:client
```

## Lint

```bash
npm run lint
```

## Branch Naming

Use short, scoped names such as `chore/archive-python`, `fix/billing-credit-debit`, or `refactor/client-pages`.

## Pull Requests

Keep PRs focused, include a concise summary, list test results, call out config or migration changes, and avoid committing generated junk such as `venv/`, `node_modules/`, build output, or local secrets.
