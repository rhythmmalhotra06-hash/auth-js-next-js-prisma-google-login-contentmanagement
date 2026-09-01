# E12.2 — Remotion needs headless Chromium + ffmpeg, which node:lts-alpine (the main
# portal's auto-generated Kessel image) can't support. Debian-based per Remotion's own
# documented Docker recipe: https://www.remotion.dev/docs/docker
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 \
    libxrandr2 libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 \
    libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
    ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src
COPY server.mjs ./

# Downloads Remotion's headless Chrome build into the image at build time, not on
# every cold start.
RUN npx remotion browser ensure

ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
