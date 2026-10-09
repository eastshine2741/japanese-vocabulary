---
name: mv-download
description: yt-dlp 로 유튜브 MV 를 받아 ~/Downloads 에 mp4(H.264, 최대 1080p·30fps)로 저장한다. 릴스 팩토리에 올릴 MV 소스용. "MV 다운", "영상 받아줘", "yt-dlp", "릴스 소스 영상" 요청 시 사용.
---

# MV Download

릴스 팩토리(admin reels factory)에 올릴 MV 를 받는다. 렌더러는 업로드 원본을 프레임마다 두 번(전경 MV + 블러 배경) 소프트웨어로 디코딩하므로, 원본이 무거우면 렌더가 8분 타임아웃에 걸린다. 4K AV1 원본은 10줄 렌더도 끝내지 못했고, 480p 는 금방 끝났다.

## 출력 규격 (반드시 지킬 것)

- 컨테이너: **mp4**
- 비디오 코덱: **H.264 (avc1)** — AV1·VP9 는 디코딩이 느려서 쓰지 않는다
- 해상도: **세로 1080 이하, 가능하면 정확히 1080p**. 4K·1440p 금지. 캔버스가 1080×1920 이라 그 이상은 의미 없이 느려지기만 한다. 1080p 가 없으면 720p.
- 프레임레이트: **30fps 이하** (릴스가 30fps)
- 오디오: AAC (m4a)
- 저장 위치: `~/Downloads/`

## 절차

1. 사용자에게 유튜브 URL 을 받는다. 곡명·아티스트만 주면 `yt-dlp --js-runtimes node "ytsearch5:<아티스트> <곡명> MV" --get-id --get-title` 로 후보를 보여주고 공식 채널 영상을 고른다(애매하면 사용자에게 확인).
2. 다운로드:

   ```bash
   yt-dlp --js-runtimes node \
     -S "res:1080,fps:30,vcodec:h264,acodec:aac" \
     -f "bv*[height<=1080][fps<=30]+ba/b[height<=1080]" \
     --merge-output-format mp4 \
     -o "$HOME/Downloads/%(title)s.%(ext)s" \
     --print after_move:filepath \
     "<URL>"
   ```

   - deno 가 없어서 `--js-runtimes node` 가 필요하다. 빼면 포맷이 일부 누락된다.
   - "Sign in to confirm your age" 가 나오면 `--cookies-from-browser chrome` 을 붙인다(브라우저가 다르면 이름만 바꾼다).

3. 받은 파일을 확인한다:

   ```bash
   ffprobe -v error -select_streams v:0 \
     -show_entries stream=codec_name,width,height,r_frame_rate -of compact "<파일>"
   ```

4. `codec_name` 이 `h264` 가 아니거나, 세로 1080 초과이거나, 30fps 를 넘으면 다시 인코딩해서 원본을 바꿔 넣는다:

   ```bash
   ffmpeg -i "<파일>" -vf "scale=-2:'min(1080,ih)',fps=30" \
     -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
     -c:a aac -b:a 192k -movflags +faststart "<파일 이름>.h264.mp4" \
     && mv "<파일 이름>.h264.mp4" "<파일>"
   ```

5. 최종 경로와 ffprobe 결과(코덱·해상도·fps)·파일 크기를 보고한다.
