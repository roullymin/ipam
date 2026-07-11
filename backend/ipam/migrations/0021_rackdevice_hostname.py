from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ipam', '0020_ansibletaskrun'),
    ]

    operations = [
        migrations.AddField(
            model_name='rackdevice',
            name='hostname',
            field=models.CharField(blank=True, default='', max_length=180, verbose_name='主机名'),
        ),
    ]
