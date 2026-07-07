import ipaddress
import re
from datetime import timedelta
from urllib.parse import urlparse

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import serializers

from .models import (
    AuditLog,
    DatacenterChangeFirewallRule,
    Blocklist,
    ConfigBackupPolicy,
    ConfigBackupTarget,
    ConfigBackupVersion,
    DatacenterChangeItem,
    DatacenterChangeRequest,
    Datacenter,
    IPAddress,
    LoginLog,
    NetworkSection,
    Rack,
    RackDevice,
    ResidentDevice,
    ResidentIntakeLink,
    ResidentStaff,
    SecretAccessRequest,
    SecretAuditEvent,
    SecretRecord,
    Subnet,
    UserProfile,
)
from .domains.change_requests.services import build_change_request_title
from .domains.config_backup.policy import build_policy_cron_command, build_policy_cron_expression


MAC_SANITIZE_PATTERN = re.compile(r'[^0-9a-fA-F]+')


def extract_management_host(value):
    text = str(value or '').strip()
    if not text:
        return ''
    parse_target = text if '://' in text else f'//{text}'
    parsed = urlparse(parse_target)
    if parsed.hostname:
        return parsed.hostname
    return re.sub(r'^[a-z][a-z0-9+.-]*://', '', text, flags=re.IGNORECASE).split('/')[0].split(':')[0].strip()


def normalize_mac_address(value):
    text = str(value or '').strip()
    if not text:
        return ''

    normalized = MAC_SANITIZE_PATTERN.sub('', text).lower()[:12]
    if not normalized:
        return ''

    return '-'.join(normalized[index:index + 4] for index in range(0, len(normalized), 4))


def normalize_resident_device_payload(device_payload):
    payload = dict(device_payload or {})
    payload['wired_mac'] = normalize_mac_address(payload.get('wired_mac'))
    payload['wireless_mac'] = normalize_mac_address(payload.get('wireless_mac'))
    return payload


def get_prefetched_related(instance, relation_name):
    return getattr(instance, '_prefetched_objects_cache', {}).get(relation_name)


def get_or_create_profile(user):
    defaults = {'role': 'admin' if user.is_staff else 'guest'}
    profile, _ = UserProfile.objects.get_or_create(user=user, defaults=defaults)
    return profile


EQUIPMENT_ASSISTANCE_TYPES = {'rack_in', 'rack_out', 'relocate'}


def get_change_request_value(attrs, instance, field_name, default=''):
    if field_name in attrs:
        return attrs.get(field_name)
    if instance is not None:
        return getattr(instance, field_name, default)
    return default


def normalize_firewall_rules_payload(rules):
    normalized_rules = []
    for index, rule in enumerate(rules or []):
        rule_type = str((rule or {}).get('rule_type') or 'destination').strip() or 'destination'
        destination_ip = str((rule or {}).get('destination_ip') or '').strip()
        destination_port = str((rule or {}).get('destination_port') or '').strip()
        purpose = str((rule or {}).get('purpose') or '').strip()
        if not destination_ip and not destination_port and not purpose:
            continue
        normalized_rules.append(
            {
                'rule_type': rule_type if rule_type in {'destination', 'snat'} else 'destination',
                'destination_ip': destination_ip,
                'destination_port': destination_port,
                'purpose': purpose,
                'sort_order': index,
            }
        )
    return normalized_rules


