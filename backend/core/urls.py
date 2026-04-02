from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from ipam import views


router = DefaultRouter()
router.register(r'sections', views.NetworkSectionViewSet)
router.register(r'subnets', views.SubnetViewSet)
router.register(r'ips', views.IPAddressViewSet)
router.register(r'users', views.UserViewSet)
router.register(r'logs', views.LoginLogViewSet)
router.register(r'audit-logs', views.AuditLogViewSet)
router.register(r'blocklist', views.BlocklistViewSet)
router.register(r'datacenters', views.DatacenterViewSet)
router.register(r'racks', views.RackViewSet)
router.register(r'rack-devices', views.RackDeviceViewSet)
router.register(r'resident-staff', views.ResidentStaffViewSet)
router.register(r'datacenter-change-requests', views.DatacenterChangeRequestViewSet)


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),

    path('api/csrf/', views.api_csrf),
    path('api/version/', views.api_version),
    path('api/system/overview/', views.system_overview),
    path('api/me/', views.api_me),
    path('api/login/', views.api_login),
    path('api/logout/', views.api_logout),
    path('api/change-password/', views.api_change_password),
    path('api/resident-intake/', views.api_resident_intake),
    path('api/resident-intake/export-pdf/', views.api_resident_intake_export_pdf),
    path('api/public/change-requests/<str:token>/', views.public_change_request_detail),
    path('api/public/change-requests/<str:token>/export-pdf/', views.public_change_request_export_pdf),
    path('api/public/dcim-overview/', views.public_dcim_overview),

    path('api/init-dc/', views.init_datacenters),
    path('api/dcim/download-template/', views.download_dcim_template),
    path('api/dcim/export-excel/', views.export_dcim_excel),
    path('api/dcim/import-excel/preview/', views.preview_dcim_import_excel),
    path('api/dcim/import-excel/', views.import_dcim_excel),
    path('api/trigger-backup/', views.trigger_backup),
    path('api/list-backups/', views.list_backups),
    path('api/backup/summary/', views.backup_summary),
    path('api/backup/download/', views.download_backup),
    path('api/data-quality/encoding-report/', views.encoding_report),
    path('api/scan/', views.scan_subnet),
    path('api/subnets/<int:pk>/usage/', views.subnet_usage_matrix),
    path('api/export-excel/', views.export_excel),
    path('api/import-excel/preview/', views.preview_import_excel),
    path('api/import-excel/', views.import_excel),
    path('api/download-template/', views.download_template),
]
