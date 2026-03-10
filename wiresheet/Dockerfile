ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG=C.UTF-8 \
    NODE_ENV=production

RUN apk add --no-cache \
    nodejs \
    nginx && \
    mkdir -p /data/wiresheet && \
    mkdir -p /run/nginx

WORKDIR /app

COPY dist ./dist
COPY server ./server
COPY node_modules ./node_modules
COPY rootfs/run.sh /run.sh
COPY rootfs/etc/nginx/nginx.conf /etc/nginx/nginx.conf

RUN chmod +x /run.sh && \
    chown -R root:root /app

CMD [ "/run.sh" ]
