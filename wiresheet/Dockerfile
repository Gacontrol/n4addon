ARG BUILD_FROM

FROM node:18-alpine AS builder

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci --production=false

COPY src ./src
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.app.json ./
COPY tsconfig.node.json ./
COPY postcss.config.js ./
COPY tailwind.config.js ./

RUN npm run build

WORKDIR /server-build

COPY server-package.json ./package.json
RUN npm install --production

FROM $BUILD_FROM

ENV LANG=C.UTF-8 \
    NODE_ENV=production

RUN apk add --no-cache \
    nodejs \
    nginx \
    python3 && \
    mkdir -p /data/wiresheet && \
    mkdir -p /run/nginx

WORKDIR /app

COPY --from=builder /build/dist ./dist
COPY --from=builder /server-build/node_modules ./node_modules
COPY server ./server
COPY rootfs /

RUN chmod +x /etc/s6-overlay/s6-rc.d/wiresheet-server/run && \
    chmod +x /etc/s6-overlay/s6-rc.d/nginx/run
