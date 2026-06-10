FROM node:24-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY frontend/package.json frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY backend/package.json backend/package.json

RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL=https://devops.emsoft.com/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build --workspace packages/shared
RUN npm run build --workspace frontend

FROM nginx:1.27-alpine AS runner

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

