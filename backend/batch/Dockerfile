FROM eclipse-temurin:17-jre
# deploy.sh 가 bootJar 파일명을 정확히 넘긴다 (build/libs 에는 -plain.jar 도 함께 있음).
ARG JAR_FILE
COPY build/libs/${JAR_FILE} app.jar
RUN test -f app.jar || (echo "JAR_FILE build-arg 가 필요합니다. ./deploy.sh 로 빌드하세요." && exit 1)
# CronJob 이 넘기는 --task=<name> 을 java 까지 전달해야 한다. `sh -c '<cmd> "$@"' --` 형태라야
# 컨테이너 args 가 $@ 로 들어온다 (그냥 두면 $0 으로 먹히고 사라진다).
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar \"$@\"", "--"]
