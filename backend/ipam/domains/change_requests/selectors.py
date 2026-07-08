def build_change_request_topology_rows(datacenters, *, include_sensitive=True):
    datacenter_rows = []
    for datacenter in datacenters:
        rack_rows = []
        for rack in datacenter.racks.all():
            devices = list(rack.devices.all())
            rack_rows.append(
                {
                    'id': rack.id,
                    'code': rack.code,
                    'name': rack.name,
                    'height': rack.height,
                    'devices': [
                        {
                            'id': device.id,
                            'name': device.name if include_sensitive else '已占用设备',
                            'position': device.position,
                            'u_height': device.u_height,
                            'device_type': device.device_type,
                            'brand': device.brand if include_sensitive else '',
                            'model': device.model if include_sensitive else '',
                            'mgmt_ip': device.mgmt_ip if include_sensitive else '',
                            'project': device.project if include_sensitive else '',
                            'contact': device.contact if include_sensitive else '',
                            'power_usage': device.power_usage,
                            'serial_number': device.sn if include_sensitive else '',
                            'asset_tag': device.asset_tag if include_sensitive else '',
                        }
                        for device in devices
                    ],
                    'occupied_ranges': [
                        {
                            'id': device.id,
                            'name': device.name if include_sensitive else '已占用设备',
                            'start': device.position,
                            'end': max(1, device.position - max(device.u_height, 1) + 1),
                        }
                        for device in devices
                    ],
                }
            )
        datacenter_rows.append(
            {
                'id': datacenter.id,
                'name': datacenter.name,
                'location': datacenter.location,
                'racks': rack_rows,
            }
        )
    return datacenter_rows
