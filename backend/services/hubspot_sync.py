"""
HubSpot CRM sync service.

Performs a one-way push of subscriber data to HubSpot contacts.

Custom HubSpot properties required (create these in HubSpot Settings → Properties):
  - pulse_domains   (string)  — comma-separated domain interests, e.g. "AI,Security"
  - pulse_subscribed (string/checkbox) — "true" / "false"
  - pulse_role (string) — subscriber persona label(s), e.g. "CTO" or "CTO, CFO"

Standard HubSpot properties used (exist by default):
  - email, firstname, lastname, industry (comma-separated when multiple)
"""

from __future__ import annotations

import logging
from typing import Any

import hubspot
from hubspot.crm.contacts import (
    PublicObjectSearchRequest,
    SimplePublicObjectInput,
    SimplePublicObjectInputForCreate,
)
from hubspot.crm.contacts.exceptions import ApiException

from ..config import settings
from ..database import SessionLocal
from ..models.hubspot_sync_log import HubSpotSyncLog
from ..models.role import Role
from ..models.subscriber import Subscriber

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Internal client factory (allows easy mocking in tests)
# ---------------------------------------------------------------------------

_hs_client: hubspot.Client | None = None


def _get_hs_client() -> hubspot.Client:
    global _hs_client
    if _hs_client is None:
        _hs_client = hubspot.Client.create(access_token=settings.hubspot_api_key)
    return _hs_client


# ---------------------------------------------------------------------------
# Property mapping
# ---------------------------------------------------------------------------


def _role_names_from_subscriber(subscriber: Subscriber) -> list[str]:
    roles_attr = getattr(subscriber, "roles", None)
    if roles_attr is not None:
        return [
            (getattr(r, "name", None) or "").strip()
            for r in roles_attr
            if (getattr(r, "name", None) or "").strip()
        ]
    single = getattr(subscriber, "role", None)
    if single is not None and getattr(single, "name", None):
        return [single.name.strip()]
    return []


def _build_properties(subscriber: Subscriber) -> dict[str, str]:
    industries = getattr(subscriber, "industries", None) or []
    industry_str = ", ".join(industries) if industries else ""
    role_names = _role_names_from_subscriber(subscriber)
    return {
        "email": subscriber.email,
        "firstname": subscriber.first_name,
        "lastname": subscriber.last_name,
        "industry": industry_str,
        # Custom PulseOne properties
        "pulse_domains": ",".join(subscriber.domains or []),
        "pulse_subscribed": "true" if subscriber.is_active else "false",
        "pulse_role": ", ".join(role_names),
    }


def _persist_sync_log(
    *,
    subscriber_id: int | None,
    email: str,
    source: str,
    operation: str,
    success: bool,
    hubspot_contact_id: str | None,
    payload: dict[str, str],
    error_message: str | None,
) -> None:
    db = SessionLocal()
    try:
        db.add(
            HubSpotSyncLog(
                subscriber_id=subscriber_id,
                email=email,
                source=source,
                operation=operation,
                success=success,
                hubspot_contact_id=hubspot_contact_id,
                payload=dict(payload),
                error_message=error_message,
            )
        )
        db.commit()
    except Exception:
        logger.warning("Persist HubSpot sync log failed for %s", email, exc_info=True)
        db.rollback()
    finally:
        db.close()


