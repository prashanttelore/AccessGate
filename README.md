# AccessGate 🚪

> **AccessGate** is an Auth-as-a-Service backend platform (a lightweight, self-hostable mini Auth0) built with Node.js, Express, PostgreSQL, Redis, and Docker.

---

## ⚡ Tech Stack

- **Runtime & Framework:** Node.js (v20+ / v22), Express (ES Modules)
- **Database:** PostgreSQL (using `pg` with connection pooling)
- **Cache & Session / Blacklist Store:** Redis (using `ioredis`)
- **Security:** Helmet, CORS, JWT (`jsonwebtoken`), Bcrypt (`bcryptjs`)
- **Containerization:** Docker & Docker Compose
- **Testing:** Node.js native test runner (`node:test`) + Supertest

---

## 📂 Project Structure

```
AccessGate/
├── .env.example              # Template for required environment variables
├── .dockerignore             # Excluded files during Docker build
├── .gitignore                # Excluded files for Git version control
├── Dockerfile                # Production Docker container definition
├── docker-compose.yml        # Compose specification (api, postgres, redis)
├── package.json              # Project dependencies and npm scripts
├── README.md                 # Documentation and setup guide
│
├── src/                      # Application source code
│   ├── config/               # Configuration modules
│   │   ├── env.js            # Environment variable validation & defaults
│   │   ├── db.js             # PostgreSQL connection pool (pg)
│   │   └── redis.js          # Redis client connection (ioredis)
│   ├── controllers/          # Request handlers
│   │   ├── health.controller.js  # GET /health & readiness handlers
│   │   └── auth.controller.js    # Register, login, me, logout handlers
│   ├── middleware/           # Express middlewares
│   │   ├── auth.middleware.js    # JWT Bearer token authentication
│   │   ├── errorHandler.js       # Global 500 error handler
│   │   └── notFound.js           # 404 handler for unmatched routes
│   ├── models/               # Data access layer
│   │   └── user.model.js     # User entity queries using PostgreSQL
│   ├── routes/               # Express route definitions
│   │   ├── index.js          # Combined API route router
│   │   ├── health.routes.js  # Health check endpoints
│   │   └── auth.routes.js    # Authentication endpoints
│   ├── services/             # Business logic layer
│   │   └── auth.service.js   # Password hashing, JWTs, Redis token blacklist
│   ├── app.js                # Express app setup and middleware configuration
│   └── server.js             # HTTP server entrypoint & graceful shutdown
│
├── migrations/               # Database migration files
│   ├── 001_init.sql          # Initial schema (users, refresh_tokens, audit_logs)
│   └── migrate.js            # Standalone migration runner script
│
└── tests/                    # Test suites
    ├── config.test.js        # Environment config verification tests
    └── health.test.js        # Health check and routing tests
```

---

## 🚀 Quickstart with Docker Compose

To spin up all three services (`api`, `postgres`, `redis`) with a single command:

```bash
# 1. Clone or navigate to the project directory
cd AccessGate

# 2. (Optional) Copy environment template if you want custom values
cp .env.example .env

# 3. Start all services in detached mode
docker-compose up -d --build
```

### Verify Running Services

Once started, Docker Compose launches:
- **`accessgate_api`** on `http://localhost:3000`
- **`accessgate_postgres`** on `localhost:5432`
- **`accessgate_redis`** on `localhost:6379`

### Test Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok"
}
```

To view logs:
```bash
docker-compose logs -f
```

To stop all services:
```bash
docker-compose down
```

---

## 💻 Local Development (Without Docker)

### Prerequisites
- Node.js >= 20.0.0
- Local or remote PostgreSQL instance
- Local or remote Redis instance

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

Set your configuration values:
```ini
PORT=3000
NODE_ENV=development
DB_URL=postgres://postgres:postgres@localhost:5432/accessgate
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=your_jwt_access_secret_key_change_in_production
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_change_in_production
```

### 3. Run Database Migrations
```bash
npm run migrate
```

### 4. Start Development Server
```bash
npm run dev
```

The server starts at `http://localhost:3000` with hot-reload enabled via `nodemon`.

---

## 🧪 Running Tests

Execute the automated test suite with Node's native test runner:

```bash
npm test
```

---

## 📋 Available Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| `start` | `node src/server.js` | Starts the production server |
| `dev` | `nodemon src/server.js` | Starts the development server with hot-reload |
| `test` | `node --test tests/**/*.test.js` | Runs automated test suites |
| `migrate` | `node migrations/migrate.js` | Runs pending PostgreSQL schema migrations |

---

## 🔌 API Endpoints Reference

### Health Checks
- `GET /health` — Simple health check returning `{ "status": "ok" }` (HTTP 200)
- `GET /health/ready` — Detailed readiness check verifying PostgreSQL and Redis connections

### Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/register` — Register a new user with `{ email, password, name }`
- `POST /api/v1/auth/login` — Authenticate with `{ email, password }` and receive JWT tokens
- `GET /api/v1/auth/me` — Retrieve current authenticated user profile (`Bearer <token>`)
- `POST /api/v1/auth/logout` — Revoke token and add to Redis blacklist (`Bearer <token>`)
