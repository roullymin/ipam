import secrets
from datetime import timedelta

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


class ResidentIntakeLink(models.Model):
    token = models.CharField('Resident intake token', max_length=64, unique=True, editable=False)
    expires_at = models.DateTimeField('Resident intake expires at')
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_resident_intake_links',
        verbose_name='Created by',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(24)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.token

    class Meta:
        verbose_name = 'Resident intake link'
        verbose_name_plural = 'Resident intake links'
        db_table = 'ops_resident_intake_link'
        ordering = ['-created_at']


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


CHANGE_REQUEST_TYPE_CHOICES = [
    ('rack_in', '设备上架'),
    ('rack_out', '设备下架'),
    ('move_in', '设备搬入'),
    ('move_out', '设备搬出'),
    ('relocate', '位置迁移'),
    ('decommission', '设备退役'),
    ('power_change', '电力变更'),
    ('assistance', '协助事项申请'),
]


CHANGE_REQUEST_STATUS_CHOICES = [
    ('draft', '草稿'),
    ('submitted', '待审批'),
    ('approved', '已批准'),
    ('rejected', '已驳回'),
    ('scheduled', '待执行'),
    ('completed', '已完成'),
    ('cancelled', '已取消'),
]


NETWORK_ROLE_CHOICES = [
    ('none', '无需网络'),
    ('command', '指挥网'),
    ('government', '政务外网'),
    ('other', '其他'),
    ('management', '指挥网（旧值兼容）'),
    ('service', '政务外网（旧值兼容）'),
    ('dual', '双网（旧值兼容）'),
]


IP_ACTION_CHOICES = [
    ('allocate', '新分配'),
    ('keep', '保留原 IP'),
    ('change', '变更 IP'),
    ('release', '释放旧 IP'),
    ('none', '不涉及'),
]


class DatacenterChangeRequest(models.Model):
    request_code = models.CharField('申请编号', max_length=32, unique=True, editable=False)
    request_type = models.CharField('申请类型', max_length=32, choices=CHANGE_REQUEST_TYPE_CHOICES)
    status = models.CharField('状态', max_length=20, choices=CHANGE_REQUEST_STATUS_CHOICES, default='draft')
    approval_code = models.CharField('审批编号', max_length=64, blank=True)
    title = models.CharField('申请标题', max_length=200)
    applicant_name = models.CharField('申请人', max_length=100)
    applicant_phone = models.CharField('联系电话', max_length=50, blank=True)
    applicant_email = models.EmailField('联系邮箱', blank=True)
    company = models.CharField('所属单位', max_length=120, blank=True)
    department = models.CharField('所属部门', max_length=120, blank=True)
    project_name = models.CharField('所属项目', max_length=120, blank=True)
    reason = models.TextField('申请原因', blank=True)
    request_content = models.TextField('申请内容', blank=True)
    impact_scope = models.TextField('影响范围', blank=True)
    requires_power_down = models.BooleanField('是否涉及下电', default=False)
    department_comment = models.TextField('部门意见', blank=True)
    it_comment = models.TextField('信息化意见', blank=True)
    planned_execute_at = models.DateTimeField('计划执行时间', null=True, blank=True)
    review_comment = models.TextField('审批意见', blank=True)
    reviewer_name = models.CharField('审批人', max_length=100, blank=True)
    reviewed_at = models.DateTimeField('审批时间', null=True, blank=True)
    executor_name = models.CharField('执行人', max_length=100, blank=True)
    executed_at = models.DateTimeField('执行时间', null=True, blank=True)
    execution_comment = models.TextField('执行备注', blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_datacenter_change_requests',
        verbose_name='创建人',
    )
    public_token = models.CharField('公开访问令牌', max_length=64, unique=True, editable=False)
    token_expires_at = models.DateTimeField('公开链接有效期', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.request_code:
            stamp = timezone.now().strftime('%Y%m%d%H%M%S')
            self.request_code = f'DCR{stamp}{secrets.token_hex(2).upper()}'
        if not self.public_token:
            self.public_token = secrets.token_urlsafe(24)
        if not self.token_expires_at:
            self.token_expires_at = timezone.now() + timedelta(days=14)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.request_code} - {self.title}'

    class Meta:
        verbose_name = '机房设备变更申请'
        verbose_name_plural = '机房设备变更申请'
        db_table = 'ops_datacenter_change_request'
        ordering = ['-created_at']


class DatacenterChangeItem(models.Model):
    request = models.ForeignKey(
        DatacenterChangeRequest,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='所属申请',
    )
    rack_device = models.ForeignKey(
        RackDevice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='change_request_items',
        verbose_name='关联现有设备',
    )
    device_name = models.CharField('设备名称', max_length=120)
    device_model = models.CharField('设备型号', max_length=120, blank=True)
    serial_number = models.CharField('序列号', max_length=120, blank=True)
    quantity = models.PositiveIntegerField('数量', default=1)
    is_rack_mounted = models.BooleanField('是否上架', default=True)
    u_height = models.PositiveIntegerField('占用 U 数', default=1)
    power_watts = models.PositiveIntegerField('功率需求(W)', default=0)
    power_circuit = models.CharField('电力回路', max_length=120, blank=True)
    network_role = models.CharField('网络需求', max_length=20, choices=NETWORK_ROLE_CHOICES, default='none')
    ip_quantity = models.PositiveIntegerField('所需 IP 数量', default=0)
    requires_static_ip = models.BooleanField('是否需要固定 IP', default=False)
    ip_action = models.CharField('IP 动作', max_length=20, choices=IP_ACTION_CHOICES, default='allocate')
    assigned_management_ip = models.CharField('分配管理 IP', max_length=100, blank=True)
    assigned_service_ip = models.CharField('分配业务 IP', max_length=100, blank=True)
    source_datacenter = models.ForeignKey(
        Datacenter,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_change_items',
        verbose_name='源机房',
    )
    source_rack = models.ForeignKey(
        Rack,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_change_items',
        verbose_name='源机柜',
    )
    source_u_start = models.PositiveIntegerField('源起始 U 位', null=True, blank=True)
    source_u_end = models.PositiveIntegerField('源结束 U 位', null=True, blank=True)
    target_datacenter = models.ForeignKey(
        Datacenter,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='target_change_items',
        verbose_name='目标机房',
    )
    target_rack = models.ForeignKey(
        Rack,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='target_change_items',
        verbose_name='目标机柜',
    )
    target_u_start = models.PositiveIntegerField('目标起始 U 位', null=True, blank=True)
    target_u_end = models.PositiveIntegerField('目标结束 U 位', null=True, blank=True)
    notes = models.TextField('明细备注', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.device_name or f'变更设备#{self.pk}'

    class Meta:
        verbose_name = '机房设备变更明细'
        verbose_name_plural = '机房设备变更明细'
        db_table = 'ops_datacenter_change_item'
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
