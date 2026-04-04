from rest_framework import serializers

from ...models import DatacenterChangeItem, IPAddress, RackDevice


def build_change_request_title(validated_data, items_data, request_type_choices):
    explicit_title = str(validated_data.get('title') or '').strip()
    if explicit_title:
        return explicit_title

    request_type = validated_data.get('request_type') or 'change'
    request_type_label = dict(request_type_choices).get(request_type, request_type)
    first_item = items_data[0] if items_data else {}
    device_name = str(first_item.get('device_name') or '').strip()
    return f'{request_type_label}申请{f" - {device_name}" if device_name else ""}'


def build_change_device_defaults(change_request, item):
    device_name = (
        str(item.device_name or '').strip()
        or (item.rack_device.name if item.rack_device else '').strip()
        or f'{change_request.request_code}-设备{item.pk}'
    )
    specs_parts = []
    if item.device_model:
        specs_parts.append(f'型号: {item.device_model}')
    if item.notes:
        specs_parts.append(f'备注: {item.notes}')
    return {
        'name': device_name,
        'position': item.target_u_start or item.source_u_start or 1,
        'u_height': max(1, int(item.u_height or 1)),
        'device_type': 'other',
        'mgmt_ip': str(item.assigned_management_ip or '').strip() or None,
        'project': str(change_request.project_name or '').strip(),
        'contact': str(change_request.applicant_name or '').strip(),
        'power_usage': int(item.power_watts or 0),
        'specs': '\n'.join(specs_parts).strip(),
        'sn': str(item.serial_number or '').strip() or None,
        'status': 'active',
    }


def resolve_existing_change_device(item):
    if item.rack_device_id:
        return item.rack_device
    if item.source_rack_id and item.source_u_start:
        return RackDevice.objects.filter(rack_id=item.source_rack_id, position=item.source_u_start).first()
    return None


def sync_change_request_ip(item, change_request, device_name, activate=True):
    management_ip = str(item.assigned_management_ip or '').strip()
    if not management_ip:
        return None

    description = f'设备变更申请 {change_request.request_code} / {change_request.title or change_request.request_type}'
    ip_record, _ = IPAddress.objects.update_or_create(
        ip_address=management_ip,
        defaults={
            'status': 'online' if activate else 'offline',
            'device_name': device_name if activate else '',
            'device_type': 'other',
            'owner': str(change_request.applicant_name or change_request.company or '').strip(),
            'description': description,
        },
    )
    return ip_record


def apply_change_request_execution(change_request):
    execution_rows = []

    for item in change_request.items.select_related('rack_device', 'source_rack', 'target_rack').all():
        request_type = change_request.request_type
        existing_device = resolve_existing_change_device(item)
        device_name = (
            str(item.device_name or '').strip()
            or (existing_device.name if existing_device else '').strip()
            or f'{change_request.request_code}-设备{item.pk}'
        )
        synced_ip = None

        if request_type in {'rack_in', 'move_in'}:
            if not item.target_rack_id or not item.target_u_start:
                raise serializers.ValidationError({'items': ['上架/搬入执行时必须填写目标机柜和目标 U 位。']})

            defaults = build_change_device_defaults(change_request, item)
            if existing_device:
                for field, value in defaults.items():
                    setattr(existing_device, field, value)
                existing_device.rack_id = item.target_rack_id
                existing_device.position = item.target_u_start
                existing_device.save()
                device = existing_device
                action = 'update_device'
            else:
                device = RackDevice.objects.create(rack_id=item.target_rack_id, **defaults)
                item.rack_device = device
                item.save(update_fields=['rack_device', 'updated_at'])
                action = 'create_device'
            synced_ip = sync_change_request_ip(item, change_request, device.name, activate=True)

        elif request_type == 'relocate':
            if not item.target_rack_id or not item.target_u_start:
                raise serializers.ValidationError({'items': ['迁移执行时必须填写目标机柜和目标 U 位。']})

            defaults = build_change_device_defaults(change_request, item)
            if existing_device:
                for field, value in defaults.items():
                    setattr(existing_device, field, value)
                existing_device.rack_id = item.target_rack_id
                existing_device.position = item.target_u_start
                existing_device.save()
                device = existing_device
                action = 'relocate_device'
            else:
                device = RackDevice.objects.create(rack_id=item.target_rack_id, **defaults)
                item.rack_device = device
                item.save(update_fields=['rack_device', 'updated_at'])
                action = 'create_and_relocate'
            synced_ip = sync_change_request_ip(item, change_request, device.name, activate=True)

        elif request_type in {'rack_out', 'move_out', 'decommission'}:
            device = existing_device
            if device:
                device.status = 'decommissioned' if request_type == 'decommission' else 'removed'
                device.save(update_fields=['status', 'updated_at'])
                device_name = device.name
                action = 'deactivate_device'
            else:
                action = 'record_only'
            if item.ip_action in {'release', 'change'}:
                synced_ip = sync_change_request_ip(item, change_request, device_name, activate=False)

        elif request_type == 'power_change':
            device = existing_device
            action = 'record_only'
            if device:
                changed_fields = []
                target_power = int(item.power_watts or 0)
                if target_power and device.power_usage != target_power:
                    device.power_usage = target_power
                    changed_fields.append('power_usage')
                management_ip = str(item.assigned_management_ip or '').strip()
                if management_ip and device.mgmt_ip != management_ip:
                    device.mgmt_ip = management_ip
                    changed_fields.append('mgmt_ip')
                if changed_fields:
                    changed_fields.append('updated_at')
                    device.save(update_fields=changed_fields)
                    action = 'update_device'
                device_name = device.name
            synced_ip = sync_change_request_ip(item, change_request, device_name, activate=True)

        else:
            action = 'record_only'

        execution_rows.append(
            {
                'item_id': item.id,
                'device_name': device_name,
                'action': action,
                'management_ip': synced_ip.ip_address if synced_ip else (item.assigned_management_ip or ''),
            }
        )

    return execution_rows
