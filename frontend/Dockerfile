FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN addgroup -S -g 10001 ethos && adduser -S -u 10001 -G ethos ethos
COPY --from=build --chown=ethos:ethos /app/.next/standalone ./
COPY --from=build --chown=ethos:ethos /app/.next/static ./.next/static
COPY --from=build --chown=ethos:ethos /app/public ./public
USER ethos
EXPOSE 3000
CMD ["node", "server.js"]
