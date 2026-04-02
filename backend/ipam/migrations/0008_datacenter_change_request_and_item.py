from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ipam', '0007_auditlog'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DatacenterChangeRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('request_code', models.CharField(editable=False, max_length=32, unique=True, verbose_name='申请编号')),
                ('request_type', models.CharField(choices=[('rack_in', '设备上架'), ('rack_out', '设备下架'), ('move_in', '设备搬入'), ('move_out', '设备搬出'), ('relocate', '位置迁移'), ('decommission', '设备退役'), ('power_change', '电力变更')], max_length=32, verbose_name='申请类型')),
                ('status', models.CharField(choices=[('draft', '草稿'), ('submitted', '待审批'), ('approved', '已批准'), ('rejected', '已驳回'), ('scheduled', '待执行'), ('completed', '已完成'), ('cancelled', '已取消')], default='draft', max_length=20, verbose_name='状态')),
                ('approval_code', models.CharField(blank=True, max_length=64, verbose_name='审批编号')),
                ('title', models.CharField(max_length=200, verbose_name='申请标题')),
                ('applicant_name', models.CharField(max_length=100, verbose_name='申请人')),
                ('applicant_phone', models.CharField(blank=True, max_length=50, verbose_name='联系电话')),
                ('applicant_email', models.EmailField(blank=True, max_length=254, verbose_name='联系邮箱')),
                ('company', models.CharField(blank=True, max_length=120, verbose_name='所属单位')),
                ('department', models.CharField(blank=True, max_length=120, verbose_name='所属部门')),
                ('project_name', models.CharField(blank=True, max_length=120, verbose_name='所属项目')),
                ('reason', models.TextField(blank=True, verbose_name='申请原因')),
                ('impact_scope', models.TextField(blank=True, verbose_name='影响范围')),
                ('requires_power_down', models.BooleanField(default=False, verbose_name='是否涉及下电')),
                ('department_comment', models.TextField(blank=True, verbose_name='部门意见')),
                ('it_comment', models.TextField(blank=True, verbose_name='信息化意见')),
                ('planned_execute_at', models.DateTimeField(blank=True, null=True, verbose_name='计划执行时间')),
                ('review_comment', models.TextField(blank=True, verbose_name='审批意见')),
                ('reviewer_name', models.CharField(blank=True, max_length=100, verbose_name='审批人')),
                ('reviewed_at', models.DateTimeField(blank=True, null=True, verbose_name='审批时间')),
                ('executor_name', models.CharField(blank=True, max_length=100, verbose_name='执行人')),
                ('executed_at', models.DateTimeField(blank=True, null=True, verbose_name='执行时间')),
                ('execution_comment', models.TextField(blank=True, verbose_name='执行备注')),
                ('public_token', models.CharField(editable=False, max_length=64, unique=True, verbose_name='公开访问令牌')),
                ('token_expires_at', models.DateTimeField(blank=True, null=True, verbose_name='公开链接有效期')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_datacenter_change_requests', to=settings.AUTH_USER_MODEL, verbose_name='创建人')),
            ],
            options={
                'verbose_name': '机房设备变更申请',
                'verbose_name_plural': '机房设备变更申请',
                'db_table': 'ops_datacenter_change_request',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='DatacenterChangeItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('device_name', models.CharField(max_length=120, verbose_name='设备名称')),
                ('device_model', models.CharField(blank=True, max_length=120, verbose_name='设备型号')),
                ('serial_number', models.CharField(blank=True, max_length=120, verbose_name='序列号')),
                ('quantity', models.PositiveIntegerField(default=1, verbose_name='数量')),
                ('is_rack_mounted', models.BooleanField(default=True, verbose_name='是否上架')),
                ('u_height', models.PositiveIntegerField(default=1, verbose_name='占用 U 数')),
                ('power_watts', models.PositiveIntegerField(default=0, verbose_name='功率需求(W)')),
                ('power_circuit', models.CharField(blank=True, max_length=120, verbose_name='电力回路')),
                ('network_role', models.CharField(choices=[('management', '管理网络'), ('service', '业务网络'), ('dual', '双网'), ('none', '无需网络')], default='none', max_length=20, verbose_name='网络需求')),
                ('ip_quantity', models.PositiveIntegerField(default=0, verbose_name='所需 IP 数量')),
                ('requires_static_ip', models.BooleanField(default=False, verbose_name='是否需要固定 IP')),
                ('ip_action', models.CharField(choices=[('allocate', '新分配'), ('keep', '保留原 IP'), ('change', '变更 IP'), ('release', '释放旧 IP'), ('none', '不涉及')], default='allocate', max_length=20, verbose_name='IP 动作')),
                ('assigned_management_ip', models.CharField(blank=True, max_length=100, verbose_name='分配管理 IP')),
                ('assigned_service_ip', models.CharField(blank=True, max_length=100, verbose_name='分配业务 IP')),
                ('source_u_start', models.PositiveIntegerField(blank=True, null=True, verbose_name='源起始 U 位')),
                ('source_u_end', models.PositiveIntegerField(blank=True, null=True, verbose_name='源结束 U 位')),
                ('target_u_start', models.PositiveIntegerField(blank=True, null=True, verbose_name='目标起始 U 位')),
                ('target_u_end', models.PositiveIntegerField(blank=True, null=True, verbose_name='目标结束 U 位')),
                ('notes', models.TextField(blank=True, verbose_name='明细备注')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('rack_device', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='change_request_items', to='ipam.rackdevice', verbose_name='关联现有设备')),
                ('request', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='ipam.datacenterchangerequest', verbose_name='所属申请')),
                ('source_datacenter', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='source_change_items', to='ipam.datacenter', verbose_name='源机房')),
                ('source_rack', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='source_change_items', to='ipam.rack', verbose_name='源机柜')),
                ('target_datacenter', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='target_change_items', to='ipam.datacenter', verbose_name='目标机房')),
                ('target_rack', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='target_change_items', to='ipam.rack', verbose_name='目标机柜')),
            ],
            options={
                'verbose_name': '机房设备变更明细',
                'verbose_name_plural': '机房设备变更明细',
                'db_table': 'ops_datacenter_change_item',
                'ordering': ['id'],
            },
        ),
    ]
