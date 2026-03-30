from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('ipam', '0005_alter_blocklist_options_alter_datacenter_options_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='ResidentStaff',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('registration_code', models.CharField(editable=False, max_length=32, unique=True, verbose_name='登记编号')),
                ('company', models.CharField(max_length=120, verbose_name='所属公司')),
                ('name', models.CharField(max_length=100, verbose_name='姓名')),
                ('title', models.CharField(blank=True, max_length=100, verbose_name='职务 / 岗位')),
                ('phone', models.CharField(max_length=50, verbose_name='联系电话')),
                ('email', models.EmailField(blank=True, max_length=254, verbose_name='邮箱')),
                ('resident_type', models.CharField(choices=[('implementation', '实施驻场'), ('operations', '运维值守'), ('vendor', '厂商支持'), ('visitor', '临时来访')], default='implementation', max_length=32, verbose_name='驻场类型')),
                ('project_name', models.CharField(blank=True, max_length=120, verbose_name='所属项目')),
                ('department', models.CharField(blank=True, max_length=120, verbose_name='归属部门')),
                ('needs_seat', models.BooleanField(default=False, verbose_name='是否需要安排座位')),
                ('office_location', models.CharField(blank=True, max_length=120, verbose_name='办公区域')),
                ('seat_number', models.CharField(blank=True, max_length=50, verbose_name='座位号')),
                ('start_date', models.DateField(blank=True, null=True, verbose_name='驻场开始日期')),
                ('end_date', models.DateField(blank=True, null=True, verbose_name='驻场结束日期')),
                ('approval_status', models.CharField(choices=[('pending', '待审核'), ('approved', '已通过'), ('rejected', '已驳回'), ('left', '已离场')], default='pending', max_length=20, verbose_name='审核状态')),
                ('reviewer_name', models.CharField(blank=True, max_length=100, verbose_name='审核人')),
                ('reviewed_at', models.DateTimeField(blank=True, null=True, verbose_name='审核时间')),
                ('intake_source', models.CharField(choices=[('manual', '后台录入'), ('qr', '扫码登记')], default='manual', max_length=16, verbose_name='录入来源')),
                ('remarks', models.TextField(blank=True, verbose_name='备注')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_resident_staff', to=settings.AUTH_USER_MODEL, verbose_name='录入人')),
            ],
            options={
                'verbose_name': '驻场人员',
                'verbose_name_plural': '驻场人员',
                'db_table': 'ops_resident_staff',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ResidentDevice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('device_name', models.CharField(blank=True, max_length=100, verbose_name='设备名称')),
                ('serial_number', models.CharField(blank=True, max_length=120, verbose_name='序列号')),
                ('brand', models.CharField(blank=True, max_length=100, verbose_name='品牌')),
                ('model', models.CharField(blank=True, max_length=100, verbose_name='型号')),
                ('wired_mac', models.CharField(blank=True, max_length=50, verbose_name='有线网卡 MAC')),
                ('wireless_mac', models.CharField(blank=True, max_length=50, verbose_name='无线网卡 MAC')),
                ('security_software_installed', models.BooleanField(default=False, verbose_name='已安装安全防护软件')),
                ('os_activated', models.BooleanField(default=False, verbose_name='操作系统正版激活')),
                ('vulnerabilities_patched', models.BooleanField(default=False, verbose_name='已修补已知漏洞')),
                ('last_antivirus_at', models.DateField(blank=True, null=True, verbose_name='最近杀毒日期')),
                ('malware_found', models.BooleanField(default=False, verbose_name='是否发现病毒木马')),
                ('malware_notes', models.CharField(blank=True, max_length=255, verbose_name='病毒木马情况说明')),
                ('remarks', models.TextField(blank=True, verbose_name='备注')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('resident', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='devices', to='ipam.residentstaff', verbose_name='关联驻场人员')),
            ],
            options={
                'verbose_name': '驻场设备备案',
                'verbose_name_plural': '驻场设备备案',
                'db_table': 'ops_resident_device',
                'ordering': ['id'],
            },
        ),
    ]
