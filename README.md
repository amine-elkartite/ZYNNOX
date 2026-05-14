# ZYNNOX

ZYNNOX is a SaaS AI Agent platform for agent chat, live web search, AI-powered research, website generation, code improvement, security review, user accounts, credits, subscriptions, and admin operations.

The production app is split into:

- `server/`: Express API, auth, credits, billing-ready services, multi-agent orchestration, web search, AI Search, website builder, admin APIs.
- `client/`: React/Vite SaaS dashboard with ZYNNOX branding, auth, chat, AI Search, website builder, credits, billing, history, and admin views.
- `pipeline/` and `training/`: preserved Python data/search/training utilities from the original prototype.

## Features

- Multi-agent architecture with Router, Research, AI Search, Website Builder, Coding, Security, UI/UX, Business, and Final Answer agents.
- Real web search provider abstraction: Serper, Tavily, Brave-compatible paths, plus demo mode.
- AI provider abstraction for OpenAI-compatible APIs through environment variables.
- User registration/login with bcrypt password hashing and JWT auth.
- Credits, usage logs, starter credits, server-side credit checks, refunds-ready structure, and admin adjustments.
- Plans, subscriptions, invoices, payment events, demo billing, and Stripe-ready checkout/webhook architecture.
- Website generation endpoint returning project structure, files, instructions, and preview notes.
- Admin APIs for users, usage, subscriptions, agent runs, generated websites, plans, and invoices.
- Professional responsive dashboard with dark navy/cyan ZYNNOX design.

## Tech Stack

- Backend: Node.js, Express, Zod, JWT, bcryptjs, Helmet, CORS, rate limiting.
- Frontend: React, Vite, lucide-react, CSS.
- Storage: file-backed demo store in `server/data/`; SQL schema provided for production database readiness.
- Payments: demo mode by default, Stripe-ready production abstraction.

## Environment

Copy `.env.example` to `.env` and configure values:

```bash
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173

AI_MODE=demo
AI_PROVIDER=openai
AI_API_KEY=your_ai_api_key_here
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini

SEARCH_MODE=demo
SEARCH_PROVIDER=serper
SEARCH_API_KEY=your_search_api_key_here

DATABASE_URL=your_database_url
JWT_SECRET=your_secure_jwt_secret
FREE_STARTER_CREDITS=25

BILLING_MODE=demo
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=

VITE_API_URL=http://localhost:5000
```

## Run

```bash
npm install
npm run dev
```

Backend only:

```bash
npm run dev --workspace server
```

Frontend only:

```bash
npm run dev --workspace client
```

Build:

```bash
npm run build
```

## Demo Mode vs Production Mode

Demo mode works without API keys. It simulates AI output, search results, subscriptions, and credit purchases for local development.

Production mode requires real keys:

- `AI_MODE=production` with `AI_API_KEY`.
- `SEARCH_MODE=production` with `SEARCH_API_KEY`.
- `BILLING_MODE=production` with Stripe keys and webhook secret.

## Core APIs

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/profile`
- `GET /api/credits/balance`
- `GET /api/credits/transactions`
- `GET /api/billing/plans`
- `POST /api/billing/demo-upgrade`
- `POST /api/billing/buy-credits`
- `POST /api/agent/chat`
- `POST /api/search`
- `POST /api/ai-search`
- `POST /api/website/create`
- `GET /api/admin/users`

## Web Search

Set `SEARCH_MODE=production`, choose `SEARCH_PROVIDER=serper`, `tavily`, or `brave`, and add `SEARCH_API_KEY`. Search results are normalized to title, URL, snippet, source, published date, and score. Research and AI Search responses include sources.

## Credits

New users receive `FREE_STARTER_CREDITS`. Costs:

- AI chat: 1
- Web search answer: 2
- AI Search quick: 3
- AI Search standard: 5
- AI Search deep: 8
- Website landing: 10
- Website dashboard/admin: 15
- Website full-stack: 30
- Code analysis: 2
- Security scan: 3

If a user lacks credits, the API returns: `Insufficient credits. Please upgrade your plan or buy more credits.`

## Deployment

- Frontend: Vercel, with `VITE_API_URL` pointing to the backend.
- Backend: Render, Railway, Fly.io, or similar Node host.
- Database: Supabase or Neon using the schema in `server/src/database/schema.sql`.
- Configure `CLIENT_URL` to the deployed frontend origin.
