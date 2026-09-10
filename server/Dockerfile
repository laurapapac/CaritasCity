FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/ ./
RUN npm run build


FROM node:20-bookworm-slim

WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/src/migrations ./dist/migrations

EXPOSE 3001

CMD ["node", "dist/index.js"]
