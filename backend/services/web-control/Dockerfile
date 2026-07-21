FROM node:20.19.0-alpine3.21 AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY gateway/package.json ./gateway/package.json
COPY services/auth/package.json ./services/auth/package.json
COPY services/user/package.json ./services/user/package.json
COPY services/retail/package.json ./services/retail/package.json
COPY services/para/package.json ./services/para/package.json
COPY services/alimentation/package.json ./services/alimentation/package.json
COPY services/fashion/package.json ./services/fashion/package.json
COPY services/mailer-api/package.json ./services/mailer-api/package.json
COPY services/engagement/package.json ./services/engagement/package.json
COPY services/web-control/package.json ./services/web-control/package.json
COPY shared/types/package.json ./shared/types/package.json
RUN npm ci --workspace @app/web-control

COPY services/web-control ./services/web-control
RUN npm run build --workspace @app/web-control

FROM node:20.19.0-alpine3.21
RUN apk add --no-cache wget && apk upgrade --no-cache
WORKDIR /app
COPY package.json package-lock.json ./
COPY gateway/package.json ./gateway/package.json
COPY services/auth/package.json ./services/auth/package.json
COPY services/user/package.json ./services/user/package.json
COPY services/retail/package.json ./services/retail/package.json
COPY services/para/package.json ./services/para/package.json
COPY services/alimentation/package.json ./services/alimentation/package.json
COPY services/fashion/package.json ./services/fashion/package.json
COPY services/mailer-api/package.json ./services/mailer-api/package.json
COPY services/engagement/package.json ./services/engagement/package.json
COPY services/web-control/package.json ./services/web-control/package.json
COPY shared/types/package.json ./shared/types/package.json
RUN npm ci --omit=dev --workspace @app/web-control
WORKDIR /app/services/web-control
COPY --from=builder /app/services/web-control/dist ./dist
COPY shared/db/migrations ./migrations
EXPOSE 3009
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
