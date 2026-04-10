FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

# npm ci is best practice for deployment, but with npm ci
# docker compose build fails with an architecture mismatch for esbuild
RUN npm install --no-save --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=deployment

COPY package.json package-lock.json ./

RUN npm install --omit=dev --no-save --no-audit --no-fund

COPY --from=builder /app/dist ./dist

COPY ./drizzle ./drizzle

EXPOSE 3000

CMD [ "node", "dist/index.js" ]