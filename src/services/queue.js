import { processVideo } from './videoProcessor.js';
import { logger } from '../utils/logger.js';
import { sendWebhookNotification } from './webhook.js';

let isPaused = false;
let currentTask = null;

class TranscriptionQueue {
  constructor() {
    this.queue = new Map();
    this.processing = new Map();
  }

  add(taskId, videoId, webhookUrl) {
    if (isPaused) {
      logger.info('Fila pausada, aguardando retomada...', { videoId });
      currentTask = { taskId, videoId, webhookUrl };
      return;
    }

    if (this.queue.has(taskId) || this.processing.has(taskId)) {
      logger.warn('Job já existe na fila', { taskId, videoId });
      return;
    }

    logger.info('Job adicionado à fila', { taskId, videoId });
    
    const processTask = async () => {
      try {
        logger.info('Job iniciou processamento', { taskId, videoId });
        const result = await processVideo(videoId, webhookUrl);
        logger.info('Job concluído com sucesso', { taskId, videoId, result });
      } catch (error) {
        if (error.message === 'AUTH_REQUIRED') {
          isPaused = true;
          currentTask = { taskId, videoId, webhookUrl };
          logger.info('Job pausado aguardando autenticação', { videoId });
        } else {
          logger.error('Erro no processamento do job:', {
            error: error.message,
            stack: error.stack,
            taskId,
            videoId
          });
          
          // Notifica erro via webhook
          await sendWebhookNotification(webhookUrl, {
            status: 'error',
            error: error.message,
            videoId
          });
        }
      } finally {
        this.processing.delete(taskId);
      }
    };

    this.queue.set(taskId, { fn: processTask, videoId });
    this.process(taskId);
  }

  async process(taskId) {
    if (this.processing.has(taskId)) {
      logger.warn('Job já está sendo processado', { taskId });
      return;
    }

    const job = this.queue.get(taskId);
    if (!job) {
      logger.warn('Job não encontrado na fila', { taskId });
      return;
    }

    this.queue.delete(taskId);
    this.processing.set(taskId, job);

    await job.fn();
  }

  resume() {
    if (!isPaused || !currentTask) {
      return;
    }

    logger.info('Fila de transcrição retomada');
    isPaused = false;
    
    const { taskId, videoId, webhookUrl } = currentTask;
    currentTask = null;
    
    // Reprocessar o job atual
    this.add(taskId, videoId, webhookUrl);
  }

  isProcessing(taskId) {
    return this.processing.has(taskId);
  }

  getStatus(taskId) {
    if (this.processing.has(taskId)) {
      return 'processing';
    }
    if (this.queue.has(taskId)) {
      return 'queued';
    }
    return 'not_found';
  }
}

export const transcriptionQueue = new TranscriptionQueue();
