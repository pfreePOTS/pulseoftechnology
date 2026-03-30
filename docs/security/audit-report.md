# Security Audit Report: Pulse of Technology

**Date:** March 30, 2026
**Scope:** Full Repository Audit (`/home/ubuntu/pot`)

## Executive Summary

A comprehensive security audit of the Pulse of Technology codebase was conducted, covering architecture, authentication, database interactions, frontend security, and AI integrations. The application demonstrates a functional MVP architecture but contains several high-risk security flaws that must be addressed before production deployment. 

The most critical issue is the authentication model for the admin dashboard, which relies on a single, static, unhashed password transmitted as a Bearer token and stored insecurely on the client side. Additionally, the AI pipeline lacks robust controls against prompt injection from untrusted RSS feeds.

## Findings Summary

| ID | Finding | Domain | Severity | Confidence | Classification |
|---|---|---|---|---|---|
| SEC-01 | Static Password Used as Bearer Token | Auth | Critical | High | Confirmed |
| SEC-02 | Insecure Client-Side Token Storage | Frontend | High | High | Confirmed |
| SEC-03 | Untrusted Content in LLM Prompts (Prompt Injection) | AI | High | High | Confirmed |
| SEC-04 | Lack of Rate Limiting on Auth & Subscribe Endpoints | APIs | Medium | High | Confirmed |
| SEC-05 | MD5 Usage for Vector Bucketing | Database | Low | High | Hardening |

---

## Detailed Findings

### SEC-01: Static Password Used as Bearer Token
**Severity:** Critical | **Confidence:** High | **Classification:** Confirmed issue
**Domain:** Authentication & Authorization

**Description:**
The application uses a single, static password (`settings.admin_password`) to secure the entire admin API. The `require_admin` dependency in `backend/dependencies.py` directly compares the incoming Bearer token to this plaintext password. There is no session management, no token expiration, and no cryptographic signing (e.g., JWT). If this password is leaked, an attacker has permanent administrative access until the environment variable is manually rotated and the service restarted.

**Evidence:**
`backend/dependencies.py` (Lines 9-14):
```python
def require_admin(
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
) -> None:
    if credentials.credentials != settings.admin_password:
        raise HTTPException(...)
```

**Recommended Remediation:**
Migrate to a standard session-based or JWT-based authentication system. The `/login` endpoint should verify the password (which should be hashed in configuration, not plaintext) and issue a short-lived JWT. The `require_admin` dependency should validate the JWT signature and expiration. For enterprise environments, integrate Microsoft Entra ID (as per project preferences).

---

### SEC-02: Insecure Client-Side Token Storage
**Severity:** High | **Confidence:** High | **Classification:** Confirmed issue
**Domain:** Frontend

**Description:**
Upon successful login, the frontend stores the admin token (which is the raw password, per SEC-01) in `localStorage` and in a client-readable cookie (`SameSite=Strict` but missing `HttpOnly` and `Secure` flags). Storing sensitive credentials in `localStorage` exposes them to Cross-Site Scripting (XSS) attacks. 

**Evidence:**
`frontend/src/app/admin/login/page.tsx` (Lines 29-31):
```javascript
localStorage.setItem("pulse_admin_token", token);
document.cookie = `pulse_admin_token=${token}; path=/; SameSite=Strict`;
```

**Recommended Remediation:**
The backend should issue an `HttpOnly`, `Secure`, `SameSite=Strict` cookie containing the session token during the `/login` request. The frontend should not handle the raw token directly. The client-side gate in `admin/layout.tsx` should rely on a `/api/admin/me` endpoint to verify session validity rather than checking `localStorage`.

---

### SEC-03: Untrusted Content in LLM Prompts (Prompt Injection)
**Severity:** High | **Confidence:** High | **Classification:** Confirmed issue
**Domain:** AI

**Description:**
The ingestion pipeline fetches untrusted content from external RSS feeds. This content is passed directly into the AI pipeline (`backend/services/ai_service.py`) and concatenated into the `user` prompt for multiple Claude models (Haiku and Sonnet) without any structural delimiters, sanitization, or prompt injection defenses. A malicious RSS feed could craft an article that overrides the system instructions (e.g., forcing the `_node_cluster` to output a specific payload or bypass gating).

**Evidence:**
`backend/services/ai_service.py` (Lines 235-237):
```python
        user = (
            f"Existing trending topics (prioritised — most important first):\n{topic_list}"
            f"\n\nArticle:\n{content}"
        )
```

**Recommended Remediation:**
Use clear structural delimiters (e.g., XML tags like `<article>...</article>`) to separate untrusted content from instructions. Update the system prompts to explicitly warn the model about untrusted content within those delimiters.

---

### SEC-04: Lack of Rate Limiting on Auth & Subscribe Endpoints
**Severity:** Medium | **Confidence:** High | **Classification:** Confirmed issue
**Domain:** APIs

**Description:**
The application does not implement any rate limiting on sensitive endpoints, specifically `POST /api/admin/login` and `POST /api/subscribe`. This leaves the admin login vulnerable to brute-force attacks (especially critical given SEC-01) and the subscribe endpoint vulnerable to spam/enumeration attacks.

**Evidence:**
`backend/main.py` and `backend/routers/admin.py` contain no references to rate limiting middleware (e.g., `slowapi`).

**Recommended Remediation:**
Implement rate limiting at the application layer using a library like `slowapi`, or ensure that the deployment infrastructure (e.g., Traefik, Nginx, or Railway edge proxies) enforces strict rate limits on `/login` and `/subscribe`.

---

### SEC-05: MD5 Usage for Vector Bucketing
**Severity:** Low | **Confidence:** High | **Classification:** Hardening recommendation
**Domain:** Database / Architecture

**Description:**
The `vector_service.py` uses the MD5 hashing algorithm to generate shingle buckets. While this is not used for cryptographic security (it is used for locality-sensitive hashing / minhash approximations), MD5 is broadly flagged by security scanners.

**Evidence:**
`backend/services/vector_service.py` (Line 83):
```python
bucket = struct.unpack("<I", hashlib.md5(shingle.encode()).digest()[:4])[0] % EMBEDDING_DIM
```

**Recommended Remediation:**
Replace `hashlib.md5` with a non-cryptographic hash function designed for speed and distribution (like `mmh3` or `xxhash`), or if a standard library function is required, use `hashlib.sha256` to avoid triggering static analysis alerts.
