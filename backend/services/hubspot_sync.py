"""
HubSpot CRM sync service.

Performs a one-way push of subscriber data to HubSpot contacts.

Custom HubSpot properties required (create these in HubSpot Settings → Properties):
  - pulse_domains   (string)  — comma-separated domain interests, e.g. "AI,Security"
  - pulse_subscribed (string/checkbox) — "true" / "false"

Standard HubSpot properties used (exist by default):
  - email, firstname, lastname, industry
"""

import logging

import hubspot
from hubspot.crm.contacts import (
    PublicObjectSearchRequest,
    SimplePublicObjectInput,
    SimplePublicObjectInputForCreate,
)
from hubspot.crm.contacts.exceptions import ApiException

from ..config import settings
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


def _build_properties(subscriber: Subscriber) -> dict[str, str]:
    return {
        "email": subscriber.email,
        "firstname": subscriber.first_name,
        "lastname": subscriber.last_name,
        "industry": subscriber.industry or "",
        # Custom PulseOne properties
        "pulse_domains": ",".join(subscriber.domains or []),
        "pulse_subscribed": "true" if subscriber.is_active else "false",
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def sync_subscriber_to_hubspot(subscriber: Subscriber) -> bool:
    """
    Create or update a HubSpot contact from a Subscriber record.

    - Looks up the contact by email.
    - If found, updates the properties.
    - If not found, creates a new contact.

    Returns True on success, False on error.
    """
    if not settings.hubspot_api_key:
        logger.debug("HubSpot sync skipped — HUBSPOT_API_KEY not configured")
        return False

    client = _get_hs_client()
    properties = _build_properties(subscriber)

    # Search for an existing contact by email
    try:
        search_request = PublicObjectSearchRequest(
            filter_groups=[
                {
                    "filters": [
                        {
                            "propertyName": "email",
                            "operator": "EQ",
                            "value": subscriber.email,
                        }
                    ]
                }
            ],
            properties=["email"],
            limit=1,
        )
        results = client.crm.contacts.search_api.do_search(search_request)
    except ApiException:
        logger.exception("HubSpot search failed for %s", subscriber.email)
        return False

    try:
        if results.total > 0:
            contact_id = results.results[0].id
            update_input = SimplePublicObjectInput(properties=properties)
            client.crm.contacts.basic_api.update(contact_id, update_input)
            logger.info("HubSpot contact updated: %s (id=%s)", subscriber.email, contact_id)
        else:
            create_input = SimplePublicObjectInputForCreate(properties=properties)
            created = client.crm.contacts.basic_api.create(create_input)
            logger.info("HubSpot contact created: %s (id=%s)", subscriber.email, created.id)
        return True
    except ApiException:
        logger.exception("HubSpot upsert failed for %s", subscriber.email)
        return False
