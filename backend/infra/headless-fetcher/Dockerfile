# Dockerfile para AWS Lambda — Headless Fetcher (Playwright + Chromium)
#
# Imagen base oficial de AWS para Node.js 22 Lambda runtime.
# @sparticuz/chromium incluye Chromium precompilado optimizado para Lambda
# (~50 MB, vs ~120 MB de la build estándar). El runtime de la Lambda lo extrae
# en /tmp en cold start.
#
# Build & push:
#   cd backend/infra/headless-fetcher
#   docker build --platform linux/amd64 -t vence-headless-fetcher:latest .
#   aws ecr get-login-password --region eu-west-2 | \
#     docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.eu-west-2.amazonaws.com
#   docker tag vence-headless-fetcher:latest \
#     <ACCOUNT_ID>.dkr.ecr.eu-west-2.amazonaws.com/vence-headless-fetcher:latest
#   docker push <ACCOUNT_ID>.dkr.ecr.eu-west-2.amazonaws.com/vence-headless-fetcher:latest
#
# Tras push, actualizar el código de la Lambda:
#   aws lambda update-function-code \
#     --function-name vence-backend-headless-fetcher \
#     --image-uri <ACCOUNT_ID>.dkr.ecr.eu-west-2.amazonaws.com/vence-headless-fetcher:latest \
#     --region eu-west-2

FROM public.ecr.aws/lambda/nodejs:22

# Variables que requiere @sparticuz/chromium en runtime.
ENV FONTCONFIG_PATH=/var/task/fonts

# Shared libraries del sistema que Chromium headless requiere y que la imagen
# base de Lambda Node22 NO trae. Sin ellas, Chromium arranca pero crashea al
# intentar renderizar y el frame se "detacha" (error típico).
# Lista validada para @sparticuz/chromium 131 en AL2023.
RUN dnf install -y \
    nss \
    nspr \
    atk \
    at-spi2-atk \
    cups-libs \
    libdrm \
    libxkbcommon \
    libXcomposite \
    libXdamage \
    libXfixes \
    libXrandr \
    mesa-libgbm \
    alsa-lib \
    pango \
    cairo \
    libxshmfence \
    && dnf clean all \
    && rm -rf /var/cache/dnf

# Workdir Lambda runtime
WORKDIR /var/task

# Instalar deps Node. npm install (no ci porque no commiteamos package-lock).
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copiar el handler tras instalar deps (cache layers Docker).
COPY handler.mjs ./

# Healthcheck Docker — útil para SAM local. AWS Lambda lo ignora.
HEALTHCHECK CMD node -e "process.exit(0)"

# Lambda runtime busca el handler exportado en CMD.
CMD ["handler.handler"]
