-- 곡의 지금 MV 를 앱 임베드 플레이어가 재생하지 못하는 이유(AGE_RESTRICTED / UNAVAILABLE). 플레이어는 이 경우를 모두 같은
-- 오류로 알려 줘 YouTube Data API 로만 구분된다. 기존 곡은 batch mv-playability-backfill 을 한 번 돌려 채우고, MV 가 바뀌면 비운다.
ALTER TABLE songs ADD COLUMN mv_unavailable_reason VARCHAR(20) NULL AFTER youtube_url;
