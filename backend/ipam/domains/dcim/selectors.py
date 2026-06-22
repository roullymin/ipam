def _resolve_rack_power_snapshot(rack, devices):
    planned_from_devices = sum(max(0, int(device.power_usage or 0)) for device in devices)
    planned_power = planned_from_devices or max(0, int(rack.power_limit or 0))
    actual_power = max(0, int(rack.pdu_power or 0)) or planned_power
    return planned_power, actual_power


def build_public_dcim_payload(datacenters, *, include_sensitive=False, updated_at=''):
    datacenter_rows = []
    totals = {
        'rack_count': 0,
        'device_count': 0,
        'total_u': 0,
        'used_u': 0,
        'planned_power': 0,
        'actual_power': 0,
    }

    for datacenter in datacenters:
        racks = sorted(datacenter.racks.all(), key=lambda rack: (rack.code, rack.id))
        rack_payload = []
        dc_totals = {
            'device_count': 0,
            'total_u': 0,
            'used_u': 0,
            'planned_power': 0,
            'actual_power': 0,
        }

        for rack in racks:
            devices = sorted(
                rack.devices.all(),
                key=lambda device: (-device.position, device.id),
            )
            rack_height = int(rack.height or 42)
            used_units = sum(max(1, int(device.u_height or 1)) for device in devices)
            planned_power, actual_power = _resolve_rack_power_snapshot(rack, devices)
            rack_payload.append(
                {
                    'id': rack.id,
                    'code': rack.code,
                    'name': rack.name or rack.code,
                    'height': rack_height,
                    'device_count': len(devices),
                    'used_units': used_units,
                    'free_units': max(0, rack_height - used_units),
                    'utilization': min(100, round((used_units / rack_height) * 100)) if rack_height else 0,
                    'planned_power': planned_power,
                    'actual_power': actual_power,
                    'devices': [
                        {
                            'id': device.id,
                            'name': device.name,
                            'position': device.position,
                            'u_height': device.u_height,
                            'device_type': device.device_type,
                            'mgmt_ip': device.mgmt_ip if include_sensitive else '',
                            'project': device.project,
                            'contact': device.contact if include_sensitive else '',
                            'power_usage': device.power_usage,
                        }
                        for device in devices
                    ],
                }
            )
            dc_totals['device_count'] += len(devices)
            dc_totals['total_u'] += rack_height
            dc_totals['used_u'] += used_units
            dc_totals['planned_power'] += planned_power
            dc_totals['actual_power'] += actual_power

        datacenter_rows.append(
            {
                'id': datacenter.id,
                'name': datacenter.name,
                'location': datacenter.location,
                'contact_phone': datacenter.contact_phone if include_sensitive else '',
                'rack_count': len(racks),
                **dc_totals,
                'free_u': max(0, dc_totals['total_u'] - dc_totals['used_u']),
                'utilization': (
                    min(100, round((dc_totals['used_u'] / dc_totals['total_u']) * 100))
                    if dc_totals['total_u']
                    else 0
                ),
                'racks': rack_payload,
            }
        )
        totals['rack_count'] += len(racks)
        for field in ['device_count', 'total_u', 'used_u', 'planned_power', 'actual_power']:
            totals[field] += dc_totals[field]

    return {
        'updated_at': updated_at,
        'summary': {
            'datacenter_count': len(datacenter_rows),
            **totals,
            'free_u': max(0, totals['total_u'] - totals['used_u']),
            'utilization': (
                min(100, round((totals['used_u'] / totals['total_u']) * 100))
                if totals['total_u']
                else 0
            ),
        },
        'datacenters': datacenter_rows,
    }
