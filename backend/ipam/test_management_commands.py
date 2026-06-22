import json
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from ipam.models import Datacenter, IPAddress, NetworkSection, Rack, RackDevice, Subnet


class DcimManagementCommandTests(TestCase):
    def test_dcim_status_reports_active_counts(self):
        datacenter = Datacenter.objects.create(name='Recovery DC')
        rack = Rack.objects.create(datacenter=datacenter, code='R-01')
        RackDevice.objects.create(rack=rack, name='Server 1', position=10)

        output = StringIO()
        call_command('dcim_status', '--json', stdout=output)
        payload = json.loads(output.getvalue())

        self.assertEqual(payload['counts']['datacenters'], 1)
        self.assertEqual(payload['counts']['racks'], 1)
        self.assertEqual(payload['counts']['rack_devices'], 1)
        self.assertTrue(payload['tables']['dcim_datacenter'])

    def test_backfill_command_moves_legacy_metadata(self):
        section = NetworkSection.objects.create(name='Recovery Network')
        subnet = Subnet.objects.create(section=section, name='Recovery Subnet', cidr='10.20.0.0/24')
        address = IPAddress.objects.create(
            subnet=subnet,
            ip_address='10.20.0.10',
            description='legacy\n__TAG__:critical\n__LOCKED__:true',
        )
        datacenter = Datacenter.objects.create(name='Recovery DC')
        rack = Rack.objects.create(
            datacenter=datacenter,
            code='R-01',
            description='legacy rack\n__PDU_META__:{"count": 4, "power": 1600}',
        )
        device = RackDevice.objects.create(
            rack=rack,
            name='Server 1',
            position=10,
            specs='legacy device\n__META__:{"model": "RX-1", "typical_power": 280}',
        )

        call_command('backfill_structured_asset_metadata')

        address.refresh_from_db()
        rack.refresh_from_db()
        device.refresh_from_db()
        self.assertEqual(address.tag, 'critical')
        self.assertTrue(address.is_locked)
        self.assertEqual(address.description, 'legacy')
        self.assertEqual(rack.pdu_count, 4)
        self.assertEqual(rack.pdu_power, 1600)
        self.assertEqual(rack.description, 'legacy rack')
        self.assertEqual(device.model, 'RX-1')
        self.assertEqual(device.typical_power, 280)
        self.assertEqual(device.specs, 'legacy device')
