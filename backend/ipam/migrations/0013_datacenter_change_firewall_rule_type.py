from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ipam', '0012_datacenter_change_firewall_rule'),
    ]

    operations = [
        migrations.AddField(
            model_name='datacenterchangefirewallrule',
            name='rule_type',
            field=models.CharField(
                choices=[('destination', '目标访问'), ('snat', 'SNAT')],
                default='destination',
                max_length=20,
                verbose_name='规则类型',
            ),
        ),
        migrations.AlterField(
            model_name='datacenterchangefirewallrule',
            name='destination_ip',
            field=models.CharField(max_length=120, verbose_name='地址'),
        ),
        migrations.AlterField(
            model_name='datacenterchangefirewallrule',
            name='destination_port',
            field=models.CharField(max_length=120, verbose_name='端口'),
        ),
        migrations.AlterField(
            model_name='datacenterchangefirewallrule',
            name='purpose',
            field=models.CharField(blank=True, max_length=200, verbose_name='用途说明'),
        ),
    ]
