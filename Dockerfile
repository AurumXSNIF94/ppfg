FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

COPY backend ./backend
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "backend/src/server.js"]
