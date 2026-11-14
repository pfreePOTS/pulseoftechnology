"""Push a public contact-form submission to HubSpot as a contact, company, and deal.

Subscriber newsletter sync stays in ``hubspot_sync``. This path never sets
``pulse_*`` properties and never adds the person to the newsletter list.
"""

from __future__ import annotations

import logging
from typing import Any

from hubspot.crm.companies import PublicObjectSearchRequest as CompanySearchRequest
from hubspot.crm.companies import SimplePublicObjectInputForCreate as CompanyCreate
from hubspot.crm.contacts import (
    PublicObjectSearchRequest,
    SimplePublicObjectInput,
    SimplePublicObjectInputForCreate,
)
from hubspot.crm.deals import SimplePublicObjectInputForCreate as DealCreate

from ..config import settings
from ..log_events import kv
from . import hubspot_sync

logger = logging.getLogger(__name__)

_DEAL_NAME_MAX = 200
_PUBLIC_EMAIL_DOMAINS = frozenset(
    {
        "gmail.com",
        "yahoo.com",
        "hotmail.com",
        "outlook.com",
        "live.com",
        "msn.com",
        "icloud.com",
        "aol.com",
        "proton.me",
        "protonmail.com",
    }
)


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


def _split_name(name: str) -> tuple[str, str | None]:
    parts = name.split(None, 1)
    if not parts:
        return "", None
    if len(parts) == 1:
        return parts[0], None
    return parts[0], parts[1]


def _company_domain(email: str) -> str | None:
    domain = email.rsplit("@", 1)[-1].strip().lower()
    if not domain or "." not in domain or domain in _PUBLIC_EMAIL_DOMAINS:
        return None
    return domain


def _contact_properties(
    *,
    name: str,
    email: str,
    company: str,
    phone: str | None,
    industry: str | None,
    role: str | None,
) -> dict[str, str]:
    first, last = _split_name(name)
    props: dict[str, str] = {"email": email, "company": company}
    if first:
        props["firstname"] = first
    if last:
        props["lastname"] = last
    if phone:
        props["phone"] = phone
    if industry:
        props["industry"] = industry
    if role:
        props["jobtitle"] = role
    return props


def _company_properties(
    *,
    company: str,
    email: str,
    phone: str | None,
) -> dict[str, str]:
    props: dict[str, str] = {"name": company}
    if phone:
        props["phone"] = phone
    domain = _company_domain(email)
    if domain:
        props["domain"] = domain
    return props


def _deal_name(company: str, name: str) -> str:
    raw = f"{company} — {name}".strip()
    if len(raw) <= _DEAL_NAME_MAX:
        return raw
    return raw[:_DEAL_NAME_MAX].rstrip()


def _deal_description(
    *,
    email: str,
    phone: str | None,
    role: str | None,
    industry: str | None,
    message: str,
) -> str:
    lines = ["Website contact form", f"Email: {email}"]
    if phone:
        lines.append(f"Phone: {phone}")
    if role:
        lines.append(f"Role: {role}")
    if industry:
        lines.append(f"Industry: {industry}")
    lines.append("")
    lines.append(message)
    return "\n".join(lines)


def _deal_properties(
    *,
    company: str,
    name: str,
    email: str,
    phone: str | None,
    role: str | None,
    industry: str | None,
    message: str,
    pipeline_id: str,
    stage_id: str,
) -> dict[str, str]:
    props = {
        "dealname": _deal_name(company, name),
        "description": _deal_description(
            email=email,
            phone=phone,
            role=role,
            industry=industry,
            message=message,
        ),
    }
    if pipeline_id:
        props["pipeline"] = pipeline_id
    if stage_id:
        props["dealstage"] = stage_id
    return props


def _eq_filter(property_name: str, value: str) -> dict[str, Any]:
    return {
        "filters": [
            {
                "propertyName": property_name,
                "operator": "EQ",
                "value": value,
            }
        ]
    }


def _error_text(exc: Exception) -> str:
    return str(exc)[:2000]


def _upsert_contact(client: Any, props: dict[str, str]) -> tuple[str | None, str | None]:
    try:
        found = client.crm.contacts.search_api.do_search(
            PublicObjectSearchRequest(
                filter_groups=[_eq_filter("email", props["email"])],
                properties=["email"],
                limit=1,
            )
        )
        if found.total > 0:
            contact_id = str(found.results[0].id)
            client.crm.contacts.basic_api.update(
                contact_id,
                SimplePublicObjectInput(properties=props),
            )
            return contact_id, None
        created = client.crm.contacts.basic_api.create(
            SimplePublicObjectInputForCreate(properties=props)
        )
        return str(created.id), None
    except Exception as exc:
        logger.warning("[hubspot] contact_form contact upsert failed: %s", exc)
        return None, _error_text(exc)


def _find_or_create_company(
    client: Any,
    props: dict[str, str],
) -> tuple[str | None, str | None]:
    try:
        found = client.crm.companies.search_api.do_search(
            CompanySearchRequest(
                filter_groups=[_eq_filter("name", props["name"])],
                properties=["name"],
                limit=1,
            )
        )
        if found.total > 0:
            return str(found.results[0].id), None
        created = client.crm.companies.basic_api.create(CompanyCreate(properties=props))
        return str(created.id), None
    except Exception as exc:
        logger.warning("[hubspot] contact_form company upsert failed: %s", exc)
        return None, _error_text(exc)


def _create_deal(client: Any, props: dict[str, str]) -> tuple[str | None, str | None]:
    try:
        created = client.crm.deals.basic_api.create(DealCreate(properties=props))
        return str(created.id), None
    except Exception as exc:
        logger.warning("[hubspot] contact_form deal create failed: %s", exc)
        return None, _error_text(exc)


