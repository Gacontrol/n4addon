ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG=C.UTF-8 \
    NODE_ENV=production

RUN apk add --no-cache \
    nodejs \
    npm \
    nginx && \
    mkdir -p /data/wiresheet

WORKDIR /app

COPY server-package.json package.json
RUN npm install --production && \
    npm cache clean --force

COPY dist ./dist
COPY server ./server
COPY rootfs /

RUN chmod +x /run.sh && \
    chown -R root:root /app

CMD [ "/run.sh" ]
