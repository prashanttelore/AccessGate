import jwt from 'jsonwebtoken';
import env from '../config/env.js';

/**
 * Authentication Middleware
 * Validates the JWT Bearer token in the Authorization header
 */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token is missing or invalid',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.jwtAccessSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token has expired or is invalid',
    });
  }
};

export default authenticate;
