FROM eclipse-temurin:17-jre

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      ffmpeg \
      nodejs \
      npm \
      python3 \
      python3-pip \
      libnss3 \
      libdbus-1-3 \
      libatk1.0-0t64 \
      libgbm-dev \
      libasound2t64 \
      libxrandr2 \
      libxkbcommon-dev \
      libxfixes3 \
      libxcomposite1 \
      libxdamage1 \
      libatk-bridge2.0-0t64 \
      libpango-1.0-0 \
      libcairo2 \
      libcups2t64 \
      fonts-noto-cjk \
    && python3 -m pip install --break-system-packages --no-cache-dir yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/reels
COPY reels/package*.json ./
RUN npm ci
RUN npx remotion browser ensure
COPY reels/ ./

WORKDIR /opt/app-rn/src/utils
COPY app-rn/src/utils/readingConverter.ts ./

WORKDIR /app
# reels/ 를 담아야 해서 이 이미지만 build context 가 repo root 다.
# deploy.sh 가 bootJar 파일명을 정확히 넘긴다 (build/libs 에는 -plain.jar 도 함께 있음).
ARG JAR_FILE
COPY backend/admin-api/build/libs/${JAR_FILE} app.jar
RUN test -f app.jar || (echo "JAR_FILE build-arg 가 필요합니다. ./deploy.sh 로 빌드하세요." && exit 1)
ENV ADMIN_REELS_RENDERER_WORKING_DIRECTORY=/opt/reels
ENV NODE_OPTIONS=--dns-result-order=ipv4first

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
