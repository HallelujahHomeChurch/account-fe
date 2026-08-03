# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc pnpm install --frozen-lockfile

COPY . .
ARG VITE_LOCALE_COOKIE_DOMAIN=.alive.org.tw
ARG VITE_THEME_COOKIE_DOMAIN=.alive.org.tw
ARG VITE_TURNSTILE_SITE_KEY=
ENV VITE_LOCALE_COOKIE_DOMAIN=$VITE_LOCALE_COOKIE_DOMAIN
ENV VITE_THEME_COOKIE_DOMAIN=$VITE_THEME_COOKIE_DOMAIN
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
RUN pnpm build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1:10000/health || exit 1
