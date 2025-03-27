import { logger } from '../utils/logger.js';

export const authenticateApiKey = (req, res, next) => {
  // Não exigir API key para a rota de callback do Google
  if (req.path === '/auth/google/callback') {
    return next();
  }

  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    logger.warn('Invalid API key attempt:', { 
      apiKey,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};
