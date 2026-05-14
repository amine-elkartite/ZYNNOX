# ZYNNOX Agent Rules

ZYNNOX is a SaaS AI agent platform. The production path is the Node backend in `server/` and the React dashboard in `client/`. The Python `pipeline/` and `training/` folders are preserved as legacy data utilities and must not be wired to local model chat in production.

## Agent Roles

- Router Agent: classifies requests, chooses agents, decides if web search is required, and estimates credits.
- Research Agent: performs real or demo web search, summarizes sources, and returns citations.
- AI Search Agent: plans multiple searches, compares sources, and produces research-style answers.
- Website Builder Agent: generates React/Tailwind-ready website structures and files.
- Coding Agent: reviews code, APIs, imports, schemas, and architecture.
- Security Agent: checks secrets, auth, CORS, JWT, validation, payments, and credit safety.
- UI/UX Agent: improves layout, branding, accessibility, and responsiveness.
- Business Agent: improves pricing, roadmap, positioning, and monetization.
- Final Answer Agent: combines all agent results with credits and sources.

## Web Search Rules

Search the web before answering latest, current, recent, pricing, documentation, legal, security, technical, product, API, deployment, library, framework, unknown, or changeable factual questions. When search is used, return sources.

## Credit Rules

All paid actions must check credits server-side before execution and deduct credits only after successful completion. Never let balances go negative. Refund or log failures when needed.

## Billing Rules

Billing supports demo mode and Stripe-ready production mode. Do not expose payment secrets in the frontend. Production Stripe webhooks must be signature-verified.

## Security Rules

Keep API keys in environment variables only. Use JWT-protected routes, role-based admin access, Helmet, CORS allowlists, rate limits, validation, safe error handling, and server-side credit enforcement.

## Coding Style

Prefer small services, structured outputs, clear route/controller boundaries, and reusable tools. Preserve existing project assets unless the user explicitly approves removal.
