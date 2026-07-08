import secrets

from django.conf import settings
from django.core import signing


RESIDENT_EXPORT_SALT = 'ipam.resident-export'
RESIDENT_EXPORT_MAX_AGE_SECONDS = 15 * 60


def permanent_resident_intake_allowed():
    return bool(getattr(settings, 'ALLOW_PERMANENT_RESIDENT_INTAKE', False))


def issue_resident_export_token(registration_codes):
    normalized_codes = sorted({str(code).strip() for code in registration_codes if str(code).strip()})
    return signing.dumps({'registration_codes': normalized_codes}, salt=RESIDENT_EXPORT_SALT, compress=True)


def validate_resident_export_token(token, requested_codes):
    payload = signing.loads(
        str(token or ''),
        salt=RESIDENT_EXPORT_SALT,
        max_age=RESIDENT_EXPORT_MAX_AGE_SECONDS,
    )
    allowed_codes = set(payload.get('registration_codes') or [])
    normalized_requested = {str(code).strip() for code in requested_codes if str(code).strip()}
    return bool(normalized_requested) and normalized_requested.issubset(allowed_codes)


def public_dcim_access_allowed(request):
    if not getattr(settings, 'PUBLIC_DCIM_OVERVIEW_ENABLED', False):
        return False

    expected_token = str(getattr(settings, 'PUBLIC_DCIM_ACCESS_TOKEN', '') or '').strip()
    if not expected_token:
        return False

    supplied_token = (
        request.headers.get('X-Public-Access-Token')
        or request.query_params.get('access_token')
        or ''
    )
    return secrets.compare_digest(expected_token, str(supplied_token).strip())
