from django.apps import AppConfig

class IpamConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ipam'

    def ready(self):
        import ipam.signals  # 加载信号监听
