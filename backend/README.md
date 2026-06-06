Bountybee backend scaffold

Quickstart:

1. Copy `.env.example` to `.env` and update values.
2. Start local services:

```bash
docker compose up -d db redis
```

3. Install dependencies and run migrations:

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

API:
- POST /auth/register

This scaffold includes Prisma schema and a minimal NestJS app with an Auth module.
