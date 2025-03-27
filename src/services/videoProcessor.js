import { google } from 'googleapis';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import ffmpeg from 'fluent-ffmpeg';
import { oauth2Client, ensureValidToken, generateAuthUrl } from './auth.js';
import { logger } from '../utils/logger.js';
import { sendWebhookNotification } from './webhook.js';

const execAsync = promisify(exec);

// Configuração do cliente do Google Drive
const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Caminho do ffmpeg
const FFMPEG_PATH = 'C:\\ffmpeg-master-latest-win64-gpl-shared\\bin\\ffmpeg.exe';
const FFPROBE_PATH = 'C:\\ffmpeg-master-latest-win64-gpl-shared\\bin\\ffprobe.exe';

// Configurar caminhos do ffmpeg
ffmpeg.setFfmpegPath(FFMPEG_PATH);
ffmpeg.setFfprobePath(FFPROBE_PATH);

// Função principal de processamento
export async function processVideo(videoId, webhookUrl) {
  const tempDir = path.join(process.cwd(), 'temp');
  const videoPath = path.join(tempDir, `${videoId}.mp4`);
  const audioPath = path.join(tempDir, `${videoId}.mp3`);
  
  try {
    // Criar diretório temporário se não existir
    await fs.mkdir(tempDir, { recursive: true });

    // Verificar autenticação antes de começar
    try {
      await ensureValidToken();
    } catch (error) {
      if (error.message === 'AUTH_REQUIRED') {
        const authUrl = generateAuthUrl();
        logger.info('Autenticação necessária', { authUrl });
        
        // Enviar webhook com URL de autenticação
        await sendWebhookNotification(webhookUrl, {
          status: 'auth_required',
          authUrl,
          videoId
        });
        
        throw error;
      }
      throw error;
    }

    // Download do vídeo
    logger.info('Iniciando download do vídeo', { videoId });
    await downloadVideo(videoId, videoPath);
    logger.info('Download do vídeo concluído', { videoId });

    // Converter para MP3
    logger.info('Iniciando conversão para MP3', { videoId });
    await convertToMp3(videoPath, audioPath);
    logger.info('Conversão para MP3 concluída', { videoId });

    // Transcrever áudio
    logger.info('Iniciando transcrição', { videoId });
    const transcription = await transcribeAudio(audioPath);
    logger.info('Transcrição concluída', { videoId });

    // Enviar webhook com sucesso
    await sendWebhookNotification(webhookUrl, {
      status: 'success',
      transcription,
      videoId
    });

    // Limpar arquivos temporários
    await cleanup(videoPath, audioPath);
    
    return transcription;
  } catch (error) {
    logger.error('Erro no processamento do vídeo:', {
      error: error.message,
      stack: error.stack,
      videoId
    });

    // Enviar webhook com erro
    await sendWebhookNotification(webhookUrl, {
      status: 'error',
      error: error.message,
      videoId
    });

    // Tentar limpar arquivos mesmo em caso de erro
    try {
      await cleanup(videoPath, audioPath);
    } catch (cleanupError) {
      logger.error('Erro ao limpar arquivos temporários:', {
        error: cleanupError.message,
        videoId
      });
    }

    throw error;
  }
}

// Função para download do vídeo
async function downloadVideo(videoId, outputPath) {
  try {
    logger.info('Iniciando download do vídeo...', { videoId });
    
    // Primeiro verifica se o arquivo existe
    try {
      await drive.files.get({ fileId: videoId });
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`Arquivo não encontrado no Google Drive: ${videoId}`);
      }
      throw error;
    }
    
    // Criar diretório se não existir
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    
    // Tenta criar o arquivo com permissões corretas
    const dest = createWriteStream(outputPath, { mode: 0o666 });
    
    const response = await drive.files.get(
      { fileId: videoId, alt: 'media' },
      { responseType: 'stream' }
    );

    if (!response.data) {
      throw new Error('Resposta vazia do Google Drive');
    }

    const fileSize = parseInt(response.headers['content-length'], 10);
    let downloadedBytes = 0;
    let lastLoggedPercent = 0;

    await new Promise((resolve, reject) => {
      response.data
        .on('data', chunk => {
          downloadedBytes += chunk.length;
          const percent = Math.round((downloadedBytes / fileSize) * 100);
          
          // Log a cada 5% de progresso
          if (percent >= lastLoggedPercent + 5) {
            logger.info(`Download progresso: ${percent}%`, {
              videoId,
              downloadedBytes,
              totalBytes: fileSize
            });
            lastLoggedPercent = percent;
          }
        })
        .on('end', () => {
          logger.info('Download concluído', {
            videoId,
            totalBytes: fileSize
          });
          resolve();
        })
        .on('error', error => {
          logger.error('Erro durante o download:', {
            error: error.message,
            videoId
          });
          reject(error);
        });

      dest.on('error', error => {
        logger.error('Erro ao escrever arquivo:', {
          error: error.message,
          path: outputPath
        });
        reject(error);
      });

      response.data.pipe(dest);
    });

    // Verificar se o arquivo foi baixado corretamente
    const stats = await fs.stat(outputPath);
    if (stats.size === 0) {
      throw new Error('Arquivo baixado está vazio');
    }

    logger.info('Arquivo salvo com sucesso', {
      videoId,
      size: stats.size
    });

  } catch (error) {
    logger.error('Erro no download:', {
      error: error.message,
      videoId
    });

    if (error.code === 401 || error.response?.status === 401) {
      throw new Error('AUTH_REQUIRED');
    }
    throw error;
  }
}

