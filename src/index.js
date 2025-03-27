import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { setupRoutes } from './routes/index.js';
import { logger } from './utils/logger.js';
import { transcriptionQueue } from './services/queue.js';
import { ensureTempDir } from './utils/ensureTempDir.js';
import { v4 as uuidv4 } from 'uuid';

const app = express();

// Configurar trust proxy apenas para o ngrok
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições por windowMs
  trustProxy: false // Desabilitar trust proxy no rate limit
});

app.use(cors());
app.use(express.json());
app.use(limiter);

// Setup routes
setupRoutes(app);

app.post('/transcribe', async (req, res) => {
  const { videoId, webhookUrl } = req.body;

  if (!videoId || !webhookUrl) {
    logger.warn('Requisição inválida', { body: req.body });
    return res.status(400).json({ 
      error: 'Missing required fields: videoId and webhookUrl' 
    });
  }

  try {
    const taskId = uuidv4();
    transcriptionQueue.add(taskId, videoId, webhookUrl);

    logger.info('Requisição de transcrição recebida', {
      taskId,
      videoId,
      webhookUrl
    });

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

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  try {
    // Garantir que o diretório temp existe com as permissões corretas
    await ensureTempDir();
    
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();
