import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import env from './config/env.js';
import configureCors from './config/cors.js';
import { swaggerSpec } from './config/swagger.js';
import sanitizeInput from './middleware/sanitize.middleware.js';
import {
  generalLimiter,
  authLimiter,
  adminLimiter,
} from './middleware/rateLimiter.middleware.js';
import healthRoutes from './routes/health.routes.js';
import adminRoutes from './routes/admin.routes.js';
import authRoutes from './routes/auth.routes.js';
import tokenRoutes from './routes/token.routes.js';
import apiRoutes from './routes/index.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// Trust reverse proxies (Docker, Nginx, ALB)
app.set('trust proxy', 1);

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://validator.swagger.io'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Whitelisted CORS
app.use(configureCors());

// Body parsing with safe size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Input sanitization against injection patterns
app.use(sanitizeInput);

// Baseline general rate limiter
app.use(generalLimiter);

// HTTP request logging (disabled during test runs)
if (!env.isTest) {
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
}

// Swagger / OpenAPI documentation UI & JSON
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'AccessGate API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  })
);
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Health check endpoint at root level (GET /health -> { status: "ok" })
app.use('/health', healthRoutes);

// Sensitive Admin management routes (with stricter rate limiting)
app.use('/admin', adminLimiter, adminRoutes);

// Sensitive Authentication routes (with auth rate limiting)
app.use('/auth', authLimiter, authRoutes);

// Token introspection route (POST /token/introspect)
app.use('/token', tokenRoutes);

// API v1 routes
app.use('/api/v1', apiRoutes);

// Fallback 404 and global error handlers
app.use(notFound);
app.use(errorHandler);

export default app;
