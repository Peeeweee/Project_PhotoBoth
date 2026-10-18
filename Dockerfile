FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY photodate-server/package*.json ./photodate-server/
RUN npm ci --prefix photodate-server
COPY photodate-client/package*.json ./photodate-client/
RUN npm ci --prefix photodate-client
COPY shared ./shared
COPY photodate-server ./photodate-server
COPY photodate-client ./photodate-client
RUN npm test --prefix photodate-server && npm run lint --prefix photodate-client && npm test --prefix photodate-client && npm run build --prefix photodate-client
RUN npm prune --omit=dev --prefix photodate-server

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 CLIENT_DIST=/app/client DB_PATH=/data/photodate.db
WORKDIR /app/server
COPY --from=build /app/photodate-server/package*.json ./
COPY --from=build /app/photodate-server/node_modules ./node_modules
COPY --from=build /app/photodate-server/dist ./dist
COPY --from=build /app/photodate-client/dist /app/client
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
