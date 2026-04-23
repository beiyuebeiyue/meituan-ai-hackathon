FROM node:20-alpine

WORKDIR /workspace/apps/ops-web

COPY apps/ops-web/package.json ./
RUN npm install

COPY apps/ops-web /workspace/apps/ops-web

EXPOSE 4173

CMD ["npm", "run", "dev"]
