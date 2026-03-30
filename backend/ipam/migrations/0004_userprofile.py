from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('ipam', '0003_ipaddress_nat_ip_ipaddress_nat_port_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('admin', '超级管理员'), ('dc_operator', '机房运维'), ('ip_manager', 'IP 管理员'), ('auditor', '审计员'), ('guest', '访客')], default='guest', max_length=32, verbose_name='角色')),
                ('display_name', models.CharField(blank=True, max_length=100, verbose_name='显示名称')),
                ('department', models.CharField(blank=True, max_length=100, verbose_name='所属部门')),
                ('phone', models.CharField(blank=True, max_length=50, verbose_name='联系电话')),
                ('title', models.CharField(blank=True, max_length=100, verbose_name='岗位')),
                ('must_change_password', models.BooleanField(default=False, verbose_name='下次登录强制修改密码')),
                ('failed_login_attempts', models.PositiveIntegerField(default=0, verbose_name='连续失败次数')),
                ('locked_until', models.DateTimeField(blank=True, null=True, verbose_name='锁定到')),
                ('last_password_changed_at', models.DateTimeField(blank=True, null=True, verbose_name='最后修改密码时间')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='profile', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': '用户档案',
                'db_table': 'auth_user_profile',
            },
        ),
    ]
