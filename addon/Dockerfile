ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8

RUN apk add --no-cache \
    nodejs \
    npm \
    nginx

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY addon/rootfs ./

RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
