# ZYNNOX

ZYNNOX is a SaaS AI agent platform for authenticated agent chat, AI Search, website generation, web research workflows, credits, subscriptions, and admin oversight.

## Production Architecture

The production path is the Node/React app:

- `server/`: Express API for auth, credits, billing, agent orchestration, search, website generation, conversation history, and admin endpoints.
- `client/`: React/Vite dashboard for the public site, auth, agent chat, AI Search, website builder, credits, billing, profile, history, and admin views.

Legacy Python prototype and data utility code is archived in `archive/python-legacy/`. It is preserved for reference only and is not part of the production app path.

## Local Setup

```bash
npm install
npm run dev
```

Server only:

```bash
npm run dev:server
```

Client only:

```bash
npm run dev:client
```

The client runs on `http://localhost:5173` and the API runs on `http://localhost:5000` by default.

## Docker Setup

```bash
docker compose up --build
```

The compose stack starts Postgres, the Express server, and the Vite client. Demo mode is enabled by default.

## Testing And Quality

```bash
npm run lint
npm run test
npm run build
npm run check
```

Server tests use Vitest and Supertest. Client tests use Vitest, jsdom, and Testing Library.

## CI

GitHub Actions runs on push and pull request:

- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`

Workflow file: `.github/workflows/ci.yml`.

## Environment Variables

Copy `.env.example` to `.env` for local development.

| Variable | Purpose | Default |
| --- | --- | --- |
| `NODE_ENV` | Runtime environment | `development` |
| `PORT` | API port | `5000` |
| `CLIENT_URL` | Allowed frontend origin list | `http://localhost:5173` |
| `DATABASE_URL` | Optional Postgres connection string | file-backed demo store when empty |
| `MEMORY_FILE` | File store path for demo mode | `server/data/zynnox-store.json` |
| `JWT_SECRET` | JWT signing secret | generated in non-production |
| `FREE_STARTER_CREDITS` | Registration starter credits | `25` |
| `AI_MODE` | `demo` or `production` AI mode | `demo` |
| `AI_API_KEY` | AI provider key | empty |
| `AI_BASE_URL` | OpenAI-compatible base URL | `https://api.openai.com/v1` |
| `AI_MODEL` | AI model name | `gpt-4o-mini` |
| `SEARCH_MODE` | `demo` or `production` search mode | `demo` |
| `SEARCH_PROVIDER` | Search provider selector | `serper` |
| `SEARCH_API_KEY` | Search provider key | empty |
| `BILLING_MODE` | `demo` or `production` billing mode | `demo` |
| `STRIPE_SECRET_KEY` | Stripe API key for production billing | empty |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | empty |
| `STRIPE_PRICE_STARTER` | Stripe price id for Starter | empty |
| `STRIPE_PRICE_PRO` | Stripe price id for Pro | empty |
| `STRIPE_PRICE_BUSINESS` | Stripe price id for Business | empty |
| `VITE_API_URL` | Client API base URL | `http://localhost:5000` |

## Feature Status

| Area | Status | Notes |
| --- | --- | --- |
| Auth | Live | Register, login, JWT-protected profile and session endpoints. |
| Agent chat | Live/demo capable | Demo AI works without keys; production uses configured AI provider. |
| AI Search | Live/demo capable | Demo search works locally; production requires search provider keys. |
| Website Builder | Live/demo capable | Generates project structures and files through the server. |
| Conversation history | Live | Dashboard history reads `/api/conversations` and detail endpoints. |
| Credits | Live | Server-side balance checks, debit/credit transactions, and admin adjustments. |
| Billing | Demo live, Stripe-ready | Demo upgrades and credit packs work; Stripe webhook route uses raw-body signature verification. |
| Admin | Live | Admin users, usage, agent runs, and generated websites are exposed through protected endpoints. |
| Settings UI | Planned | Environment-driven settings are server-side; dashboard settings are marked Coming soon. |
| Database persistence | Planned/live-ready | File-backed demo store is active; Postgres schema is present for production hardening. |
| Legacy Python tools | Archived | Preserved under `archive/python-legacy/` and not wired into production. |

## Useful API Routes

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/agent/dashboard`
- `POST /api/agent/chat`
- `GET /api/conversations`
- `GET /api/conversations/:id`
- `GET /api/credits/balance`
- `GET /api/credits/transactions`
- `GET /api/billing/plans`
- `GET /api/billing/subscription`
- `POST /api/billing/demo-upgrade`
- `POST /api/billing/webhook`
- `GET /api/admin/users`

## Repository Hygiene

Do not commit `venv/`, `.venv/`, `node_modules/`, build output, coverage, SQLite files, editor settings, local env files, or generated runtime data. The production app should remain centered on `client/` and `server/`.
