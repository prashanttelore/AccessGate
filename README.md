# AccessGate 🚪

> **AccessGate** is an enterprise-grade, developer-friendly **Auth-as-a-Service & Identity Management Platform** (a self-hostable open-source alternative to Auth0 and Firebase Auth) built with **Node.js**, **Express**, **PostgreSQL**, and **Redis**.

---

## 📖 Table of Contents

- [Overview & The Problem It Solves](#-overview--the-problem-it-solves)
- [Architecture & Token Lifecycle Flow](#-architecture--token-lifecycle-flow)
- [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
- [OAuth2 Authentication Flow](#-oauth2-authentication-flow)
- [Production Hardening & Security Features](#-production-hardening--security-features)
- [Interactive API Documentation (Swagger)](#-interactive-api-documentation-swagger)
- [Setup & Deployment Instructions](#-setup--deployment-instructions)
- [Environment Configuration](#-environment-configuration)
- [API Endpoints Reference Table](#-api-endpoints-reference-table)
- [Testing & Quality Assurance](#-testing--quality-assurance)

---

## 🎯 Overview & The Problem It Solves

Modern web and mobile applications require robust authentication and authorization systems that are secure, performant, and compliant with privacy standards. However, developers typically face two suboptimal choices:

1. **Proprietary Third-Party SaaS (e.g. Auth0, Firebase, Okta):**
   - Expensive per-monthly-active-user (MAU) pricing tiers that scale aggressively.
   - Vendor lock-in and opaque data storage, raising compliance and data sovereignty concerns (e.g. GDPR, HIPAA).
   - Rate limits, external latency, and potential downtime outside your control.

2. **Ad-hoc Custom Auth Implementations:**
   - Prone to critical security vulnerabilities (e.g. lack of token rotation, vulnerable storage of session state, missing rate limits, and unmitigated brute-force vectors).
   - Incomplete audit trails and lack of centralized role governance.

### How AccessGate Solves This

**AccessGate** delivers a drop-in, self-hostable identity microservice:
- **Dual-Token Architecture:** Short-lived stateless JWT access tokens (15m) paired with stateful, rotatable refresh tokens (7d).
- **Instant Revocation with Distributed Blacklisting:** High-speed Redis blacklist for real-time token invalidation upon user logout or session revocation.
- **Granular RBAC:** Role and permission validation middlewares (`requireRole`, `requireAdmin`).
- **Defensive Security by Default:** Automated input sanitization against XSS/injections, Helmet HTTP security headers, CORS whitelisting, and tiered rate limiting.
- **Comprehensive Audit Trail:** Dedicated audit logs tracking role modifications, session terminations, and user access history.
- **Interactive OpenAPI Specification:** Auto-documented endpoints via Swagger UI at `/api-docs`.

---

## 🏗 Architecture & Token Lifecycle Flow

AccessGate uses short-lived JWT access tokens for low-latency, stateless API authorization combined with rotatable refresh tokens stored in PostgreSQL and a Redis blacklist for near-zero-latency revocation.

### Token Flow Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client App
    participant AG as AccessGate Auth Service
    participant DB as PostgreSQL Database
    participant Redis as Redis Cache / Blacklist

    Note over Client,Redis: 1. User Authentication
    Client->>AG: POST /auth/login { email, password }
    AG->>DB: Query user & verify bcrypt password hash
    AG->>DB: Record login attempt (IP, user agent, success)
    AG-->>Client: Returns Access Token (15m) + Refresh Token (7d)

    Note over Client,Redis: 2. Authenticated Request Execution
    Client->>AG: GET /api/v1/protected (Header: Authorization: Bearer <Token>)
    AG->>Redis: Check Redis Blacklist (Key: bl:<token>)
    Redis-->>AG: Not found (Token is valid)
    AG->>AG: Verify cryptographic JWT signature & expiration
    AG-->>Client: 200 OK (Protected Resource Data)

    Note over Client,Redis: 3. Token Refresh with Family Rotation
    Client->>AG: POST /auth/refresh { refreshToken }
    AG->>DB: Validate refresh token & ensure not revoked
    AG->>Redis: Blacklist previous refresh token
    AG->>DB: Invalidate previous token & issue new token pair
    AG-->>Client: New Access Token (15m) + New Refresh Token (7d)

    Note over Client,Redis: 4. Immediate Session Logout
    Client->>AG: POST /auth/logout (Bearer <Token>)
    AG->>Redis: Add Access Token to blacklist with remaining TTL
    AG-->>Client: 200 OK { message: "Logged out successfully" }

    Note over Client,Redis: 5. Rejection of Blacklisted Token
    Client->>AG: GET /api/v1/protected (Revoked Access Token)
    AG->>Redis: Check Redis Blacklist (Key: bl:<token>)
    Redis-->>AG: Match found: 'revoked'
    AG-->>Client: 401 Unauthorized { error: "Unauthorized", message: "Token revoked" }
```

---

## 🛡 Role-Based Access Control (RBAC)

AccessGate enforces a declarative, hierarchical RBAC model designed for multi-tier applications:

```mermaid
flowchart TD
    User([User Request]) --> AuthMW["authenticate Middleware\n(Validates JWT & Redis Blacklist)"]
    AuthMW --> RBACMW{"requireAdmin / requireRole\n(Checks req.user.role / req.user.roles)"}
    RBACMW -- Role Match --> Controller["Route Controller\n(e.g., Admin Controller)"]
    RBACMW -- Role Mismatch --> Forbidden["403 Forbidden\n('Requires admin role')"]
    Controller --> Audit["Audit Logger\n(Writes to audit_logs)"]
```

### Roles & Responsibilities

- **`admin`**: Full administrative access to list users, manage user roles, revoke active sessions across all devices, view login audit history, and inspect audit logs.
- **`moderator`**: Elevated privileges for content moderation and read operations without administrative revocation powers.
- **`user`**: Default role assigned upon registration, restricted to managing their own profile and authenticated resources.

### Middleware Implementation

- **`authenticate`**: Verifies incoming `Authorization: Bearer <token>`, checks the Redis blacklist (`bl:<token>`), and attaches the validated user payload to `req.user`.
- **`requireRole(requiredRole)`**: Evaluates `req.user.role` or `req.user.roles` array. Returns `403 Forbidden` if the subject does not possess the requisite authorization.
- **`requireAdmin`**: Sugar middleware enforcing `admin` role authorization.

---

## 🌐 OAuth2 Authentication Flow

AccessGate integrates with Google Identity Services using the standard **OAuth 2.0 Authorization Code Flow** with direct token exchange and local account linking.

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Browser
    participant App as Client Frontend
    participant AG as AccessGate Server
    participant Google as Google OAuth2 Provider
    participant DB as PostgreSQL

    User->>App: Click "Sign in with Google"
    App->>AG: GET /auth/google
    AG-->>User: 302 Redirect to Google Consent Screen
    User->>Google: Authenticate & Authorize AccessGate Scopes
    Google-->>User: 302 Redirect to /auth/google/callback?code=AUTH_CODE
    User->>AG: GET /auth/google/callback?code=AUTH_CODE
    AG->>Google: Exchange AUTH_CODE for Profile & ID Token
    Google-->>AG: Returns email, name, google_id
    AG->>DB: Query user by email or google_id
    alt Account exists
        AG->>DB: Link google_id if not present
    else New Account
        AG->>DB: Create user (email, name, google_id, role='user')
    end
    AG->>DB: Store initial Refresh Token
    AG-->>App: Issue AccessGate Access Token (JWT) + Refresh Token
    App-->>User: 200 OK (Authenticated session established)
```

---

## 🔒 Production Hardening & Security Features

AccessGate includes multi-layered defense-in-depth protections:

1. **HTTP Security Headers (Helmet):**
   - `Content-Security-Policy`: Configured with strict origins while enabling interactive Swagger UI rendering.
   - `X-Content-Type-Options: nosniff` to prevent MIME-sniffing attacks.
   - `X-Frame-Options: SAMEORIGIN` to mitigate clickjacking attacks.
   - `Strict-Transport-Security` (HSTS) with 1-year max-age in production.

2. **CORS Origin Whitelisting:**
   - Whitelists allowed client domains using the `CORS_ORIGIN` environment variable.
   - Supports explicit multi-origin comma-separated lists (e.g. `https://app.domain.com,https://admin.domain.com`) or wildcard `*` for local development.

3. **Input Sanitization Middleware:**
   - Recursively inspects `req.body`, `req.query`, and `req.params`.
   - Strips null byte injections (`\0`, `%00`).
   - Removes `<script>`, `<iframe>`, `<object>`, and `javascript:` URIs to prevent Stored & Reflected Cross-Site Scripting (XSS).
   - Removes dangerous inline DOM event handlers (`onload=`, `onerror=`, `onclick=`).
   - Protects against prototype pollution and NoSQL operator injections (`__proto__`, `$where`).
   - Preserves user passwords with complex special characters without alteration.

4. **Tiered Rate Limiting & Brute-Force Protection:**
   - **Baseline General Limiter:** Caps excessive API traffic (100 req/15 min).
   - **Auth Limiter (`/auth/*`):** Stricter thresholds (20 req/15 min) defending against credential stuffing and brute-force attacks.
   - **Admin Limiter (`/admin/*`):** Rate limits sensitive administrative mutations (30 req/15 min).
   - Emits RFC-compliant `Retry-After` headers and `429 Too Many Requests` responses.

---

## 📚 Interactive API Documentation (Swagger)

Interactive OpenAPI 3.0 documentation is served directly from the application:

- **Swagger UI:** Accessible at [`http://localhost:3000/api-docs`](http://localhost:3000/api-docs)
- **Raw OpenAPI Specification:** Available as JSON at [`http://localhost:3000/api-docs.json`](http://localhost:3000/api-docs.json)

---

## 🚀 Setup & Deployment Instructions

### Option 1: Docker Compose (Recommended)

Run all services (`api`, `postgres`, `redis`) with zero local software dependencies:

```bash
# 1. Clone repository
git clone https://github.com/prashanttelore/AccessGate.git
cd AccessGate

# 2. Configure environment
cp .env.example .env

# 3. Launch container stack
docker-compose up -d --build
```

Verify service status:
```bash
docker-compose ps
```

Stop the environment:
```bash
docker-compose down
```

### Option 2: Local Development Setup

#### Prerequisites
- Node.js >= 20.0.0
- PostgreSQL >= 14
- Redis >= 6

#### 1. Install Dependencies
```bash
npm install
```

#### 2. Set Up Environment Variables
Create a local `.env` file:
```bash
cp .env.example .env
```

#### 3. Run Database Migrations
```bash
npm run migrate
```

#### 4. Start Development Server
```bash
npm run dev
```

The server will start at `http://localhost:3000`.

---

## ⚙️ Environment Configuration

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port on which the HTTP server listens |
| `NODE_ENV` | `development` | Environment mode (`development`, `production`, `test`) |
| `DB_URL` | `postgres://postgres:postgres@localhost:5432/accessgate` | PostgreSQL connection URI |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URI |
| `JWT_ACCESS_SECRET` | *(Required)* | Secret key for signing 15m access tokens |
| `JWT_REFRESH_SECRET` | *(Required)* | Secret key for signing 7d refresh tokens |
| `CORS_ORIGIN` | `*` | Allowed CORS origins (comma-separated list or `*`) |
| `RATE_LIMIT_WINDOW_MS`| `900000` | Rate limit window in milliseconds (15 mins) |
| `RATE_LIMIT_MAX_REQUESTS`| `100` | General API rate limit threshold per window |
| `AUTH_RATE_LIMIT_MAX` | `20` | Auth endpoint rate limit threshold per window |
| `ADMIN_RATE_LIMIT_MAX`| `30` | Admin endpoint rate limit threshold per window |
| `GOOGLE_CLIENT_ID` | `""` | Google OAuth2 Client ID |
| `GOOGLE_CLIENT_SECRET` | `""` | Google OAuth2 Client Secret |
| `GOOGLE_CALLBACK_URL` | `http://localhost:3000/auth/google/callback` | Google OAuth2 Redirect URI |

---

## 📋 API Endpoints Reference Table

| Method | Endpoint | Auth Required | Role | Description |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/health` | No | Any | Basic service health probe (`{ status: "ok" }`) |
| `GET` | `/health/ready` | No | Any | Readiness probe checking PostgreSQL and Redis connectivity |
| `GET` | `/api-docs` | No | Any | Interactive Swagger/OpenAPI UI |
| `GET` | `/api-docs.json` | No | Any | Raw OpenAPI 3.0.0 JSON specification |
| `POST` | `/auth/register` | No | Any | Register new account with email, password, and optional name |
| `POST` | `/auth/login` | No | Any | Authenticate with credentials and receive token pair |
| `POST` | `/auth/refresh` | No | Any | Rotate refresh token and obtain new access + refresh token |
| `GET` | `/auth/me` | Yes | Any | Retrieve current authenticated user profile |
| `POST` | `/auth/logout` | Yes | Any | Logout current session and add access token to Redis blacklist |
| `POST` | `/auth/logout-all`| Yes | Any | Invalidate all active sessions/refresh tokens for user |
| `GET` | `/admin/users` | Yes | `admin` | Paginated user listing, filterable by email query |
| `POST` | `/admin/users/:id/roles` | Yes | `admin` | Assign or remove a role (`admin`, `moderator`, `user`) |
| `POST` | `/admin/users/:id/revoke-sessions` | Yes | `admin` | Force terminate all active sessions for a target user |
| `GET` | `/admin/users/:id/login-history` | Yes | `admin` | View successful and failed login attempts for a target user |
| `GET` | `/admin/audit-logs` | Yes | `admin` | Paginated audit log retrieval with action and date filters |

---

## 🧪 Testing & Quality Assurance

AccessGate includes a comprehensive automated test suite powered by the Node.js native test runner (`node:test`) and Supertest.

```bash
# Execute test suite
npm test
```

### Test Coverage Highlights

- **Access Control & RBAC:** Verifies `401 Unauthorized` on missing tokens, `403 Forbidden` on insufficient roles, and `200 OK` on admin authorization.
- **Audit Logging Verification:** Ensures every administrative mutation generates an immutable record with actor, target, action, and JSONB metadata.
- **Security & Hardening:** Tests Helmet security headers, CORS origin rejection, input sanitization against XSS and null bytes, and 429 rate limit triggers.
- **Documentation Verification:** Validates that `/api-docs` and `/api-docs.json` serve complete OpenAPI schemas.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
