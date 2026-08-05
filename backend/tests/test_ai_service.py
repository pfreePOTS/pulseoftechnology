"""Unit tests for backend/services/ai_service.py."""

import json
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from ..models.article import Article, ArticleStatus
from ..models.classification_feedback import ClassificationFeedback
from ..models.source import Source, SourceType
from ..models.topic import Topic
from ..services import ai_service
from ..tests.domain_fixtures import make_topic

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _patch_prompts():
    """Use built-in fallbacks so tests do not require prompt_templates rows."""
    return patch.object(
        ai_service,
        "get_active_prompt",
        side_effect=lambda _db, name: ai_service._FALLBACK_PROMPTS[name],
    )


def _patch_llm(reply: str):
    """Patch ``chat_completion_result`` so the pipeline gets text + mocked metrics."""
    return patch.object(
        ai_service.llm_client,
        "chat_completion_result",
        return_value=ai_service.llm_client.ChatCompletionResult(
            text=reply,
            model_id="mock-model",
            latency_ms=100,
            total_tokens=42,
        ),
    )


# ---------------------------------------------------------------------------
# evaluate_article
# ---------------------------------------------------------------------------


class TestEvaluateArticle:
    def test_relevant_article_returns_dict(self):
        payload = {
            "relevant": True,
            "domain": "AI",
            "subdomain": "Model Launches",
            "tags": ["ai"],
            "suggested_topic_name": "Enterprise AI Model Launches",
            "urgency_score": 8,
            "reason": "Describes a major AI model launch affecting enterprise strategy.",
            "what_is_it": "OpenAI launched a new enterprise model.",
            "why_it_matters": "Executives need to evaluate adoption.",
        }
        mock_db = MagicMock()

        with _patch_llm(json.dumps(payload)), _patch_prompts():
            result = ai_service.evaluate_article("OpenAI launches GPT-5 for enterprise.", mock_db)

        assert result is not None
        assert result["relevant"] is True
        assert result["domain"] == "AI"
        assert result["urgency_score"] == 8
        assert "reason" in result

    def test_irrelevant_article_returns_none(self):
        payload = {
            "relevant": False,
            "domain": "Other",
            "urgency_score": 1,
            "reason": "Celebrity gossip, not relevant to executives.",
        }
        mock_db = MagicMock()

        with _patch_llm(json.dumps(payload)), _patch_prompts():
            result = ai_service.evaluate_article("Celebrity spotted at coffee shop.", mock_db)

        assert result is None

    def test_malformed_json_requests_retry_instead_of_review_topic(self):
        mock_db = MagicMock()

        with _patch_llm("not json at all"), _patch_prompts():
            try:
                ai_service.evaluate_article("Some article text.", mock_db)
            except ai_service.PipelineRetryRequested as exc:
                assert "gate" in str(exc).lower()
            else:  # pragma: no cover - explicit failure path
                raise AssertionError("Malformed AI JSON should request retry")

    def test_json_with_surrounding_text_still_extracts_pipeline(self):
        payload = {
            "relevant": True,
            "domain": "AI",
            "subdomain": "Model Launches",
            "tags": ["ai"],
            "suggested_topic_name": "Enterprise AI Model Launches",
            "urgency_score": 8,
            "reason": "Describes a major AI model launch affecting enterprise strategy.",
            "what_is_it": "OpenAI launched a new enterprise model.",
            "why_it_matters": "Executives need to evaluate adoption.",
        }
        wrapped = (
            "Here is the structured extraction you asked for:\n\n"
            + json.dumps(payload)
            + "\n\nLet me know if you need tweaks."
        )
        mock_db = MagicMock()

        with _patch_llm(wrapped), _patch_prompts():
            result = ai_service.evaluate_article("OpenAI launches GPT-5 for enterprise.", mock_db)

        assert result is not None
        assert result["domain"] == "AI"
        assert result["urgency_score"] == 8

    def test_parse_accepts_balanced_fragment_with_trailing_noise(self):
        with patch("backend.services.optimizer_service.record_agent_run"):
            out = ai_service._parse('{"gate": true} extra junk', "gate")

        assert out == {"gate": True}

    def test_parse_empty_response_records_actionable_failure_detail(self):
        captured: dict = {}

        def _capture(**kw):
            captured.update(kw)

        with patch("backend.services.optimizer_service.record_agent_run", side_effect=_capture):
            out = ai_service._parse("", "gate")

        assert out is None
        assert captured.get("context_text") == "(empty response)"
        assert "Empty model response" in (captured.get("failure_detail") or "")

    def test_correct_model_used(self):
        payload = {"relevant": False, "domain": "Other", "urgency_score": 1, "reason": "x"}
        mock_db = MagicMock()

        with (
            patch.object(
                ai_service.llm_client,
                "chat_completion_result",
                return_value=ai_service.llm_client.ChatCompletionResult(
                    text=json.dumps(payload),
                    model_id="mock-model",
                    latency_ms=100,
                    total_tokens=42,
                ),
            ) as mock_chat,
            _patch_prompts(),
        ):
            ai_service.evaluate_article("text", mock_db)

        gate_model = mock_chat.call_args_list[0].args[0]
        assert gate_model == ai_service.HAIKU_MODEL

    def test_classification_feedback_context_contains_recent_corrections(self, db_session):
        db_session.add(
            ClassificationFeedback(
                action="approve",
                article_title="SAP npm packages compromised",
                content_excerpt="npm credential theft",
                corrected_domain="Security",
                corrected_subdomain="Software Supply Chain",
                corrected_topic_name="Package Registry Credential Theft",
            )
        )
        db_session.add(
            ClassificationFeedback(
                action="skip",
                article_title="Today’s Wordle hints",
                content_excerpt="puzzle",
            )
        )
        db_session.commit()

        context = ai_service._classification_feedback_context(db_session)

        assert (
            "Classify as Security / Software Supply Chain / Package Registry Credential Theft"
            in context
        )
        assert "SAP npm packages compromised" in context
        assert "Reject as non-tech/noise: Today’s Wordle hints" in context


