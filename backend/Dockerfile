FROM node:24-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/package.json backend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run prisma:generate --workspace backend
RUN npx --yes esbuild@0.25.9 backend/src/index.ts \
  --bundle --platform=node --target=node24 --format=cjs \
  --outfile=backend/dist/index.cjs \
  --external:@prisma/client \
  --external:@prisma/client/runtime/library

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/dist/index.cjs ./backend/dist/index.cjs
COPY --from=build /app/node_modules/@fastify/swagger-ui/static ./backend/dist/static
COPY --from=build /app/backend/prisma ./backend/prisma

WORKDIR /app/backend
EXPOSE 4000

CMD ["node", "dist/index.cjs"]
