from django.db import migrations, models


def set_single_version_retention(apps, schema_editor):
    ConfigBackupPolicy = apps.get_model('ipam', 'ConfigBackupPolicy')
    ConfigBackupTarget = apps.get_model('ipam', 'ConfigBackupTarget')
    ConfigBackupPolicy.objects.update(retention_count=1)
    ConfigBackupTarget.objects.update(retention_count=1)


class Migration(migrations.Migration):

    dependencies = [
        ('ipam', '0018_configbackuppolicy'),
    ]

    operations = [
        migrations.AlterField(
            model_name='configbackuppolicy',
            name='retention_count',
            field=models.PositiveSmallIntegerField(default=1, verbose_name='默认保留版本数'),
        ),
        migrations.AlterField(
            model_name='configbackuptarget',
            name='device_type',
            field=models.CharField(
                choices=[
                    ('switch_core', '核心交换机'),
                    ('switch_access', '接入交换机'),
                    ('switch', '交换机'),
                    ('router', '路由器'),
                    ('firewall', '防火墙'),
                    ('load_balancer', '负载均衡'),
                    ('waf', 'WAF'),
                    ('ids', 'IDS/IPS'),
                    ('wireless_controller', '无线控制器'),
                    ('ap', '无线 AP'),
                    ('server', '服务器'),
                    ('storage', '存储设备'),
                    ('security', '安全设备'),
                    ('video_conference', '会议/视频设备'),
                    ('gateway', '网关'),
                    ('other', '其他'),
                ],
                default='switch',
                max_length=32,
                verbose_name='设备类型',
            ),
        ),
        migrations.AlterField(
            model_name='configbackuptarget',
            name='retention_count',
            field=models.PositiveSmallIntegerField(default=1, verbose_name='保留版本数'),
        ),
        migrations.RunPython(set_single_version_retention, migrations.RunPython.noop),
    ]
