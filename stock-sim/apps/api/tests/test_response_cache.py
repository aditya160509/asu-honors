from apps.api.response_cache import ResponseCache


def test_cache_collapses_duplicate_reads():
    cache = ResponseCache(max_entries=4)
    calls = 0

    def factory():
        nonlocal calls
        calls += 1
        return {"value": calls}

    first = cache.get_or_create(("market", 1), 30, factory)
    second = cache.get_or_create(("market", 1), 30, factory)

    assert first == second == {"value": 1}
    assert calls == 1


def test_timeline_invalidation_only_removes_matching_entries():
    cache = ResponseCache(max_entries=4)
    calls = {1: 0, 2: 0}

    def build(timeline_id: int):
        calls[timeline_id] += 1
        return calls[timeline_id]

    assert cache.get_or_create(("market", 1, None), 30, lambda: build(1)) == 1
    assert cache.get_or_create(("market", 2, None), 30, lambda: build(2)) == 1

    cache.invalidate_timeline(1)

    assert cache.get_or_create(("market", 1, None), 30, lambda: build(1)) == 2
    assert cache.get_or_create(("market", 2, None), 30, lambda: build(2)) == 1
