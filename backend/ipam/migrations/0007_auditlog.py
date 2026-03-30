from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('ipam', '0006_residentstaff_residentdevice'),
    ]

    operations = [
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('actor_name', models.CharField(blank=True, max_length=150)),
                ('module', models.CharField(max_length=64)),
                ('action', models.CharField(max_length=64)),
                ('target_type', models.CharField(blank=True, max_length=64)),
                ('target_id', models.CharField(blank=True, max_length=64)),
                ('target_display', models.CharField(blank=True, max_length=200)),
                ('detail', models.TextField(blank=True)),
                ('ip_address', models.CharField(blank=True, max_length=64)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'user',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='operation_audit_logs',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'verbose_name': '操作审计',
                'verbose_name_plural': '操作审计',
                'db_table': 'ops_audit_log',
                'ordering': ['-created_at'],
            },
        ),
    ]
