FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG PUBLIC_MIRA_REGISTRY_ENDPOINT
ARG PUBLIC_MIRA_REGISTRY_PUBLIC_JWK
ARG PUBLIC_RELEASE_ID=development
ENV PUBLIC_MIRA_REGISTRY_ENDPOINT=$PUBLIC_MIRA_REGISTRY_ENDPOINT
ENV PUBLIC_MIRA_REGISTRY_PUBLIC_JWK=$PUBLIC_MIRA_REGISTRY_PUBLIC_JWK
ENV PUBLIC_RELEASE_ID=$PUBLIC_RELEASE_ID
RUN npm run build && rm -f dist/ollama-mira-test.js

FROM nginx:1.27-alpine
COPY deploy/nginx-static.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
