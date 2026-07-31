# Vence backend — imagen de producción.
# Multi-stage: la imagen final NO lleva ni el código TS ni las devDependencies.
# Contenedor estándar 12-factor → corre igual en Fargate, Fly, Railway o una VM.

# ---- build ----
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production

# poppler-utils (pdftotext) + curl: dependencias REALES de la vigilancia de fuentes legales
# [T-380]. Casi todas las fuentes que el monitor del BOE no cubre son PDFs de boletines
# autonómicos, y hay que convertirlos a texto para hashearlos.
#
# Por qué se instala aquí y no se resuelve con una librería JS: el CLI
# (`scripts/laws/vigilar-fuentes-legales.cjs`) extrae con `pdftotext -layout`, y un extractor
# distinto produce un TEXTO distinto del mismo PDF — y por tanto otro hash. Las dos mitades
# tienen que leer igual o la línea base fijada por una da «cambiada» vista por la otra: ese
# fallo ya costó un 8-de-8 en falso el 31/07 entre dos criterios de hash distintos, y aquí se
# evita por construcción compartiendo el mismo extractor.
#
# `--no-install-recommends` y limpieza de listas para que el coste sea el mínimo (~30-50 MB).
RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils curl \
  && rm -rf /var/lib/apt/lists/*
# SHA del commit horneado en la imagen → /health lo expone para que el deploy
# verifique que prod sirve lo que construyó (anti-clobber, incidente 11/07).
ARG GIT_COMMIT_SHA=
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist

# Ejecutar como usuario sin privilegios (el usuario `node` viene en la imagen).
USER node
EXPOSE 3000

# Health check del contenedor (lo usa también ECS si no se sobreescribe).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
