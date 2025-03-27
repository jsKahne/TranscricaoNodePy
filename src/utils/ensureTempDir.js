import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.js';

const TEMP_DIR = path.join(process.cwd(), 'temp');

export async function ensureTempDir() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true, mode: 0o777 });
    await fs.chmod(TEMP_DIR, 0o777);
    logger.info('Diretório temporário criado/verificado com sucesso', { path: TEMP_DIR });
  } catch (error) {
    logger.error('Erro ao criar/verificar diretório temporário:', {
      error: error.message,
      path: TEMP_DIR
    });
    throw error;
  }
}
