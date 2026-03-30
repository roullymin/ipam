from django.db import models
from django.utils import timezone

# --- 选项常量 (与前端 Select 对应) ---
ISP_CHOICES = [
    ('CT', '中国电信 (China Telecom)'),
    ('CM', '中国移动 (China Mobile)'),
    ('CU', '中国联通 (China Unicom)'),
    ('BN', '中国广电 (Broadnet)'),
    ('GOV', '政务外网统筹线路'),
    ('CMD', '应急指挥专网'),
    ('LAN', '自建光纤 / 内部局域网'),
]

class NetworkSection(models.Model):
    """一级区域（如：运营商公网、内网、指挥网）"""
    name = models.CharField("区域名称", max_length=100)
    description = models.CharField("描述", max_length=255, blank=True)
    color_theme = models.CharField("UI颜色主题", max_length=50, default="blue") # 用于前端显示颜色

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "业务区域"
        db_table = "ipam_section"

class Subnet(models.Model):
    """二级网段 / 电路档案"""
    section = models.ForeignKey(NetworkSection, on_delete=models.CASCADE, related_name='subnets')
    name = models.CharField("网段名称", max_length=100)
    cidr = models.CharField("CIDR", max_length=50, unique=True, help_text="例: 10.128.1.0/24")
    
    # --- 核心档案字段 ---
    circuit_id = models.CharField("电路编号", max_length=100, blank=True, null=True)
    isp = models.CharField("运营商", max_length=50, choices=ISP_CHOICES, default='LAN')
    bandwidth = models.CharField("带宽容量", max_length=50, blank=True, help_text="例: 1000M")
    vlan_id = models.IntegerField("VLAN ID", blank=True, null=True)
    gateway = models.GenericIPAddressField("网关地址", blank=True, null=True)
    location = models.CharField("部署位置", max_length=100, blank=True)
    function_usage = models.CharField("主要用途", max_length=100, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.cidr} - {self.name}"

    class Meta:
        verbose_name = "网段/电路"
        db_table = "ipam_subnet"

class IPAddress(models.Model):
    """IP 资产台账"""
    STATUS_CHOICES = [
        ('online', '在线 / 正常'),
        ('offline', '离线 / 空闲'),
        ('rogue', '异常 / 私接'),
        ('reserved', '保留地址'),
    ]

    subnet = models.ForeignKey(Subnet, on_delete=models.CASCADE, related_name='ips')
    ip_address = models.GenericIPAddressField("IP地址", unique=True)
    
    # --- 资产详情 ---
    status = models.CharField("状态", max_length=20, choices=STATUS_CHOICES, default='offline')
    device_name = models.CharField("设备名称", max_length=100, blank=True)
    device_type = models.CharField("设备类型", max_length=50, blank=True) # 如: 服务器, 交换机
    owner = models.CharField("负责人/部门", max_length=100, blank=True)
    description = models.TextField("备注", blank=True)
    
    last_online = models.DateTimeField("最后在线时间", null=True, blank=True)
    
    def __str__(self):
        return self.ip_address

    class Meta:
        verbose_name = "IP资产"
        db_table = "ipam_ip_address"
        ordering = ['ip_address']