def validate_assistance_request_payload(attrs, instance=None):
    request_type = get_change_request_value(attrs, instance, 'request_type', 'assistance')
    assistance_type = get_change_request_value(attrs, instance, 'assistance_type', 'other_support') or 'other_support'
    current_status = attrs.get('status') if 'status' in attrs else None
    items = attrs.get('items', None)
    errors = {}

    if 'terminal_mac' in attrs:
        attrs['terminal_mac'] = normalize_mac_address(attrs.get('terminal_mac'))

    if 'firewall_rules' in attrs:
        attrs['firewall_rules'] = normalize_firewall_rules_payload(attrs.get('firewall_rules'))

    if request_type != 'assistance':
        return attrs

    if instance is None and current_status == 'draft':
        return attrs

    if assistance_type in EQUIPMENT_ASSISTANCE_TYPES:
        current_items = items
        if current_items is None and instance is not None:
            current_items = list(instance.items.all())
        if not current_items:
            errors['items'] = ['设备上架、下架和迁移至少要填写一台设备。']

    if assistance_type == 'firewall_port_open':
        current_rules = attrs.get('firewall_rules')
        if current_rules is None:
            legacy_destination_ip = str(get_change_request_value(attrs, instance, 'destination_ip', '') or '').strip()
            legacy_destination_port = str(get_change_request_value(attrs, instance, 'destination_port', '') or '').strip()
            legacy_purpose = str(get_change_request_value(attrs, instance, 'request_content', '') or '').strip()
            if legacy_destination_ip or legacy_destination_port:
                current_rules = normalize_firewall_rules_payload(
                    [
                        {
                            'rule_type': 'destination',
                            'destination_ip': legacy_destination_ip,
                            'destination_port': legacy_destination_port,
                            'purpose': legacy_purpose,
                        }
                    ]
                )
                attrs['firewall_rules'] = current_rules
        if current_rules is None and instance is not None:
            current_rules = normalize_firewall_rules_payload(
                instance.firewall_rules.values('destination_ip', 'destination_port', 'purpose')
            )
        if not current_rules:
            errors['firewall_rules'] = ['请至少填写一条访问规则，包含类型、地址、端口和用途说明。']
        else:
            for index, rule in enumerate(current_rules):
                missing_fields = []
                if not rule.get('rule_type'):
                    missing_fields.append('规则类型')
                if not rule.get('destination_ip'):
                    missing_fields.append('地址')
                if not rule.get('destination_port'):
                    missing_fields.append('端口')
                if not rule.get('purpose'):
                    missing_fields.append('用途说明')
                if missing_fields:
                    errors.setdefault('firewall_rules', []).append(
                        f'第 {index + 1} 行请补全：{"、".join(missing_fields)}。'
                    )
        if not get_change_request_value(attrs, instance, 'firewall_open_at', None):
            errors['firewall_open_at'] = ['请填写端口开通时间。']

    if assistance_type == 'ip_open':
        if not str(get_change_request_value(attrs, instance, 'ip_open_details', '') or '').strip():
            errors['ip_open_details'] = ['请填写 IP 开通说明。']
        if not get_change_request_value(attrs, instance, 'ip_open_at', None):
            errors['ip_open_at'] = ['请填写 IP 开通时间。']

    if assistance_type == 'external_terminal_access':
        if not str(get_change_request_value(attrs, instance, 'access_location', '') or '').strip():
            errors['access_location'] = ['请填写接入位置。']
        if not get_change_request_value(attrs, instance, 'access_at', None):
            errors['access_at'] = ['请填写接入时间。']
        if not str(get_change_request_value(attrs, instance, 'terminal_mac', '') or '').strip():
            errors['terminal_mac'] = ['请填写终端 MAC 地址。']

    if errors:
        raise serializers.ValidationError(errors)

    return attrs


class RackDeviceSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        instance = self.instance
        rack = attrs.get('rack') or (instance.rack if instance else None)
        position = attrs.get('position', instance.position if instance else 1)
        u_height = attrs.get('u_height', instance.u_height if instance else 1)

        if not rack:
            raise serializers.ValidationError({'rack': ['必须选择所属机柜。']})
        if position < 1 or u_height < 1:
            raise serializers.ValidationError({'position': ['U 位和占用高度必须大于 0。']})

        range_start = position - u_height + 1
        if position > rack.height or range_start < 1:
            raise serializers.ValidationError(
                {'position': [f'设备占用范围必须位于机柜 1U 至 {rack.height}U 之间。']}
            )

        occupied = RackDevice.objects.filter(rack=rack)
        if instance:
            occupied = occupied.exclude(pk=instance.pk)
        for device in occupied.only('id', 'name', 'position', 'u_height'):
            other_start = device.position - max(device.u_height, 1) + 1
            if range_start <= device.position and position >= other_start:
                raise serializers.ValidationError(
                    {'position': [f'该 U 位范围与设备“{device.name}”重叠。']}
                )

        return attrs

    class Meta:
        model = RackDevice
        fields = '__all__'


