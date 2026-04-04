from datetime import timedelta


SYSTEM_OVERVIEW_CACHE = {'expires_at': None, 'payload': None}


def get_data_quality_summary(*, now, build_report, max_age_seconds=300):
    expires_at = SYSTEM_OVERVIEW_CACHE.get('expires_at')
    payload = SYSTEM_OVERVIEW_CACHE.get('payload')
    if payload is not None and expires_at and now < expires_at:
        return payload

    report = build_report(limit_per_model=1)
    payload = report['summary']
    SYSTEM_OVERVIEW_CACHE['payload'] = payload
    SYSTEM_OVERVIEW_CACHE['expires_at'] = now + timedelta(seconds=max_age_seconds)
    return payload
