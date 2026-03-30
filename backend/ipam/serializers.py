from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import serializers

from .models import (
    AuditLog,
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


def get_prefetched_related(instance, relation_name):
    return getattr(instance, '_prefetched_objects_cache', {}).get(relation_name)


def get_or_create_profile(user):
    defaults = {'role': 'admin' if user.is_staff else 'guest'}
    profile, _ = UserProfile.objects.get_or_create(user=user, defaults=defaults)
    return profile


class RackDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = RackDevice
        fields = '__all__'


class RackSerializer(serializers.ModelSerializer):
    load = serializers.SerializerMethodField()

    class Meta:
        model = Rack
        fields = '__all__'

    def get_load(self, obj):
        if not obj.height:
            return 0
        devices = get_prefetched_related(obj, 'devices') or obj.devices.all()
        used_u = sum(device.u_height for device in devices if device.u_height)
        return min(int((used_u / obj.height) * 100), 100)


class DatacenterSerializer(serializers.ModelSerializer):
    count = serializers.SerializerMethodField()

    class Meta:
        model = Datacenter
        fields = '__all__'

    def get_count(self, obj):
        prefetched_racks = get_prefetched_related(obj, 'racks')
        if prefetched_racks is not None:
            return len(prefetched_racks)
        return obj.racks.count()


class NetworkSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = NetworkSection
        fields = '__all__'


class SubnetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subnet
        fields = '__all__'


class IPAddressSerializer(serializers.ModelSerializer):
    subnet_info = SubnetSerializer(source='subnet', read_only=True)

    class Meta:
        model = IPAddress
        fields = '__all__'


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    status_display = serializers.SerializerMethodField()
    permission_scope = serializers.SerializerMethodField()
    role = serializers.CharField(required=False, allow_blank=True)
    display_name = serializers.CharField(required=False, allow_blank=True)
    department = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    title = serializers.CharField(required=False, allow_blank=True)
    must_change_password = serializers.BooleanField(required=False)
    failed_login_attempts = serializers.IntegerField(read_only=True)
    locked_until = serializers.DateTimeField(read_only=True)
    last_password_changed_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'is_staff',
            'is_active',
            'last_login',
            'password',
            'status_display',
            'permission_scope',
            'role',
            'display_name',
            'department',
            'phone',
            'title',
            'must_change_password',
            'failed_login_attempts',
            'locked_until',
            'last_password_changed_at',
        ]

    def get_status_display(self, obj):
        return 'active' if obj.is_active else 'offline'

    def get_permission_scope(self, obj):
        profile = get_or_create_profile(obj)
        if profile.role == 'admin':
            return '完全访问'
        if profile.role == 'guest':
            return '只读访问'
        return '按角色授权'

    def to_representation(self, instance):
        data = super().to_representation(instance)
        profile = get_or_create_profile(instance)
        data['role'] = profile.role
        data['display_name'] = profile.display_name or instance.username
        data['department'] = profile.department
        data['phone'] = profile.phone
        data['title'] = profile.title
        data['must_change_password'] = profile.must_change_password
        data['failed_login_attempts'] = profile.failed_login_attempts
        data['locked_until'] = profile.locked_until
        data['last_password_changed_at'] = profile.last_password_changed_at
        return data

    def _extract_profile_data(self, validated_data):
        profile_keys = [
            'role',
            'display_name',
            'department',
            'phone',
            'title',
            'must_change_password',
        ]
        profile_data = {}
        for key in profile_keys:
            if key in validated_data:
                profile_data[key] = validated_data.pop(key)
        return profile_data

    def _apply_profile_data(self, user, profile_data, password_changed=False):
        profile = get_or_create_profile(user)
        for field, value in profile_data.items():
            setattr(profile, field, value)

        if password_changed:
            profile.last_password_changed_at = timezone.now()
            profile.failed_login_attempts = 0
            profile.locked_until = None

        if not profile.role:
            profile.role = 'admin' if user.is_staff else 'guest'

        user.is_staff = profile.role == 'admin'
        user.save(update_fields=['is_staff'])
        profile.save()

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        profile_data = self._extract_profile_data(validated_data)
        user = User(**validated_data)

        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()

        user.is_staff = profile_data.get('role') == 'admin'
        user.save()
        self._apply_profile_data(user, profile_data, password_changed=bool(password))
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        profile_data = self._extract_profile_data(validated_data)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        self._apply_profile_data(instance, profile_data, password_changed=bool(password))
        return instance


class LoginLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoginLog
        fields = '__all__'


class BlocklistSerializer(serializers.ModelSerializer):
    class Meta:
        model = Blocklist
        fields = '__all__'


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = '__all__'


class ResidentDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResidentDevice
        fields = [
            'id',
            'device_name',
            'serial_number',
            'brand',
            'model',
            'wired_mac',
            'wireless_mac',
            'security_software_installed',
            'os_activated',
            'vulnerabilities_patched',
            'last_antivirus_at',
            'malware_found',
            'malware_notes',
            'remarks',
        ]


class ResidentStaffSerializer(serializers.ModelSerializer):
    devices = ResidentDeviceSerializer(many=True, required=False)
    device_count = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = ResidentStaff
        fields = [
            'id',
            'registration_code',
            'company',
            'name',
            'title',
            'phone',
            'email',
            'resident_type',
            'project_name',
            'department',
            'needs_seat',
            'office_location',
            'seat_number',
            'start_date',
            'end_date',
            'approval_status',
            'reviewer_name',
            'reviewed_at',
            'intake_source',
            'remarks',
            'created_at',
            'updated_at',
            'devices',
            'device_count',
            'days_remaining',
        ]
        read_only_fields = [
            'registration_code',
            'reviewer_name',
            'reviewed_at',
            'created_at',
            'updated_at',
            'device_count',
            'days_remaining',
        ]

    def get_device_count(self, obj):
        prefetched_devices = get_prefetched_related(obj, 'devices')
        if prefetched_devices is not None:
            return len(prefetched_devices)
        return obj.devices.count()

    def get_days_remaining(self, obj):
        if not obj.end_date:
            return None
        delta = (obj.end_date - timezone.localdate()).days
        return delta

    def create(self, validated_data):
        devices_data = validated_data.pop('devices', [])
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data.setdefault('created_by', request.user)
        resident = ResidentStaff.objects.create(**validated_data)
        for device_data in devices_data:
            ResidentDevice.objects.create(resident=resident, **device_data)
        return resident

    def update(self, instance, validated_data):
        devices_data = validated_data.pop('devices', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if devices_data is not None:
            instance.devices.all().delete()
            for device_data in devices_data:
                ResidentDevice.objects.create(resident=instance, **device_data)

        return instance