# ---------------------------------------------------------------------------
# Cluster node — JSON retries + degraded empty topic
# ---------------------------------------------------------------------------


class TestClusterNode:
    def test_second_completion_parses_after_first_is_garbage(self):
        mock_db = MagicMock()
        good = {"suggested_topic_name": "  Phishing trends  "}
        with (
            _patch_prompts(),
            patch.object(ai_service, "get_active_model", return_value="mock-cluster"),
            patch.object(
                ai_service.llm_client,
                "chat_completion_result",
                side_effect=[
                    ai_service.llm_client.ChatCompletionResult(
                        text="Here is prose only",
                        model_id="m",
                        latency_ms=11,
                        total_tokens=21,
                    ),
                    ai_service.llm_client.ChatCompletionResult(
                        text=json.dumps(good),
                        model_id="m",
                        latency_ms=12,
                        total_tokens=22,
                    ),
                ],
            ) as cc,
            patch("backend.services.optimizer_service.record_agent_run"),
        ):
            out = ai_service._node_cluster(
                mock_db, "Article body.", [], domain="Security", subdomain="SOC"
            )

        assert out == "Phishing trends"
        assert cc.call_count == 2

    def test_persistent_bad_json_returns_empty_string(self):
        mock_db = MagicMock()
        with (
            _patch_prompts(),
            patch.object(ai_service, "get_active_model", return_value="mock-cluster"),
            patch.object(
                ai_service.llm_client,
                "chat_completion_result",
                return_value=ai_service.llm_client.ChatCompletionResult(
                    text="not-valid-json",
                    model_id="m",
                    latency_ms=1,
                    total_tokens=9,
                ),
            ) as cc,
            patch("backend.services.optimizer_service.record_agent_run") as ra,
        ):
            out = ai_service._node_cluster(mock_db, "Body", [], domain="Security", subdomain="")

        assert out == ""
        assert cc.call_count == 2
        assert len(ra.call_args_list) == 1

    def test_parse_failure_suppresses_telemetry_when_requested(self):
        recorded: list[dict] = []

        def _cap(**kw):
            recorded.append(kw)

        with patch("backend.services.optimizer_service.record_agent_run", side_effect=_cap):
            out = ai_service._parse("", "gate", record_parse_failure_telemetry=False)

        assert out is None
        assert recorded == []


# ---------------------------------------------------------------------------
# Finance subdomain normalization
# ---------------------------------------------------------------------------


