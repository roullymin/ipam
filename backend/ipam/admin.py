from django.contrib import admin

from .models import (
    Blocklist,
    Datacenter,
    IPAddress,
    LoginLog,
    NetworkSection,
    Rack,
    RackDevice,
    ResidentDevice,
    ResidentStaff,
    Subnet,
    UserProfile,
)


admin.site.site_header = 'IP 台账管理系统'
admin.site.site_title = 'IP 台账管理后台'
admin.site.index_title = '运维管理后台'


@admin.register(NetworkSection)
class NetworkSectionAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'color_theme')
    search_fields = ('name', 'description')


@admin.register(Subnet)
class SubnetAdmin(admin.ModelAdmin):
    list_display = ('cidr', 'name', 'section', 'vlan_id', 'bandwidth', 'location')
    list_filter = ('section', 'isp', 'location')
    search_fields = ('cidr', 'name', 'circuit_id')


@admin.register(IPAddress)
class IPAddressAdmin(admin.ModelAdmin):
    list_display = ('ip_address', 'status', 'device_name', 'subnet', 'owner', 'last_online')
    list_filter = ('status', 'device_type', 'subnet__section')
    search_fields = ('ip_address', 'device_name', 'owner', 'nat_ip')
    ordering = ('ip_address',)


@admin.register(Datacenter)
class DatacenterAdmin(admin.ModelAdmin):
    list_display = ('name', 'location', 'contact_phone')
    search_fields = ('name', 'location')


@admin.register(Rack)
class RackAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'datacenter', 'height', 'power_limit')
    list_filter = ('datacenter',)
    search_fields = ('code', 'name')


@admin.register(RackDevice)
class RackDeviceAdmin(admin.ModelAdmin):
    list_display = ('name', 'rack', 'position', 'u_height', 'device_type', 'status')
    list_filter = ('rack__datacenter', 'device_type', 'status')
    search_fields = ('name', 'brand', 'sn', 'asset_tag', 'mgmt_ip')


@admin.register(LoginLog)
class LoginLogAdmin(admin.ModelAdmin):
    list_display = ('username', 'ip_address', 'action', 'status', 'timestamp')
    list_filter = ('action', 'status')
    search_fields = ('username', 'ip_address')
    ordering = ('-timestamp',)


@admin.register(Blocklist)
class BlocklistAdmin(admin.ModelAdmin):
    list_display = ('ip_address', 'reason', 'created_at')
    search_fields = ('ip_address', 'reason')
    ordering = ('-created_at',)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'role',
        'display_name',
        'department',
        'phone',
        'must_change_password',
        'failed_login_attempts',
        'locked_until',
    )
    list_filter = ('role', 'must_change_password')
    search_fields = ('user__username', 'display_name', 'department', 'phone')


class ResidentDeviceInline(admin.TabularInline):
    model = ResidentDevice
    extra = 0


@admin.register(ResidentStaff)
class ResidentStaffAdmin(admin.ModelAdmin):
    list_display = (
        'registration_code',
        'name',
        'company',
        'resident_type',
        'approval_status',
        'office_location',
        'end_date',
    )
    list_filter = ('approval_status', 'resident_type', 'needs_seat', 'office_location')
    search_fields = ('registration_code', 'name', 'company', 'phone', 'project_name')
    inlines = [ResidentDeviceInline]
