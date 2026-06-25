FROM eclipse-temurin:17-jre

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      ffmpeg \
      nodejs \
      npm \
      python3 \
      python3-pip \
    && python3 -m pip install --break-system-packages --no-cache-dir yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/reels
COPY reels/package*.json ./
RUN npm ci
COPY reels/ ./

WORKDIR /app
COPY backend/admin-api/build/libs/*.jar app.jar
ENV ADMIN_REELS_RENDERER_WORKING_DIRECTORY=/opt/reels

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
