FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=2s --start-period=10s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.status === 503 ? 1 : 0)).catch(() => process.exit(1))"
USER node
CMD ["node", "src/server.js"]
