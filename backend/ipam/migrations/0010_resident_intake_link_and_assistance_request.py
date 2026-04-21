from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ipam', '0009_alter_blocklist_options_alter_datacenter_options_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ResidentIntakeLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(editable=False, max_length=64, unique=True, verbose_name='Resident intake token')),
                ('expires_at', models.DateTimeField(verbose_name='Resident intake expires at')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_resident_intake_links', to=settings.AUTH_USER_MODEL, verbose_name='Created by')),
            ],
            options={
                'verbose_name': 'Resident intake link',
                'verbose_name_plural': 'Resident intake links',
                'db_table': 'ops_resident_intake_link',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddField(
            model_name='datacenterchangerequest',
            name='request_content',
            field=models.TextField(blank=True, verbose_name='申请内容'),
        ),
        migrations.AlterField(
            model_name='datacenterchangerequest',
            name='request_type',
            field=models.CharField(choices=[('rack_in', '设备上架'), ('rack_out', '设备下架'), ('move_in', '设备搬入'), ('move_out', '设备搬出'), ('relocate', '位置迁移'), ('decommission', '设备退役'), ('power_change', '电力变更'), ('assistance', '协助事项申请')], max_length=32, verbose_name='申请类型'),
        ),
    ]
