FROM node:24-alpine AS build
# 릴스 미리보기가 reels/src 와 app-rn 의 readingConverter 를 가져와서 build context 가 repo root 다.
WORKDIR /app/admin-web

ARG VITE_ADMIN_API_BASE_URL=/admin/api
ARG VITE_ADMIN_BASE_PATH=
ENV VITE_ADMIN_API_BASE_URL=$VITE_ADMIN_API_BASE_URL
ENV VITE_ADMIN_BASE_PATH=$VITE_ADMIN_BASE_PATH

COPY admin-web/package*.json ./
RUN npm ci
COPY reels/src /app/reels/src
COPY app-rn/src/utils/readingConverter.ts /app/app-rn/src/utils/readingConverter.ts
COPY admin-web/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY admin-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/admin-web/dist /usr/share/nginx/html
EXPOSE 80
