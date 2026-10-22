#!/usr/bin/env bash
# dev k3s(main) api 의 JWT_SECRET 으로 그 유저의 1시간짜리 토큰을 만든다.
# 사용: mint-dev-jwt.sh <userId> <name>
set -euo pipefail
USER_ID=${1:?userId}
NAME=${2:?name}
SECRET=$(kubectl -n main get secret api-secret -o jsonpath='{.data.JWT_SECRET}' | base64 -d) \
USER_ID="$USER_ID" NAME="$NAME" python3 -I - <<'EOF'
import base64, hashlib, hmac, json, os, time
b = lambda d: base64.urlsafe_b64encode(d).rstrip(b'=').decode()
k = os.environ['SECRET'].encode()
# jjwt 의 signWith(key) 는 키 길이로 알고리즘을 고른다.
alg, h = ('HS512', hashlib.sha512) if len(k) >= 64 else ('HS384', hashlib.sha384) if len(k) >= 48 else ('HS256', hashlib.sha256)
now = int(time.time())
m = b(json.dumps({'alg': alg}).encode()) + '.' + b(json.dumps({'sub': os.environ['USER_ID'], 'name': os.environ['NAME'], 'iat': now, 'exp': now + 3600}).encode())
print(m + '.' + b(hmac.new(k, m.encode(), h).digest()))
EOF
