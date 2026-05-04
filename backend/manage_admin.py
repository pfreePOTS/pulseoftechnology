"""
Idempotent admin-user management CLI.

Useful when the boot-time bootstrap already ran (so it can't recreate the first
admin) or when you need to add / reset a console user against a remote DB.

Examples (run inside the backend container with `DATABASE_URL` already set):

    # Create or update an admin (also resets password if user exists)
    python -m backend.manage_admin upsert --email me@pulseone.com --password 's3cret!' --superuser

    # Reset just the password
    python -m backend.manage_admin reset-password --email me@pulseone.com --password 'newpw!'

    # Promote an existing user to superuser
    python -m backend.manage_admin promote --email me@pulseone.com

    # List all admin rows (no password material)
    python -m backend.manage_admin list

Railway one-off (Backend service → ⋯ → Run command):

    python -m backend.manage_admin upsert --email pfreeman@pulseone.com --password '<chosen>' --superuser
"""

from __future__ import annotations

import argparse
import sys
from getpass import getpass

from .admin_permissions import normalize_login_email
from .database import SessionLocal
from .dependencies import hash_password
from .models.admin_user import AdminUser


def _resolve_password(arg_value: str | None) -> str:
    """Use --password if supplied, otherwise prompt twice (no echo)."""
    if arg_value:
        return arg_value
    pw = getpass("New password: ")
    if not pw:
        sys.exit("Password is required.")
    confirm = getpass("Confirm password: ")
    if pw != confirm:
        sys.exit("Passwords do not match.")
    return pw


def upsert(email: str, password: str | None, *, superuser: bool) -> int:
    pw = _resolve_password(password)
    norm_email = normalize_login_email(email)
    db = SessionLocal()
    try:
        user = db.query(AdminUser).filter(AdminUser.email == norm_email).first()
        if user is None:
            user = AdminUser(
                email=norm_email,
                password_hash=hash_password(pw),
                is_superuser=superuser,
                is_active=True,
                must_change_password=False,
                page_permissions=[],
            )
            db.add(user)
            action = "created"
        else:
            user.password_hash = hash_password(pw)
            user.is_active = True
            if superuser:
                user.is_superuser = True
            action = "updated"
        db.commit()
        print(f"{action}: {norm_email} (superuser={user.is_superuser})")
        return 0
    finally:
        db.close()


def reset_password(email: str, password: str | None) -> int:
    pw = _resolve_password(password)
    norm_email = normalize_login_email(email)
    db = SessionLocal()
    try:
        user = db.query(AdminUser).filter(AdminUser.email == norm_email).first()
        if user is None:
            sys.exit(f"No admin user with email {norm_email!r}.")
        user.password_hash = hash_password(pw)
        db.commit()
        print(f"password reset: {norm_email}")
        return 0
    finally:
        db.close()


def promote(email: str) -> int:
    norm_email = normalize_login_email(email)
    db = SessionLocal()
    try:
        user = db.query(AdminUser).filter(AdminUser.email == norm_email).first()
        if user is None:
            sys.exit(f"No admin user with email {norm_email!r}.")
        user.is_superuser = True
        user.is_active = True
        db.commit()
        print(f"promoted: {norm_email} (superuser=True)")
        return 0
    finally:
        db.close()


def list_admins() -> int:
    db = SessionLocal()
    try:
        rows = db.query(AdminUser).order_by(AdminUser.id).all()
        if not rows:
            print("(no admin users)")
            return 0
        for u in rows:
            flags = []
            if u.is_superuser:
                flags.append("superuser")
            if not u.is_active:
                flags.append("inactive")
            if u.must_change_password:
                flags.append("must-change-pw")
            tag = f"  [{', '.join(flags)}]" if flags else ""
            print(f"{u.id:>4}  {u.email}{tag}")
        return 0
    finally:
        db.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="backend.manage_admin")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_up = sub.add_parser("upsert", help="Create or update an admin user")
    p_up.add_argument("--email", required=True)
    p_up.add_argument("--password", help="If omitted, you'll be prompted (no echo)")
    p_up.add_argument("--superuser", action="store_true")

    p_rp = sub.add_parser("reset-password", help="Reset a user's password")
    p_rp.add_argument("--email", required=True)
    p_rp.add_argument("--password", help="If omitted, you'll be prompted (no echo)")

    p_pr = sub.add_parser("promote", help="Make an existing user a superuser")
    p_pr.add_argument("--email", required=True)

    sub.add_parser("list", help="List admin users (no password material)")

    args = parser.parse_args(argv)

    if args.cmd == "upsert":
        return upsert(args.email, args.password, superuser=args.superuser)
    if args.cmd == "reset-password":
        return reset_password(args.email, args.password)
    if args.cmd == "promote":
        return promote(args.email)
    if args.cmd == "list":
        return list_admins()
    parser.error(f"unknown command: {args.cmd}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
