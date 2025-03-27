# Imagem base com Node.js 20 e Python 3.12
FROM nikolaik/python-nodejs:python3.12-nodejs20

# Definir diretório de trabalho
WORKDIR /app

# Atualizar e instalar FFmpeg em uma única camada
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copiar apenas os arquivos de dependências para cache eficiente
COPY package.json package-lock.json ./
COPY requirements.txt ./

# Instalar dependências Node.js e Python
RUN npm ci --omit=dev && \
    python -m pip install --upgrade pip && \
    python -m pip install -r requirements.txt

# Copiar restante do projeto
COPY . .

# Criar diretório para arquivos temporários
RUN mkdir -p /app/temp

# Definir variável de ambiente (exemplo)
ENV NODE_ENV=production

# Expor porta
EXPOSE 9898

# Comando para iniciar a aplicação
CMD ["npm", "start"]
