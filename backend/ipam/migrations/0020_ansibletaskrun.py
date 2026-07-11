from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('ipam', '0019_config_backup_type_defaults'),
    ]

    operations = [
        migrations.CreateModel(
            name='AnsibleTaskRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('login_test', '登录测试'), ('readonly_probe', '只读探测'), ('inventory_provision', '纳入 Inventory'), ('facts_collect', '设备信息采集'), ('rotation_plan', '密码轮换预案')], max_length=32, verbose_name='任务类型')),
                ('status', models.CharField(choices=[('success', '成功'), ('partial', '部分成功'), ('failed', '失败')], default='success', max_length=20, verbose_name='执行状态')),
                ('total', models.PositiveIntegerField(default=0, verbose_name='目标数量')),
                ('success_count', models.PositiveIntegerField(default=0, verbose_name='成功数量')),
                ('failed_count', models.PositiveIntegerField(default=0, verbose_name='失败数量')),
                ('skipped_count', models.PositiveIntegerField(default=0, verbose_name='跳过数量')),
                ('actor_name', models.CharField(blank=True, max_length=150, verbose_name='执行人名称')),
                ('detail', models.TextField(blank=True, verbose_name='任务摘要')),
                ('results', models.JSONField(blank=True, default=list, verbose_name='执行结果')),
                ('started_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='开始时间')),
                ('finished_at', models.DateTimeField(blank=True, null=True, verbose_name='完成时间')),
                ('duration_seconds', models.PositiveIntegerField(default=0, verbose_name='耗时（秒）')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ansible_task_runs', to=settings.AUTH_USER_MODEL, verbose_name='执行人')),
            ],
            options={
                'verbose_name': 'Ansible 执行记录',
                'verbose_name_plural': 'Ansible 执行记录',
                'db_table': 'ops_ansible_task_run',
                'ordering': ['-started_at', '-id'],
            },
        ),
    ]