def _newsletter_list_sync_after_upsert(
    client: hubspot.Client,
    hubspot_contact_id: str,
    *,
    is_active: bool,
) -> None:
    """Add/remove CRM contact ID from HubSpot MANUAL/SNAPSHOT list — errors are logged only."""
    lid = (settings.hubspot_newsletter_list_id or "").strip()
    if not lid:
        return
    try:
        memberships = client.crm.lists.memberships_api
        if is_active:
            memberships.add(lid, [hubspot_contact_id])
        else:
            memberships.remove(lid, [hubspot_contact_id])
    except Exception:
        logger.warning(
            "HubSpot newsletter list membership sync failed — list=%s contact=%s active=%s",
            lid,
            hubspot_contact_id,
            is_active,
            exc_info=True,
        )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def sync_subscriber_to_hubspot(subscriber: Subscriber, *, source: str = "unknown") -> bool:
    """
    Create or update a HubSpot contact from a Subscriber record.

    - Looks up the contact by email.
    - If found, updates the properties.
    - If not found, creates a new contact.

    Returns True on success, False if skipped (no API key) or HubSpot/API error.
    """
    email = subscriber.email

    if not settings.hubspot_api_key:
        logger.debug("HubSpot sync skipped — HUBSPOT_API_KEY not configured")
        return False

    sub: Subscriber | None = None
    sid = getattr(subscriber, "id", None)
    try:
        if isinstance(subscriber, Subscriber):
            db = SessionLocal()
            try:
                sub = db.query(Subscriber).filter(Subscriber.id == subscriber.id).first()
                if sub is not None:
                    rids = sub.role_ids or []
                    if rids:
                        rows = db.query(Role).filter(Role.id.in_(rids)).all()
                        order = {rid: i for i, rid in enumerate(rids)}
                        rows.sort(key=lambda r: order.get(r.id, 999))
                        sub.roles = rows  # type: ignore[attr-defined]
            finally:
                db.close()
    except Exception:
        logger.debug(
            "HubSpot: could not reload subscriber id=%s from DB — using in-memory object",
            getattr(subscriber, "id", "?"),
            exc_info=False,
        )

    effective = sub if sub is not None else subscriber
    subscriber_id_val = getattr(effective, "id", sid)

    client = _get_hs_client()
    properties = _build_properties(effective)

    # Search for an existing contact by email
    try:
        search_request = PublicObjectSearchRequest(
            filter_groups=[
                {
                    "filters": [
                        {
                            "propertyName": "email",
                            "operator": "EQ",
                            "value": email,
                        }
                    ]
                }
            ],
            properties=["email"],
            limit=1,
        )
        results = client.crm.contacts.search_api.do_search(search_request)
    except ApiException as e:
        logger.exception("HubSpot search failed for %s", email)
        _persist_sync_log(
            subscriber_id=subscriber_id_val,
            email=email,
            source=source,
            operation="error_search",
            success=False,
            hubspot_contact_id=None,
            payload=properties,
            error_message=str(e)[:2000],
        )
        return False

    try:
        if results.total > 0:
            contact_id_hs = results.results[0].id
            update_input = SimplePublicObjectInput(properties=properties)
            client.crm.contacts.basic_api.update(contact_id_hs, update_input)
            logger.info("HubSpot contact updated: %s (id=%s)", email, contact_id_hs)
            _newsletter_list_sync_after_upsert(
                client,
                str(contact_id_hs),
                is_active=getattr(effective, "is_active", True),
            )
            _persist_sync_log(
                subscriber_id=subscriber_id_val,
                email=email,
                source=source,
                operation="updated",
                success=True,
                hubspot_contact_id=str(contact_id_hs),
                payload=properties,
                error_message=None,
            )
        else:
            create_input = SimplePublicObjectInputForCreate(properties=properties)
            created = client.crm.contacts.basic_api.create(create_input)
            logger.info("HubSpot contact created: %s (id=%s)", email, created.id)
            _newsletter_list_sync_after_upsert(
                client,
                str(created.id),
                is_active=getattr(effective, "is_active", True),
            )
            _persist_sync_log(
                subscriber_id=subscriber_id_val,
                email=email,
                source=source,
                operation="created",
                success=True,
                hubspot_contact_id=str(created.id),
                payload=properties,
                error_message=None,
            )
        return True
    except ApiException as e:
        logger.exception("HubSpot upsert failed for %s", email)
        _persist_sync_log(
            subscriber_id=subscriber_id_val,
            email=email,
            source=source,
            operation="error_upsert",
            success=False,
            hubspot_contact_id=None,
            payload=properties,
            error_message=str(e)[:2000],
        )
        return False


def reconcile_all_subscribers_to_hubspot(*, source: str = "scheduled_batch") -> dict[str, Any]:
    """
    Upsert every subscriber (active + inactive) so CRM reflects pulse_subscribed.

    Intended for scheduled reconcile or manual bulk run from admin.
    Returns counts; no-ops quickly when ``HUBSPOT_API_KEY`` is unset.
    """
    summary: dict[str, Any] = {
        "source": source,
        "skipped": False,
        "skipped_reason": None,
        "total": 0,
        "ok": 0,
        "failed": 0,
    }

    if not (settings.hubspot_api_key or "").strip():
        summary["skipped"] = True
        summary["skipped_reason"] = "HUBSPOT_API_KEY not set"
        logger.info("HubSpot reconcile skipped — %s", summary["skipped_reason"])
        return summary

    db = SessionLocal()
    try:
        rows = db.query(Subscriber).order_by(Subscriber.id.asc()).all()
        summary["total"] = len(rows)
        for sub in rows:
            if sync_subscriber_to_hubspot(sub, source=source):
                summary["ok"] += 1
            else:
                summary["failed"] += 1
    finally:
        db.close()

    logger.info(
        "HubSpot reconcile finished — total=%s ok=%s failed=%s source=%s",
        summary["total"],
        summary["ok"],
        summary["failed"],
        source,
    )
    return summary


def test_hubspot_connection() -> tuple[bool, str | None]:
    """Auth sanity check — CRM search endpoint (same as subscriber upsert auth)."""
    if not (settings.hubspot_api_key or "").strip():
        return False, "HUBSPOT_API_KEY is not set"
    try:
        client = _get_hs_client()
        search_request = PublicObjectSearchRequest(
            filter_groups=[
                {
                    "filters": [
                        {
                            "propertyName": "email",
                            "operator": "EQ",
                            "value": "hubspot-connectivity-check@pulseone.invalid",
                        }
                    ]
                }
            ],
            limit=1,
        )
        client.crm.contacts.search_api.do_search(search_request)
        return True, None
    except ApiException as e:
        logger.warning("HubSpot connectivity test failed: %s", e)
        return False, str(e)[:400]
    except Exception as e:
        logger.warning("HubSpot connectivity test unexpected: %s", e)
        return False, str(e)[:400]
