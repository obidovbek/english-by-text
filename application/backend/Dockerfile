# syntax=docker/dockerfile:1

FROM node:20-slim AS base
WORKDIR /app

# --- Dependencies layer ---
FROM base AS deps
COPY package*.json ./
RUN npm ci

# --- Development runtime ---
FROM base AS development
ENV NODE_ENV=development
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

# --- Migrator (runs sequelize-cli migrations/seeds) ---
FROM deps AS migrator
ENV NODE_ENV=development
COPY . .
CMD ["sh", "-lc", "npm run db:migrate && npm run db:seed"]

# --- Build for production ---
FROM deps AS build
ENV NODE_ENV=production
COPY . .
RUN npm run build

# --- Production runtime ---
FROM node:20-slim AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/server.js"] 