class RackSerializer(serializers.ModelSerializer):
    load = serializers.SerializerMethodField()

    class Meta:
        model = Rack
        fields = '__all__'

    def validate(self, attrs):
        instance = self.instance
        datacenter = attrs.get('datacenter') or (instance.datacenter if instance else None)
        code = str(attrs.get('code', instance.code if instance else '') or '').strip()
        if datacenter and code:
            duplicates = Rack.objects.filter(datacenter=datacenter, code__iexact=code)
            if instance:
                duplicates = duplicates.exclude(pk=instance.pk)
            if duplicates.exists():
                raise serializers.ValidationError({'code': ['同一机房内的机柜编号不能重复。']})
        return attrs

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

    def validate(self, attrs):
        instance = self.instance
        address_value = attrs.get('ip_address', instance.ip_address if instance else None)
        subnet = attrs.get('subnet', instance.subnet if instance else None)
        is_locked = attrs.get('is_locked', instance.is_locked if instance else False)

        if subnet and address_value:
            try:
                network = ipaddress.ip_network(subnet.cidr, strict=False)
                address = ipaddress.ip_address(address_value)
            except ValueError:
                raise serializers.ValidationError({'ip_address': ['IP 地址或所属网段格式无效。']})
            if address not in network:
                raise serializers.ValidationError({'ip_address': [f'该地址不属于网段 {subnet.cidr}。']})

        if is_locked:
            attrs['status'] = 'online'
        return attrs


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


class SecretRecordSerializer(serializers.ModelSerializer):
    secret_username = serializers.CharField(write_only=True, required=False, allow_blank=True)
    secret_value = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=False,
        trim_whitespace=False,
        style={'input_type': 'password'},
    )
    target_display = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    lifecycle_status = serializers.SerializerMethodField()

    class Meta:
        model = SecretRecord
        fields = '__all__'
        read_only_fields = [
            'vault_path',
            'username_hint',
            'created_by',
            'created_at',
            'updated_at',
            'last_rotated_at',
        ]

    def validate(self, attrs):
        instance = self.instance
        secret_value = attrs.get('secret_value')
        secret_username = attrs.get('secret_username')
        if instance is None and not secret_value:
            raise serializers.ValidationError({'secret_value': ['首次创建必须填写密码或密钥。']})
        if instance is not None and secret_username is not None and secret_value is None:
            raise serializers.ValidationError({'secret_value': ['修改账号时必须同时填写新的密码或密钥。']})

        target_type = attrs.get('target_type', instance.target_type if instance else 'general')
        target_fields = {
            'datacenter': 'datacenter',
            'rack': 'rack',
            'device': 'rack_device',
            'ip': 'ip_address',
        }
        required_field = target_fields.get(target_type)
        if required_field and not attrs.get(required_field, getattr(instance, required_field, None) if instance else None):
            raise serializers.ValidationError({required_field: ['请选择关联对象。']})

        for field_name in target_fields.values():
            if field_name != required_field:
                attrs[field_name] = None
        return attrs

    def create(self, validated_data):
        username = validated_data.pop('secret_username', '')
        secret_value = validated_data.pop('secret_value')
        if username:
            validated_data['username_hint'] = username
        instance = super().create(validated_data)
        instance._pending_secret_payload = {'username': username, 'secret_value': secret_value}
        return instance

    def update(self, instance, validated_data):
        username = validated_data.pop('secret_username', None)
        secret_value = validated_data.pop('secret_value', None)
        if username is not None:
            validated_data['username_hint'] = username
        instance = super().update(instance, validated_data)
        if secret_value is not None:
            instance._pending_secret_payload = {
                'username': username if username is not None else instance.username_hint,
                'secret_value': secret_value,
            }
        return instance

    def get_target_display(self, obj):
        if obj.target_type == 'datacenter' and obj.datacenter:
            return obj.datacenter.name
        if obj.target_type == 'rack' and obj.rack:
            return f'{obj.rack.datacenter.name} / {obj.rack.code}'
        if obj.target_type == 'device' and obj.rack_device:
            return f'{obj.rack_device.rack.datacenter.name} / {obj.rack_device.rack.code} / {obj.rack_device.name}'
        if obj.target_type == 'ip' and obj.ip_address:
            return obj.ip_address.ip_address
        return '通用凭据'

    def get_lifecycle_status(self, obj):
        if obj.status == 'disabled':
            return 'disabled'
        if obj.expires_at and obj.expires_at <= timezone.now():
            return 'expired'
        if obj.expires_at and obj.expires_at <= timezone.now() + timedelta(days=14):
            return 'expiring'
        return 'active'

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data.pop('vault_path', None)
        return data


