FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:24-alpine AS runner
RUN addgroup -S idp \
    && adduser -S idp -G idp

WORKDIR /app

ENV NODE_ENV=deployment

COPY package.json package-lock.json ./

RUN npm ci

COPY --from=builder /app/dist ./dist

COPY ./drizzle ./drizzle

USER idp

EXPOSE 3000

CMD [ "node", "dist/index.js" ]
