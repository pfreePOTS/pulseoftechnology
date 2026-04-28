# Pulse of Technology - Architectural Invariants

1. **Frontend-Backend Separation**: Next.js (App Router) is for UI only. All business logic, AI calls, and database access MUST happen in the FastAPI backend.
2. **JWT Trust Boundaries**: The frontend only stores the JWT. It must not decode or trust its contents for authorization. The backend must validate the token on every protected route.
3. **Database Access**: All database access must go through SQLAlchemy 2.0 async sessions. No raw SQL strings unless absolutely necessary for complex analytics.
4. **Tailwind Styling**: Use Tailwind utility classes for all styling. Avoid custom CSS unless implementing complex animations (like the D3 Radar).
