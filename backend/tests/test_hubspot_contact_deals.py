"""Contact-form submissions become a HubSpot contact, company, and deal."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from ..services import hubspot_contact_deals as deals


def _search(total: int, object_id: str) -> MagicMock:
    result = MagicMock()
    result.total = total
    if total > 0:
        found = MagicMock()
        found.id = object_id
        result.results = [found]
    else:
        result.results = []
    return result


def _client(
    *,
    contact_total: int = 0,
    contact_id: str = "c1",
    company_total: int = 0,
    company_id: str = "co1",
    deal_id: str = "d1",
) -> MagicMock:
    client = MagicMock()
    client.crm.contacts.search_api.do_search.return_value = _search(contact_total, contact_id)
    client.crm.contacts.basic_api.create.return_value = MagicMock(id=contact_id)
    client.crm.companies.search_api.do_search.return_value = _search(company_total, company_id)
    client.crm.companies.basic_api.create.return_value = MagicMock(id=company_id)
    client.crm.deals.basic_api.create.return_value = MagicMock(id=deal_id)
    return client


FORM = dict(
    name="Jane Doe",
    email="jane@acme.com",
    company="Acme Corp",
    message="We need help with cloud migration.",
    phone="555-0100",
    industry="Financial Services",
    role="CIO / CTO",
    source="contact_form",
)


@pytest.fixture
def hs(monkeypatch):
    client = _client()
    logs: list[dict] = []
    monkeypatch.setattr(deals.hubspot_sync, "_get_hs_client", lambda: client)
    monkeypatch.setattr(
        deals.hubspot_sync, "_persist_sync_log", lambda **kwargs: logs.append(kwargs)
    )
    monkeypatch.setattr(deals.settings, "hubspot_api_key", "fake-key")
    monkeypatch.setattr(deals.settings, "hubspot_contact_deal_pipeline_id", "pipe-connected")
    monkeypatch.setattr(deals.settings, "hubspot_contact_deal_stage_id", "stage-new")
    return SimpleNamespace(client=client, logs=logs)


def _contact_props(hs) -> dict:
    created = hs.client.crm.contacts.basic_api.create.call_args.args[0]
    return created.properties


def _company_props(hs) -> dict:
    created = hs.client.crm.companies.basic_api.create.call_args.args[0]
    return created.properties


def _deal_props(hs) -> dict:
    created = hs.client.crm.deals.basic_api.create.call_args.args[0]
    return created.properties


class TestContactProperties:
    def test_name_split_and_optional_fields(self, hs):
        deals.submit_contact_form_to_hubspot(**FORM)
        props = _contact_props(hs)
        assert props["email"] == "jane@acme.com"
        assert props["firstname"] == "Jane"
        assert props["lastname"] == "Doe"
        assert props["company"] == "Acme Corp"
        assert props["phone"] == "555-0100"
        assert props["industry"] == "Financial Services"
        assert props["jobtitle"] == "CIO / CTO"
        assert not any(key.startswith("pulse_") for key in props)

    def test_single_token_name_omits_lastname(self, hs):
        deals.submit_contact_form_to_hubspot(**{**FORM, "name": "Prince"})
        props = _contact_props(hs)
        assert props["firstname"] == "Prince"
        assert "lastname" not in props

    def test_blank_optionals_are_omitted(self, hs):
        deals.submit_contact_form_to_hubspot(
            **{**FORM, "phone": None, "industry": None, "role": "  "}
        )
        props = _contact_props(hs)
        assert "phone" not in props
        assert "industry" not in props
        assert "jobtitle" not in props
        assert not any(key.startswith("pulse_") for key in props)

    def test_multi_word_given_name_keeps_remainder_as_lastname(self, hs):
        deals.submit_contact_form_to_hubspot(**{**FORM, "name": "Mary Ann Smith"})
        props = _contact_props(hs)
        assert props["firstname"] == "Mary"
        assert props["lastname"] == "Ann Smith"


class TestCompanyAndDeal:
    def test_creates_company_when_name_is_new(self, hs):
        assert deals.submit_contact_form_to_hubspot(**FORM) is True
        search = hs.client.crm.companies.search_api.do_search.call_args.args[0]
        filt = search.filter_groups[0]["filters"][0]
        assert filt == {"propertyName": "name", "operator": "EQ", "value": "Acme Corp"}
        assert _company_props(hs)["name"] == "Acme Corp"
        assert _company_props(hs)["domain"] == "acme.com"
        assert "industry" not in _company_props(hs)

    def test_public_mailbox_does_not_set_company_domain(self, hs):
        deals.submit_contact_form_to_hubspot(**{**FORM, "email": "jane@gmail.com"})
        assert "domain" not in _company_props(hs)

    def test_reuses_company_when_exact_name_exists(self, hs):
        hs.client.crm.companies.search_api.do_search.return_value = _search(1, "co-existing")
        deals.submit_contact_form_to_hubspot(**FORM)
        hs.client.crm.companies.basic_api.create.assert_not_called()
        assoc = hs.client.crm.associations.v4.basic_api.create_default.call_args_list
        assert assoc[0].args == ("contacts", "c1", "companies", "co-existing")

    def test_deal_uses_configured_pipeline_and_stage(self, hs):
        deals.submit_contact_form_to_hubspot(**FORM)
        props = _deal_props(hs)
        assert props["dealname"] == "Acme Corp — Jane Doe"
        assert props["pipeline"] == "pipe-connected"
        assert props["dealstage"] == "stage-new"
        assert "amount" not in props
        assert "hubspot_owner_id" not in props
        assert "closedate" not in props
        assert "jane@acme.com" in props["description"]
        assert "555-0100" in props["description"]
        assert "CIO / CTO" in props["description"]
        assert "Financial Services" in props["description"]
        assert "cloud migration" in props["description"]

    def test_happy_path_associates_contact_company_and_deal(self, hs):
        deals.submit_contact_form_to_hubspot(**FORM)
        calls = [
            c.args for c in hs.client.crm.associations.v4.basic_api.create_default.call_args_list
        ]
        assert calls == [
            ("contacts", "c1", "companies", "co1"),
            ("deals", "d1", "contacts", "c1"),
            ("deals", "d1", "companies", "co1"),
        ]
        log = hs.logs[-1]
        assert log["operation"] == "deal_created"
        assert log["success"] is True
        assert log["source"] == "contact_form"
        assert log["subscriber_id"] is None
        assert log["hubspot_contact_id"] == "c1"
        assert log["hubspot_company_id"] == "co1"
        assert log["hubspot_deal_id"] == "d1"
        assert log["error_message"] is None

    def test_second_submission_creates_another_deal(self, hs):
        deals.submit_contact_form_to_hubspot(**FORM)
        deals.submit_contact_form_to_hubspot(**FORM)
        assert hs.client.crm.deals.basic_api.create.call_count == 2

    def test_company_error_still_creates_the_deal(self, hs):
        hs.client.crm.companies.search_api.do_search.side_effect = RuntimeError("company down")
        assert deals.submit_contact_form_to_hubspot(**FORM) is False
        hs.client.crm.deals.basic_api.create.assert_called_once()
        calls = [
            c.args for c in hs.client.crm.associations.v4.basic_api.create_default.call_args_list
        ]
        assert ("deals", "d1", "contacts", "c1") in calls
        assert not any(args[2] == "companies" for args in calls)
        log = hs.logs[-1]
        assert log["operation"] == "deal_created_company_failed"
        assert log["success"] is False
        assert log["hubspot_deal_id"] == "d1"
        assert log["hubspot_company_id"] is None
        assert "company down" in (log["error_message"] or "")

    def test_missing_pipeline_skips_deal_and_still_upserts_contact_and_company(
        self, hs, monkeypatch
    ):
        monkeypatch.setattr(deals.settings, "hubspot_contact_deal_pipeline_id", "")
        assert deals.submit_contact_form_to_hubspot(**FORM) is False
        hs.client.crm.contacts.basic_api.create.assert_called_once()
        hs.client.crm.companies.basic_api.create.assert_called_once()
        hs.client.crm.deals.basic_api.create.assert_not_called()
        log = hs.logs[-1]
        assert log["operation"] == "deal_skipped_no_pipeline"
        assert log["hubspot_contact_id"] == "c1"
        assert log["hubspot_company_id"] == "co1"
        assert log["hubspot_deal_id"] is None

    def test_missing_api_key_skips_without_calling_hubspot(self, hs, monkeypatch):
        monkeypatch.setattr(deals.settings, "hubspot_api_key", "")
        assert deals.submit_contact_form_to_hubspot(**FORM) is False
        hs.client.crm.contacts.search_api.do_search.assert_not_called()
        log = hs.logs[-1]
        assert log["operation"] == "skipped"
        assert log["success"] is False
        assert "HUBSPOT_API_KEY" in (log["error_message"] or "")

    def test_deal_error_keeps_the_contact(self, hs):
        hs.client.crm.deals.basic_api.create.side_effect = RuntimeError("deal down")
        assert deals.submit_contact_form_to_hubspot(**FORM) is False
        log = hs.logs[-1]
        assert log["operation"] == "error_deal"
        assert log["hubspot_contact_id"] == "c1"
        assert log["hubspot_company_id"] == "co1"
        assert log["hubspot_deal_id"] is None
        assert "deal down" in (log["error_message"] or "")

    def test_contact_error_does_not_create_a_deal(self, hs):
        hs.client.crm.contacts.search_api.do_search.side_effect = RuntimeError("contact down")
        assert deals.submit_contact_form_to_hubspot(**FORM) is False
        hs.client.crm.deals.basic_api.create.assert_not_called()
        hs.client.crm.companies.basic_api.create.assert_not_called()
        log = hs.logs[-1]
        assert log["operation"] == "error_contact"
        assert log["hubspot_deal_id"] is None
        assert "contact down" in (log["error_message"] or "")

    def test_updates_existing_contact_without_subscriber_fields(self, hs):
        hs.client.crm.contacts.search_api.do_search.return_value = _search(1, "c-existing")
        deals.submit_contact_form_to_hubspot(**FORM)
        hs.client.crm.contacts.basic_api.create.assert_not_called()
        updated = hs.client.crm.contacts.basic_api.update.call_args.args[1]
        assert not any(key.startswith("pulse_") for key in updated.properties)
        assert hs.client.crm.contacts.basic_api.update.call_args.args[0] == "c-existing"

    def test_log_line_has_ids_and_omits_the_message(self, hs, caplog):
        with caplog.at_level("INFO", logger="backend.services.hubspot_contact_deals"):
            deals.submit_contact_form_to_hubspot(**FORM)
        line = next(
            rec.message for rec in caplog.records if "[hubspot] contact_form" in rec.message
        )
        assert "operation=deal_created" in line
        assert "hubspot_deal_id=d1" in line
        assert "cloud migration" not in line
