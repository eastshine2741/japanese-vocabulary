-- 실행기가 MV 를 받지 못한 이유. 앱 임베드 플레이어는 연령 제한·삭제·재생 불가를 모두 같은 오류로 알려 줘서 이유는 여기서만 안다.
ALTER TABLE lyric_mv_sync ADD COLUMN mv_unavailable VARCHAR(20) NULL AFTER error_message;
