# Prompt 16: Fix Ingestion Pipeline and Newsletter Article Rendering

This prompt fixes the gaps in the ingestion pipeline that are preventing real articles from being processed, and wires the newsletter to actually render those articles using the `_ARTICLE_BLOCK` template we designed in Prompt 15.

## 1. Fix Ingestion Feed Parsing (Missing Dates)

**Context:** The `feedparser` library sometimes fails to parse dates depending on the RSS feed format, which causes `published_at` to be `None`. If the AI pipeline or newsletter relies on recency, these articles might be dropped. We also need to ensure `ANTHROPIC_API_KEY` is loaded correctly so the AI evaluation doesn't silently fail.

**Instructions for Cursor:**
1.  **Update `backend/services/ingestion.py`**:
    *   In `_parse_published`, add a fallback: if `published_parsed` is missing but `published` exists, try using `dateutil.parser.parse` (you may need to add `python-dateutil` to requirements/imports).
    *   If all parsing fails, fallback to `datetime.now(timezone.utc)`.
    *   Ensure the `process_raw_articles` call at the end of `run_all_sources` is wrapped in a `try/except` block that logs the exact error, so we know if the Anthropic API call is failing.

## 2. Fix AI Pipeline Article Schema and Model Alignment

**Context:** We added `what_is_it`, `why_it_matters`, and `tags` to the Article model in Prompt 15, but we need to ensure the AI pipeline actually extracts them from the JSON and saves them to the database.

**Instructions for Cursor:**
1.  **Update `backend/services/ai_service.py`**:
    *   In `evaluate_article`, ensure the returned dictionary includes the new fields:
        ```python
        return {
            "relevant": result.get("relevant", False),
            "domain": result.get("domain", "Other"),
            "urgency_score": result.get("urgency_score", 1),
            "suggested_topic_name": result.get("suggested_topic_name"),
            "what_is_it": result.get("what_is_it"),
            "why_it_matters": result.get("why_it_matters"),
            "tags": result.get("tags", [])
        }
        ```
    *   In `process_raw_articles`, when updating the `article` object, set these fields:
        ```python
        article.what_is_it = result.get("what_is_it")
        article.why_it_matters = result.get("why_it_matters")
        article.tags = result.get("tags")
        ```

## 3. Wire Newsletter to Render Articles

**Context:** The newsletter `_build_html` function currently only formats the `_TOPIC_BLOCK`. It does not fetch or render the actual articles associated with the topic.

**Instructions for Cursor:**
1.  **Update `backend/services/email_service.py`**:
    *   Ensure `_ARTICLE_BLOCK` is defined at the top of the file (from Prompt 15).
    *   In `_build_html`, before formatting `_TOPIC_BLOCK`, fetch the articles for the current `topic` (you may need to pass the `db` session to `_build_html` or ensure the `topic.articles` relationship is eager-loaded).
    *   Filter the articles based on the subscriber's role tags (if applicable). For the preview, you can just take the top 3 most recent articles for the topic.
    *   Format each article using `_ARTICLE_BLOCK`:
        ```python
        articles_html_list = []
        for article in topic.articles[:3]: # Limit to top 3 for now
            articles_html_list.append(
                _ARTICLE_BLOCK.format(
                    url=article.url,
                    title=article.title,
                    what_is_it=article.what_is_it or "No summary available.",
                    why_it_matters=article.why_it_matters or "No impact available."
                )
            )
        articles_html = "\n".join(articles_html_list)
        ```
    *   Pass `articles_html` into the `_TOPIC_BLOCK.format()` call.
    *   Update `_TOPIC_BLOCK` template string to include `{articles_html}` at the bottom of the `<td>` containing the summary.

## 4. Ensure Admin Preview Uses Real Data

**Context:** The admin newsletter preview currently uses a dummy subscriber. We need to make sure it triggers the full rendering logic with the articles.

**Instructions for Cursor:**
1.  **Update `backend/routers/admin.py`**:
    *   In `newsletter_preview`, ensure the `db` session is passed correctly to `generate_newsletter_preview`.
    *   Ensure that `generate_newsletter_preview` passes the `db` session down to `_build_html` if needed for lazy-loading articles.

## End-to-End Testing
1. Run the RSS Ingestion from the Admin Jobs page.
2. Check the server logs to confirm articles are fetched and the Anthropic API is called successfully.
3. Check the Topic Editor to confirm articles appear with `what_is_it` and `why_it_matters`.
4. Go to the Newsletter Simulation Sandbox and run the simulation. The preview should now show the actual articles under each topic, formatted with the `_ARTICLE_BLOCK` template.
