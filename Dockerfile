# Imagem base com Node.js e Python
FROM nikolaik/python-nodejs:latest

# Instalar FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos do projeto
COPY . .

# Instalar dependências Python
RUN python -m pip install --upgrade pip
RUN python -m pip install -r requirements.txt

# Instalar dependências Node.js
RUN npm ci

# Criar diretório para arquivos temporários
RUN mkdir -p temp

# Expor porta
EXPOSE 9898

# Comando para iniciar a aplicação
CMD ["npm", "start"]
