# Authentication

ZYNNOX uses bcryptjs for password hashing and JWT for API authentication.

Registration creates:

- user account
- profile record
- free subscription
- starter credit transaction

The first registered user becomes admin. You can also set `ADMIN_EMAIL`.

JWT refresh tokens, email verification, and password reset are represented as ready extension points in the API response and docs.
