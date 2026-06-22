import logging

from django.db import DatabaseError
from django.http import JsonResponse

from .domains.security.services import get_client_ip
from .models import Blocklist


logger = logging.getLogger('django.security')


class SecurityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == '/api/health/' and request.META.get('REMOTE_ADDR') in {'127.0.0.1', '::1'}:
            return self.get_response(request)

        ip = get_client_ip(request)
        try:
            is_blocked = ip not in {'', 'unknown'} and Blocklist.objects.filter(ip_address=ip).exists()
        except DatabaseError:
            # Database startup and migrations must not be blocked by the blocklist lookup.
            logger.warning('Blocklist lookup unavailable; request allowed.', exc_info=True)
            is_blocked = False

        if is_blocked:
            return JsonResponse({'detail': '该来源地址已被安全策略阻止。'}, status=403)

        return self.get_response(request)
