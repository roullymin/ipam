def parse_encoding_report_limit(raw_limit, default=5, minimum=1):
    try:
        return max(int(raw_limit or default), minimum)
    except (TypeError, ValueError):
        return default


def build_encoding_report_payload(*, raw_limit, build_report):
    limit = parse_encoding_report_limit(raw_limit)
    return limit, build_report(limit_per_model=limit)
