# Tarea Fargate (L/X/V): refresco del radar de contenido (Business Discovery).
# Solo DB + Meta API (sin S3). Secrets como env desde SSM /vence-social (task def).
FROM node:20-slim
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY content_radar.mjs .
CMD ["node", "content_radar.mjs"]
