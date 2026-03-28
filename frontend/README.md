# Frontend — Next.js

> **Always start via Docker Compose from the project root.**
> See the [root README](../README.md) for instructions.

```bash
# From project root
docker compose up --build frontend
```

## Notes for maintainers

- Framework: Next.js 15 (App Router), TypeScript, Tailwind CSS
- API calls use `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`)
- `src/` and `public/` are volume-mounted for hot reload; `node_modules` stays inside the container

## Running standalone (debugging only)

Only do this if you need to debug the frontend in isolation:

```bash
cd frontend/
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```
