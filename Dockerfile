FROM node:20-alpine AS build
WORKDIR /app

# Workspace install: lockfile is at repo root, not in backend/
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm ci --workspace=backend

COPY backend ./backend
RUN npm run build -w backend

FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm ci --workspace=backend --omit=dev

COPY --from=build /app/backend/dist ./backend/dist

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "backend/dist/index.js"]
