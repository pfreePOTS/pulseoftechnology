"""Shared SlowAPI limiter instance (see main.py for exception handler wiring)."""

import os

from slowapi import Limiter
from slowapi.util import get_remote_address

# Full test runs exceed per-route caps on /login; see PULSEONE_TESTING in tests/conftest.py.
limiter = Limiter(
    key_func=get_remote_address,
    enabled=os.environ.get("PULSEONE_TESTING") != "1",
)
