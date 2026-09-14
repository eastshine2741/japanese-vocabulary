#!/usr/bin/env bash
# dev DB(k3s `main` 네임스페이스 mysql-0)에서 곡을 찾아 가사를 출력한다.
#
#   lyrics.sh <검색어>                # songs.title / songs.artist LIKE 검색 → 후보 목록
#   lyrics.sh --id <song_id>          # 가사 줄 출력 (index\ttext)
#   lyrics.sh --id <song_id> --tokens # 줄마다 앱 분석 토큰(surface/reading/뜻)도 출력
#   NAMESPACE=reels-factory lyrics.sh ...   # 다른 네임스페이스
set -euo pipefail

NS="${NAMESPACE:-main}"
MODE=search
SONG_ID=""
TOKENS=0
QUERY=""

while [ $# -gt 0 ]; do
  case "$1" in
    --id) MODE=lyrics; SONG_ID="$2"; shift 2 ;;
    --tokens) TOKENS=1; shift ;;
    *) QUERY="$1"; shift ;;
  esac
done

run_sql() {
  kubectl -n "$NS" exec -i mysql-0 -- sh -c \
    'mysql --default-character-set=utf8mb4 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -N --raw' \
    2>&1 | grep -v 'Using a password'
}

# LIKE 패턴용 이스케이프 (' % _)
esc() { printf '%s' "$1" | sed "s/'/''/g; s/%/\\\\%/g; s/_/\\\\_/g"; }

if [ "$MODE" = search ]; then
  [ -n "$QUERY" ] || { echo "usage: lyrics.sh <검색어> | --id <song_id> [--tokens]" >&2; exit 2; }
  Q="$(esc "$QUERY")"
  echo -e "id\ttitle\tartist\tlyric_rows"
  run_sql <<SQL
SELECT s.id, s.title, s.artist, COUNT(l.id)
FROM songs s LEFT JOIN lyrics l ON l.song_id = s.id
WHERE s.title LIKE '%${Q}%' OR s.artist LIKE '%${Q}%'
GROUP BY s.id ORDER BY s.id LIMIT 20;
SQL
  exit 0
fi

# 가장 최근 lyrics 행 하나만 사용
if [ "$TOKENS" = 0 ]; then
  run_sql <<SQL
SELECT jt.idx, jt.txt
FROM lyrics l,
     JSON_TABLE(l.raw_content, '\$[*]' COLUMNS (idx INT PATH '\$.index', txt VARCHAR(1000) PATH '\$.text')) jt
WHERE l.id = (SELECT MAX(id) FROM lyrics WHERE song_id = ${SONG_ID})
ORDER BY jt.idx;
SQL
else
  run_sql <<SQL
SELECT line.idx, line.txt,
       IFNULL(GROUP_CONCAT(
         CONCAT(tok.surface, '(', IFNULL(tok.reading,''), ')',
                IF(tok.base <> tok.surface, CONCAT('←', tok.base), ''),
                ' ', IFNULL(tok.ko,''))
         ORDER BY tok.cs SEPARATOR ' | '), '(분석 없음)')
FROM lyrics l
JOIN JSON_TABLE(l.raw_content, '\$[*]' COLUMNS (idx INT PATH '\$.index', txt VARCHAR(1000) PATH '\$.text')) line
LEFT JOIN JSON_TABLE(l.analyzed_content, '\$[*]' COLUMNS (
           aidx INT PATH '\$.index',
           NESTED PATH '\$.tokens[*]' COLUMNS (
             surface VARCHAR(100) PATH '\$.surface',
             reading VARCHAR(100) PATH '\$.reading',
             base    VARCHAR(100) PATH '\$.baseForm',
             ko      VARCHAR(200) PATH '\$.koreanText',
             cs      INT          PATH '\$.charStart'))) tok
  ON tok.aidx = line.idx
WHERE l.id = (SELECT MAX(id) FROM lyrics WHERE song_id = ${SONG_ID})
GROUP BY line.idx, line.txt
ORDER BY line.idx;
SQL
fi
