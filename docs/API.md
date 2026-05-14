# ZYNNOX API

Base URL: `http://localhost:5000`

All protected endpoints require `Authorization: Bearer <jwt>`.

## Health

- `GET /api/health`

## Auth

- `POST /api/auth/register` `{ "name": "", "email": "", "password": "" }`
- `POST /api/auth/login` `{ "email": "", "password": "" }`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PUT /api/auth/profile`

## Credits

- `GET /api/credits/balance`
- `GET /api/credits/transactions`
- `POST /api/credits/admin/add`
- `POST /api/credits/admin/remove`

## Billing

- `GET /api/billing/plans`
- `GET /api/billing/subscription`
- `POST /api/billing/checkout`
- `POST /api/billing/customer-portal`
- `POST /api/billing/webhook`
- `POST /api/billing/buy-credits`
- `POST /api/billing/demo-upgrade`

## AI

- `POST /api/agent/chat`
- `POST /api/search`
- `POST /api/ai-search`
- `POST /api/website/create`
- `GET /api/agent/runs`
- `GET /api/conversations`
- `GET /api/conversations/:id`

## Admin

- `GET /api/admin/users`
- `GET /api/admin/usage`
- `GET /api/admin/subscriptions`
- `GET /api/admin/agent-runs`
- `GET /api/admin/generated-websites`
- `PUT /api/admin/users/:id/role`
- `PUT /api/admin/users/:id/credits`
