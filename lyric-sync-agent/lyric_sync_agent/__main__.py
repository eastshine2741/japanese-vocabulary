"""Local lyric MV sync agent.

  python -m lyric_sync_agent              claim and process syncs until stopped
  python -m lyric_sync_agent try JOB.json  run one claim-shaped job and print the result, nothing is sent
  python -m lyric_sync_agent song SONG_ID  claim that song right away (FAILED included), process it and exit

The server cannot fetch MV audio (YouTube flags the Hetzner egress IP as a bot), so this PC does the
work whenever it is on. A job left half-done when the PC shuts down is re-claimed after its lease.
"""
import argparse
import json
import logging
import os
import sys
import time

import requests

from . import pipeline
from .client import AdminApi, Conflict, Rejected

log = logging.getLogger("lyric_sync_agent")


# Several agent-side failures in a row mean the PC itself is broken (GPU, yt-dlp blocked); stop burning the queue.
MAX_AGENT_FAILURES_IN_A_ROW = 3
BACKOFF_SECONDS = 1800


def serve(api: AdminApi, model: str, device: str, poll_seconds: int) -> None:
    failures_in_a_row = 0
    while True:
        try:
            job = api.claim()
        except requests.RequestException as e:
            log.warning("claim failed, retrying in %ss: %s", poll_seconds, e)
            time.sleep(poll_seconds)
            continue
        if job is None:
            time.sleep(poll_seconds)
            continue
        failures_in_a_row = 0 if process(api, job, model, device) else failures_in_a_row + 1
        if failures_in_a_row >= MAX_AGENT_FAILURES_IN_A_ROW:
            log.error("%s agent-side failures in a row, pausing %ss", failures_in_a_row, BACKOFF_SECONDS)
            time.sleep(BACKOFF_SECONDS)
            failures_in_a_row = 0


def process(api: AdminApi, job: dict, model: str, device: str) -> bool:
    """Returns False only when this PC failed (the song may be fine), so the caller can back off."""
    sid, attempt = job["id"], job["attempt"]
    log.info("sync %s: song %s %s / %s (video %s)", sid, job["songId"], job["title"], job["artist"], job["youtubeVideoId"])
    started = time.monotonic()
    try:
        result = pipeline.run(job, model, device)
    except pipeline.SyncError as e:
        log.warning("sync %s: %s", sid, e)
        report(lambda: api.fail(sid, attempt, f"SyncError: {e}", retryable=False))
        return True
    except Exception as e:  # noqa: BLE001 - every agent-side failure goes on the ledger instead of killing the loop
        log.exception("sync %s failed", sid)
        report(lambda: api.fail(sid, attempt, f"{type(e).__name__}: {e}", retryable=True))
        return False
    log.info("sync %s: %s %s in %.0fs", sid, result.method, result.confidence, time.monotonic() - started)
    try:
        report(lambda: api.complete(sid, attempt, result.method, result.lines, result.confidence), rejected_raises=True)
    except Rejected as e:
        log.error("sync %s: result rejected: %s", sid, e)
        report(lambda: api.fail(sid, attempt, f"rejected: {e}", retryable=False))
    return True


def report(send, rejected_raises: bool = False) -> None:
    try:
        send()
    except Rejected:
        if rejected_raises:
            raise
        log.exception("report rejected")
    except Conflict as e:
        log.info("result dropped, claim no longer current: %s", e)
    except Exception:  # noqa: BLE001 - the row stays RUNNING and is re-claimed after its lease
        log.exception("could not report result")


def main() -> None:
    parser = argparse.ArgumentParser(prog="lyric_sync_agent")
    parser.add_argument("command", nargs="?", default="serve", choices=["serve", "try", "song"])
    parser.add_argument("target", nargs="?", help="claim-shaped JSON file for `try`, song id for `song`")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    model = os.environ.get("WHISPER_MODEL", "large-v3")
    device = os.environ.get("DEVICE", "cuda")

    if args.command == "try":
        with open(args.target) as f:
            result = pipeline.run(json.load(f), model, device)
        json.dump({"method": result.method, "confidence": result.confidence, "lines": result.lines},
                  sys.stdout, ensure_ascii=False, indent=1)
        return

    api = AdminApi(os.environ["KOTONOHA_ADMIN_API"], os.environ["LYRIC_SYNC_AGENT_TOKEN"])
    if args.command == "song":
        job = api.claim(int(args.target))
        if job is None:
            sys.exit(f"song {args.target}: nothing to claim (already COMPLETED, leased by another run, or no MV)")
        process(api, job, model, device)
        return
    serve(api, model, device, int(os.environ.get("POLL_SECONDS", "300")))


if __name__ == "__main__":
    main()
