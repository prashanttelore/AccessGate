import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import env from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import apiRoutes from './routes/index.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// Security and utility middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP request logging (disabled during test runs)
if (!env.isTest) {
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
}

// Health check endpoint at root level (GET /health -> { status: "ok" })
app.use('/health', healthRoutes);

// API v1 routes
app.use('/api/v1', apiRoutes);

// Fallback 404 and global error handlers
app.use(notFound);
app.use(errorHandler);

export default app;
