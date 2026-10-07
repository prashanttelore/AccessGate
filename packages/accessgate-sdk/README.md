# @accessgate/sdk

Official Node.js SDK and Express middleware for [AccessGate](https://github.com/prashanttelore/AccessGate).

## Features

- 🚀 **Plug-and-Play Express Middleware:** Protect your endpoints with `requireAuth()`, `requireRole()`, and `requirePermission()`.
- 🔍 **Remote Token Introspection:** Verifies tokens in real-time against AccessGate's `POST /token/introspect` endpoint, instantly rejecting blacklisted/revoked tokens.
- ⚡ **Local Verification Mode:** Low-latency offline JWT verification when your service shares the secret key or public certificate.
- ⏱ **Built-in TTL Caching:** Avoids redundant network round-trips with configurable in-memory token caching.

## Installation

```bash
npm install @accessgate/sdk
```

## Quick Start

```javascript
import express from 'express';
import { AccessGate } from '@accessgate/sdk';

const app = express();

// Initialize AccessGate client
const auth = new AccessGate({
  issuerUrl: 'http://localhost:3000', // AccessGate Auth Service URL
  cacheTtlMs: 30000,                  // Cache introspection results for 30s
});

// 1. Protected route (any authenticated user)
app.get('/api/orders', auth.requireAuth(), (req, res) => {
  res.json({ message: 'User orders', user: req.user });
});

// 2. Role-protected route (requires 'admin' role)
app.post('/api/products', auth.requireAuth(), auth.requireRole('admin'), (req, res) => {
  res.json({ message: 'Product created' });
});

// 3. Permission-protected route (requires 'orders:write' permission)
app.patch('/api/orders/:id', auth.requireAuth(), auth.requirePermission('orders:write'), (req, res) => {
  res.json({ message: 'Order updated' });
});

app.listen(4000, () => {
  console.log('Resource server listening on port 4000');
});
```

## Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `issuerUrl` | `string` | `process.env.ACCESSGATE_URL` | Base URL of AccessGate service |
| `jwtSecret` | `string` | `process.env.ACCESSGATE_JWT_SECRET` | Secret/public key for local verification mode |
| `introspectEndpoint` | `string` | `${issuerUrl}/token/introspect` | Custom introspection URL |
| `cacheTtlMs` | `number` | `30000` | Introspection cache TTL in milliseconds |
| `timeoutMs` | `number` | `5000` | HTTP request timeout for introspection calls |

## License

MIT