class TestFinanceSubdomainNormalization:
    def test_replaces_vague_finance_label_with_tech_investment_bucket(self):
        label = ai_service._normalize_subdomain_label(
            "Finance",
            "Emerging Financial Behaviors",
            "AI startup funding, venture capital valuations, IPO, M&A, and technology investment.",
        )

        assert label == "Tech Investment & Valuations"

    def test_replaces_vague_finance_label_with_digital_payments_bucket(self):
        label = ai_service._normalize_subdomain_label(
            "Finance",
            "Emerging Financial Behaviors",
            "Stablecoin payouts, tokenization, crypto wallets, and digital payment rails.",
        )

        assert label == "Digital Payments & Assets"

    def test_non_finance_subdomain_is_unchanged(self):
        label = ai_service._normalize_subdomain_label(
            "AI",
            "Emerging Financial Behaviors",
            "AI agent adoption and model orchestration.",
        )

        assert label == "Emerging Financial Behaviors"

    def test_reclassifies_legacy_finance_articles_and_subdomains(self, db_session):
        source = Source(name="Legacy", url="https://example.com/legacy", type=SourceType.rss)
        topic = make_topic(
            db_session,
            name="Finance",
            domain_slug="compliance",
            subdomain="Emerging Financial Behaviors",
            urgency_score=7,
        )
        bad = Article(
            source=source,
            topic=topic,
            title="Fed holds steady on rates",
            url="https://example.com/fed",
            content="Powell discussed inflation, rates, and macroeconomic policy.",
            status=ArticleStatus.processed,
            published_at=datetime.now(UTC),
        )
        good = Article(
            source=source,
            topic=topic,
            title="AI startup funding wave lifts enterprise software valuations",
            url="https://example.com/ai-funding",
            content="Venture capital, startup funding, valuations, IPO pipelines, and technology investment.",
            status=ArticleStatus.processed,
            published_at=datetime.now(UTC),
        )
        db_session.add_all([source, topic, bad, good])
        db_session.commit()

        result = ai_service.reclassify_legacy_finance_topics(db_session)

        db_session.refresh(topic)
        db_session.refresh(bad)
        db_session.refresh(good)
        assert result == {
            "articles_archived": 1,
            "topics_normalized": 1,
            "articles_normalized": 1,
        }
        assert bad.status == ArticleStatus.skipped
        assert bad.archived_at is not None
        assert good.archived_at is None
        assert good.subdomain == "Tech Investment & Valuations"
        assert topic.subdomain == "Tech Investment & Valuations"

    def test_reclassifies_legacy_leadership_without_tech_signals(self, db_session):
        result = ai_service.reclassify_legacy_leadership_topics(db_session)
        assert result == {
            "articles_archived": 0,
            "topics_normalized": 0,
            "articles_normalized": 0,
        }

    def test_cleanup_review_needed_topics_moves_articles_out_of_trending(self, db_session):
        source = Source(name="Legacy", url="https://example.com/legacy-review", type=SourceType.rss)
        topic = make_topic(
            db_session, name="Other: Review Needed", domain_slug="other", urgency_score=5
        )
        nontech = Article(
            source=source,
            topic=topic,
            title="Today’s Wordle hints",
            url="https://example.com/legacy-wordle",
            content="Puzzle hints and answer.",
            status=ArticleStatus.processed,
        )
        tech = Article(
            source=source,
            topic=topic,
            title="Official SAP npm packages compromised",
            url="https://example.com/legacy-npm",
            content="Attackers compromised npm packages to steal credentials from enterprise systems.",
            status=ArticleStatus.processed,
        )
        db_session.add_all([source, topic, nontech, tech])
        db_session.commit()

        result = ai_service.cleanup_review_needed_topics(db_session)

        db_session.refresh(nontech)
        db_session.refresh(tech)
        assert result == {"reviewed": 1, "skipped": 1, "topics_deleted": 1}
        assert nontech.status == ArticleStatus.skipped
        assert nontech.topic_id is None
        assert nontech.archived_at is not None
        assert tech.status == ArticleStatus.review
        assert tech.topic_id is None
        assert db_session.query(Topic).count() == 0


# ---------------------------------------------------------------------------
# process_raw_articles
# ---------------------------------------------------------------------------


