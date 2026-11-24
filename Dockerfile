FROM node:22-bookworm-slim

WORKDIR /app

# Install dependencies cleanly
COPY package.json ./
RUN npm install --no-audit --no-fund

# Copy application source
COPY . .

# Build frontend SPA bundle and bundled server entry
RUN npm run build && npm run build:server

# Persistent data folder (mount a volume here in production)
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV TEKNOVANT_DATA_DIR=/app/data
ENV TEKNOVANT_DIST_DIR=/app/dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist-server/server.mjs"]
