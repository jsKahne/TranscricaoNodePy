# API de Transcrição de Vídeo

API para transcrição automática de vídeos do Google Drive para texto em português do Brasil usando o modelo Whisper.

## Requisitos

- Docker e Docker Compose
- Conta Google Cloud Platform com API do Google Drive habilitada
- Credenciais OAuth 2.0 configuradas

## Configuração

1. Clone o repositório:
```bash
git clone [URL_DO_REPOSITORIO]
cd transcription-api
```

2. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:
```env
PORT=9898
API_KEY=sua_api_key_secreta
GOOGLE_CLIENT_ID=seu_client_id
GOOGLE_CLIENT_SECRET=seu_client_secret
GOOGLE_REDIRECT_URI=http://seu.dominio:9898/auth/google/callback
```

3. Configure as credenciais do Google:
- Crie um projeto no Google Cloud Console
- Habilite a API do Google Drive
- Configure as credenciais OAuth 2.0
- Baixe o arquivo de credenciais e salve como `credentials.json`

## Deploy com Portainer

1. No Portainer, vá para "Stacks" e clique em "Add stack"

2. Configure o stack:
   - Nome: transcription-api
   - Build method: Git Repository
   - Repository URL: [URL_DO_REPOSITORIO]
   - Repository reference: main

3. Adicione suas variáveis de ambiente no Portainer:
   - PORT=9898
   - API_KEY
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - GOOGLE_REDIRECT_URI

4. Deploy o stack

## Uso da API

### Autenticação

Todas as requisições precisam incluir o header `x-api-key`:
```
x-api-key: sua_api_key
```

### Endpoints

#### POST /transcribe
Inicia a transcrição de um vídeo:
```json
{
  "videoId": "id_do_video_no_google_drive",
  "webhookUrl": "url_para_receber_notificacao"
}
```

Resposta:
```json
{
  "status": "queued",
  "taskId": "id_da_tarefa",
  "message": "Video queued for transcription"
}
```

### Webhook

O sistema enviará uma notificação para o webhookUrl quando a transcrição for concluída:

Sucesso:
```json
{
  "status": "success",
  "text": "texto_transcrito",
  "videoId": "id_do_video"
}
```

Erro:
```json
{
  "status": "error",
  "error": "mensagem_de_erro",
  "videoId": "id_do_video"
}
```

## Manutenção

### Logs
Visualize os logs do container:
```bash
docker logs transcription-api
```

### Atualização
Para atualizar o sistema:
1. Pull das alterações do repositório
2. Redeploy do stack no Portainer

## Segurança

- Mantenha sua API_KEY segura
- Não compartilhe suas credenciais do Google
- Use HTTPS para o webhook
- Monitore os logs regularmente

## Limitações

- Tamanho máximo do vídeo: 2GB
- Formatos suportados: MP4
- Idioma: Português do Brasil
- Rate limit: 100 requisições por 15 minutos

## Suporte

Para suporte, abra uma issue no repositório ou entre em contato através de [seu_email].
