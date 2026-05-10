"""Unit tests for backend/services/hubspot_sync.py."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from ..services import hubspot_sync


@pytest.fixture(autouse=True)
def _mute_hubspot_sync_persistence():
    """Avoid Postgres SessionLocal writes when exercising HubSpot mocks."""
    with patch.object(hubspot_sync, "_persist_sync_log"):
        yield


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sub(**kw) -> SimpleNamespace:
    defaults = dict(
        id=1,
        email="jane@corp.com",
        first_name="Jane",
        last_name="Smith",
        industries=["Technology"],
        domains=["AI", "Security"],
        is_active=True,
        role=None,
        roles=None,
    )
    return SimpleNamespace(**{**defaults, **kw})


def _search_result(total: int, contact_id: str = "101") -> MagicMock:
    result = MagicMock()
    result.total = total
    if total > 0:
        contact = MagicMock()
        contact.id = contact_id
        result.results = [contact]
    else:
        result.results = []
    return result


# ---------------------------------------------------------------------------
# _build_properties
# ---------------------------------------------------------------------------


class TestBuildProperties:
    def test_standard_fields_mapped(self):
        sub = _sub()
        props = hubspot_sync._build_properties(sub)
        assert props["email"] == "jane@corp.com"
        assert props["firstname"] == "Jane"
        assert props["lastname"] == "Smith"
        assert props["industry"] == "Technology"

    def test_domains_joined_as_csv(self):
        sub = _sub(domains=["AI", "Security", "Cloud"])
        props = hubspot_sync._build_properties(sub)
        assert props["pulse_domains"] == "AI,Security,Cloud"

    def test_empty_domains_gives_empty_string(self):
        sub = _sub(domains=None)
        props = hubspot_sync._build_properties(sub)
        assert props["pulse_domains"] == ""

    def test_pulse_subscribed_reflects_is_active(self):
        assert hubspot_sync._build_properties(_sub(is_active=True))["pulse_subscribed"] == "true"
        assert hubspot_sync._build_properties(_sub(is_active=False))["pulse_subscribed"] == "false"

    def test_pulse_role_from_subscriber_role(self):
        role = SimpleNamespace(name="CTO")
        props = hubspot_sync._build_properties(_sub(role=role))
        assert props["pulse_role"] == "CTO"

    def test_pulse_role_empty_without_role(self):
        assert hubspot_sync._build_properties(_sub())["pulse_role"] == ""

    def test_no_industry_gives_empty_string(self):
        sub = _sub(industries=None)
        props = hubspot_sync._build_properties(sub)
        assert props["industry"] == ""


# ---------------------------------------------------------------------------
# sync_subscriber_to_hubspot — new contact
# ---------------------------------------------------------------------------


class TestSyncNewContact:
    def test_creates_contact_when_not_found(self):
        mock_client = MagicMock()
        mock_client.crm.contacts.search_api.do_search.return_value = _search_result(0)
        created = MagicMock()
        created.id = "42"
        mock_client.crm.contacts.basic_api.create.return_value = created

        with (
            patch.object(hubspot_sync, "_get_hs_client", return_value=mock_client),
            patch.object(hubspot_sync.settings, "hubspot_api_key", "fake-key"),
        ):
            result = hubspot_sync.sync_subscriber_to_hubspot(_sub())

        assert result is True
        mock_client.crm.contacts.basic_api.create.assert_called_once()
        mock_client.crm.contacts.basic_api.update.assert_not_called()

    def test_create_called_with_correct_properties(self):
        mock_client = MagicMock()
        mock_client.crm.contacts.search_api.do_search.return_value = _search_result(0)
        mock_client.crm.contacts.basic_api.create.return_value = MagicMock(id="99")
        sub = _sub(domains=["Cloud"])

        with (
            patch.object(hubspot_sync, "_get_hs_client", return_value=mock_client),
            patch.object(hubspot_sync.settings, "hubspot_api_key", "fake-key"),
        ):
            hubspot_sync.sync_subscriber_to_hubspot(sub)

        call_kwargs = mock_client.crm.contacts.basic_api.create.call_args
        input_obj = call_kwargs.args[0]
        assert input_obj.properties["pulse_domains"] == "Cloud"
        assert input_obj.properties["email"] == "jane@corp.com"


# ---------------------------------------------------------------------------
# sync_subscriber_to_hubspot — existing contact
# ---------------------------------------------------------------------------


class TestSyncExistingContact:
    def test_updates_contact_when_found(self):
        mock_client = MagicMock()
        mock_client.crm.contacts.search_api.do_search.return_value = _search_result(
            total=1, contact_id="77"
        )

        with (
            patch.object(hubspot_sync, "_get_hs_client", return_value=mock_client),
            patch.object(hubspot_sync.settings, "hubspot_api_key", "fake-key"),
        ):
            result = hubspot_sync.sync_subscriber_to_hubspot(_sub())

        assert result is True
        mock_client.crm.contacts.basic_api.update.assert_called_once()
        mock_client.crm.contacts.basic_api.create.assert_not_called()
        # Confirm the correct contact_id was used
        update_args = mock_client.crm.contacts.basic_api.update.call_args
        assert update_args.args[0] == "77"


# ---------------------------------------------------------------------------
# Skip when no API key
# ---------------------------------------------------------------------------


class TestNoApiKey:
    def test_returns_false_when_api_key_empty(self):
        with patch.object(hubspot_sync.settings, "hubspot_api_key", ""):
            result = hubspot_sync.sync_subscriber_to_hubspot(_sub())
        assert result is False

    def test_does_not_call_hubspot_when_key_missing(self):
        mock_client = MagicMock()
        with (
            patch.object(hubspot_sync, "_get_hs_client", return_value=mock_client),
            patch.object(hubspot_sync.settings, "hubspot_api_key", ""),
        ):
            hubspot_sync.sync_subscriber_to_hubspot(_sub())

        mock_client.crm.contacts.search_api.do_search.assert_not_called()


# ---------------------------------------------------------------------------
# API exception handling
# ---------------------------------------------------------------------------


class TestApiExceptions:
    def test_returns_false_on_search_exception(self):
        from hubspot.crm.contacts.exceptions import ApiException

        mock_client = MagicMock()
        mock_client.crm.contacts.search_api.do_search.side_effect = ApiException(
            status=401, reason="Unauthorized"
        )

        with (
            patch.object(hubspot_sync, "_get_hs_client", return_value=mock_client),
            patch.object(hubspot_sync.settings, "hubspot_api_key", "fake-key"),
        ):
            result = hubspot_sync.sync_subscriber_to_hubspot(_sub())

        assert result is False

    def test_returns_false_on_create_exception(self):
        from hubspot.crm.contacts.exceptions import ApiException

        mock_client = MagicMock()
        mock_client.crm.contacts.search_api.do_search.return_value = _search_result(0)
        mock_client.crm.contacts.basic_api.create.side_effect = ApiException(
            status=400, reason="Bad Request"
        )

        with (
            patch.object(hubspot_sync, "_get_hs_client", return_value=mock_client),
            patch.object(hubspot_sync.settings, "hubspot_api_key", "fake-key"),
        ):
            result = hubspot_sync.sync_subscriber_to_hubspot(_sub())

        assert result is False


# ---------------------------------------------------------------------------
# Newsletter list membership
# ---------------------------------------------------------------------------


class TestNewsletterListMembership:
    def test_adds_to_list_when_configured_and_active(self):
        mock_client = MagicMock()
        mock_client.crm.contacts.search_api.do_search.return_value = _search_result(
            total=1, contact_id="77"
        )

        with (
            patch.object(hubspot_sync, "_get_hs_client", return_value=mock_client),
            patch.object(hubspot_sync.settings, "hubspot_api_key", "fake-key"),
            patch.object(hubspot_sync.settings, "hubspot_newsletter_list_id", "list-99"),
        ):
            result = hubspot_sync.sync_subscriber_to_hubspot(_sub(is_active=True))

        assert result is True
        mock_client.crm.lists.memberships_api.add.assert_called_once_with("list-99", ["77"])
        mock_client.crm.lists.memberships_api.remove.assert_not_called()

    def test_removes_from_list_when_inactive(self):
        mock_client = MagicMock()
        mock_client.crm.contacts.search_api.do_search.return_value = _search_result(
            total=1, contact_id="77"
        )

        with (
            patch.object(hubspot_sync, "_get_hs_client", return_value=mock_client),
            patch.object(hubspot_sync.settings, "hubspot_api_key", "fake-key"),
            patch.object(hubspot_sync.settings, "hubspot_newsletter_list_id", "list-99"),
        ):
            result = hubspot_sync.sync_subscriber_to_hubspot(_sub(is_active=False))

        assert result is True
        mock_client.crm.lists.memberships_api.remove.assert_called_once_with("list-99", ["77"])
        mock_client.crm.lists.memberships_api.add.assert_not_called()

    def test_skips_list_when_list_id_empty(self):
        mock_client = MagicMock()
        mock_client.crm.contacts.search_api.do_search.return_value = _search_result(
            total=1, contact_id="77"
        )

        with (
            patch.object(hubspot_sync, "_get_hs_client", return_value=mock_client),
            patch.object(hubspot_sync.settings, "hubspot_api_key", "fake-key"),
            patch.object(hubspot_sync.settings, "hubspot_newsletter_list_id", ""),
        ):
            hubspot_sync.sync_subscriber_to_hubspot(_sub())

        mock_client.crm.lists.memberships_api.add.assert_not_called()
        mock_client.crm.lists.memberships_api.remove.assert_not_called()

    def test_list_failure_still_returns_true_after_upsert(self):
        from hubspot.crm.lists.exceptions import ApiException as ListsApiException

        mock_client = MagicMock()
        mock_client.crm.contacts.search_api.do_search.return_value = _search_result(
            total=1, contact_id="77"
        )
        mock_client.crm.lists.memberships_api.add.side_effect = ListsApiException(
            status=403, reason="Forbidden"
        )

        with (
            patch.object(hubspot_sync, "_get_hs_client", return_value=mock_client),
            patch.object(hubspot_sync.settings, "hubspot_api_key", "fake-key"),
            patch.object(hubspot_sync.settings, "hubspot_newsletter_list_id", "list-99"),
        ):
            result = hubspot_sync.sync_subscriber_to_hubspot(_sub(is_active=True))

        assert result is True
        mock_client.crm.contacts.basic_api.update.assert_called_once()

    def test_new_contact_gets_list_add_with_created_id(self):
        mock_client = MagicMock()
        mock_client.crm.contacts.search_api.do_search.return_value = _search_result(0)
        created = MagicMock()
        created.id = "42"
        mock_client.crm.contacts.basic_api.create.return_value = created

        with (
            patch.object(hubspot_sync, "_get_hs_client", return_value=mock_client),
            patch.object(hubspot_sync.settings, "hubspot_api_key", "fake-key"),
            patch.object(hubspot_sync.settings, "hubspot_newsletter_list_id", "list-1"),
        ):
            hubspot_sync.sync_subscriber_to_hubspot(_sub(is_active=True))

        mock_client.crm.lists.memberships_api.add.assert_called_once_with("list-1", ["42"])
