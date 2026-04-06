FROM node:20-alpine AS deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci

FROM node:20-alpine AS web-deps
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app/backend
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine AS web-build
WORKDIR /app/web
COPY --from=web-deps /app/web/node_modules ./node_modules
COPY web/ ./
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=web-build /app/web/dist ./web/dist
COPY docs ./docs
COPY favicon_io ./favicon_io
USER node
EXPOSE 4000
CMD ["node", "backend/dist/server.js"]
