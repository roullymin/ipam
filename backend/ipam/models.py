import secrets

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


ISP_CHOICES = [
    ('CT', '中国电信 (China Telecom)'),
    ('CM', '中国移动 (China Mobile)'),
    ('CU', '中国联通 (China Unicom)'),
    ('BN', '中国广电 (Broadnet)'),
    ('GOV', '政务外网'),
    ('CMD', '指挥专网'),
    ('LAN', '自建光纤 / 内部局域网'),
]


USER_ROLE_CHOICES = [
    ('admin', '超级管理员'),
    ('dc_operator', '机房运维'),
    ('ip_manager', 'IP 管理员'),
    ('auditor', '审计员'),
    ('guest', '访客'),
]


class Datacenter(models.Model):
    name = models.CharField('机房名称', max_length=100)
    location = models.CharField('位置 / 楼层', max_length=200, blank=True)
    contact_phone = models.CharField('值班电话', max_length=50, blank=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = '机房'
        verbose_name_plural = '机房'
        db_table = 'dcim_datacenter'


class Rack(models.Model):
    datacenter = models.ForeignKey(
        Datacenter,
        on_delete=models.CASCADE,
        related_name='racks',
        verbose_name='所属机房',
    )
    code = models.CharField('机柜编号', max_length=50)
    name = models.CharField('机柜名称', max_length=100, blank=True)
    height = models.IntegerField('高度 (U)', default=42)
    power_limit = models.IntegerField('额定功率 (W)', default=0)
    description = models.TextField('备注', blank=True)

    def __str__(self):
        return f'{self.datacenter.name} - {self.code}'

    class Meta:
        verbose_name = '机柜'
        verbose_name_plural = '机柜'
        db_table = 'dcim_rack'


class RackDevice(models.Model):
    rack = models.ForeignKey(Rack, on_delete=models.CASCADE, related_name='devices')
    name = models.CharField('设备名称', max_length=100)
    position = models.IntegerField('起始 U 位')
    u_height = models.IntegerField('占用高度 (U)', default=1)
    device_type = models.CharField('设备类型', max_length=50, default='server')
    brand = models.CharField('品牌', max_length=100, blank=True)
    mgmt_ip = models.CharField('管理 IP', max_length=100, blank=True, null=True)
    project = models.CharField('项目名称', max_length=100, blank=True)
    contact = models.CharField('负责人', max_length=100, blank=True)
    power_usage = models.IntegerField('额定功率 (W)', default=0, blank=True, null=True)
    specs = models.TextField('配置信息', blank=True)
    sn = models.CharField('序列号 (S/N)', max_length=100, blank=True, null=True)
    asset_tag = models.CharField('固定资产编号', max_length=100, blank=True)
    status = models.CharField('设备状态', max_length=50, default='active')
    purchase_date = models.DateField('采购日期', null=True, blank=True)
    warranty_date = models.DateField('维保到期日', null=True, blank=True)
    supplier = models.CharField('供应商', max_length=100, blank=True)
    os_version = models.CharField('操作系统 / 固件', max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = '机柜设备'
        verbose_name_plural = '机柜设备'
        db_table = 'dcim_rack_device'


class NetworkSection(models.Model):
    name = models.CharField('业务区域名称', max_length=100)
    description = models.CharField('描述', max_length=255, blank=True)
    color_theme = models.CharField('界面主题色', max_length=50, default='blue')

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = '业务区域'
        verbose_name_plural = '业务区域'
        db_table = 'ipam_section'


class Subnet(models.Model):
    section = models.ForeignKey(
        NetworkSection,
        on_delete=models.CASCADE,
        related_name='subnets',
        null=True,
        blank=True,
    )
    name = models.CharField('网段名称', max_length=100)
    cidr = models.CharField('CIDR', max_length=50, unique=True)
    circuit_id = models.CharField('电路编号', max_length=100, blank=True, null=True)
    isp = models.CharField('运营商', max_length=50, blank=True, default='自建光纤')
    bandwidth = models.CharField('带宽容量', max_length=50, blank=True)
    vlan_id = models.IntegerField('VLAN ID', blank=True, null=True)
    gateway = models.GenericIPAddressField('网关地址', blank=True, null=True)
    location = models.CharField('物理位置', max_length=100, blank=True)
    function_usage = models.CharField('核心用途', max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.cidr} - {self.name}'

    class Meta:
        verbose_name = '网段 / 专线'
        verbose_name_plural = '网段 / 专线'
        db_table = 'ipam_subnet'


class IPAddress(models.Model):
    NAT_TYPE_CHOICES = [
        ('none', '无'),
        ('dnat', 'DNAT (公网映射入站)'),
        ('snat', 'SNAT (内网映射出站)'),
    ]

    subnet = models.ForeignKey(Subnet, on_delete=models.CASCADE, related_name='ips', null=True, blank=True)
    ip_address = models.GenericIPAddressField('IP 地址', unique=True)
    status = models.CharField('状态', max_length=50, default='offline')
    device_name = models.CharField('设备名称', max_length=100, blank=True)
    device_type = models.CharField('设备类型', max_length=50, blank=True)
    owner = models.CharField('负责人 / 部门', max_length=100, blank=True)
    description = models.TextField('备注', blank=True)
    last_online = models.DateTimeField('最后在线时间', null=True, blank=True)
    nat_type = models.CharField('NAT 类型', max_length=20, choices=NAT_TYPE_CHOICES, default='none')
    nat_ip = models.GenericIPAddressField('映射地址', null=True, blank=True, help_text='公网 IP 或映射后的 IP')
    nat_port = models.CharField('端口映射', max_length=50, blank=True, help_text='例如：80 -> 8080')

    def __str__(self):
        return self.ip_address

    class Meta:
        verbose_name = 'IP 资产'
        verbose_name_plural = 'IP 资产'
        db_table = 'ipam_ip_address'
        ordering = ['ip_address']


class LoginLog(models.Model):
    username = models.CharField(max_length=150, blank=True, null=True)
    ip_address = models.CharField(max_length=50)
    action = models.CharField(max_length=50)
    status = models.CharField(max_length=20)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '登录审计'
        verbose_name_plural = '登录审计'
        db_table = 'security_login_log'
        ordering = ['-timestamp']


class Blocklist(models.Model):
    ip_address = models.GenericIPAddressField(unique=True)
    reason = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '黑名单'
        verbose_name_plural = '黑名单'
        db_table = 'security_blocklist'
        ordering = ['-created_at']


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField('角色', max_length=32, choices=USER_ROLE_CHOICES, default='guest')
    display_name = models.CharField('显示名称', max_length=100, blank=True)
    department = models.CharField('所属部门', max_length=100, blank=True)
    phone = models.CharField('联系电话', max_length=50, blank=True)
    title = models.CharField('岗位', max_length=100, blank=True)
    must_change_password = models.BooleanField('下次登录强制修改密码', default=False)
    failed_login_attempts = models.PositiveIntegerField('连续失败次数', default=0)
    locked_until = models.DateTimeField('锁定到', null=True, blank=True)
    last_password_changed_at = models.DateTimeField('最后修改密码时间', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.user.username} ({self.role})'

    class Meta:
        verbose_name = '用户档案'
        verbose_name_plural = '用户档案'
        db_table = 'auth_user_profile'


RESIDENT_TYPE_CHOICES = [
    ('implementation', '实施驻场'),
    ('operations', '运维值守'),
    ('vendor', '厂商支持'),
    ('visitor', '临时来访'),
]


RESIDENT_APPROVAL_STATUS_CHOICES = [
    ('pending', '待审核'),
    ('approved', '已通过'),
    ('rejected', '已驳回'),
    ('left', '已离场'),
]


RESIDENT_INTAKE_SOURCE_CHOICES = [
    ('manual', '后台录入'),
    ('qr', '扫码登记'),
]


class ResidentStaff(models.Model):
    registration_code = models.CharField('登记编号', max_length=32, unique=True, editable=False)
    company = models.CharField('所属公司', max_length=120)
    name = models.CharField('姓名', max_length=100)
    title = models.CharField('职务 / 岗位', max_length=100, blank=True)
    phone = models.CharField('联系电话', max_length=50)
    email = models.EmailField('邮箱', blank=True)
    resident_type = models.CharField(
        '驻场类型',
        max_length=32,
        choices=RESIDENT_TYPE_CHOICES,
        default='implementation',
    )
    project_name = models.CharField('所属项目', max_length=120, blank=True)
    department = models.CharField('归属部门', max_length=120, blank=True)
    needs_seat = models.BooleanField('是否需要安排座位', default=False)
    office_location = models.CharField('办公区域', max_length=120, blank=True)
    seat_number = models.CharField('座位号', max_length=50, blank=True)
    start_date = models.DateField('驻场开始日期', null=True, blank=True)
    end_date = models.DateField('驻场结束日期', null=True, blank=True)
    approval_status = models.CharField(
        '审核状态',
        max_length=20,
        choices=RESIDENT_APPROVAL_STATUS_CHOICES,
        default='pending',
    )
    reviewer_name = models.CharField('审核人', max_length=100, blank=True)
    reviewed_at = models.DateTimeField('审核时间', null=True, blank=True)
    intake_source = models.CharField(
        '录入来源',
        max_length=16,
        choices=RESIDENT_INTAKE_SOURCE_CHOICES,
        default='manual',
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_resident_staff',
        verbose_name='录入人',
    )
    remarks = models.TextField('备注', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.registration_code:
            stamp = timezone.now().strftime('%Y%m%d%H%M%S')
            self.registration_code = f'RC{stamp}{secrets.token_hex(2).upper()}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.registration_code} - {self.name}'

    class Meta:
        verbose_name = '驻场人员'
        verbose_name_plural = '驻场人员'
        db_table = 'ops_resident_staff'
        ordering = ['-created_at']


class ResidentDevice(models.Model):
    resident = models.ForeignKey(
        ResidentStaff,
        on_delete=models.CASCADE,
        related_name='devices',
        verbose_name='关联驻场人员',
    )
    device_name = models.CharField('设备名称', max_length=100, blank=True)
    serial_number = models.CharField('序列号', max_length=120, blank=True)
    brand = models.CharField('品牌', max_length=100, blank=True)
    model = models.CharField('型号', max_length=100, blank=True)
    wired_mac = models.CharField('有线网卡 MAC', max_length=50, blank=True)
    wireless_mac = models.CharField('无线网卡 MAC', max_length=50, blank=True)
    security_software_installed = models.BooleanField('已安装安全防护软件', default=False)
    os_activated = models.BooleanField('操作系统正版激活', default=False)
    vulnerabilities_patched = models.BooleanField('已修补已知漏洞', default=False)
    last_antivirus_at = models.DateField('最近杀毒日期', null=True, blank=True)
    malware_found = models.BooleanField('是否发现病毒木马', default=False)
    malware_notes = models.CharField('病毒木马情况说明', max_length=255, blank=True)
    remarks = models.TextField('备注', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.device_name or self.serial_number or f'驻场设备#{self.pk}'

    class Meta:
        verbose_name = '驻场设备备案'
        verbose_name_plural = '驻场设备备案'
        db_table = 'ops_resident_device'
        ordering = ['id']


class AuditLog(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='operation_audit_logs',
    )
    actor_name = models.CharField(max_length=150, blank=True)
    module = models.CharField(max_length=64)
    action = models.CharField(max_length=64)
    target_type = models.CharField(max_length=64, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    target_display = models.CharField(max_length=200, blank=True)
    detail = models.TextField(blank=True)
    ip_address = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.module}:{self.action}:{self.target_display or self.target_id}'

    class Meta:
        verbose_name = '操作审计'
        verbose_name_plural = '操作审计'
        db_table = 'ops_audit_log'
        ordering = ['-created_at']
