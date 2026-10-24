import requests

TIMEOUT_SECONDS = 30


class Conflict(Exception):
    """The claim moved on (lease expired and someone re-claimed, or the song changed). Drop the result."""


class Rejected(Exception):
    """The server refused the result itself (4xx). Sending it again gets the same answer."""


class AdminApi:
    def __init__(self, base_url: str, token: str):
        self.base = base_url.rstrip("/") + "/lyric-sync-agent"
        self.session = requests.Session()
        self.session.headers["Authorization"] = f"Bearer {token}"

    def claim(self, song_id: int | None = None) -> dict | None:
        params = {"songId": song_id} if song_id is not None else None
        r = self.session.post(f"{self.base}/claim", params=params, timeout=TIMEOUT_SECONDS)
        if r.status_code == 204:
            return None
        r.raise_for_status()
        return r.json()

    def complete(self, sync_id: int, attempt: int, method: str, lines: list[dict], confidence: dict) -> None:
        self._post(f"syncs/{sync_id}/complete", {"attempt": attempt, "method": method, "lines": lines, "confidence": confidence})

    def fail(self, sync_id: int, attempt: int, message: str, retryable: bool) -> None:
        self._post(f"syncs/{sync_id}/fail", {"attempt": attempt, "message": message, "retryable": retryable})

    def _post(self, path: str, body: dict) -> None:
        r = self.session.post(f"{self.base}/{path}", json=body, timeout=TIMEOUT_SECONDS)
        if r.status_code == 409:
            raise Conflict(r.text)
        if 400 <= r.status_code < 500:
            raise Rejected(f"{r.status_code} {r.text}")
        r.raise_for_status()
