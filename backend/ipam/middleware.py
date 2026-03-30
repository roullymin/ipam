from django.http import HttpResponseForbidden
from .models import Blocklist

class SecurityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 1. 获取客户端 IP
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')

        # 2. 检查是否在黑名单中 (使用 exists() 高效查询)
        if Blocklist.objects.filter(ip_address=ip).exists():
            return HttpResponseForbidden(f"403 Forbidden - Your IP ({ip}) has been blocked by security policy.")

        # 3. 放行
        response = self.get_response(request)
        return response
