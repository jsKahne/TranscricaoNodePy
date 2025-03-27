import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

export async function sendWebhookNotification(webhookUrl, data) {
  try {
    logger.info(`Sending webhook notification to ${webhookUrl}`, data);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed with status ${response.status}`);
    }

    logger.info('Webhook notification sent successfully');
    return true;
  } catch (error) {
    logger.error('Error sending webhook notification:', error);
    throw error;
  }
}
