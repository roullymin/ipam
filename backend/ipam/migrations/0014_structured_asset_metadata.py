import json
import inspect
import re

from django.db import migrations, models


TAG_PATTERN = re.compile(r'__TAG__:(.*)$', re.MULTILINE)
LOCK_PATTERN = re.compile(r'__LOCKED__:(true|false)', re.MULTILINE)
PDU_PATTERN = re.compile(r'__PDU_META__:({.*})$', re.MULTILINE)
DEVICE_PATTERN = re.compile(r'__META__:({.*})$', re.MULTILINE)


_CHECK_CONSTRAINT_KWARG = (
    'condition'
    if 'condition' in inspect.signature(models.CheckConstraint).parameters
    else 'check'
)


def check_constraint(condition, name):
    return models.CheckConstraint(**{_CHECK_CONSTRAINT_KWARG: condition}, name=name)


def migrate_hidden_metadata(apps, schema_editor):
    IPAddress = apps.get_model('ipam', 'IPAddress')
    Rack = apps.get_model('ipam', 'Rack')
    RackDevice = apps.get_model('ipam', 'RackDevice')

    for address in IPAddress.objects.all().iterator():
        description = address.description or ''
        tag_match = TAG_PATTERN.search(description)
        lock_match = LOCK_PATTERN.search(description)
        address.tag = tag_match.group(1).strip()[:64] if tag_match else ''
        address.is_locked = bool(lock_match and lock_match.group(1) == 'true')
        address.description = LOCK_PATTERN.sub('', TAG_PATTERN.sub('', description)).strip()
        address.save(update_fields=['tag', 'is_locked', 'description'])

    for rack in Rack.objects.all().iterator():
        description = rack.description or ''
        match = PDU_PATTERN.search(description)
        if match:
            try:
                metadata = json.loads(match.group(1))
            except (TypeError, ValueError):
                metadata = {}
            rack.pdu_count = max(0, int(metadata.get('count') or 2))
            rack.pdu_power = max(0, int(metadata.get('power') or 0))
            rack.description = PDU_PATTERN.sub('', description).strip()
        rack.height = max(1, int(rack.height or 42))
        rack.power_limit = max(0, int(rack.power_limit or 0))
        rack.save(update_fields=['pdu_count', 'pdu_power', 'description', 'height', 'power_limit'])

    for device in RackDevice.objects.all().iterator():
        specs = device.specs or ''
        match = DEVICE_PATTERN.search(specs)
        if match:
            try:
                metadata = json.loads(match.group(1))
            except (TypeError, ValueError):
                metadata = {}
            device.model = str(metadata.get('model') or '')[:100]
            device.typical_power = max(0, int(metadata.get('typical_power') or 0))
            device.specs = DEVICE_PATTERN.sub('', specs).strip()
        device.position = max(1, int(device.position or 1))
        device.u_height = max(1, int(device.u_height or 1))
        device.power_usage = max(0, int(device.power_usage or 0))
        device.save(
            update_fields=[
                'model',
                'typical_power',
                'specs',
                'position',
                'u_height',
                'power_usage',
            ]
        )


def restore_hidden_metadata(apps, schema_editor):
    IPAddress = apps.get_model('ipam', 'IPAddress')
    Rack = apps.get_model('ipam', 'Rack')
    RackDevice = apps.get_model('ipam', 'RackDevice')

    for address in IPAddress.objects.all().iterator():
        metadata = []
        if address.tag:
            metadata.append(f'__TAG__:{address.tag}')
        if address.is_locked:
            metadata.append('__LOCKED__:true')
        address.description = '\n'.join(filter(None, [address.description, *metadata])).strip()
        address.save(update_fields=['description'])

    for rack in Rack.objects.all().iterator():
        metadata = json.dumps(
            {'count': rack.pdu_count, 'power': rack.pdu_power},
            ensure_ascii=False,
        )
        rack.description = '\n'.join(filter(None, [rack.description, f'__PDU_META__:{metadata}'])).strip()
        rack.save(update_fields=['description'])

    for device in RackDevice.objects.all().iterator():
        metadata = json.dumps(
            {'model': device.model, 'typical_power': device.typical_power},
            ensure_ascii=False,
        )
        device.specs = '\n'.join(filter(None, [device.specs, f'__META__:{metadata}'])).strip()
        device.save(update_fields=['specs'])


class Migration(migrations.Migration):
    dependencies = [
        ('ipam', '0013_datacenter_change_firewall_rule_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='ipaddress',
            name='is_locked',
            field=models.BooleanField(default=False, verbose_name='锁定地址'),
        ),
        migrations.AddField(
            model_name='ipaddress',
            name='tag',
            field=models.CharField(blank=True, db_index=True, max_length=64, verbose_name='标签'),
        ),
        migrations.AddField(
            model_name='rack',
            name='pdu_count',
            field=models.PositiveSmallIntegerField(default=2, verbose_name='PDU 数量'),
        ),
        migrations.AddField(
            model_name='rack',
            name='pdu_power',
            field=models.PositiveIntegerField(default=0, verbose_name='PDU 实测功率 (W)'),
        ),
        migrations.AddField(
            model_name='rackdevice',
            name='model',
            field=models.CharField(blank=True, max_length=100, verbose_name='型号'),
        ),
        migrations.AddField(
            model_name='rackdevice',
            name='typical_power',
            field=models.PositiveIntegerField(default=0, verbose_name='典型功率 (W)'),
        ),
        migrations.RunPython(migrate_hidden_metadata, restore_hidden_metadata),
        migrations.AddConstraint(
            model_name='rack',
            constraint=check_constraint(
                models.Q(height__gte=1),
                name='rack_height_gte_1',
            ),
        ),
        migrations.AddConstraint(
            model_name='rack',
            constraint=check_constraint(
                models.Q(power_limit__gte=0),
                name='rack_power_limit_gte_0',
            ),
        ),
        migrations.AddConstraint(
            model_name='rackdevice',
            constraint=check_constraint(
                models.Q(position__gte=1),
                name='rack_device_position_gte_1',
            ),
        ),
        migrations.AddConstraint(
            model_name='rackdevice',
            constraint=check_constraint(
                models.Q(u_height__gte=1),
                name='rack_device_height_gte_1',
            ),
        ),
        migrations.AddConstraint(
            model_name='rackdevice',
            constraint=check_constraint(
                models.Q(power_usage__isnull=True) | models.Q(power_usage__gte=0),
                name='rack_device_power_usage_gte_0',
            ),
        ),
    ]
