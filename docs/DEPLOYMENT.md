# Deployment

## Frontend

Deploy `client/` to Vercel. Set:

```bash
VITE_API_URL=https://your-api.example.com
```

## Backend

Deploy `server/` to Render, Railway, Fly.io, or similar. Set all server environment variables and configure `CLIENT_URL` to the frontend origin.

## Database

Use Supabase or Neon and apply `server/src/database/schema.sql`.

## Production

Use:

```bash
AI_MODE=production
SEARCH_MODE=production
BILLING_MODE=production
```
