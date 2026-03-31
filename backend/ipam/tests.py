import json
import os
import shutil
import tempfile
from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from .models import Datacenter, IPAddress, NetworkSection, Rack, RackDevice, Subnet, UserProfile


def make_csv_upload(name, content):
    return SimpleUploadedFile(name, content.encode('utf-8'), content_type='text/csv')


class BaseApiTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = 'pass12345'
        cls.admin = User.objects.create_user(username='admin', password=cls.password, is_staff=True)
        cls.ip_manager = User.objects.create_user(username='ip-manager', password=cls.password, is_staff=False)
        cls.dc_operator = User.objects.create_user(username='dc-operator', password=cls.password, is_staff=False)
        cls.auditor = User.objects.create_user(username='auditor', password=cls.password, is_staff=False)
        cls.guest = User.objects.create_user(username='guest', password=cls.password, is_staff=False)
        UserProfile.objects.create(user=cls.admin, role='admin', display_name='Admin')
        UserProfile.objects.create(user=cls.ip_manager, role='ip_manager', display_name='IP Manager')
        UserProfile.objects.create(user=cls.dc_operator, role='dc_operator', display_name='DC Operator')
        UserProfile.objects.create(user=cls.auditor, role='auditor', display_name='Auditor')
        UserProfile.objects.create(user=cls.guest, role='guest', display_name='Guest')

    def make_authenticated_client(self, user):
        client = self.client_class()
        client.force_login(user)
        return client


class AuthAndCrudSmokeTests(BaseApiTestCase):
    def test_login_smoke_returns_user_payload_and_session(self):
        response = self.client.post(
            '/api/login/',
            {'username': self.ip_manager.username, 'password': self.password},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['user']['username'], self.ip_manager.username)
        self.assertIn('csrfToken', response.data)

        me_response = self.client.get('/api/me/')
        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.data['user']['username'], self.ip_manager.username)

    def test_ip_crud_smoke(self):
        client = self.make_authenticated_client(self.ip_manager)
        section = NetworkSection.objects.create(name='Core Network')
        subnet = Subnet.objects.create(
            section=section,
            name='Office LAN',
            cidr='10.10.10.0/24',
            location='HQ',
        )

        create_response = client.post(
            '/api/ips/',
            {
                'subnet': subnet.id,
                'ip_address': '10.10.10.10',
                'status': 'offline',
                'device_name': 'printer-01',
                'device_type': 'printer',
                'owner': 'ops',
                'description': 'Initial import',
                'nat_type': 'none',
            },
            format='json',
        )
        self.assertEqual(create_response.status_code, 201)
        ip_id = create_response.data['id']

        list_response = client.get('/api/ips/')
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data), 1)

        update_response = client.patch(
            f'/api/ips/{ip_id}/',
            {'status': 'online', 'device_name': 'printer-01a'},
            format='json',
        )
        self.assertEqual(update_response.status_code, 200)

        delete_response = client.delete(f'/api/ips/{ip_id}/')
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(IPAddress.objects.filter(id=ip_id).exists())

    def test_rack_and_device_crud_smoke(self):
        client = self.make_authenticated_client(self.dc_operator)

        datacenter_response = client.post(
            '/api/datacenters/',
            {'name': 'DC-1', 'location': 'Floor 7', 'contact_phone': '10086'},
            format='json',
        )
        self.assertEqual(datacenter_response.status_code, 201)
        datacenter_id = datacenter_response.data['id']

        rack_response = client.post(
            '/api/racks/',
            {
                'datacenter': datacenter_id,
                'code': 'R01',
                'name': 'Rack 01',
                'height': 42,
                'power_limit': 3000,
                'description': 'Primary rack',
            },
            format='json',
        )
        self.assertEqual(rack_response.status_code, 201)
        rack_id = rack_response.data['id']

        device_response = client.post(
            '/api/rack-devices/',
            {
                'rack': rack_id,
                'name': 'Server 01',
                'position': 10,
                'u_height': 2,
                'device_type': 'server',
                'brand': 'Dell',
                'mgmt_ip': '10.10.10.20',
                'project': 'IPAM',
                'contact': 'ops',
                'power_usage': 450,
                'specs': '64GB RAM',
                'sn': 'SN001',
                'asset_tag': 'AT001',
                'status': 'active',
                'purchase_date': None,
                'warranty_date': None,
                'supplier': 'Vendor',
                'os_version': 'Ubuntu 24.04',
            },
            format='json',
        )
        self.assertEqual(device_response.status_code, 201)
        device_id = device_response.data['id']

        patch_response = client.patch(
            f'/api/rack-devices/{device_id}/',
            {'name': 'Server 01B', 'power_usage': 500},
            format='json',
        )
        self.assertEqual(patch_response.status_code, 200)

        delete_device_response = client.delete(f'/api/rack-devices/{device_id}/')
        self.assertEqual(delete_device_response.status_code, 204)
        self.assertFalse(RackDevice.objects.filter(id=device_id).exists())

        delete_rack_response = client.delete(f'/api/racks/{rack_id}/')
        self.assertEqual(delete_rack_response.status_code, 204)
        self.assertFalse(Rack.objects.filter(id=rack_id).exists())


