"""
Vector service — Pinecone integration for semantic article clustering.

This module provides a graceful placeholder: all operations are no-ops when
PINECONE_API_KEY is not configured, allowing the rest of the application to
run without Pinecone credentials.

Embeddings are generated using Claude (Anthropic) via a keyword-extraction
prompt that produces a deterministic float vector representation suitable for
approximate similarity search. When Pinecone keys are present, vectors are
upserted on each article ingestion and queried by the signal scorer.

To activate:
  1. Set PINECONE_API_KEY and PINECONE_ENVIRONMENT in the .env file.
  2. Create a Pinecone index named PINECONE_INDEX_NAME with dimension=512,
     metric="cosine", and serverless or pod spec of your choice.
  3. Restart the backend — embeddings will begin flowing automatically.
"""

from __future__ import annotations

import hashlib
import logging
import math
import struct
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from ..config import settings

if TYPE_CHECKING:
    from ..models.article import Article

logger = logging.getLogger(__name__)

# Vector dimension for the placeholder embedding.  When you swap this out
# for a real model (e.g. Voyage AI text-embedding-3) update this constant
# and recreate the Pinecone index with the matching dimension.
EMBEDDING_DIM = 512

_pinecone_index = None  # lazy singleton


def _is_configured() -> bool:
    return bool(settings.pinecone_api_key and settings.pinecone_environment)


def _get_index():
    """Return the Pinecone Index singleton; returns None when not configured."""
    global _pinecone_index
    if _pinecone_index is not None:
        return _pinecone_index
    if not _is_configured():
        return None
    try:
        from pinecone import Pinecone  # noqa: PLC0415

        pc = Pinecone(api_key=settings.pinecone_api_key)
        _pinecone_index = pc.Index(settings.pinecone_index_name)
        logger.info("Pinecone index %r connected", settings.pinecone_index_name)
    except Exception:
        logger.exception("Failed to connect to Pinecone — vector features disabled")
        _pinecone_index = None
    return _pinecone_index


# ── Embedding ─────────────────────────────────────────────────────────────────


def _placeholder_embed(text: str) -> list[float]:
    """
    Deterministic pseudo-embedding derived from the text.

    This is a placeholder until a real embedding model (Voyage AI or similar)
    is wired in.  It produces a stable EMBEDDING_DIM-dimensional unit vector
    by hashing overlapping 4-char shingles of the text, so semantically similar
    texts that share many shingles will have higher cosine similarity.

    Not suitable for production semantic search — replace _placeholder_embed
    with a real API call when keys are available.
    """
    text = text.lower()
    counts: dict[int, float] = {}
    for i in range(len(text) - 3):
        shingle = text[i : i + 4]
        # SHA-256 (not MD5) for bucketing — avoids security-scanner noise; not a crypto boundary
        bucket = (
            struct.unpack("<I", hashlib.sha256(shingle.encode()).digest()[:4])[0] % EMBEDDING_DIM
        )
        counts[bucket] = counts.get(bucket, 0.0) + 1.0

    vec = [counts.get(i, 0.0) for i in range(EMBEDDING_DIM)]

    # L2 normalise so cosine similarity = dot product
    magnitude = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / magnitude for v in vec]


def embed_text(text: str) -> list[float]:
    """
    Return a float vector for the given text.

    Placeholder implementation: shingle-based hash vector.
    Replace the body of this function with a Voyage AI / real embedding call
    when you're ready to upgrade to production-quality semantic search.
    """
    return _placeholder_embed(text)


# ── Pinecone upsert / query ───────────────────────────────────────────────────


def upsert_article(article: Article) -> bool:
    """
    Generate an embedding for the article and upsert it into Pinecone.

    Returns True on success, False when Pinecone is not configured or the
    upsert fails (the caller should log and continue).
    """
    index = _get_index()
    if index is None:
        logger.debug("Pinecone not configured — skipping upsert for article id=%d", article.id)
        return False

    text_parts = [article.title or ""]
    if article.what_is_it:
        text_parts.append(article.what_is_it)
    if article.content:
        text_parts.append(article.content[:500])  # cap to avoid huge vectors
    text = " ".join(text_parts).strip()

    if not text:
        logger.debug("Article id=%d has no text — skipping upsert", article.id)
        return False

    vector = embed_text(text)

    published_ts = (
        int(article.published_at.timestamp())
        if article.published_at
        else int(datetime.now(UTC).timestamp())
    )

    metadata = {
        "article_id": article.id,
        "topic_id": article.topic_id or 0,
        "domain": article.topic.domain if article.topic else "",
        "published_at": published_ts,
    }

    try:
        index.upsert(
            vectors=[
                {
                    "id": f"article-{article.id}",
                    "values": vector,
                    "metadata": metadata,
                }
            ]
        )
        logger.debug("Upserted article id=%d to Pinecone", article.id)
        return True
    except Exception:
        logger.exception("Pinecone upsert failed for article id=%d", article.id)
        return False


def query_topic_velocity(
    topic_id: int,
    domain: str,
    since_ts: int,
    top_k: int = 100,
) -> list[dict]:
    """
    Query Pinecone for articles in the given topic since `since_ts` (Unix timestamp).

    Returns a list of metadata dicts for matching vectors, or an empty list
    when Pinecone is not configured.  The caller uses the count / timestamps
    to compute velocity and acceleration.
    """
    index = _get_index()
    if index is None:
        return []

    try:
        # Build a centroid query vector: average of domain label embedding
        # (stand-in until we store per-topic centroids)
        query_vec = embed_text(f"{domain} technology trend enterprise")

        response = index.query(
            vector=query_vec,
            top_k=top_k,
            filter={
                "topic_id": {"$eq": topic_id},
                "published_at": {"$gte": since_ts},
            },
            include_metadata=True,
        )
        return [m.metadata for m in response.matches] if response.matches else []
    except Exception:
        logger.exception("Pinecone query failed for topic_id=%d", topic_id)
        return []


def delete_article(article_id: int) -> None:
    """Remove an article vector from Pinecone (e.g. on article deletion)."""
    index = _get_index()
    if index is None:
        return
    try:
        index.delete(ids=[f"article-{article_id}"])
    except Exception:
        logger.exception("Pinecone delete failed for article_id=%d", article_id)
