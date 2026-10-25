-- 곡의 지금 MV 를 앱 임베드 플레이어가 재생하지 못하는 이유(AGE_RESTRICTED / UNAVAILABLE). 플레이어는 이 경우를 모두 같은
-- 오류로 알려 줘 YouTube Data API 로만 구분된다. batch 가 매일 채우고 비우며, MV 가 바뀌면 비운다. 기존 곡은 첫 batch 실행이 채운다.
ALTER TABLE songs ADD COLUMN mv_unavailable_reason VARCHAR(20) NULL AFTER youtube_url;