class ImportExcelTests(BaseApiTestCase):
    def setUp(self):
        self.client = self.make_authenticated_client(self.ip_manager)
        section = NetworkSection.objects.create(name='Campus')
        self.subnet = Subnet.objects.create(
            section=section,
            name='Access Network',
            cidr='10.20.30.0/24',
            location='Building A',
        )

    def test_import_excel_smoke_creates_ip_record(self):
        upload = make_csv_upload(
            'import.csv',
            'IP地址,设备名称,状态,设备类型,负责人,备注\n'
            '10.20.30.10,core-sw,online,switch,network-team,Imported by smoke test\n',
        )

        response = self.client.post(
            '/api/import-excel/',
            {'file': upload, 'config': json.dumps({'skipRows': 1, 'conflictMode': 'overwrite'})},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        imported = IPAddress.objects.get(ip_address='10.20.30.10')
        self.assertEqual(imported.device_name, 'core-sw')
        self.assertEqual(imported.subnet_id, self.subnet.id)

    def test_import_excel_rejects_missing_required_columns(self):
        upload = make_csv_upload(
            'bad_import.csv',
            '地址,名称\n'
            '10.20.30.11,bad-row\n',
        )

        response = self.client.post(
            '/api/import-excel/',
            {'file': upload, 'config': json.dumps({'skipRows': 1})},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('缺少必要列', response.data['message'])


class BackupApiTests(BaseApiTestCase):
    def setUp(self):
        self.client = self.make_authenticated_client(self.admin)
        self.backup_dir = tempfile.mkdtemp(prefix='ipam-backup-tests-')
        self.addCleanup(shutil.rmtree, self.backup_dir, ignore_errors=True)

    def test_backup_smoke_creates_backup_and_updates_summary(self):
        with patch.dict(os.environ, {'BACKUP_DIR': self.backup_dir}, clear=False):
            with patch('ipam.views.subprocess.run', return_value=CompletedProcess(args=['mysqldump'], returncode=0, stderr=b'')):
                response = self.client.post('/api/trigger-backup/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        backup_file = Path(self.backup_dir) / response.data['filename']
        self.assertTrue(backup_file.exists())

        with patch.dict(os.environ, {'BACKUP_DIR': self.backup_dir}, clear=False):
            summary_response = self.client.get('/api/backup/summary/')

        self.assertEqual(summary_response.status_code, 200)
        self.assertEqual(summary_response.data['backup_count'], 1)
        self.assertEqual(summary_response.data['status'], 'normal')

    def test_trigger_backup_returns_error_when_dump_fails(self):
        with patch.dict(os.environ, {'BACKUP_DIR': self.backup_dir}, clear=False):
            with patch(
                'ipam.views.subprocess.run',
                return_value=CompletedProcess(args=['mysqldump'], returncode=1, stderr=b'dump failed'),
            ):
                response = self.client.post('/api/trigger-backup/')

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('dump failed', response.data['message'])


class AccessControlAndPaginationTests(BaseApiTestCase):
    def test_guest_cannot_import_ip_assets(self):
        client = self.make_authenticated_client(self.guest)
        upload = make_csv_upload('import.csv', 'IP地址,设备名称\n10.30.40.10,test\n')

        response = client.post('/api/import-excel/', {'file': upload, 'config': json.dumps({'skipRows': 1})})

        self.assertEqual(response.status_code, 403)

    def test_guest_cannot_create_datacenter(self):
        client = self.make_authenticated_client(self.guest)

        response = client.post('/api/datacenters/', {'name': 'Restricted DC'}, format='json')

        self.assertEqual(response.status_code, 403)

    def test_ip_list_supports_optional_pagination(self):
        client = self.make_authenticated_client(self.ip_manager)
        section = NetworkSection.objects.create(name='Pagination Section')
        subnet = Subnet.objects.create(section=section, name='Pagination Subnet', cidr='10.99.0.0/24')
        IPAddress.objects.create(ip_address='10.99.0.10', subnet=subnet, device_name='one', nat_type='none')
        IPAddress.objects.create(ip_address='10.99.0.11', subnet=subnet, device_name='two', nat_type='none')

        response = client.get('/api/ips/?page=1&page_size=1')

        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['results']), 1)

    def test_admin_can_reset_user_password_with_partial_patch(self):
        client = self.make_authenticated_client(self.admin)

        response = client.patch(
            f'/api/users/{self.guest.id}/',
            {'password': 'ResetPass123', 'must_change_password': True},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.guest.refresh_from_db()
        self.assertTrue(self.guest.check_password('ResetPass123'))
        profile = UserProfile.objects.get(user=self.guest)
        self.assertTrue(profile.must_change_password)


class ResidentImportTests(BaseApiTestCase):
    def setUp(self):
        self.client = self.make_authenticated_client(self.dc_operator)

    def test_resident_import_updates_existing_record_by_registration_code(self):
        response = self.client.post(
            '/api/resident-staff/',
            {
                'company': 'Example Co',
                'name': 'Alice',
                'phone': '13800000000',
                'resident_type': 'implementation',
                'approval_status': 'approved',
                'devices': [],
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        registration_code = response.data['registration_code']

        upload = make_csv_upload(
            'resident_import.csv',
            '登记编号,公司,姓名,联系方式,所属项目,设备名称,品牌,型号\n'
            f'{registration_code},Example Co,Alice,13800000000,Project X,Laptop 01,Lenovo,ThinkPad\n',
        )

        import_response = self.client.post('/api/resident-staff/import_excel/', {'file': upload})

        self.assertEqual(import_response.status_code, 200)
        self.assertEqual(import_response.data['created'], 0)
        self.assertEqual(import_response.data['updated'], 1)

        resident_response = self.client.get('/api/resident-staff/')
        self.assertEqual(resident_response.status_code, 200)
        self.assertEqual(len(resident_response.data), 1)
        self.assertEqual(resident_response.data[0]['registration_code'], registration_code)
        self.assertEqual(resident_response.data[0]['project_name'], 'Project X')
        self.assertEqual(resident_response.data[0]['device_count'], 1)
