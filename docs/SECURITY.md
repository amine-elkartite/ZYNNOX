# Security

ZYNNOX includes:

- Helmet security headers
- CORS origin allowlist
- rate limiting
- JWT protected routes
- role-based admin access
- Zod input validation
- bcrypt password hashing
- payment webhook signature validation in production
- SSRF protection for URL extraction
- server-side credit checks

Keep secrets in environment variables only. Never expose provider or payment keys in the frontend.