class SecretAccessRequestSerializer(serializers.ModelSerializer):
    secret_name = serializers.CharField(source='secret.name', read_only=True)
    requester_name = serializers.CharField(source='requester.username', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.username', read_only=True)

    class Meta:
        model = SecretAccessRequest
        fields = '__all__'
        read_only_fields = [
            'secret',
            'requester',
            'status',
            'reviewed_by',
            'reviewed_at',
            'review_comment',
            'approved_expires_at',
            'used_at',
            'created_at',
        ]


class SecretAuditEventSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = SecretAuditEvent
        fields = '__all__'


class ConfigBackupVersionSerializer(serializers.ModelSerializer):
    target_name = serializers.CharField(source='target.name', read_only=True)
    management_ip = serializers.CharField(source='target.management_ip', read_only=True)
    name = serializers.CharField(source='filename', read_only=True)
    size = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()
    time_iso = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = ConfigBackupVersion
        fields = [
            'id',
            'target',
            'target_name',
            'management_ip',
            'name',
            'filename',
            'relative_path',
            'bytes',
            'size',
            'sha256',
            'status',
            'status_label',
            'started_at',
            'finished_at',
            'time',
            'time_iso',
            'duration_seconds',
            'command_profile',
            'error_message',
            'created_at',
        ]
        read_only_fields = [
            'target',
            'status',
            'filename',
            'relative_path',
            'bytes',
            'sha256',
            'started_at',
            'finished_at',
            'duration_seconds',
            'command_profile',
            'error_message',
            'created_at',
        ]

    @staticmethod
    def _format_bytes(size):
        value = int(size or 0)
        if value < 1024:
            return f'{value} B'
        if value < 1024 * 1024:
            return f'{value / 1024:.1f} KB'
        if value < 1024 * 1024 * 1024:
            return f'{value / 1024 / 1024:.2f} MB'
        return f'{value / 1024 / 1024 / 1024:.2f} GB'

    @staticmethod
    def _display_moment(obj):
        return obj.finished_at or obj.started_at

    def get_size(self, obj):
        return self._format_bytes(obj.bytes)

    def get_time(self, obj):
        moment = self._display_moment(obj)
        return timezone.localtime(moment).strftime('%Y-%m-%d %H:%M') if moment else ''

    def get_time_iso(self, obj):
        moment = self._display_moment(obj)
        return timezone.localtime(moment).isoformat() if moment else ''

    def get_status_label(self, obj):
        return {'success': '成功', 'failed': '失败'}.get(obj.status, obj.status)


class ConfigBackupTargetSerializer(serializers.ModelSerializer):
    rack_device_name = serializers.CharField(source='rack_device.name', read_only=True)
    ip_asset_display = serializers.CharField(source='ip_address.ip_address', read_only=True)
    credential_name = serializers.CharField(source='credential.name', read_only=True)
    credential_username_hint = serializers.CharField(source='credential.username_hint', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    datacenter_name = serializers.SerializerMethodField()
    rack_code = serializers.SerializerMethodField()
    location_label = serializers.SerializerMethodField()
    version_count = serializers.SerializerMethodField()
    latest_version = serializers.SerializerMethodField()

    class Meta:
        model = ConfigBackupTarget
        fields = '__all__'
        read_only_fields = [
            'last_status',
            'last_error',
            'last_backup_at',
            'last_duration_seconds',
            'created_by',
            'created_at',
            'updated_at',
        ]

    def to_internal_value(self, data):
        if isinstance(data, dict) and 'management_ip' in data:
            data = data.copy()
            data['management_ip'] = extract_management_host(data.get('management_ip'))
        return super().to_internal_value(data)

    def validate(self, attrs):
        instance = self.instance
        rack_device = attrs.get('rack_device', instance.rack_device if instance else None)
        ip_address = attrs.get('ip_address', instance.ip_address if instance else None)
        management_ip = attrs.get('management_ip', instance.management_ip if instance else '')
        if 'management_ip' in attrs:
            attrs['management_ip'] = extract_management_host(attrs.get('management_ip'))
            management_ip = attrs['management_ip']

        if not management_ip and rack_device and rack_device.mgmt_ip:
            attrs['management_ip'] = extract_management_host(rack_device.mgmt_ip)
        if not management_ip and ip_address:
            attrs['management_ip'] = extract_management_host(ip_address.ip_address)
        if not attrs.get('management_ip', management_ip):
            raise serializers.ValidationError({'management_ip': ['必须提供管理 IP。']})

        ssh_port = attrs.get('ssh_port', instance.ssh_port if instance else 22)
        timeout_seconds = attrs.get('timeout_seconds', instance.timeout_seconds if instance else 30)
        retention_count = attrs.get('retention_count', instance.retention_count if instance else 1)
        try:
            ssh_port_value = int(ssh_port)
            timeout_seconds_value = int(timeout_seconds)
            retention_count_value = int(retention_count)
        except (TypeError, ValueError):
            raise serializers.ValidationError({'ssh_port': ['端口、超时时间和保留版本数必须是数字。']})
        if not (1 <= ssh_port_value <= 65535):
            raise serializers.ValidationError({'ssh_port': ['SSH 端口必须在 1-65535 之间。']})
        if not (5 <= timeout_seconds_value <= 600):
            raise serializers.ValidationError({'timeout_seconds': ['超时时间必须在 5-600 秒之间。']})
        if not (1 <= retention_count_value <= 200):
            raise serializers.ValidationError({'retention_count': ['保留版本数必须在 1-200 之间。']})

        if not attrs.get('name') and instance is None:
            attrs['name'] = rack_device.name if rack_device else (ip_address.device_name if ip_address else attrs['management_ip'])

        return attrs

    def get_version_count(self, obj):
        prefetched_versions = get_prefetched_related(obj, 'versions')
        if prefetched_versions is not None:
            return len(prefetched_versions)
        return obj.versions.count()

    def get_latest_version(self, obj):
        latest = obj.versions.order_by('-started_at', '-id').first()
        return ConfigBackupVersionSerializer(latest).data if latest else None

    def get_datacenter_name(self, obj):
        if obj.rack_device and obj.rack_device.rack and obj.rack_device.rack.datacenter:
            return obj.rack_device.rack.datacenter.name
        return ''

    def get_rack_code(self, obj):
        if obj.rack_device and obj.rack_device.rack:
            return obj.rack_device.rack.code
        return ''

    def get_location_label(self, obj):
        if obj.rack_device and obj.rack_device.rack and obj.rack_device.rack.datacenter:
            return f'{obj.rack_device.rack.datacenter.name} / {obj.rack_device.rack.code} / {obj.rack_device.name}'
        if obj.ip_address:
            return obj.ip_address.ip_address
        return ''


class ConfigBackupPolicySerializer(serializers.ModelSerializer):
    cron_expression = serializers.SerializerMethodField()
    cron_command = serializers.SerializerMethodField()
    schedule_frequency_label = serializers.CharField(source='get_schedule_frequency_display', read_only=True)
    execution_strategy_label = serializers.CharField(source='get_execution_strategy_display', read_only=True)
    last_run_status_label = serializers.CharField(source='get_last_run_status_display', read_only=True)

    class Meta:
        model = ConfigBackupPolicy
        fields = '__all__'
        read_only_fields = [
            'last_run_at',
            'last_run_status',
            'last_run_message',
            'created_at',
            'updated_at',
        ]

    def validate(self, attrs):
        retention_count = attrs.get('retention_count', self.instance.retention_count if self.instance else 1)
        try:
            retention_count_value = int(retention_count)
        except (TypeError, ValueError):
            raise serializers.ValidationError({'retention_count': ['保留版本数必须是数字。']})
        if not (1 <= retention_count_value <= 200):
            raise serializers.ValidationError({'retention_count': ['保留版本数必须在 1-200 之间。']})
        email_recipients = attrs.get('email_recipients', self.instance.email_recipients if self.instance else '')
        if attrs.get('email_enabled', self.instance.email_enabled if self.instance else False) and not str(email_recipients or '').strip():
            raise serializers.ValidationError({'email_recipients': ['启用邮件通知时必须填写收件人。']})
        return attrs

    def get_cron_expression(self, obj):
        return build_policy_cron_expression(obj)

    def get_cron_command(self, obj):
        return build_policy_cron_command(obj)


class ResidentDeviceSerializer(serializers.ModelSerializer):
    def validate_wired_mac(self, value):
        return normalize_mac_address(value)

    def validate_wireless_mac(self, value):
        return normalize_mac_address(value)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['wired_mac'] = normalize_mac_address(data.get('wired_mac'))
        data['wireless_mac'] = normalize_mac_address(data.get('wireless_mac'))
        return data

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
            ResidentDevice.objects.create(
                resident=resident,
                **normalize_resident_device_payload(device_data),
            )
        return resident

    def update(self, instance, validated_data):
        devices_data = validated_data.pop('devices', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if devices_data is not None:
            instance.devices.all().delete()
            for device_data in devices_data:
                ResidentDevice.objects.create(
                    resident=instance,
                    **normalize_resident_device_payload(device_data),
                )

        return instance


class DatacenterChangeItemSerializer(serializers.ModelSerializer):
    source_datacenter_name = serializers.CharField(source='source_datacenter.name', read_only=True)
    source_rack_code = serializers.CharField(source='source_rack.code', read_only=True)
    target_datacenter_name = serializers.CharField(source='target_datacenter.name', read_only=True)
    target_rack_code = serializers.CharField(source='target_rack.code', read_only=True)

    class Meta:
        model = DatacenterChangeItem
        fields = [
            'id',
            'rack_device',
            'device_name',
            'device_model',
            'serial_number',
            'quantity',
            'is_rack_mounted',
            'u_height',
            'power_watts',
            'power_circuit',
            'network_role',
            'ip_quantity',
            'requires_static_ip',
            'ip_action',
            'assigned_management_ip',
            'assigned_service_ip',
            'source_datacenter',
            'source_datacenter_name',
            'source_rack',
            'source_rack_code',
            'source_u_start',
            'source_u_end',
            'target_datacenter',
            'target_datacenter_name',
            'target_rack',
            'target_rack_code',
            'target_u_start',
            'target_u_end',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']
        extra_kwargs = {
            'device_name': {'required': False, 'allow_blank': True},
            'device_model': {'required': False, 'allow_blank': True},
            'serial_number': {'required': False, 'allow_blank': True},
            'power_circuit': {'required': False, 'allow_blank': True},
            'assigned_management_ip': {'required': False, 'allow_blank': True},
            'assigned_service_ip': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
            'source_datacenter': {'required': False, 'allow_null': True},
            'source_rack': {'required': False, 'allow_null': True},
            'target_datacenter': {'required': False, 'allow_null': True},
            'target_rack': {'required': False, 'allow_null': True},
            'source_u_start': {'required': False, 'allow_null': True},
            'source_u_end': {'required': False, 'allow_null': True},
            'target_u_start': {'required': False, 'allow_null': True},
            'target_u_end': {'required': False, 'allow_null': True},
        }


class DatacenterChangeFirewallRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatacenterChangeFirewallRule
        fields = [
            'id',
            'rule_type',
            'destination_ip',
            'destination_port',
            'purpose',
            'sort_order',
        ]
        read_only_fields = ['id', 'sort_order']
        extra_kwargs = {
            'rule_type': {'required': False, 'allow_blank': False},
            'destination_ip': {'required': False, 'allow_blank': True},
            'destination_port': {'required': False, 'allow_blank': True},
            'purpose': {'required': False, 'allow_blank': True},
        }


class DatacenterChangeRequestSerializer(serializers.ModelSerializer):
    items = DatacenterChangeItemSerializer(many=True, required=False)
    firewall_rules = DatacenterChangeFirewallRuleSerializer(many=True, required=False)
    item_count = serializers.SerializerMethodField()
    public_link = serializers.SerializerMethodField()

    class Meta:
        model = DatacenterChangeRequest
        fields = [
            'id',
            'request_code',
            'request_type',
            'status',
            'approval_code',
            'title',
            'applicant_name',
            'applicant_phone',
            'applicant_email',
            'company',
            'department',
            'project_name',
            'assistance_type',
            'reason',
            'request_content',
            'destination_ip',
            'destination_port',
            'firewall_open_at',
            'firewall_rules',
            'ip_open_details',
            'ip_open_at',
            'access_location',
            'access_at',
            'antivirus_installed',
            'terminal_mac',
            'related_links',
            'impact_scope',
            'requires_power_down',
            'department_comment',
            'it_comment',
            'planned_execute_at',
            'review_comment',
            'reviewer_name',
            'reviewed_at',
            'executor_name',
            'executed_at',
            'execution_comment',
            'public_token',
            'token_expires_at',
            'created_at',
            'updated_at',
            'items',
            'item_count',
            'public_link',
        ]
        read_only_fields = [
            'request_code',
            'reviewer_name',
            'reviewed_at',
            'public_token',
            'token_expires_at',
            'created_at',
            'updated_at',
            'item_count',
            'public_link',
        ]
        extra_kwargs = {
            'title': {'required': False, 'allow_blank': True},
            'applicant_name': {'required': False, 'allow_blank': True},
            'applicant_phone': {'required': False, 'allow_blank': True},
            'applicant_email': {'required': False, 'allow_blank': True},
            'company': {'required': False, 'allow_blank': True},
            'department': {'required': False, 'allow_blank': True},
            'project_name': {'required': False, 'allow_blank': True},
            'assistance_type': {'required': False, 'allow_blank': True},
            'reason': {'required': False, 'allow_blank': True},
            'request_content': {'required': False, 'allow_blank': True},
            'destination_ip': {'required': False, 'allow_blank': True},
            'destination_port': {'required': False, 'allow_blank': True},
            'ip_open_details': {'required': False, 'allow_blank': True},
            'access_location': {'required': False, 'allow_blank': True},
            'terminal_mac': {'required': False, 'allow_blank': True},
            'related_links': {'required': False, 'allow_blank': True},
            'impact_scope': {'required': False, 'allow_blank': True},
            'department_comment': {'required': False, 'allow_blank': True},
            'it_comment': {'required': False, 'allow_blank': True},
            'review_comment': {'required': False, 'allow_blank': True},
            'execution_comment': {'required': False, 'allow_blank': True},
        }

    def validate(self, attrs):
        return validate_assistance_request_payload(attrs, instance=self.instance)

    def get_item_count(self, obj):
        prefetched_items = get_prefetched_related(obj, 'items')
        if prefetched_items is not None:
            return len(prefetched_items)
        return obj.items.count()

    def get_public_link(self, obj):
        request = self.context.get('request')
        path = f'/?change-request-intake=1&token={obj.public_token}'
        return request.build_absolute_uri(path) if request else path

    def _build_default_title(self, validated_data, items_data):
        explicit_title = (validated_data.get('title') or '').strip()
        if explicit_title:
            return explicit_title
        request_type = validated_data.get('request_type') or 'change'
        request_type_label = dict(DatacenterChangeRequest._meta.get_field('request_type').choices).get(request_type, request_type)
        first_item = items_data[0] if items_data else {}
        device_name = (first_item.get('device_name') or '').strip()
        return f'{request_type_label}申请{f" - {device_name}" if device_name else ""}'

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        firewall_rules_data = validated_data.pop('firewall_rules', [])
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data.setdefault('created_by', request.user)
        validated_data['title'] = build_change_request_title(
            validated_data,
            items_data,
            DatacenterChangeRequest._meta.get_field('request_type').choices,
        )
        change_request = DatacenterChangeRequest.objects.create(**validated_data)
        for item_data in items_data:
            DatacenterChangeItem.objects.create(request=change_request, **item_data)
        for rule_data in firewall_rules_data:
            DatacenterChangeFirewallRule.objects.create(request=change_request, **rule_data)
        return change_request

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        firewall_rules_data = validated_data.pop('firewall_rules', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if not instance.title:
            instance.title = build_change_request_title(
                {'request_type': instance.request_type, 'title': instance.title},
                items_data if items_data is not None else list(instance.items.values('device_name')[:1]),
                DatacenterChangeRequest._meta.get_field('request_type').choices,
            )
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                DatacenterChangeItem.objects.create(request=instance, **item_data)
        if firewall_rules_data is not None:
            instance.firewall_rules.all().delete()
            for rule_data in firewall_rules_data:
                DatacenterChangeFirewallRule.objects.create(request=instance, **rule_data)

        return instance


class DatacenterChangeRequestPublicSerializer(serializers.ModelSerializer):
    items = DatacenterChangeItemSerializer(many=True, read_only=True)
    firewall_rules = DatacenterChangeFirewallRuleSerializer(many=True, read_only=True)
    public_export_url = serializers.SerializerMethodField()

    class Meta:
        model = DatacenterChangeRequest
        fields = [
            'request_code',
            'request_type',
            'status',
            'title',
            'applicant_name',
            'applicant_phone',
            'applicant_email',
            'company',
            'department',
            'project_name',
            'assistance_type',
            'reason',
            'request_content',
            'destination_ip',
            'destination_port',
            'firewall_open_at',
            'firewall_rules',
            'ip_open_details',
            'ip_open_at',
            'access_location',
            'access_at',
            'antivirus_installed',
            'terminal_mac',
            'related_links',
            'impact_scope',
            'requires_power_down',
            'planned_execute_at',
            'token_expires_at',
            'public_export_url',
            'items',
        ]

    def get_public_export_url(self, obj):
        request = self.context.get('request')
        path = f'/api/public/change-requests/{obj.public_token}/export-pdf/'
        return request.build_absolute_uri(path) if request else path


class DatacenterChangeRequestPublicSubmitSerializer(serializers.ModelSerializer):
    items = DatacenterChangeItemSerializer(many=True, required=False)
    firewall_rules = DatacenterChangeFirewallRuleSerializer(many=True, required=False)

    class Meta:
        model = DatacenterChangeRequest
        fields = [
            'request_type',
            'title',
            'applicant_name',
            'applicant_phone',
            'applicant_email',
            'company',
            'department',
            'project_name',
            'assistance_type',
            'reason',
            'request_content',
            'destination_ip',
            'destination_port',
            'firewall_open_at',
            'firewall_rules',
            'ip_open_details',
            'ip_open_at',
            'access_location',
            'access_at',
            'antivirus_installed',
            'terminal_mac',
            'related_links',
            'impact_scope',
            'requires_power_down',
            'planned_execute_at',
            'items',
        ]
        extra_kwargs = {
            'title': {'required': False, 'allow_blank': True},
            'applicant_name': {'required': False, 'allow_blank': True},
            'applicant_phone': {'required': False, 'allow_blank': True},
            'applicant_email': {'required': False, 'allow_blank': True},
            'request_type': {'required': False},
            'company': {'required': False, 'allow_blank': True},
            'department': {'required': False, 'allow_blank': True},
            'project_name': {'required': False, 'allow_blank': True},
            'assistance_type': {'required': False, 'allow_blank': True},
            'reason': {'required': False, 'allow_blank': True},
            'request_content': {'required': False, 'allow_blank': True},
            'destination_ip': {'required': False, 'allow_blank': True},
            'destination_port': {'required': False, 'allow_blank': True},
            'ip_open_details': {'required': False, 'allow_blank': True},
            'access_location': {'required': False, 'allow_blank': True},
            'terminal_mac': {'required': False, 'allow_blank': True},
            'related_links': {'required': False, 'allow_blank': True},
            'impact_scope': {'required': False, 'allow_blank': True},
        }

    def validate(self, attrs):
        return validate_assistance_request_payload(attrs, instance=self.instance)

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        firewall_rules_data = validated_data.pop('firewall_rules', [])
        validated_data.setdefault('request_type', 'assistance')
        validated_data['status'] = 'submitted'
        validated_data['title'] = build_change_request_title(
            validated_data,
            items_data,
            DatacenterChangeRequest._meta.get_field('request_type').choices,
        )
        change_request = DatacenterChangeRequest.objects.create(**validated_data)
        for item_data in items_data:
            DatacenterChangeItem.objects.create(request=change_request, **item_data)
        for rule_data in firewall_rules_data:
            DatacenterChangeFirewallRule.objects.create(request=change_request, **rule_data)
        return change_request

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        firewall_rules_data = validated_data.pop('firewall_rules', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if instance.status == 'draft':
            instance.status = 'submitted'
        if not instance.title:
            instance.title = build_change_request_title(
                {'request_type': instance.request_type, 'title': instance.title},
                items_data if items_data is not None else list(instance.items.values('device_name')[:1]),
                DatacenterChangeRequest._meta.get_field('request_type').choices,
            )
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                DatacenterChangeItem.objects.create(request=instance, **item_data)
        if firewall_rules_data is not None:
            instance.firewall_rules.all().delete()
            for rule_data in firewall_rules_data:
                DatacenterChangeFirewallRule.objects.create(request=instance, **rule_data)

        return instance


class ResidentIntakeLinkSerializer(serializers.ModelSerializer):
    intake_url = serializers.SerializerMethodField()

    class Meta:
        model = ResidentIntakeLink
        fields = ['token', 'expires_at', 'created_at', 'intake_url']

    def get_intake_url(self, obj):
        request = self.context.get('request')
        path = f'/?resident-intake=1&token={obj.token}'
        return request.build_absolute_uri(path) if request else path
