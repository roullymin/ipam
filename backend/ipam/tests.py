from datetime import timedelta
import json
import os
import shutil
import tempfile
from io import StringIO
from io import BytesIO
from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import patch

import pandas as pd
from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import (
    Datacenter,
    DatacenterChangeRequest,
    IPAddress,
    NetworkSection,
    Rack,
    RackDevice,
    ResidentDevice,
    ResidentIntakeLink,
    ResidentStaff,
    Subnet,
    UserProfile,
)


def make_csv_upload(name, content):
    return SimpleUploadedFile(name, content.encode('utf-8'), content_type='text/csv')


def make_csv_upload_bytes(name, content_bytes):
    return SimpleUploadedFile(name, content_bytes, content_type='text/csv')


def make_excel_upload(name, sheets):
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        for sheet_name, rows in sheets.items():
            pd.DataFrame(rows).to_excel(writer, sheet_name=sheet_name, index=False)
    buffer.seek(0)
    return SimpleUploadedFile(
        name,
        buffer.getvalue(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )


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
    def test_version_endpoint_returns_backend_metadata(self):
        response = self.client.get('/api/version/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['backend']['service'], 'backend')

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

    def test_import_excel_preview_returns_summary(self):
        upload = make_csv_upload(
            'preview.csv',
            'IP地址,设备名称,状态,设备类型,负责人,备注\n'
            '10.20.30.15,preview-sw,online,switch,ops,预览测试\n',
        )

        response = self.client.post(
            '/api/import-excel/preview/',
            {'file': upload, 'config': json.dumps({'skipRows': 1, 'conflictMode': 'overwrite'})},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertTrue(response.data['preview']['can_import'])
        self.assertEqual(response.data['preview']['summary']['create_rows'], 1)
        self.assertEqual(response.data['preview']['rows'][0]['action'], 'create')
        self.assertEqual(response.data['preview']['failed_rows'], [])


class PublicDcimOverviewTests(BaseApiTestCase):
    def test_public_dcim_overview_uses_device_power_and_pdu_fallbacks(self):
        datacenter = Datacenter.objects.create(name='13F 机房', location='1301')
        rack_with_pdu = Rack.objects.create(
            datacenter=datacenter,
            code='R-01',
            name='1号机柜',
            height=42,
            power_limit=5000,
            description='主机柜\n__PDU_META__:{"count": 2, "power": 1800}',
        )
        RackDevice.objects.create(rack=rack_with_pdu, name='核心交换机', position=20, u_height=2, power_usage=300)
        RackDevice.objects.create(rack=rack_with_pdu, name='服务器01', position=16, u_height=4, power_usage=450)

        rack_without_pdu = Rack.objects.create(
            datacenter=datacenter,
            code='R-02',
            name='2号机柜',
            height=42,
            power_limit=1200,
        )
        RackDevice.objects.create(rack=rack_without_pdu, name='服务器02', position=10, u_height=2, power_usage=600)

        response = self.client.get('/api/public/dcim-overview/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['summary']['planned_power'], 1350)
        self.assertEqual(response.data['summary']['actual_power'], 2400)

        rack_rows = {row['code']: row for row in response.data['datacenters'][0]['racks']}
        self.assertEqual(rack_rows['R-01']['planned_power'], 750)
        self.assertEqual(rack_rows['R-01']['actual_power'], 1800)
        self.assertEqual(rack_rows['R-02']['planned_power'], 600)
        self.assertEqual(rack_rows['R-02']['actual_power'], 600)


class DatacenterChangeRequestTests(BaseApiTestCase):
    def setUp(self):
        self.client = self.make_authenticated_client(self.dc_operator)
        self.datacenter = Datacenter.objects.create(name='核心机房', location='7F')
        self.rack = Rack.objects.create(
            datacenter=self.datacenter,
            code='R-01',
            name='主机柜',
            height=42,
            power_limit=5000,
        )
        self.device = RackDevice.objects.create(
            rack=self.rack,
            name='核心交换机',
            position=20,
            u_height=2,
            device_type='switch_core',
            brand='Huawei',
            mgmt_ip='10.0.0.10',
            project='核心网络',
            contact='网络组',
            power_usage=300,
        )

    def test_can_create_change_request_with_nested_items(self):
        response = self.client.post(
            '/api/datacenter-change-requests/',
            {
                'request_type': 'rack_out',
                'title': '核心交换机搬出申请',
                'applicant_name': '张三',
                'applicant_phone': '13800000000',
                'applicant_email': 'zhangsan@example.com',
                'company': '数字广东',
                'department': '网络组',
                'project_name': '核心网改造',
                'reason': '更换老旧设备',
                'items': [
                    {
                        'rack_device': self.device.id,
                        'device_name': '核心交换机',
                        'device_model': 'S12700',
                        'serial_number': 'SN-CORE-001',
                        'quantity': 1,
                        'u_height': 2,
                        'power_watts': 300,
                        'network_role': 'management',
                        'ip_quantity': 1,
                        'requires_static_ip': True,
                        'ip_action': 'release',
                        'source_datacenter': self.datacenter.id,
                        'source_rack': self.rack.id,
                        'source_u_start': 20,
                        'source_u_end': 19,
                        'notes': '由网络组执行下架',
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'draft')
        self.assertEqual(response.data['item_count'], 1)
        self.assertTrue(response.data['public_token'])
        self.assertTrue(response.data['public_link'].endswith(f"/?change-request-intake=1&token={response.data['public_token']}"))

        change_request = DatacenterChangeRequest.objects.get(pk=response.data['id'])
        self.assertEqual(change_request.items.count(), 1)
        self.assertEqual(change_request.created_by, self.dc_operator)

    def test_can_create_draft_with_only_location_and_ip_prefill(self):
        response = self.client.post(
            '/api/datacenter-change-requests/',
            {
                'request_type': 'rack_in',
                'items': [
                    {
                        'network_role': 'command',
                        'ip_action': 'allocate',
                        'assigned_management_ip': '10.10.10.10',
                        'target_datacenter': self.datacenter.id,
                        'target_rack': self.rack.id,
                        'target_u_start': 10,
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'draft')
        self.assertEqual(response.data['item_count'], 1)

        change_request = DatacenterChangeRequest.objects.get(pk=response.data['id'])
        item = change_request.items.get()
        self.assertEqual(item.assigned_management_ip, '10.10.10.10')
        self.assertEqual(item.target_rack_id, self.rack.id)
        self.assertEqual(item.network_role, 'command')
        self.assertEqual(item.ip_action, 'allocate')

    def test_can_create_assistance_request_without_items(self):
        response = self.client.post(
            '/api/datacenter-change-requests/',
            {
                'request_type': 'assistance',
                'title': '协助接入新项目',
                'applicant_name': '王五',
                'applicant_phone': '13700000000',
                'applicant_email': 'wangwu@example.com',
                'company': '数字广东',
                'department': '科技与信息化处',
                'project_name': '一体化平台',
                'reason': '项目上线前需要协调处理',
                'request_content': '协助开通账号、座位和网络访问权限。',
                'planned_execute_at': '2026-04-22T09:30:00',
                'items': [],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['request_type'], 'assistance')
        self.assertEqual(response.data['item_count'], 0)
        self.assertEqual(response.data['request_content'], '协助开通账号、座位和网络访问权限。')

        change_request = DatacenterChangeRequest.objects.get(pk=response.data['id'])
        self.assertEqual(change_request.items.count(), 0)
        self.assertEqual(change_request.request_content, '协助开通账号、座位和网络访问权限。')

    def test_can_approve_change_request(self):
        change_request = DatacenterChangeRequest.objects.create(
            request_type='rack_in',
            status='submitted',
            title='新设备上架申请',
            applicant_name='李四',
            applicant_phone='13900000000',
        )

        response = self.client.post(
            f'/api/datacenter-change-requests/{change_request.id}/approve/',
            {'review_comment': '批准实施'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        change_request.refresh_from_db()
        self.assertEqual(change_request.status, 'approved')
        self.assertEqual(change_request.review_comment, '批准实施')
        self.assertTrue(change_request.reviewer_name)

    def test_can_submit_draft_change_request(self):
        change_request = DatacenterChangeRequest.objects.create(
            request_type='rack_in',
            status='draft',
            title='测试草稿提交',
            applicant_name='',
            applicant_phone='',
        )

        response = self.client.post(
            f'/api/datacenter-change-requests/{change_request.id}/submit/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        change_request.refresh_from_db()
        self.assertEqual(change_request.status, 'submitted')

    def test_only_draft_change_request_can_be_deleted(self):
        draft_request = DatacenterChangeRequest.objects.create(
            request_type='rack_in',
            status='draft',
            title='Draft Request',
            applicant_name='Tester',
        )
        submitted_request = DatacenterChangeRequest.objects.create(
            request_type='rack_in',
            status='submitted',
            title='Submitted Request',
            applicant_name='Tester',
        )

        draft_response = self.client.delete(f'/api/datacenter-change-requests/{draft_request.id}/')
        self.assertEqual(draft_response.status_code, 204)
        self.assertFalse(DatacenterChangeRequest.objects.filter(pk=draft_request.id).exists())

        submitted_response = self.client.delete(f'/api/datacenter-change-requests/{submitted_request.id}/')
        self.assertEqual(submitted_response.status_code, 400)
        self.assertTrue(DatacenterChangeRequest.objects.filter(pk=submitted_request.id).exists())

    def test_can_schedule_and_complete_change_request(self):
        change_request = DatacenterChangeRequest.objects.create(
            request_type='relocate',
            status='approved',
            title='璁惧杩佺Щ鎵ц',
            applicant_name='璧靛叚',
            applicant_phone='13600000000',
        )

        schedule_response = self.client.post(
            f'/api/datacenter-change-requests/{change_request.id}/schedule/',
            {
                'planned_execute_at': '2026-04-05T10:00:00',
                'department_comment': '缃戠粶缁勯厤鍚?',
                'it_comment': '瀹夋帓鍋滄満绐楀彛',
            },
            format='json',
        )
        self.assertEqual(schedule_response.status_code, 200)
        change_request.refresh_from_db()
        self.assertEqual(change_request.status, 'scheduled')
        self.assertEqual(change_request.department_comment, '缃戠粶缁勯厤鍚?')
        self.assertEqual(change_request.it_comment, '瀹夋帓鍋滄満绐楀彛')

        complete_response = self.client.post(
            f'/api/datacenter-change-requests/{change_request.id}/complete/',
            {'executor_name': '鎵ц宸ョ▼甯?', 'execution_comment': '璁惧宸叉惉杩佸畬鎴?'},
            format='json',
        )
        self.assertEqual(complete_response.status_code, 200)
        change_request.refresh_from_db()
        self.assertEqual(change_request.status, 'completed')
        self.assertEqual(change_request.executor_name, '鎵ц宸ョ▼甯?')
        self.assertEqual(change_request.execution_comment, '璁惧宸叉惉杩佸畬鎴?')
        self.assertIsNotNone(change_request.executed_at)

    def test_complete_rack_in_creates_rack_device_and_updates_ip(self):
        change_request = DatacenterChangeRequest.objects.create(
            request_type='rack_in',
            status='approved',
            title='新设备上架',
            applicant_name='执行人A',
            project_name='新项目',
        )
        change_request.items.create(
            device_name='接入交换机A',
            device_model='S5700',
            serial_number='SN-RACKIN-001',
            quantity=1,
            u_height=2,
            power_watts=260,
            network_role='command',
            ip_action='allocate',
            assigned_management_ip='10.10.10.20',
            target_datacenter=self.datacenter,
            target_rack=self.rack,
            target_u_start=18,
            target_u_end=17,
        )

        response = self.client.post(
            f'/api/datacenter-change-requests/{change_request.id}/complete/',
            {'executor_name': '执行工程师', 'execution_comment': '已完成上架并接入管理网络'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        change_request.refresh_from_db()
        item = change_request.items.get()
        self.assertEqual(change_request.status, 'completed')
        self.assertIsNotNone(item.rack_device_id)
        self.assertEqual(item.rack_device.rack_id, self.rack.id)
        self.assertEqual(item.rack_device.position, 18)
        self.assertEqual(item.rack_device.mgmt_ip, '10.10.10.20')
        ip_record = IPAddress.objects.get(ip_address='10.10.10.20')
        self.assertEqual(ip_record.status, 'online')
        self.assertEqual(ip_record.device_name, '接入交换机A')

    def test_complete_rack_out_marks_device_removed_and_releases_ip(self):
        change_request = DatacenterChangeRequest.objects.create(
            request_type='rack_out',
            status='approved',
            title='旧设备下架',
            applicant_name='执行人B',
        )
        change_request.items.create(
            rack_device=self.device,
            device_name=self.device.name,
            quantity=1,
            u_height=2,
            ip_action='release',
            assigned_management_ip=self.device.mgmt_ip,
            source_datacenter=self.datacenter,
            source_rack=self.rack,
            source_u_start=self.device.position,
            source_u_end=self.device.position - self.device.u_height + 1,
        )
        IPAddress.objects.create(ip_address=self.device.mgmt_ip, status='online', device_name=self.device.name, nat_type='none')

        response = self.client.post(
            f'/api/datacenter-change-requests/{change_request.id}/complete/',
            {'execution_comment': '设备已下架并释放地址'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.device.refresh_from_db()
        self.assertEqual(self.device.status, 'removed')
        ip_record = IPAddress.objects.get(ip_address=self.device.mgmt_ip)
        self.assertEqual(ip_record.status, 'offline')
        self.assertEqual(ip_record.device_name, '')

    def test_public_change_request_detail_works_with_token(self):
        change_request = DatacenterChangeRequest.objects.create(
            request_type='move_in',
            status='submitted',
            title='测试公开链接',
            applicant_name='王五',
            applicant_phone='13700000000',
        )

        response = self.client.get(f'/api/public/change-requests/{change_request.public_token}/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['request']['request_code'], change_request.request_code)
        self.assertEqual(response.data['request']['title'], '测试公开链接')

    def test_public_change_request_can_submit_updates(self):
        change_request = DatacenterChangeRequest.objects.create(
            request_type='rack_in',
            status='draft',
            title='寰呰ˉ鍏呯敵璇?',
            applicant_name='',
            applicant_phone='',
        )

        response = self.client.post(
            f'/api/public/change-requests/{change_request.public_token}/',
            {
                'applicant_name': '鐢宠浜虹敳',
                'applicant_phone': '13500000000',
                'company': '鏁板瓧骞夸笢',
                'reason': '璁惧涓婃灦闇€姹?',
                'requires_power_down': True,
                'items': [
                    {
                        'device_name': '姹囪仛浜ゆ崲鏈?',
                        'device_model': 'S7700',
                        'quantity': 1,
                        'u_height': 2,
                        'power_watts': 400,
                        'network_role': 'management',
                        'ip_quantity': 1,
                        'ip_action': 'allocate',
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        change_request.refresh_from_db()
        self.assertEqual(change_request.status, 'submitted')
        self.assertEqual(change_request.applicant_name, '鐢宠浜虹敳')
        self.assertTrue(change_request.requires_power_down)
        self.assertEqual(change_request.items.count(), 1)

    def test_can_set_revoke_and_restore_public_link(self):
        change_request = DatacenterChangeRequest.objects.create(
            request_type='rack_in',
            status='draft',
            title='Public Link Controls',
            applicant_name='Tester',
        )

        set_response = self.client.post(
            f'/api/datacenter-change-requests/{change_request.id}/set_link_expiry/',
            {'expires_in_days': 7},
            format='json',
        )
        self.assertEqual(set_response.status_code, 200)

        revoke_response = self.client.post(
            f'/api/datacenter-change-requests/{change_request.id}/revoke_link/',
            {},
            format='json',
        )
        self.assertEqual(revoke_response.status_code, 200)

        public_response = self.client.get(f'/api/public/change-requests/{change_request.public_token}/')
        self.assertEqual(public_response.status_code, 410)

        restore_response = self.client.post(
            f'/api/datacenter-change-requests/{change_request.id}/restore_link/',
            {'expires_in_days': 30},
            format='json',
        )
        self.assertEqual(restore_response.status_code, 200)

        public_response = self.client.get(f'/api/public/change-requests/{change_request.public_token}/')
        self.assertEqual(public_response.status_code, 200)

    def test_can_export_change_request_pdf(self):
        change_request = DatacenterChangeRequest.objects.create(
            request_type='rack_out',
            status='submitted',
            title='PDF Export',
            applicant_name='Tester',
            applicant_phone='13500000000',
        )
        change_request.items.create(
            device_name='Core Switch',
            quantity=1,
            u_height=2,
            network_role='command',
            ip_action='release',
        )

        response = self.client.get(f'/api/datacenter-change-requests/{change_request.id}/export_pdf/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')

        public_response = self.client.get(f'/api/public/change-requests/{change_request.public_token}/export-pdf/')
        self.assertEqual(public_response.status_code, 200)
        self.assertEqual(public_response['Content-Type'], 'application/pdf')

    def test_topology_endpoint_returns_datacenter_racks_and_occupied_ranges(self):
        response = self.client.get('/api/datacenter-change-requests/topology/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['datacenters']), 1)
        rack_row = response.data['datacenters'][0]['racks'][0]
        self.assertEqual(rack_row['devices'][0]['id'], self.device.id)
        self.assertEqual(rack_row['code'], 'R-01')
        self.assertEqual(rack_row['occupied_ranges'][0]['name'], '核心交换机')

    def test_import_excel_preview_returns_failed_row_report(self):
        client = self.make_authenticated_client(self.ip_manager)
        upload = make_csv_upload(
            'invalid_preview.csv',
            'IP鍦板潃,璁惧鍚嶇О\n'
            'bad-ip,preview-sw\n',
        )

        response = client.post(
            '/api/import-excel/preview/',
            {'file': upload, 'config': json.dumps({'skipRows': 1, 'conflictMode': 'overwrite'})},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['preview']['summary']['invalid_rows'], 1)
        self.assertEqual(len(response.data['preview']['failed_rows']), 1)
        self.assertEqual(response.data['preview']['failed_rows'][0]['row_number'], 1)
        self.assertEqual(response.data['preview']['failed_rows'][0]['action'], 'invalid')

    def test_import_excel_accepts_gb18030_csv_and_repairs_mojibake(self):
        client = self.make_authenticated_client(self.ip_manager)
        source_name = '核心交换机'
        upload = make_csv_upload_bytes(
            'gb18030_import.csv',
            (
                'IP地址,设备名称,状态,设备类型,负责人,备注\n'
                f'10.20.30.12,{source_name},online,switch,网络管理部,骨干网络接入\n'
            ).encode('gb18030'),
        )

        response = client.post(
            '/api/import-excel/',
            {'file': upload, 'config': json.dumps({'skipRows': 1, 'conflictMode': 'overwrite'})},
        )

        self.assertEqual(response.status_code, 200)
        imported = IPAddress.objects.get(ip_address='10.20.30.12')
        self.assertEqual(imported.device_name, source_name)
        self.assertEqual(imported.owner, '网络管理部')


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

    def test_authenticated_user_can_fetch_system_overview(self):
        client = self.make_authenticated_client(self.ip_manager)

        response = client.get('/api/system/overview/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('backend', response.data)
        self.assertIn('counts', response.data)
        self.assertIn('data_quality', response.data)

    def test_dc_operator_can_preview_dcim_import(self):
        client = self.make_authenticated_client(self.dc_operator)
        upload = make_excel_upload(
            'dcim_preview.xlsx',
            {
                '机柜资产': [
                    {
                        '机房名称': '7F 核心机房',
                        '机房位置': '708',
                        '机柜编号': 'RK-01',
                        '机柜名称': '核心交换机柜',
                        '高度(U)': 42,
                        '额定功率(W)': 8000,
                        'PDU数量': 2,
                        'PDU实测功率(W)': 1200,
                        '备注': '预览机柜',
                    }
                ],
                '设备资产': [
                    {
                        '机房名称': '7F 核心机房',
                        '机柜编号': 'RK-01',
                        '机柜名称': '核心交换机柜',
                        '设备名称': '核心交换机 A',
                        '起始U位': 40,
                        '占用高度(U)': 2,
                        '设备类型': 'switch',
                        '品牌': 'Huawei',
                        '管理IP': '172.25.1.10',
                        '项目名称': '骨干网络',
                        '负责人': '张三',
                        '额定功率(W)': 350,
                        '配置信息': '24口万兆交换机',
                        '序列号(SN)': 'SN-0001',
                        '固定资产编号': 'ASSET-0001',
                        '设备状态': 'active',
                        '采购日期': '2025-01-01',
                        '维保到期': '2028-01-01',
                        '供应商': '华为',
                        'OS/固件': 'V1.0.0',
                    }
                ],
            },
        )

        response = client.post('/api/dcim/import-excel/preview/', {'file': upload})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertTrue(response.data['preview']['can_import'])
        self.assertEqual(response.data['preview']['summary']['rack_create_rows'], 1)
        self.assertEqual(response.data['preview']['summary']['device_create_rows'], 1)
        self.assertEqual(response.data['preview']['failed_rows'], [])

    def test_dc_operator_preview_dcim_import_returns_failed_rows(self):
        client = self.make_authenticated_client(self.dc_operator)
        upload = make_excel_upload(
            'dcim_invalid_preview.xlsx',
            {
                '机柜资产': [
                    {
                        '机房名称': '',
                        '机房位置': '708',
                        '机柜编号': '',
                        '机柜名称': '异常机柜',
                    }
                ],
                '设备资产': [],
            },
        )

        response = client.post('/api/dcim/import-excel/preview/', {'file': upload})

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['preview']['can_import'])
        self.assertEqual(response.data['preview']['summary']['invalid_rows'], 1)
        self.assertEqual(len(response.data['preview']['failed_rows']), 1)
        self.assertEqual(response.data['preview']['failed_rows'][0]['action'], 'invalid')

    def test_admin_can_fetch_encoding_report(self):
        client = self.make_authenticated_client(self.admin)
        garbled_name = '核心交换机'.encode('utf-8').decode('latin1')
        datacenter = Datacenter.objects.create(name='主机房', location='7F')
        rack = Rack.objects.create(datacenter=datacenter, code='R-01', name='核心机柜')
        RackDevice.objects.create(rack=rack, name=garbled_name, position=1, u_height=1)

        response = client.get('/api/data-quality/encoding-report/?limit=2')

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['summary']['suspected_records'], 1)
        self.assertTrue(any(model['model'] == 'RackDevice' for model in response.data['models']))


class ResidentImportTests(BaseApiTestCase):
    def setUp(self):
        self.client = self.make_authenticated_client(self.dc_operator)

    def test_resident_import_preview_returns_summary(self):
        upload = make_csv_upload(
            'resident_preview.csv',
            '登记编号,公司,姓名,联系方式,所属项目,归属部门,设备名称,品牌,型号\n'
            'RC202604010101,示例科技,李四,13800002222,一体化项目,运维中心,办公终端,Lenovo,ThinkPad\n',
        )

        response = self.client.post('/api/resident-staff/preview_import_excel/', {'file': upload})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['preview']['can_import'])
        self.assertEqual(response.data['preview']['summary']['resident_rows'], 1)
        self.assertEqual(response.data['preview']['summary']['device_rows'], 1)
        self.assertEqual(response.data['preview']['summary']['create_rows'], 1)
        self.assertEqual(response.data['preview']['rows'][0]['action'], 'create')
        self.assertEqual(response.data['preview']['failed_rows'], [])

    def test_resident_import_preview_returns_failed_row_report(self):
        upload = make_csv_upload(
            'resident_invalid_preview.csv',
            '公司,姓名,联系方式,所属项目,归属部门\n'
            ',李四,13800002222,一体化项目,运维中心\n'
            '示例科技,王五,13800002223,一体化项目,运维中心\n',
        )

        response = self.client.post('/api/resident-staff/preview_import_excel/', {'file': upload})

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['preview']['can_import'])
        self.assertEqual(response.data['preview']['summary']['invalid_rows'], 1)
        self.assertEqual(len(response.data['preview']['failed_rows']), 1)
        self.assertEqual(response.data['preview']['failed_rows'][0]['row_number'], 2)
        self.assertEqual(response.data['preview']['failed_rows'][0]['action'], 'invalid')

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

    def test_resident_import_accepts_gbk_csv(self):
        upload = make_csv_upload_bytes(
            'resident_import_gbk.csv',
            (
                '登记编号,公司,姓名,联系方式,所属项目,设备名称,品牌,型号\n'
                'RC202604010001,示例科技,张三,13800001111,骨干网改造,运维笔记本,联想,ThinkPad\n'
            ).encode('gbk'),
        )

        response = self.client.post('/api/resident-staff/import_excel/', {'file': upload})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['created'], 1)
        resident_response = self.client.get('/api/resident-staff/')
        self.assertEqual(resident_response.status_code, 200)
        self.assertEqual(resident_response.data[0]['company'], '示例科技')
        self.assertEqual(resident_response.data[0]['device_count'], 1)


class ResidentIntakeTests(BaseApiTestCase):
    def setUp(self):
        self.client = self.make_authenticated_client(self.dc_operator)

    def test_public_resident_intake_without_token_returns_fixed_entry(self):
        response = self.client.get('/api/resident-intake/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['link']['token'], '')
        self.assertTrue(response.data['link']['is_permanent'])
        self.assertIn('/?resident-intake=1', response.data['link']['intake_url'])

    def test_public_resident_intake_without_token_allows_submission(self):
        response = self.client.post(
            '/api/resident-intake/',
            {
                'company_profile': {
                    'company': 'Example Co',
                    'project_name': 'Project X',
                    'department': 'Ops',
                    'resident_type': 'implementation',
                },
                'staff_members': [
                    {
                        'name': 'Alice',
                        'phone': '13800000000',
                        'email': 'alice@example.com',
                        'devices': [],
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['created'], 1)
        self.assertEqual(response.data['updated'], 0)
        self.assertTrue(response.data['link']['is_permanent'])
        resident = ResidentStaff.objects.get()
        self.assertEqual(resident.company, 'Example Co')
        self.assertEqual(resident.approval_status, 'pending')
        self.assertEqual(resident.intake_source, 'qr')

    def test_public_resident_intake_updates_existing_record_and_formats_mac(self):
        resident = ResidentStaff.objects.create(
            company='Example Co',
            name='Alice',
            phone='13800000000',
            email='alice@example.com',
            resident_type='implementation',
            project_name='Old Project',
            approval_status='approved',
            intake_source='manual',
        )
        ResidentDevice.objects.create(
            resident=resident,
            device_name='Old Laptop',
            wireless_mac='AA:BB:CC:DD:EE:FF',
        )
        intake_link = ResidentIntakeLink.objects.create(
            expires_at=timezone.now() + timedelta(hours=4),
            created_by=self.dc_operator,
        )

        verify_response = self.client.get(f'/api/resident-intake/?token={intake_link.token}')
        self.assertEqual(verify_response.status_code, 200)
        self.assertEqual(verify_response.data['link']['token'], intake_link.token)

        response = self.client.post(
            '/api/resident-intake/',
            {
                'token': intake_link.token,
                'company_profile': {
                    'company': 'Example Co',
                    'project_name': 'New Project',
                    'department': 'Ops',
                    'resident_type': 'implementation',
                    'start_date': '2026-04-20',
                    'end_date': '2026-05-01',
                },
                'staff_members': [
                    {
                        'name': 'Alice',
                        'phone': '13800000000',
                        'email': 'alice@example.com',
                        'title': 'Engineer',
                        'devices': [
                            {
                                'device_name': 'New Laptop',
                                'wired_mac': '782B4645C9A0',
                                'wireless_mac': '20-1E-88-5D-E9-95',
                            }
                        ],
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['created'], 0)
        self.assertEqual(response.data['updated'], 1)
        self.assertEqual(ResidentStaff.objects.count(), 1)

        resident.refresh_from_db()
        self.assertEqual(resident.registration_code, response.data['registration_codes'][0])
        self.assertEqual(resident.project_name, 'New Project')
        self.assertEqual(resident.department, 'Ops')
        self.assertEqual(resident.approval_status, 'pending')
        self.assertEqual(resident.devices.count(), 1)

        device = resident.devices.get()
        self.assertEqual(device.device_name, 'New Laptop')
        self.assertEqual(device.wired_mac, '782b-4645-c9a0')
        self.assertEqual(device.wireless_mac, '201e-885d-e995')
        self.assertEqual(response.data['residents'][0]['devices'][0]['wired_mac'], '782b-4645-c9a0')

    def test_public_resident_intake_rejects_expired_link(self):
        intake_link = ResidentIntakeLink.objects.create(
            expires_at=timezone.now() - timedelta(minutes=1),
            created_by=self.dc_operator,
        )

        get_response = self.client.get(f'/api/resident-intake/?token={intake_link.token}')
        self.assertEqual(get_response.status_code, 410)

        post_response = self.client.post(
            '/api/resident-intake/',
            {
                'token': intake_link.token,
                'company_profile': {
                    'company': 'Example Co',
                    'resident_type': 'implementation',
                },
                'staff_members': [
                    {
                        'name': 'Alice',
                        'phone': '13800000000',
                        'devices': [],
                    }
                ],
            },
            format='json',
        )

        self.assertEqual(post_response.status_code, 410)
        self.assertIn('过期', str(post_response.data.get('detail', '')))


class EncodingAuditCommandTests(BaseApiTestCase):
    def test_scan_encoding_issues_command_reports_suspected_rows(self):
        garbled_device_name = '华三交换机'.encode('utf-8').decode('latin1')
        datacenter = Datacenter.objects.create(name='主机房', location='7F')
        rack = Rack.objects.create(datacenter=datacenter, code='R-09', name='接入机柜')
        RackDevice.objects.create(rack=rack, name=garbled_device_name, position=9, u_height=1)

        stdout = StringIO()
        call_command('scan_encoding_issues', '--limit', '1', stdout=stdout)
        output = stdout.getvalue()

        self.assertIn('RackDevice', output)
        self.assertIn('建议修复', output)

    def test_repair_encoding_issues_command_can_apply_and_restore(self):
        garbled_device_name = '华三交换机'.encode('utf-8').decode('latin1')
        datacenter = Datacenter.objects.create(name='主机房', location='7F')
        rack = Rack.objects.create(datacenter=datacenter, code='R-11', name='回滚机柜')
        device = RackDevice.objects.create(rack=rack, name=garbled_device_name, position=11, u_height=1)

        snapshot_path = Path(tempfile.mkdtemp(prefix='ipam-encoding-snapshot-')) / 'encoding_snapshot.json'
        self.addCleanup(shutil.rmtree, snapshot_path.parent, ignore_errors=True)

        preview_stdout = StringIO()
        call_command('repair_encoding_issues', '--snapshot', str(snapshot_path), stdout=preview_stdout)
        self.assertTrue(snapshot_path.exists())

        apply_stdout = StringIO()
        call_command('repair_encoding_issues', '--apply', '--snapshot', str(snapshot_path), stdout=apply_stdout)
        device.refresh_from_db()
        self.assertEqual(device.name, '华三交换机')

        restore_stdout = StringIO()
        call_command('repair_encoding_issues', '--restore', str(snapshot_path), stdout=restore_stdout)
        device.refresh_from_db()
        self.assertEqual(device.name, garbled_device_name)
