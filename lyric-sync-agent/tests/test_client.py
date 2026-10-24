from unittest.mock import MagicMock

import pytest
import requests

from lyric_sync_agent.client import AdminApi, Conflict


def api_with(*outcomes):
    api = AdminApi("https://example.test/admin/api", "token")
    api.session = MagicMock()
    api.session.post.side_effect = list(outcomes)
    return api


def response(status):
    r = requests.Response()
    r.status_code = status
    return r


def test_result_is_sent_again_once_when_the_idle_connection_was_closed():
    api = api_with(requests.ConnectionError("Remote end closed connection"), response(204))
    api.complete(41, 1, "OFFSET", [], {})
    assert api.session.post.call_count == 2


def test_resend_after_the_first_one_landed_is_dropped_as_conflict():
    api = api_with(requests.ConnectionError("Remote end closed connection"), response(409))
    with pytest.raises(Conflict):
        api.complete(41, 1, "OFFSET", [], {})


def test_a_second_connection_failure_is_left_to_the_lease():
    api = api_with(requests.ConnectionError("down"), requests.ConnectionError("down"))
    with pytest.raises(requests.ConnectionError):
        api.complete(41, 1, "OFFSET", [], {})
