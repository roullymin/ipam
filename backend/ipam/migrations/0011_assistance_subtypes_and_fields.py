from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ipam', '0010_resident_intake_link_and_assistance_request'),
    ]

    operations = [
        migrations.AddField(
            model_name='datacenterchangerequest',
            name='assistance_type',
            field=models.CharField(
                blank=True,
                choices=[
                    ('general_support', '综合协助'),
                    ('rack_in', '设备上架'),
                    ('rack_out', '设备下架'),
                    ('relocate', '设备迁移'),
                    ('firewall_port_open', '防火墙访问开通'),
                    ('ip_open', 'IP 开通'),
                    ('external_terminal_access', '外来终端接入厅内网络'),
                    ('other_support', '其他协助'),
                ],
                default='other_support',
                max_length=32,
                verbose_name='协助类型',
            ),
        ),
        migrations.AddField(
            model_name='datacenterchangerequest',
            name='destination_ip',
            field=models.CharField(blank=True, max_length=120, verbose_name='目的 IP 地址'),
        ),
        migrations.AddField(
            model_name='datacenterchangerequest',
            name='destination_port',
            field=models.CharField(blank=True, max_length=120, verbose_name='目的端口'),
        ),
        migrations.AddField(
            model_name='datacenterchangerequest',
            name='firewall_open_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='端口开通时间'),
        ),
        migrations.AddField(
            model_name='datacenterchangerequest',
            name='ip_open_details',
            field=models.TextField(blank=True, verbose_name='IP 开通说明'),
        ),
        migrations.AddField(
            model_name='datacenterchangerequest',
            name='ip_open_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='IP 开通时间'),
        ),
        migrations.AddField(
            model_name='datacenterchangerequest',
            name='access_location',
            field=models.CharField(blank=True, max_length=120, verbose_name='接入位置'),
        ),
        migrations.AddField(
            model_name='datacenterchangerequest',
            name='access_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='接入时间'),
        ),
        migrations.AddField(
            model_name='datacenterchangerequest',
            name='antivirus_installed',
            field=models.BooleanField(default=False, verbose_name='已完成杀毒'),
        ),
        migrations.AddField(
            model_name='datacenterchangerequest',
            name='terminal_mac',
            field=models.CharField(blank=True, max_length=50, verbose_name='终端 MAC 地址'),
        ),
        migrations.AddField(
            model_name='datacenterchangerequest',
            name='related_links',
            field=models.TextField(blank=True, verbose_name='相关链接'),
        ),
    ]