class TestProcessRawArticles:
    def test_malformed_json_retries_once_then_moves_to_review(self, db_session):
        source = Source(name="Tech", url="https://example.com/raw", type=SourceType.rss)
        article = Article(
            source=source,
            title="Ambiguous article",
            url="https://example.com/ambiguous",
            content="Some ambiguous text.",
            status=ArticleStatus.raw,
        )
        db_session.add_all([source, article])
        db_session.commit()

        with _patch_llm("not json at all"), _patch_prompts():
            processed = ai_service.process_raw_articles(db_session)

        db_session.refresh(article)
        assert processed == 0
        assert article.status == ArticleStatus.retry
        assert article.review_attempts == 1

        with _patch_llm("not json at all"), _patch_prompts():
            processed = ai_service.process_raw_articles(db_session)

        db_session.refresh(article)
        assert processed == 0
        assert article.status == ArticleStatus.review
        assert article.review_reason
        assert article.topic_id is None

    def test_tech_article_with_placeholder_topic_is_categorized_not_reviewed(self, db_session):
        """Gate decides tech vs non-tech; a tech-passing article must always be categorized.

        Even when the LLM punts to "Other: Review Needed" we synthesize a topic name from the
        subdomain (or a title stub) so the article ends up processed under whatever domain
        applies — never auto-pushed to a curator queue.
        """
        source = Source(name="Wire", url="https://example.com/review", type=SourceType.rss)
        article = Article(
            source=source,
            title="Questionable article",
            url="https://example.com/questionable",
            content="This mentions technology only vaguely.",
            status=ArticleStatus.raw,
        )
        db_session.add_all([source, article])
        db_session.commit()

        result = {
            "relevant": True,
            "domain": "Other",
            "subdomain": "",
            "suggested_topic_name": "Other: Review Needed",
            "urgency_score": 5,
            "what_is_it": "Unclear classification.",
            "why_it_matters": "Vague tech mention.",
            "tags": ["review"],
        }

        with (
            patch.object(ai_service, "evaluate_article", return_value=result),
            patch.object(ai_service, "fill_missing_topic_subdomains", return_value=0),
        ):
            processed = ai_service.process_raw_articles(db_session)

        db_session.refresh(article)
        topic = db_session.query(Topic).one()
        assert processed == 1
        assert article.status == ArticleStatus.processed
        assert article.topic_id == topic.id
        assert topic.domain.short_label == "Other"
        assert "review needed" not in topic.name.lower()

    def test_gate_decides_tech_vs_non_tech_and_skips_when_false(self, db_session):
        """Architectural contract: Agent 1 (Gate, Haiku) is the *only* tech / non-tech screen.

        Articles the gate rejects are skipped. There is no keyword backstop in the live pipeline —
        downstream agents (classify, score, cluster, summarize) are not consulted at all.
        """
        source = Source(name="HealthWire", url="https://example.com/rawmilk", type=SourceType.rss)
        article = Article(
            source=source,
            title="Risk of paralysis, bacteria, even death is no match for Americans' thirst for raw milk",
            url="https://example.com/raw-milk",
            content=(
                "Federal regulators warn about pasteurization protections being cast aside by a "
                "dedicated raw-milk audience even after well-publicised hospitalizations."
            ),
            status=ArticleStatus.raw,
        )
        db_session.add_all([source, article])
        db_session.commit()

        with (
            patch.object(ai_service, "_node_gate", return_value=False),
            patch.object(ai_service, "fill_missing_topic_subdomains", return_value=0),
            _patch_prompts(),
        ):
            processed = ai_service.process_raw_articles(db_session)

        db_session.refresh(article)
        assert processed == 0
        assert article.status == ArticleStatus.skipped
        assert article.topic_id is None
        assert db_session.query(Topic).count() == 0

    def test_gate_pass_with_other_domain_is_categorized_under_other(self, db_session):
        """Once gate (Agent 1) says yes, classify (Agent 2) chooses the domain — including ``Other`` —
        and the article must be processed there, never sent to review."""
        source = Source(name="Fortune", url="https://example.com/fortune", type=SourceType.rss)
        article = Article(
            source=source,
            title="Fed holds steady on rates after Powell press conference",
            url="https://example.com/fed-rates",
            content=(
                "The Federal Reserve held interest rates steady while investors watched inflation."
            ),
            status=ArticleStatus.raw,
        )
        db_session.add_all([source, article])
        db_session.commit()

        result = {
            "relevant": True,
            "domain": "Other",
            "subdomain": "Emerging Financial Behaviors",
            "suggested_topic_name": "Other: Review Needed",
            "urgency_score": 6,
            "what_is_it": "Central bank policy update.",
            "why_it_matters": "Macro context for executives.",
            "tags": ["rates", "fed"],
        }

        with (
            patch.object(ai_service, "evaluate_article", return_value=result),
            patch.object(ai_service, "fill_missing_topic_subdomains", return_value=0),
        ):
            processed = ai_service.process_raw_articles(db_session)

        db_session.refresh(article)
        topic = db_session.query(Topic).one()
        assert processed == 1
        assert article.status == ArticleStatus.processed
        assert article.topic_id == topic.id
        assert topic.domain.short_label == "Other"
        assert "review needed" not in topic.name.lower()

    def test_empty_cluster_topic_is_categorized_via_synthesis(self, db_session):
        """If cluster returns an empty topic name, gate-passing tech articles still categorize."""
        source = Source(name="Wire", url="https://example.com/cluster-empty", type=SourceType.rss)
        article = Article(
            source=source,
            title="GitHub repository hit by malicious npm package campaign",
            url="https://example.com/npm-campaign",
            content=(
                "Attackers compromised npm packages tied to enterprise systems and stole "
                "credentials from CI pipelines hosted on GitHub."
            ),
            status=ArticleStatus.raw,
        )
        db_session.add_all([source, article])
        db_session.commit()

        # Mock chained internal nodes: gate=True, classify={Security}, score=urgency, cluster="" (empty),
        # summarize returns body. We exercise process_raw_articles -> evaluate_article integration.
        with (
            patch.object(ai_service, "_node_gate", return_value=True),
            patch.object(
                ai_service,
                "_node_classify",
                return_value={
                    "domain": "Security",
                    "subdomain": "Software Supply Chain",
                    "tags": ["npm"],
                },
            ),
            patch.object(
                ai_service,
                "_node_score",
                return_value={"urgency_score": 7.0, "reason": "Active campaign."},
            ),
            patch.object(ai_service, "_node_cluster", return_value=""),
            patch.object(
                ai_service,
                "_node_summarize",
                return_value={
                    "what_is_it": "Supply-chain compromise.",
                    "why_it_matters": "Operational impact.",
                    "persona_impacts": None,
                },
            ),
            patch.object(ai_service, "fill_missing_topic_subdomains", return_value=0),
            _patch_prompts(),
        ):
            processed = ai_service.process_raw_articles(db_session)

        db_session.refresh(article)
        topic = db_session.query(Topic).one()
        assert processed == 1
        assert article.status == ArticleStatus.processed
        assert article.topic_id == topic.id
        assert topic.domain.short_label == "Security"
        assert "review needed" not in topic.name.lower()

    def test_classify_assigned_domain_is_used_verbatim_no_keyword_rescue(self, db_session):
        """Classify (Agent 2) is the sole authority on domain. Even when an article reads as a
        clear tech-domain story, if classify returns ``Other`` the pipeline must respect that
        verdict — no keyword inference is allowed to override it."""
        source = Source(name="NetWorld", url="https://example.com/net", type=SourceType.rss)
        article = Article(
            source=source,
            title="The era of chatbot AIOps is fading as agentic AI gains traction",
            url="https://example.com/agentic-aiops",
            content=(
                "Network teams are moving past chatbot AIOps as agentic AI assistants take on "
                "incident response, generative AI copilots augment SREs, and large language models "
                "are pulled into observability workflows."
            ),
            status=ArticleStatus.raw,
        )
        db_session.add_all([source, article])
        db_session.commit()

        result = {
            "relevant": True,
            "domain": "Other",
            "subdomain": "Agentic AI Operations",
            "suggested_topic_name": "Other: Review Needed",
            "urgency_score": 6,
            "what_is_it": "Agentic AI is replacing chatbot AIOps in network operations.",
            "why_it_matters": "Operations leaders should plan for autonomous remediation.",
            "tags": ["aiops", "agentic", "ai"],
        }

        with (
            patch.object(ai_service, "evaluate_article", return_value=result),
            patch.object(ai_service, "fill_missing_topic_subdomains", return_value=0),
        ):
            processed = ai_service.process_raw_articles(db_session)

        db_session.refresh(article)
        topic = db_session.query(Topic).one()
        assert processed == 1
        assert article.status == ArticleStatus.processed
        assert article.topic_id == topic.id
        assert topic.domain.short_label == "Other"
        assert topic.name == "Other: Agentic AI Operations"

    def test_processes_finance_classification_with_technology_signal(self, db_session):
        source = Source(
            name="Industry Wire", url="https://example.com/tech-rss", type=SourceType.rss
        )
        article = Article(
            source=source,
            title="Bank rolls out API-first core banking platform",
            url="https://example.com/core-banking-platform",
            content="The new platform modernizes payment rails, cloud integration, and fraud controls.",
            status=ArticleStatus.raw,
        )
        db_session.add_all([source, article])
        db_session.commit()

        finance_result = {
            "relevant": True,
            "domain": "Finance",
            "subdomain": "Core Banking Modernization",
            "suggested_topic_name": "Core Banking Modernization",
            "urgency_score": 7,
            "what_is_it": "Cloud platform upgrade for banking operations",
            "why_it_matters": "Financial institutions are modernizing legacy systems.",
            "tags": ["api", "payments", "cloud"],
        }

        with (
            patch.object(ai_service, "evaluate_article", return_value=finance_result),
            patch.object(ai_service, "fill_missing_topic_subdomains", return_value=0),
        ):
            processed = ai_service.process_raw_articles(db_session)

        db_session.refresh(article)
        topic = db_session.query(Topic).one()
        assert processed == 1
        assert article.status == ArticleStatus.processed
        assert article.topic_id == topic.id
        assert topic.domain.short_label == "Compliance"

    def test_llm_api_error_increments_attempts_and_escalates_at_cap(self, db_session):
        """`LLMAPIError` must count toward `review_attempts` so a row that keeps
        tripping the same provider error eventually escalates from `retry` to
        the manual `review` queue instead of looping forever."""
        source = Source(name="Wire", url="https://example.com/llm-cap", type=SourceType.rss)
        article = Article(
            source=source,
            title="An article that always fails the LLM call",
            url="https://example.com/llm-cap",
            content="Body text.",
            status=ArticleStatus.raw,
        )
        db_session.add_all([source, article])
        db_session.commit()

        boom = ai_service.llm_client.LLMAPIError("provider 503")

        with patch.object(ai_service, "evaluate_article", side_effect=boom):
            for expected_attempt in range(1, ai_service._LLM_API_ERROR_RETRY_CAP):
                ai_service.process_raw_articles(db_session)
                db_session.refresh(article)
                assert article.status == ArticleStatus.retry
                assert article.review_attempts == expected_attempt
                assert article.review_reason and "LLMAPIError" in article.review_reason

            ai_service.process_raw_articles(db_session)

        db_session.refresh(article)
        assert article.status == ArticleStatus.review
        assert article.topic_id is None
        assert article.review_attempts == ai_service._LLM_API_ERROR_RETRY_CAP

    def test_retry_rows_are_processed_before_fresh_raw_rows(self, db_session):
        """A `retry` row queued earlier in the day should not sit behind a fresh
        batch of `raw` rows. Ordering keeps once-failed articles from starving
        when the next ingestion tick adds a wave of new arrivals."""
        source = Source(name="Wire", url="https://example.com/order", type=SourceType.rss)
        old_retry = Article(
            source=source,
            title="Old retry row",
            url="https://example.com/old-retry",
            content="Already failed once.",
            status=ArticleStatus.retry,
            review_attempts=1,
            ingested_at=datetime(2026, 4, 30, 17, 0, tzinfo=UTC),
        )
        fresh_raw = Article(
            source=source,
            title="Fresh raw row",
            url="https://example.com/fresh-raw",
            content="Just ingested.",
            status=ArticleStatus.raw,
            ingested_at=datetime(2026, 4, 30, 21, 0, tzinfo=UTC),
        )
        db_session.add_all([source, old_retry, fresh_raw])
        db_session.commit()

        seen_order: list[int] = []

        def fake_evaluate(_content, _db, **_kwargs):
            seen_order.append(_kwargs["article_id"])
            return {
                "relevant": True,
                "domain": "AI",
                "subdomain": "Testing",
                "suggested_topic_name": "AI: Testing",
                "urgency_score": 5,
                "what_is_it": "test",
                "why_it_matters": "test",
                "tags": ["test"],
            }

        with (
            patch.object(ai_service, "evaluate_article", side_effect=fake_evaluate),
            patch.object(ai_service, "fill_missing_topic_subdomains", return_value=0),
        ):
            ai_service.process_raw_articles(db_session)

        assert seen_order == [old_retry.id, fresh_raw.id]


