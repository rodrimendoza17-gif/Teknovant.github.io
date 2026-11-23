FROM node:22-bookworm-slim

WORKDIR /app

# Install dependencies cleanly
COPY package.json ./
RUN npm install

# Copy application source
COPY . .

# Build frontend SPA bundle
RUN npm run build

# Persistent data folder (mount a volume here in production)
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["node", "server.ts"]
