FROM node:24-alpine AS build
WORKDIR /app

ARG VITE_ADMIN_API_BASE_URL=/admin/api
ARG VITE_ADMIN_BASE_PATH=
ENV VITE_ADMIN_API_BASE_URL=$VITE_ADMIN_API_BASE_URL
ENV VITE_ADMIN_BASE_PATH=$VITE_ADMIN_BASE_PATH

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
