def build_change_request_topology_rows(datacenters):
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
                            'name': device.name,
                            'position': device.position,
                            'u_height': device.u_height,
                            'device_type': device.device_type,
                            'brand': device.brand,
                            'model': '',
                            'mgmt_ip': device.mgmt_ip,
                            'project': device.project,
                            'contact': device.contact,
                            'power_usage': device.power_usage,
                            'serial_number': device.sn,
                            'asset_tag': device.asset_tag,
                        }
                        for device in devices
                    ],
                    'occupied_ranges': [
                        {
                            'id': device.id,
                            'name': device.name,
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
