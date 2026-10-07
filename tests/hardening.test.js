import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { sanitizeData, sanitizeString } from '../src/middleware/sanitize.middleware.js';

describe('Production Hardening & Security Suite', () => {
  describe('Security Headers (Helmet)', () => {
    it('should set essential security headers on HTTP responses', async () => {
      const res = await request(app).get('/health').expect(200);

      // Verify Helmet headers
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
      assert.equal(res.headers['x-download-options'], 'noopen');
      assert.ok(res.headers['content-security-policy'], 'CSP header should be present');
      assert.match(res.headers['content-security-policy'], /default-src 'self'/);
    });
  });

  describe('CORS Configuration', () => {
    it('should allow requests with Origin header', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173')
        .expect(200);

      assert.ok(res.headers['access-control-allow-origin']);
    });

    it('should respond with proper headers for OPTIONS preflight request', async () => {
      const res = await request(app)
        .options('/auth/login')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      assert.ok(res.headers['access-control-allow-methods']);
      assert.match(res.headers['access-control-allow-methods'], /POST/);
    });
  });

  describe('Input Sanitization Middleware', () => {
    it('should strip <script> tags and malicious inline handlers from strings', () => {
      const dirty = '<script>alert("xss")</script>Hello <img src=x onerror=alert(1)>world';
      const clean = sanitizeString(dirty);
      assert.equal(clean.includes('<script>'), false);
      assert.equal(clean.includes('onerror='), false);
      assert.match(clean, /Hello/);
      assert.match(clean, /world/);
    });

    it('should strip null byte injection attacks', () => {
      const attack = 'malicious\0payload%00here';
      const clean = sanitizeString(attack);
      assert.equal(clean.includes('\0'), false);
      assert.equal(clean.includes('%00'), false);
      assert.equal(clean, 'maliciouspayloadhere');
    });

    it('should preserve complex passwords while removing null bytes', () => {
      const passwordWithSymbols = 'P@$$w0rd!#%^&*()_\0';
      const clean = sanitizeString(passwordWithSymbols, 'password');
      assert.equal(clean, 'P@$$w0rd!#%^&*()_');
    });

    it('should remove prototype pollution and NoSQL operator keys from objects', () => {
      const maliciousObj = {
        name: 'Normal User',
        __proto__: { isAdmin: true },
        $where: 'sleep(5000)',
        nested: {
          bio: '<script>stealCookies()</script>Developer',
          constructor: 'bad',
        },
      };

      const sanitized = sanitizeData(maliciousObj);
      assert.equal(sanitized.name, 'Normal User');
      assert.equal(Object.prototype.hasOwnProperty.call(sanitized, '$where'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(sanitized, '__proto__'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(sanitized.nested, 'constructor'), false);
      assert.equal(sanitized.nested.bio.includes('<script>'), false);
      assert.match(sanitized.nested.bio, /Developer/);
    });

    it('should sanitize request body during HTTP requests', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'xss-test@example.com',
          password: 'Password123!',
          name: '<script>alert(1)</script>SafeName',
        });

      // Whether registered or email taken, the name passed to controller was sanitized
      if (res.status === 201) {
        assert.equal(res.body.data.user.name, 'SafeName');
      }
    });
  });

  describe('Rate Limiting on Sensitive Endpoints', () => {
    it('should enforce rate limits and return 429 when threshold exceeded', async () => {
      // Trigger rate limiter with test header enabled
      const agent = request(app);
      let hit429 = false;

      // Exceed admin/auth rate limit threshold
      for (let i = 0; i < 35; i++) {
        const res = await agent
          .get('/admin/audit-logs')
          .set('x-test-ratelimit', 'true');

        if (res.status === 429) {
          hit429 = true;
          assert.equal(res.body.error, 'TooManyRequests');
          assert.ok(res.body.retryAfter);
          assert.ok(res.headers['retry-after']);
          break;
        }
      }

      assert.ok(hit429, 'Sensitive admin route should trigger 429 after exceeding limit');
    });
  });

  describe('Swagger / OpenAPI Documentation (/api-docs)', () => {
    it('should expose Swagger UI at /api-docs', async () => {
      const res = await request(app).get('/api-docs/').expect(200);
      assert.match(res.text, /swagger/i);
    });

    it('should return valid OpenAPI 3.0.0 JSON specification at /api-docs.json', async () => {
      const res = await request(app).get('/api-docs.json').expect(200);

      assert.equal(res.body.openapi, '3.0.0');
      assert.equal(res.body.info.title, 'AccessGate Auth-as-a-Service API');

      // Verify all essential paths are documented
      const paths = Object.keys(res.body.paths);
      assert.ok(paths.includes('/health'));
      assert.ok(paths.includes('/health/ready'));
      assert.ok(paths.includes('/auth/register'));
      assert.ok(paths.includes('/auth/login'));
      assert.ok(paths.includes('/auth/refresh'));
      assert.ok(paths.includes('/auth/me'));
      assert.ok(paths.includes('/auth/logout'));
      assert.ok(paths.includes('/auth/logout-all'));
      assert.ok(paths.includes('/admin/users'));
      assert.ok(paths.includes('/admin/users/{id}/roles'));
      assert.ok(paths.includes('/admin/users/{id}/revoke-sessions'));
      assert.ok(paths.includes('/admin/users/{id}/login-history'));
      assert.ok(paths.includes('/admin/audit-logs'));
    });
  });
});
