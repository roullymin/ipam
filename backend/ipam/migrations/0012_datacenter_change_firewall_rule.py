from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ipam', '0011_assistance_subtypes_and_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='DatacenterChangeFirewallRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('destination_ip', models.CharField(max_length=120, verbose_name='目的 IP 地址')),
                ('destination_port', models.CharField(max_length=120, verbose_name='目的端口')),
                ('purpose', models.CharField(blank=True, max_length=200, verbose_name='开通用途')),
                ('sort_order', models.PositiveIntegerField(default=0, verbose_name='排序')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'request',
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name='firewall_rules',
                        to='ipam.datacenterchangerequest',
                        verbose_name='所属申请',
                    ),
                ),
            ],
            options={
                'verbose_name': '防火墙访问规则',
                'verbose_name_plural': '防火墙访问规则',
                'db_table': 'ops_datacenter_change_firewall_rule',
                'ordering': ['sort_order', 'id'],
            },
        ),
    ]
