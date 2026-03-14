ARG BUILD_FROM
ARG BUILD_VERSION=1.0.5

FROM node:18-alpine AS builder

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci --production=false

COPY src ./src
COPY index.html ./
COPY visu.html ./
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

ARG BUILD_VERSION
ENV LANG=C.UTF-8 \
    NODE_ENV=production \
    BUILD_VERSION=${BUILD_VERSION}

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

LABEL io.hass.version="${BUILD_VERSION}"
