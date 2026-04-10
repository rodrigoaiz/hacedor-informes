# ---- build stage ----
FROM node:22-slim AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

COPY . .
RUN npm run astro -- build

# ---- runtime stage ----
FROM node:22-slim AS runtime

# Puppeteer / Chromium system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

# Only production deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --prefer-offline

# Copy source files needed at runtime
COPY --from=build /app/dist ./dist
COPY lib ./lib
COPY server ./server
COPY plantillas ./plantillas
COPY assets ./assets
COPY generar-reporte.js listar-reportes.js ver-reporte.js ./

EXPOSE 4324

CMD ["node", "server/index.js"]
