import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import SQLAlchemyError

from .config import settings
from .rate_limits import limiter
from .routers.admin import router as admin_router
from .routers.public import router as public_router
from .scheduler import start_scheduler, stop_scheduler


def _cors_allow_origins() -> list[str]:
    """Explicit origins only — `*` is invalid with `allow_credentials=True` (browser blocks admin cookie fetches)."""
    out = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    if not out:
        # Empty env would yield no CORS headers and break all browser API calls.
        # Include 127.0.0.1 — browsers send a distinct Origin from "localhost".
        return [
            "http://localhost:3000",
            "http://localhost:3100",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3100",
        ]
    return out


logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="Pulse of Technology API",
    version="0.1.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Return JSON (not plain text) so browsers still receive CORS headers on failure."""
    logging.exception("Database error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Database error — schema may be out of date. Run: "
            "docker compose exec -w /app/backend backend alembic upgrade head",
        },
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allow_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(admin_router)
app.include_router(public_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
