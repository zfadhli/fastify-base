FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/cli/package.json apps/cli/package.json
RUN bun install --frozen-lockfile

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api ./apps/api
COPY package.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "apps/api/src/index.ts"]
