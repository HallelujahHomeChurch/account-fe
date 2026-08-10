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
ARG VITE_SENTRY_DSN=
ARG VITE_SENTRY_ENVIRONMENT=production
ARG VITE_SENTRY_RELEASE=
ARG SENTRY_ORG=
ARG SENTRY_PROJECT=
ENV VITE_LOCALE_COOKIE_DOMAIN=$VITE_LOCALE_COOKIE_DOMAIN
ENV VITE_THEME_COOKIE_DOMAIN=$VITE_THEME_COOKIE_DOMAIN
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT
ENV VITE_SENTRY_RELEASE=$VITE_SENTRY_RELEASE
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT
RUN --mount=type=secret,id=sentry_auth_token,required=false \
  SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" pnpm build
RUN sentry_origin="$(node -e 'try { const value = process.argv[1]; if (value) process.stdout.write(" " + new URL(value).origin) } catch {}' "$VITE_SENTRY_DSN")" \
  && sed "s|__SENTRY_CONNECT_ORIGIN__|$sentry_origin|g" nginx.conf > /tmp/nginx.conf

FROM nginx:1.29-alpine
COPY --from=build /tmp/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://127.0.0.1:10000/health || exit 1
