# ---------- build stage ----------
FROM node:22-alpine3.18 AS build

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

RUN npm prune --omit=dev

# ---------- runtime stage ----------
FROM node:22-alpine3.18 AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Only copy what runtime needs
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/templates ./src/templates
COPY MivoraSwagger.yaml ./MivoraSwagger.yaml

# create and chown upload dirs BEFORE dropping privileges
RUN mkdir -p /app/uploads/images/temp && \
    chown -R node:node /app/uploads

USER node

EXPOSE 4000

CMD ["node", "dist/index.js"]
