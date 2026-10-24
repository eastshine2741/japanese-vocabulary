# Lyric Sync Agent

로컬 PC 에서 도는 가사 줄 시각 계산기. 왜 서버가 아니라 여기서 도는지, 원장 규칙, 계산 방식에서 바꾸면 깨지는 것은
`../docs/architecture/lyric-mv-sync.md` 에 있다.

```bash
./install.sh                                    # uv 로 .venv(Python 3.12) + systemd 사용자 서비스 등록
systemctl --user enable --now lyric-sync-agent  # 로그인할 때마다 자동 시작
journalctl --user -u lyric-sync-agent -f
./run.sh try job.json                           # claim 응답 모양의 JSON 하나를 돌려 결과만 출력 (서버에 안 보냄)
.venv/bin/python -m pytest                      # 오디오 없이 도는 정렬·시각 테스트
```

- 실행은 반드시 `run.sh` 로 한다. CTranslate2 가 CUDA 12 cuBLAS/cuDNN 을 `LD_LIBRARY_PATH` 에서만 찾는다.
- 설정은 `~/.config/kotonoha/lyric-sync-agent.env` (`KOTONOHA_ADMIN_API`, `LYRIC_SYNC_AGENT_TOKEN`, `POLL_SECONDS`, `WHISPER_MODEL`, `DEVICE`).
- MV 오디오는 작업 임시 디렉터리에만 두고 작업이 끝나면 지운다.