# ---------------------------------------------------------------------------
# generate_topic_summary
# ---------------------------------------------------------------------------


class TestGenerateTopicSummary:
    def _make_topic(self) -> SimpleNamespace:
        return SimpleNamespace(
            id=1,
            name="AI",
            domain="AI",
            urgency_score=8.0,
            summary=None,
            newsletter_briefing=None,
        )

    def _make_articles(self, n: int = 2) -> list[SimpleNamespace]:
        return [
            SimpleNamespace(
                id=i + 1,
                title=f"Article {i + 1}: AI breakthrough",
                content=f"Details about AI development number {i + 1}.",
            )
            for i in range(n)
        ]

    def test_summary_saved_to_topic(self):
        payload = {
            "summary": "AI adoption accelerated this quarter.",
            "why_it_matters": "CEOs must plan for workforce changes now.",
            "what_is_it": "Agent tools automate routine decisions.",
            "what_changed": "Enterprise suites shipped integrations.",
            "what_to_do": "Start with a bounded pilot.",
        }

        topic = self._make_topic()
        articles = self._make_articles()

        mock_db = MagicMock()

        with _patch_llm(json.dumps(payload)), _patch_prompts():
            result = ai_service.generate_topic_summary(topic, articles, mock_db)

        assert "AI adoption accelerated" in result
        assert "Why it matters:" in result
        assert topic.summary == result
        assert topic.newsletter_briefing["what_is_it"] == payload["what_is_it"]
        assert topic.newsletter_briefing["what_to_do"] == payload["what_to_do"]

    def test_empty_articles_returns_empty_string(self):
        topic = self._make_topic()
        mock_db = MagicMock()
        result = ai_service.generate_topic_summary(topic, [], mock_db)
        assert result == ""

    def test_malformed_json_falls_back_to_raw_text(self):
        raw_text = "Some summary without JSON structure."
        fallback = "Summary generation failed. Review needed."

        topic = self._make_topic()
        articles = self._make_articles()
        mock_db = MagicMock()

        with _patch_llm(raw_text), _patch_prompts():
            result = ai_service.generate_topic_summary(topic, articles, mock_db)

        assert result == fallback
        assert topic.summary == fallback
        assert topic.newsletter_briefing is None

    def test_correct_model_used(self):
        payload = {"summary": "s", "why_it_matters": "w"}

        topic = self._make_topic()
        articles = self._make_articles()
        mock_db = MagicMock()

        with (
            patch.object(
                ai_service.llm_client,
                "chat_completion_result",
                return_value=ai_service.llm_client.ChatCompletionResult(
                    text=json.dumps(payload),
                    model_id="mock-model",
                    latency_ms=100,
                    total_tokens=42,
                ),
            ) as mock_chat,
            _patch_prompts(),
        ):
            ai_service.generate_topic_summary(topic, articles, mock_db)

        used = mock_chat.call_args_list[0].args[0]
        assert used == ai_service.SONNET_MODEL

    def test_articles_capped_at_ten(self):
        payload = {"summary": "s", "why_it_matters": "w"}

        topic = self._make_topic()
        articles = self._make_articles(15)
        mock_db = MagicMock()

        with (
            patch.object(
                ai_service.llm_client,
                "chat_completion_result",
                return_value=ai_service.llm_client.ChatCompletionResult(
                    text=json.dumps(payload),
                    model_id="mock-model",
                    latency_ms=100,
                    total_tokens=42,
                ),
            ) as mock_chat,
            _patch_prompts(),
        ):
            ai_service.generate_topic_summary(topic, articles, mock_db)

        user_content = mock_chat.call_args_list[0].kwargs["user"]
        assert "Article 10" in user_content
        assert "Article 11" not in user_content
