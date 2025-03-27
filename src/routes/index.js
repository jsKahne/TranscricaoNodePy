import express from 'express';
import { transcriptionQueue } from '../services/queue.js';
import { logger } from '../utils/logger.js';
import { exchangeCodeForTokens, generateAuthUrl } from '../services/auth.js';
import { authenticateApiKey } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Rotas que precisam de API key
const apiRouter = express.Router();
apiRouter.use(authenticateApiKey); // Aplica autenticação em todas as rotas deste router

apiRouter.post('/transcribe', async (req, res) => {
  const { videoId, webhookUrl } = req.body;

  if (!videoId || !webhookUrl) {
    logger.warn('Requisição inválida', { body: req.body });
    return res.status(400).json({ 
      error: 'Missing required fields: videoId and webhookUrl' 
    });
  }

  try {
    logger.info('Received transcription request for video', { videoId });
    
    const taskId = uuidv4();
    transcriptionQueue.add(taskId, videoId, webhookUrl);

    res.json({ 
      status: 'queued',
      taskId,
      message: 'Video queued for transcription'
    });
  } catch (error) {
    logger.error('Error processing transcription request:', error.message, {
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Rotas públicas (não precisam de API key)
router.get('/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    logger.error('Erro na autenticação do Google', { error });
    return res.status(400).json({ 
      error: 'Google authentication failed',
      details: error
    });
  }

  if (!code) {
    logger.warn('Código de autorização não fornecido');
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    logger.info('Recebido código de autorização do Google');
    const tokens = await exchangeCodeForTokens(code);
    
    logger.info('Tokens obtidos com sucesso');
    
    // Retorna uma página HTML com mensagem de sucesso
    res.send(`
      <html>
        <head>
          <title>Autenticação Concluída</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #4CAF50; }
          </style>
        </head>
        <body>
          <h1 class="success">✓ Autenticação Concluída com Sucesso</h1>
          <p>Você pode fechar esta janela e voltar para a aplicação.</p>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error('Erro na autenticação com Google:', {
      error: error.message,
      stack: error.stack
    });
    
    // Retorna uma página HTML com mensagem de erro
    res.status(500).send(`
      <html>
        <head>
          <title>Erro na Autenticação</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #f44336; }
          </style>
        </head>
        <body>
          <h1 class="error">✗ Erro na Autenticação</h1>
          <p>Ocorreu um erro ao autenticar com o Google:</p>
          <p><strong>${error.message}</strong></p>
          <p>Por favor, tente novamente.</p>
        </body>
      </html>
    `);
  }
});

export function setupRoutes(app) {
  // Rotas que precisam de API key ficam sob /api
  app.use('/api', apiRouter);
  
  // Rotas públicas ficam na raiz
  app.use('/', router);
}
