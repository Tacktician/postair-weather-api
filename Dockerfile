# PostAir Weather API — container image for the EKS demo.
# Multi-stage: install prod deps in a builder, copy into a slim runtime.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# Run as the built-in non-root "node" user.
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

# The Winston daily-rotate logger writes to ./logs; make it writable by "node".
RUN mkdir -p /app/logs && chown node:node /app/logs

USER node
EXPOSE 3000

# Lightweight liveness check against the app's /health endpoint.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