def _associate(
    client: Any,
    from_type: str,
    from_id: str,
    to_type: str,
    to_id: str,
) -> str | None:
    try:
        client.crm.associations.v4.basic_api.create_default(from_type, from_id, to_type, to_id)
        return None
    except Exception as exc:
        logger.warning(
            "[hubspot] contact_form association %s→%s failed: %s",
            from_type,
            to_type,
            exc,
        )
        return _error_text(exc)


def _record(
    *,
    email: str,
    source: str,
    operation: str,
    success: bool,
    hubspot_contact_id: str | None,
    hubspot_company_id: str | None,
    hubspot_deal_id: str | None,
    payload: dict[str, Any],
    error_message: str | None,
) -> None:
    logger.info(
        "[hubspot] contact_form %s",
        kv(
            email=email,
            operation=operation,
            hubspot_contact_id=hubspot_contact_id or "",
            hubspot_company_id=hubspot_company_id or "",
            hubspot_deal_id=hubspot_deal_id or "",
        ),
    )
    hubspot_sync._persist_sync_log(
        subscriber_id=None,
        email=email,
        source=source,
        operation=operation,
        success=success,
        hubspot_contact_id=hubspot_contact_id,
        hubspot_company_id=hubspot_company_id,
        hubspot_deal_id=hubspot_deal_id,
        payload=payload,
        error_message=error_message,
    )


def submit_contact_form_to_hubspot(
    *,
    name: str,
    email: str,
    company: str,
    message: str,
    phone: str | None = None,
    industry: str | None = None,
    role: str | None = None,
    source: str = "contact_form",
) -> bool:
    """Create a contact, a company, and a new deal. Returns True only when the deal lands."""
    email = (email or "").strip().lower()
    name = (name or "").strip()
    company_name = (company or "").strip()
    message = (message or "").strip()
    phone = _clean(phone)
    industry = _clean(industry)
    role = _clean(role)

    pipeline_id = (settings.hubspot_contact_deal_pipeline_id or "").strip()
    stage_id = (settings.hubspot_contact_deal_stage_id or "").strip()
    contact_props = _contact_properties(
        name=name,
        email=email,
        company=company_name,
        phone=phone,
        industry=industry,
        role=role,
    )
    company_props = (
        _company_properties(company=company_name, email=email, phone=phone) if company_name else {}
    )
    deal_props = _deal_properties(
        company=company_name,
        name=name,
        email=email,
        phone=phone,
        role=role,
        industry=industry,
        message=message,
        pipeline_id=pipeline_id,
        stage_id=stage_id,
    )
    payload: dict[str, Any] = {
        "contact": contact_props,
        "company": company_props,
        "deal": deal_props,
    }

    def finish(
        operation: str,
        *,
        success: bool,
        contact_id: str | None = None,
        company_id: str | None = None,
        deal_id: str | None = None,
        error_message: str | None = None,
    ) -> bool:
        _record(
            email=email,
            source=source,
            operation=operation,
            success=success,
            hubspot_contact_id=contact_id,
            hubspot_company_id=company_id,
            hubspot_deal_id=deal_id,
            payload=payload,
            error_message=error_message,
        )
        return success

    if not (settings.hubspot_api_key or "").strip():
        return finish(
            "skipped",
            success=False,
            error_message="HUBSPOT_API_KEY is not set",
        )

    client = hubspot_sync._get_hs_client()
    contact_id, contact_error = _upsert_contact(client, contact_props)
    if contact_error or not contact_id:
        return finish(
            "error_contact",
            success=False,
            error_message=contact_error or "HubSpot contact id missing",
        )

    company_id: str | None = None
    company_error: str | None = None
    if company_props:
        company_id, company_error = _find_or_create_company(client, company_props)
        if company_id and not company_error:
            assoc_error = _associate(client, "contacts", contact_id, "companies", company_id)
            if assoc_error:
                company_error = assoc_error
    else:
        company_error = "Company name is empty"

    if not pipeline_id or not stage_id:
        missing = []
        if not pipeline_id:
            missing.append("HUBSPOT_CONTACT_DEAL_PIPELINE_ID")
        if not stage_id:
            missing.append("HUBSPOT_CONTACT_DEAL_STAGE_ID")
        skip_message = " and ".join(missing) + " is not set"
        if company_error:
            skip_message = f"{skip_message}; {company_error}"
        return finish(
            "deal_skipped_no_pipeline",
            success=False,
            contact_id=contact_id,
            company_id=company_id,
            error_message=skip_message,
        )

    deal_id, deal_error = _create_deal(client, deal_props)
    if deal_error or not deal_id:
        parts = [part for part in (company_error, deal_error or "HubSpot deal id missing") if part]
        return finish(
            "error_deal",
            success=False,
            contact_id=contact_id,
            company_id=company_id,
            error_message="; ".join(parts),
        )

    link_error = _associate(client, "deals", deal_id, "contacts", contact_id)
    if link_error:
        parts = [part for part in (company_error, link_error) if part]
        return finish(
            "error_deal",
            success=False,
            contact_id=contact_id,
            company_id=company_id,
            deal_id=deal_id,
            error_message="; ".join(parts),
        )

    if company_id:
        company_link_error = _associate(client, "deals", deal_id, "companies", company_id)
        if company_link_error:
            company_error = company_link_error

    if company_error:
        return finish(
            "deal_created_company_failed",
            success=False,
            contact_id=contact_id,
            company_id=company_id,
            deal_id=deal_id,
            error_message=company_error,
        )

    return finish(
        "deal_created",
        success=True,
        contact_id=contact_id,
        company_id=company_id,
        deal_id=deal_id,
    )
