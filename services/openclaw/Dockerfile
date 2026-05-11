FROM node:24-bookworm-slim

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

CMD ["./node_modules/.bin/openclaw", "gateway", "--bind", "lan", "--port", "18798", "run"]
