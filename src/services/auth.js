import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

const TOKENS_FILE = path.join(process.cwd(), 'tokens.json');

const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Carregar tokens salvos ao iniciar
async function loadSavedTokens() {
  try {
    const data = await fs.readFile(TOKENS_FILE, 'utf8');
    const tokens = JSON.parse(data);
    oauth2Client.setCredentials(tokens);
    logger.info('Tokens carregados do arquivo');
  } catch (error) {
    logger.info('Nenhum token salvo encontrado');
  }
}

// Salvar tokens em arquivo
async function saveTokens(tokens) {
  try {
    await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2));
    logger.info('Tokens salvos em arquivo');
  } catch (error) {
    logger.error('Erro ao salvar tokens:', error);
  }
}

// Inicializar carregando tokens salvos
loadSavedTokens();

// Função para verificar se o token está expirado
function isTokenExpired() {
  const credentials = oauth2Client.credentials;
  if (!credentials || !credentials.expiry_date) {
    return true;
  }
  // Considera expirado se faltar menos de 5 minutos
  return Date.now() >= credentials.expiry_date - (5 * 60 * 1000);
}

// Função para verificar e renovar o token se necessário
export async function ensureValidToken() {
  if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
    logger.warn('Nenhum token de acesso encontrado');
    throw new Error('AUTH_REQUIRED');
  }

  try {
    // Verifica se o token está expirado
    if (isTokenExpired()) {
      logger.info('Token expirado, tentando renovar...');
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      await saveTokens(credentials);
      logger.info('Token renovado e salvo com sucesso');
    } else {
      logger.info('Token válido, continuando...');
    }
  } catch (error) {
    logger.error('Erro ao verificar/renovar token', {
      error: error.message,
      stack: error.stack
    });
    throw new Error('AUTH_REQUIRED');
  }
}

// Função para gerar URL de autorização
export function generateAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.readonly'],
    prompt: 'consent'
  });
}

// Função para trocar o código de autorização por tokens
export async function exchangeCodeForTokens(code) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    await saveTokens(tokens);
    logger.info('Tokens obtidos e configurados com sucesso');
    
    // Retomar processamento da fila
    const { transcriptionQueue } = await import('../services/queue.js');
    transcriptionQueue.resume();
    logger.info('Fila de transcrição retomada');
    
    return tokens;
  } catch (error) {
    logger.error('Erro ao trocar código por tokens', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}
