FROM node:22-slim

RUN apt-get update && \
    apt-get install -y git python3 make g++ build-essential libc6-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install --verbose

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
