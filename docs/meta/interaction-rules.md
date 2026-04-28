# Pulse of Technology - AI Interaction Rules

1. **Docker Compose Only**: Never run services directly on the host. Always use `docker compose up --build`.
2. **Strict Write Discipline**: Do not use `sed` or `echo` for multi-line edits. Use proper file editing tools or full file rewrites.
3. **Incremental Commits**: Commit after every logical change. Do not batch unrelated changes.
4. **Database Migrations**: Always use Alembic for schema changes. Never edit the database directly.
