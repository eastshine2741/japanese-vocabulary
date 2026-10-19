# 카드 공유 웹 화면. app-rn 의 카드 컴포넌트를 웹으로 빌드해 nginx 로 서빙한다. build context 는 repo root 다.
FROM node:24-alpine AS build
WORKDIR /app/app-rn

# 번들·에셋 경로를 빌드 때 굽는다. dev 는 /<ns>/share-assets.
ARG SHARE_WEB_BASE_PATH=/share-assets
ARG DEPLOY_NS=main
ENV EXPO_PUBLIC_SHARE_WEB=1 SHARE_WEB_BASE_PATH=$SHARE_WEB_BASE_PATH DEPLOY_NS=$DEPLOY_NS

COPY app-rn/package*.json ./
COPY app-rn/patches ./patches
RUN npm ci
COPY app-rn/ ./
RUN npx expo export --platform web --output-dir /out

FROM nginx:1.27-alpine
COPY share-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /out /usr/share/nginx/html
EXPOSE 80
