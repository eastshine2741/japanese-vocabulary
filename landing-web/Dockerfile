# 서비스 소개 랜딩. 빌드 단계 없이 public/ 을 그대로 서빙한다.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public /usr/share/nginx/html
EXPOSE 80