// Função para converter vídeo para MP3
async function convertToMp3(videoPath, audioPath) {
  try {
    logger.info('Iniciando conversão para MP3...', { videoPath, audioPath });

    // Verificar se o arquivo de vídeo existe
    const videoExists = await fs.access(videoPath)
      .then(() => true)
      .catch(() => false);

    if (!videoExists) {
      throw new Error(`Arquivo de vídeo não encontrado: ${videoPath}`);
    }

    // Criar diretório de destino se não existir
    const audioDir = path.dirname(audioPath);
    await fs.mkdir(audioDir, { recursive: true });

    // Comando simplificado do ffmpeg
    const command = `ffmpeg -y -i "${videoPath}" -vn -acodec libmp3lame -ab 128k "${audioPath}"`;
    logger.debug('Comando ffmpeg:', { command });
    
    const { stdout, stderr } = await execAsync(command);
    
    // Verificar se o arquivo foi criado
    const audioExists = await fs.access(audioPath)
      .then(() => true)
      .catch(() => false);

    if (!audioExists) {
      throw new Error('Arquivo MP3 não foi gerado');
    }

    const stats = await fs.stat(audioPath);
    if (stats.size === 0) {
      throw new Error('Arquivo MP3 gerado está vazio');
    }

    logger.info('Conversão para MP3 concluída', {
      videoPath,
      audioPath,
      size: stats.size
    });

    return audioPath;
  } catch (error) {
    logger.error('Erro na conversão para MP3:', {
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr,
      videoPath,
      audioPath
    });
    throw new Error(`Erro na conversão para MP3: ${error.message}`);
  }
}

// Função para transcrever áudio
async function transcribeAudio(audioPath) {
  try {
    logger.info('Iniciando transcrição do áudio...', { audioPath });
    
    // Verificar se o arquivo existe antes de tentar transcrever
    const exists = await fs.access(audioPath).then(() => true).catch(() => false);
    if (!exists) {
      throw new Error(`Arquivo de áudio não encontrado: ${audioPath}`);
    }

    const startTime = Date.now();
    const { stdout, stderr } = await execAsync(`python transcribe.py "${audioPath}"`, {
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    
    if (stderr) {
      logger.warn('Avisos durante a transcrição:', { stderr });
    }

    const duration = (Date.now() - startTime) / 1000;
    
    // Parse da saída JSON
    let result;
    try {
      result = JSON.parse(stdout);
    } catch (e) {
      logger.error('Erro ao parsear saída da transcrição:', { stdout, error: e.message });
      throw new Error('Erro ao processar resultado da transcrição');
    }
    
    if (result.status === 'error') {
      throw new Error(result.error || 'Erro desconhecido na transcrição');
    }
    
    if (!result.text) {
      throw new Error('Transcrição retornou vazia');
    }
    
    logger.info('Transcrição concluída', {
      durationSeconds: duration,
      audioPath
    });
    
    return result.text;
  } catch (error) {
    logger.error('Erro na transcrição:', {
      error: error.message,
      audioPath
    });
    throw new Error(`Erro na transcrição: ${error.message}`);
  }
}

// Função para limpar arquivos temporários
async function cleanup(...files) {
  for (const file of files) {
    try {
      await fs.unlink(file);
    } catch (error) {
      // Ignora erro se arquivo não existir
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
