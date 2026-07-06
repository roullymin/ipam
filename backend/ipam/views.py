import gzip
import io
import csv
import ipaddress
import json
import logging
import os
import re
import secrets
import subprocess
from functools import lru_cache
from datetime import date, datetime, timedelta
from urllib.parse import quote, urlparse

import pandas as pd
import qrcode
from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.models import User
from django.core import signing
from django.db import transaction
from django.http import FileResponse, HttpResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.pdfmetrics import registerFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from rest_framework import filters, serializers, status, viewsets
from rest_framework.authentication import BasicAuthentication, SessionAuthentication
from rest_framework.decorators import action, api_view, authentication_classes, parser_classes, permission_classes
from rest_framework.exceptions import APIException, PermissionDenied
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from .models import (
    AuditLog,
    Blocklist,
    ConfigBackupTarget,
    ConfigBackupVersion,
    DatacenterChangeFirewallRule,
    DatacenterChangeRequest,
    Datacenter,
    DatacenterChangeItem,
    IPAddress,
    LoginLog,
    NetworkSection,
    Rack,
    RackDevice,
    ResidentDevice,
    ResidentIntakeLink,
    ResidentStaff,
    SecretAccessRequest,
    SecretAuditEvent,
    SecretRecord,
    Subnet,
    UserProfile,
)
from .pagination import OptionalPaginationMixin
from .permissions import (
    DatacenterChangeAccessPermission,
    DcimAccessPermission,
    DcimWritePermission,
    IpamAccessPermission,
    IpamWritePermission,
    ResidentAccessPermission,
    SecretActionPermission,
    SecretAuditPermission,
    SecretRecordPermission,
    get_user_role,
)
from .domains.backup.selectors import build_backup_summary, collect_backup_files, get_backup_dir
from .domains.backup.services import create_manual_backup, resolve_backup_download_path
from .domains.change_requests.selectors import build_change_request_topology_rows
from .domains.change_requests.services import apply_change_request_execution
from .domains.change_requests.workflow import transition_change_request
from .domains.config_backup.selectors import (
    build_config_backup_summary,
    collect_config_backup_files,
    get_config_backup_dir,
)
from .domains.config_backup.policy import (
    ConfigBackupPolicyError,
    get_or_create_config_backup_policy,
    run_config_backup_targets,
    select_policy_targets,
    send_config_backup_notification,
    summarize_failure_reasons,
    update_policy_run_state,
)
from .domains.config_backup.services import (
    ConfigBackupConnectionError,
    ConfigBackupError,
    run_config_backup_target,
    test_config_backup_target,
    test_secret_login,
)
from .domains.data_quality.services import build_encoding_report_payload
from .domains.data_quality.selectors import get_data_quality_summary
from .domains.dcim.selectors import build_public_dcim_payload
from .domains.platform.selectors import build_system_overview_payload
from .domains.public_access.services import (
    issue_resident_export_token,
    permanent_resident_intake_allowed,
    public_dcim_access_allowed,
    validate_resident_export_token,
)
from .domains.resident.selectors import build_resident_export_rows, build_resident_lookup_maps
from .domains.resident.services import (
    build_resident_import_groups,
    build_resident_import_preview,
    get_resident_row_value,
    parse_resident_approval_status,
    parse_resident_type,
    read_resident_import_dataframe,
)
from .domains.security.services import (
    get_actor_name as security_get_actor_name,
    get_client_ip as security_get_client_ip,
    record_audit as security_record_audit,
    record_login as security_record_login,
)
from .domains.vault.services import (
    VaultError,
    delete_secret as vault_delete_secret,
    read_secret as vault_read_secret,
    write_secret as vault_write_secret,
)
from .serializers import (
    AuditLogSerializer,
    BlocklistSerializer,
    ConfigBackupPolicySerializer,
    ConfigBackupTargetSerializer,
    ConfigBackupVersionSerializer,
    DatacenterChangeRequestPublicSerializer,
    DatacenterChangeRequestPublicSubmitSerializer,
    DatacenterChangeRequestSerializer,
    DatacenterSerializer,
    IPAddressSerializer,
    LoginLogSerializer,
    NetworkSectionSerializer,
    RackDeviceSerializer,
    RackSerializer,
    ResidentIntakeLinkSerializer,
    ResidentStaffSerializer,
    SecretAccessRequestSerializer,
    SecretAuditEventSerializer,
    SecretRecordSerializer,
    SubnetSerializer,
    UserSerializer,
    normalize_resident_device_payload,
)
from .text_encoding import build_encoding_report, normalize_dataframe_text, normalize_text_value, read_csv_with_fallback

logger = logging.getLogger('django')

LOGIN_LOCK_THRESHOLD = 5
LOGIN_LOCK_MINUTES = 30
APP_VERSION = os.environ.get('APP_VERSION', 'ipam-20260705')


class VaultServiceUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = '密码库暂时不可用。'
    default_code = 'vault_unavailable'


def get_client_ip(request):
    return security_get_client_ip(request)


def _repo_root():
    return settings.BASE_DIR.parent


def _run_git_command(args):
    try:
        result = subprocess.run(
            ['git', *args],
            cwd=str(_repo_root()),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=2,
            check=False,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        logger.debug('Git command failed: %s', args, exc_info=True)
    return ''


@lru_cache(maxsize=1)
def get_backend_version_payload():
    commit = _run_git_command(['rev-parse', '--short', 'HEAD']) or os.environ.get('APP_GIT_SHA', '')
    branch = _run_git_command(['rev-parse', '--abbrev-ref', 'HEAD']) or os.environ.get('APP_GIT_BRANCH', '')
    committed_at = _run_git_command(['log', '-1', '--format=%cI']) or os.environ.get('APP_GIT_COMMITTED_AT', '')
    dirty = bool(_run_git_command(['status', '--porcelain']))
    return {
        'service': 'backend',
        'version': APP_VERSION,
        'commit': commit,
        'branch': branch,
        'committed_at': committed_at,
        'dirty': dirty,
        'runtime': 'django',
    }

DCIM_RACK_HEADERS = [
    '机房名称',
    '机房位置',
    '机柜编号',
    '机柜名称',
    '高度(U)',
    '额定功率(W)',
    'PDU数量',
    'PDU实测功率(W)',
    '备注',
]

DCIM_DEVICE_HEADERS = [
    '机房名称',
    '机柜编号',
    '机柜名称',
    '设备名称',
    '起始U位',
    '占用高度(U)',
    '设备类型',
    '品牌',
    '型号',
    '管理IP',
    '项目名称',
    '负责人',
    '额定功率(W)',
    '典型功率(W)',
    '配置信息',
    '序列号(SN)',
    '固定资产编号',
    '设备状态',
    '采购日期',
    '维保到期',
    '供应商',
    'OS/固件',
]

RESIDENT_EXPORT_HEADERS = [
    '序号',
    '登记编号',
    '公司',
    '姓名',
    '职务',
    '联系方式',
    '邮箱',
    '驻场类型',
    '所属项目',
    '归属部门',
    '是否需要安排座位',
    '目前在厅办公地点',
    '座位号',
    '驻场开始日期',
    '驻场结束日期',
    '审批状态',
    '设备名称',
    '序列号',
    '品牌',
    '型号',
    '有线网卡mac地址',
    '无线网卡mac地址',
    '是否安装安全防护软件',
    '操作系统是否正版激活',
    '是否已对终端已知安全漏洞进行修补',
    '最近杀毒时间',
    '是否发现病毒、木马',
    '病毒木马说明',
    '备注',
]

RESIDENT_HEADER_ALIASES = {
    'registration_code': ['登记编号', '申请编号', '驻场编号'],
    'company': ['公司'],
    'name': ['姓名'],
    'title': ['职务', '岗位'],
    'phone': ['联系方式', '联系电话', '联系号码', '手机'],
    'email': ['邮箱', '电子邮箱'],
    'resident_type': ['驻场类型', '人员类型'],
    'project_name': ['所属项目', '项目名称'],
    'department': ['归属部门', '所属部门'],
    'needs_seat': ['是否需要安排座位', '是否安排座位'],
    'office_location': ['目前在厅办公地点', '办公地点', '办公区域', '办公位置'],
    'seat_number': ['座位号'],
    'start_date': ['驻场开始日期', '开始日期', '入场日期'],
    'end_date': ['驻场结束日期', '结束日期', '离场日期'],
    'approval_status': ['审批状态', '审核状态'],
    'device_name': ['设备名称'],
    'serial_number': ['序列号'],
    'brand': ['品牌'],
    'model': ['型号'],
    'wired_mac': ['有线网卡mac地址', '有线网卡MAC地址', '有线mac地址', '有线MAC'],
    'wireless_mac': ['无线网卡mac地址', '无线网卡MAC地址', '无线mac地址', '无线MAC'],
    'security_software_installed': ['是否安装安全防护软件'],
    'os_activated': ['操作系统是否正版激活'],
    'vulnerabilities_patched': ['是否已对终端已知安全漏洞进行修补', '是否已修补已知漏洞', '是否已修补漏洞'],
    'last_antivirus_at': ['最近杀毒时间', '最近杀毒日期'],
    'malware_found': ['是否发现病毒、木马', '是否发现病毒木马'],
    'malware_notes': ['病毒木马说明', '病毒木马情况说明'],
    'remarks': ['备注'],
}


def get_user_profile(user):
    defaults = {'role': 'admin' if user.is_staff else 'guest'}
    profile, _ = UserProfile.objects.get_or_create(user=user, defaults=defaults)
    if not profile.display_name:
        profile.display_name = user.username
        profile.save(update_fields=['display_name'])
    return profile


def record_login(username, request, action, result):
    security_record_login(
        model=LoginLog,
        username=username,
        request=request,
        action=action,
        result=result,
        logger=logger,
    )


def get_actor_name(user):
    return security_get_actor_name(user, get_user_profile)


def resolve_target_display(target):
    if target is None:
        return ''
    for field in ['registration_code', 'username', 'name', 'code', 'cidr', 'ip_address']:
        value = getattr(target, field, '')
        if value:
            return str(value)
    return str(target)


def record_audit(request, module, action, target=None, detail=''):
    security_record_audit(
        model=AuditLog,
        request=request,
        module=module,
        action=action,
        get_actor_name_fn=get_actor_name,
        target=target,
        detail=detail,
        logger=logger,
    )


def _normalize_header(value):
    text = str(normalize_text_value(value) or '').strip()
    text = text.replace('\n', '').replace('\r', '').replace(' ', '')
    if text.lower().startswith('unnamed:'):
        return ''
    return text


def _normalize_cell(value):
    return normalize_text_value(value)


def _parse_bool(value):
    normalized = str(_normalize_cell(value)).strip().lower()
    if normalized in {'1', 'true', 'yes', 'y', '是', '已', '需要', '有'}:
        return True
    if normalized in {'0', 'false', 'no', 'n', '否', '未', '不需要', '无', '沒有', '没有'}:
        return False
    return False


def _parse_date(value):
    value = _normalize_cell(value)
    if value == '':
        return None
    if isinstance(value, pd.Timestamp):
        return value.date()
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)):
        try:
            return (pd.Timestamp('1899-12-30') + pd.to_timedelta(float(value), unit='D')).date()
        except Exception:
            return None
    try:
        return pd.to_datetime(value).date()
    except Exception:
        return None


def _parse_resident_type(value):
    return parse_resident_type(value, _normalize_cell)


def _parse_approval_status(value):
    return parse_resident_approval_status(value, _normalize_cell)


def _read_resident_import_dataframe(uploaded_file):
    return read_resident_import_dataframe(
        uploaded_file=uploaded_file,
        read_csv_with_fallback=read_csv_with_fallback,
        normalize_dataframe_text=normalize_dataframe_text,
        normalize_header=_normalize_header,
        pandas_module=pd,
    )


def _get_row_value(row, field_name):
    return get_resident_row_value(
        row,
        field_name,
        header_aliases=RESIDENT_HEADER_ALIASES,
        normalize_header=_normalize_header,
        normalize_cell=_normalize_cell,
    )


def _build_resident_import_groups(dataframe, header_rows):
    return build_resident_import_groups(
        dataframe,
        header_rows,
        header_aliases=RESIDENT_HEADER_ALIASES,
        normalize_header=_normalize_header,
        normalize_cell=_normalize_cell,
        parse_bool=_parse_bool,
        parse_date=_parse_date,
    )


def _build_resident_import_preview(grouped_rows, errors, failed_rows, preview_limit=20):
    return build_resident_import_preview(
        grouped_rows=grouped_rows,
        errors=errors,
        failed_rows=failed_rows,
        build_lookup_maps=build_resident_lookup_maps,
        resident_model=ResidentStaff,
        preview_limit=preview_limit,
    )


def _get_resident_registration_url(request):
    return request.build_absolute_uri('/?resident-intake=1')


def _get_public_change_request_entry_url(request):
    return request.build_absolute_uri('/?change-request-intake=1')


def _get_resident_intake_url(request, token=''):
    suffix = '/?resident-intake=1'
    if token:
        suffix = f'{suffix}&token={token}'
    return request.build_absolute_uri(suffix)


def _build_resident_intake_link_payload(request, intake_link=None):
    if intake_link is None:
        return {
            'token': '',
            'expires_at': None,
            'created_at': None,
            'intake_url': _get_resident_registration_url(request),
            'is_permanent': permanent_resident_intake_allowed(),
            'requires_token': not permanent_resident_intake_allowed(),
        }

    payload = ResidentIntakeLinkSerializer(intake_link, context={'request': request}).data
    payload['is_permanent'] = False
    payload['requires_token'] = False
    return payload


def _resolve_resident_intake_link(token):
    normalized = str(token or '').strip()
    if not normalized:
        return None, Response({'detail': '缺少驻场登记链接令牌。'}, status=status.HTTP_400_BAD_REQUEST)

    intake_link = ResidentIntakeLink.objects.filter(token=normalized).first()
    if intake_link is None:
        return None, Response({'detail': '驻场登记链接不存在。'}, status=status.HTTP_404_NOT_FOUND)
    if intake_link.expires_at <= timezone.now():
        return None, Response({'detail': '驻场登记链接已过期。'}, status=status.HTTP_410_GONE)
    return intake_link, None


def _build_resident_qr_png(request, token=''):
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(_get_resident_intake_url(request, token))
    qr.make(fit=True)
    image = qr.make_image(fill_color='black', back_color='white')
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer


def _format_resident_display_date(value):
    if not value:
        return '未填写'
    if isinstance(value, datetime):
        value = value.date()
    return value.strftime('%Y-%m-%d')


def _build_public_change_request_template():
    return {
        'request_code': '',
        'request_type': 'assistance',
        'status': 'draft',
        'approval_code': '',
        'title': '',
        'applicant_name': '',
        'applicant_phone': '',
        'applicant_email': '',
        'company': '',
        'department': '',
        'project_name': '',
        'assistance_type': 'other_support',
        'reason': '',
        'request_content': '',
        'destination_ip': '',
        'destination_port': '',
        'firewall_open_at': '',
        'firewall_rules': [
            {
                'rule_type': 'destination',
                'destination_ip': '',
                'destination_port': '',
                'purpose': '',
                'sort_order': 0,
            }
        ],
        'ip_open_details': '',
        'ip_open_at': '',
        'access_location': '',
        'access_at': '',
        'antivirus_installed': False,
        'terminal_mac': '',
        'related_links': '',
        'impact_scope': '',
        'requires_power_down': False,
        'planned_execute_at': '',
        'token_expires_at': None,
        'public_export_url': '',
        'items': [
            {
                'device_name': '',
                'rack_device': None,
                'device_model': '',
                'serial_number': '',
                'quantity': 1,
                'is_rack_mounted': True,
                'u_height': 1,
                'power_watts': 0,
                'power_circuit': '',
                'network_role': 'none',
                'ip_quantity': 0,
                'requires_static_ip': False,
                'ip_action': 'allocate',
                'assigned_management_ip': '',
                'assigned_service_ip': '',
                'source_datacenter': None,
                'source_datacenter_name': '',
                'source_rack': None,
                'source_rack_code': '',
                'source_u_start': None,
                'source_u_end': None,
                'target_datacenter': None,
                'target_datacenter_name': '',
                'target_rack': None,
                'target_rack_code': '',
                'target_u_start': None,
                'target_u_end': None,
                'notes': '',
            }
        ],
    }


def _resolve_existing_resident_for_intake(company, name, phone='', email=''):
    company = str(company or '').strip()
    name = str(name or '').strip()
    phone = str(phone or '').strip()
    email = str(email or '').strip()

    if not company or not name:
        return None

    if phone:
        resident = ResidentStaff.objects.filter(company=company, name=name, phone=phone).first()
        if resident is not None:
            return resident

    if email:
        resident = ResidentStaff.objects.filter(company=company, name=name, email=email).first()
        if resident is not None:
            return resident

    same_name_residents = list(
        ResidentStaff.objects.filter(company=company, name=name).order_by('-updated_at', '-created_at')[:2]
    )
    if len(same_name_residents) == 1:
        return same_name_residents[0]

    return None


def _build_resident_pdf(response_buffer, resident, request):
    try:
        registerFont(UnicodeCIDFont('STSong-Light'))
    except Exception:
        pass

    styles = getSampleStyleSheet()
    base_font = 'STSong-Light'
    title_style = ParagraphStyle(
        'ResidentTitle',
        parent=styles['Title'],
        fontName=base_font,
        fontSize=18,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=10,
    )
    heading_style = ParagraphStyle(
        'ResidentHeading',
        parent=styles['Heading2'],
        fontName=base_font,
        fontSize=12,
        leading=18,
        textColor=colors.HexColor('#1d4ed8'),
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        'ResidentBody',
        parent=styles['BodyText'],
        fontName=base_font,
        fontSize=10,
        leading=15,
        textColor=colors.HexColor('#334155'),
    )

    doc = SimpleDocTemplate(
        response_buffer,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )

    elements = []
    elements.append(Paragraph('驻场人员申请签批单', title_style))
    elements.append(
        Paragraph(
            f'登记编号：{resident.registration_code}　　生成时间：{timezone.localtime().strftime("%Y-%m-%d %H:%M")}',
            body_style,
        )
    )
    elements.append(Spacer(1, 6 * mm))

    info_rows = [
        ['姓名', resident.name, '公司', resident.company],
        ['职务', resident.title or '未填写', '联系方式', resident.phone],
        ['邮箱', resident.email or '未填写', '驻场类型', resident.get_resident_type_display()],
        ['所属项目', resident.project_name or '未填写', '归属部门', resident.department or '未填写'],
        ['开始日期', _format_resident_display_date(resident.start_date), '结束日期', _format_resident_display_date(resident.end_date)],
        ['是否安排座位', '是' if resident.needs_seat else '否', '办公区域', resident.office_location or '未填写'],
        ['座位号', resident.seat_number or '未填写', '审批状态', resident.get_approval_status_display()],
        ['审核人', resident.reviewer_name or '未审核', '审核时间', _format_resident_display_date(resident.reviewed_at)],
    ]

    elements.append(Paragraph('一、人员基本信息', heading_style))
    info_table = Table(info_rows, colWidths=[22 * mm, 60 * mm, 22 * mm, 60 * mm])
    info_table.setStyle(
        TableStyle(
            [
                ('FONTNAME', (0, 0), (-1, -1), base_font),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('LEADING', (0, 0), (-1, -1), 14),
                ('BACKGROUND', (0, 0), (-1, -1), colors.white),
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#eff6ff')),
                ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#eff6ff')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#334155')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(info_table)
    elements.append(Spacer(1, 5 * mm))

    device_rows = [['设备名称', '序列号', '品牌型号', '安全软件', '正版激活', '漏洞修补', '最近杀毒']]
    for device in resident.devices.all():
        device_rows.append(
            [
                device.device_name or '未填写',
                device.serial_number or '未填写',
                ' / '.join(filter(None, [device.brand, device.model])) or '未填写',
                '是' if device.security_software_installed else '否',
                '是' if device.os_activated else '否',
                '是' if device.vulnerabilities_patched else '否',
                _format_resident_display_date(device.last_antivirus_at),
            ]
        )
    if len(device_rows) == 1:
        device_rows.append(['未备案', '-', '-', '-', '-', '-', '-'])

    elements.append(Paragraph('二、设备备案信息', heading_style))
    device_table = Table(
        device_rows,
        colWidths=[36 * mm, 32 * mm, 38 * mm, 20 * mm, 20 * mm, 20 * mm, 24 * mm],
        repeatRows=1,
    )
    device_table.setStyle(
        TableStyle(
            [
                ('FONTNAME', (0, 0), (-1, -1), base_font),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('LEADING', (0, 0), (-1, -1), 13),
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ]
        )
    )
    elements.append(device_table)
    elements.append(Spacer(1, 5 * mm))

    elements.append(Paragraph('三、备注与签批', heading_style))
    remarks = resident.remarks or '无'
    elements.append(Paragraph(f'备注：{remarks}', body_style))
    elements.append(Spacer(1, 8 * mm))

    sign_table = Table(
        [
            ['申请人签字', '', '部门负责人签字', ''],
            ['签字日期', '', '签字日期', ''],
        ],
        colWidths=[28 * mm, 55 * mm, 32 * mm, 55 * mm],
    )
    sign_table.setStyle(
        TableStyle(
            [
                ('FONTNAME', (0, 0), (-1, -1), base_font),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 18),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 18),
            ]
        )
    )
    elements.append(sign_table)
    elements.append(Spacer(1, 6 * mm))
    elements.append(Paragraph('公开登记入口：本次资料通过时效链接提交，链接过期后自动失效。', body_style))

    doc.build(elements)


def _append_resident_pdf_section(elements, resident, request, base_font, title_style, heading_style, body_style):
    elements.append(Paragraph('驻场人员申请签批单', title_style))
    elements.append(
        Paragraph(
            f'登记编号：{resident.registration_code}　　生成时间：{timezone.localtime().strftime("%Y-%m-%d %H:%M")}',
            body_style,
        )
    )
    elements.append(Spacer(1, 6 * mm))

    info_rows = [
        ['姓名', resident.name, '公司', resident.company],
        ['职务', resident.title or '未填写', '联系方式', resident.phone],
        ['邮箱', resident.email or '未填写', '驻场类型', resident.get_resident_type_display()],
        ['所属项目', resident.project_name or '未填写', '归属部门', resident.department or '未填写'],
        ['开始日期', _format_resident_display_date(resident.start_date), '结束日期', _format_resident_display_date(resident.end_date)],
        ['是否安排座位', '是' if resident.needs_seat else '否', '办公区域', resident.office_location or '未填写'],
        ['座位号', resident.seat_number or '未填写', '审批状态', resident.get_approval_status_display()],
        ['审核人', resident.reviewer_name or '未审核', '审核时间', _format_resident_display_date(resident.reviewed_at)],
    ]

    elements.append(Paragraph('一、人员基本信息', heading_style))
    info_table = Table(info_rows, colWidths=[22 * mm, 60 * mm, 22 * mm, 60 * mm])
    info_table.setStyle(
        TableStyle(
            [
                ('FONTNAME', (0, 0), (-1, -1), base_font),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('LEADING', (0, 0), (-1, -1), 14),
                ('BACKGROUND', (0, 0), (-1, -1), colors.white),
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#eff6ff')),
                ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#eff6ff')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#334155')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(info_table)
    elements.append(Spacer(1, 5 * mm))

    device_rows = [['设备名称', '序列号', '品牌型号', '安全软件', '正版激活', '漏洞修补', '最近杀毒']]
    for device in resident.devices.all():
        device_rows.append(
            [
                device.device_name or '未填写',
                device.serial_number or '未填写',
                ' / '.join(filter(None, [device.brand, device.model])) or '未填写',
                '是' if device.security_software_installed else '否',
                '是' if device.os_activated else '否',
                '是' if device.vulnerabilities_patched else '否',
                _format_resident_display_date(device.last_antivirus_at),
            ]
        )
    if len(device_rows) == 1:
        device_rows.append(['未备案', '-', '-', '-', '-', '-', '-'])

    elements.append(Paragraph('二、设备备案信息', heading_style))
    device_table = Table(
        device_rows,
        colWidths=[36 * mm, 32 * mm, 38 * mm, 20 * mm, 20 * mm, 20 * mm, 24 * mm],
        repeatRows=1,
    )
    device_table.setStyle(
        TableStyle(
            [
                ('FONTNAME', (0, 0), (-1, -1), base_font),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('LEADING', (0, 0), (-1, -1), 13),
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ]
        )
    )
    elements.append(device_table)
    elements.append(Spacer(1, 5 * mm))

    elements.append(Paragraph('三、备注与签批', heading_style))
    remarks = resident.remarks or '无'
    elements.append(Paragraph(f'备注：{remarks}', body_style))
    elements.append(Spacer(1, 8 * mm))

    sign_table = Table(
        [
            ['申请人签字', '', '项目经理签字', ''],
            ['签字日期', '', '签字日期', ''],
            ['部门负责人签字', '', '审批意见', ''],
        ],
        colWidths=[28 * mm, 55 * mm, 32 * mm, 55 * mm],
    )
    sign_table.setStyle(
        TableStyle(
            [
                ('FONTNAME', (0, 0), (-1, -1), base_font),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 18),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 18),
            ]
        )
    )
    elements.append(sign_table)
    elements.append(Spacer(1, 6 * mm))
    elements.append(Paragraph('公开登记入口：本次资料通过时效链接提交，链接过期后自动失效。', body_style))


def _build_resident_batch_pdf(response_buffer, residents, request):
    try:
        registerFont(UnicodeCIDFont('STSong-Light'))
    except Exception:
        pass

    styles = getSampleStyleSheet()
    base_font = 'STSong-Light'
    title_style = ParagraphStyle(
        'ResidentBatchTitle',
        parent=styles['Title'],
        fontName=base_font,
        fontSize=18,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=10,
    )
    heading_style = ParagraphStyle(
        'ResidentBatchHeading',
        parent=styles['Heading2'],
        fontName=base_font,
        fontSize=12,
        leading=18,
        textColor=colors.HexColor('#1d4ed8'),
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        'ResidentBatchBody',
        parent=styles['BodyText'],
        fontName=base_font,
        fontSize=10,
        leading=15,
        textColor=colors.HexColor('#334155'),
    )

    doc = SimpleDocTemplate(
        response_buffer,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )
    elements = []
    resident_list = list(residents)
    for index, resident in enumerate(resident_list):
        _append_resident_pdf_section(elements, resident, request, base_font, title_style, heading_style, body_style)
        if index < len(resident_list) - 1:
            elements.append(PageBreak())
    doc.build(elements)


def _format_change_datetime(value):
    if not value:
        return '未填写'
    if isinstance(value, datetime):
        if timezone.is_aware(value):
            value = timezone.localtime(value)
        return value.strftime('%Y-%m-%d %H:%M')
    return str(value)


def _format_change_link_status(change_request):
    if change_request.token_expires_at and change_request.token_expires_at < timezone.now():
        return '已作废或已过期'
    return f'有效期至：{_format_change_datetime(change_request.token_expires_at)}'


EQUIPMENT_ASSISTANCE_TYPES = {'rack_in', 'rack_out', 'relocate'}


def _is_equipment_assistance(change_request):
    return change_request.request_type == 'assistance' and change_request.assistance_type in EQUIPMENT_ASSISTANCE_TYPES


def _get_assistance_request_title(change_request):
    assistance_type = change_request.assistance_type or 'other_support'
    return {
        'rack_in': '设备上架申请单',
        'rack_out': '设备下架申请单',
        'relocate': '设备迁移申请单',
        'firewall_port_open': '防火墙访问开通申请单',
        'ip_open': 'IP 开通申请单',
        'external_terminal_access': '外来终端接入厅内网络申请单',
        'other_support': '其他协助申请单',
        'general_support': '协助事项申请单',
    }.get(assistance_type, '协助事项申请单')


def _get_firewall_rule_type_label(rule_type):
    return {
        'destination': '目标访问',
        'snat': 'SNAT',
    }.get(rule_type or 'destination', rule_type or '目标访问')


def _get_pdf_text(value):
    if value is None:
        return ''
    text = str(value).strip()
    return '' if text in {'未填写', 'None'} else text


def _append_pdf_pair_row(rows, left_label, left_value='', right_label='', right_value=''):
    left_text = _get_pdf_text(left_value)
    right_text = _get_pdf_text(right_value)
    if not left_text and not right_text:
        return
    rows.append([left_label, left_text, right_label, right_text])


def _append_pdf_detail_row(rows, label, value):
    text = _get_pdf_text(value)
    if text:
        rows.append([label, text])


def _get_pdf_value(value, placeholder='—'):
    text = _get_pdf_text(value)
    return text or placeholder


def _get_section_heading(index, title):
    numerals = '一二三四五六七八九十'
    prefix = numerals[index - 1] if 1 <= index <= len(numerals) else str(index)
    return f'{prefix}、{title}'


def _sanitize_pdf_filename_part(value, default='申请单'):
    text = _get_pdf_text(value)
    if not text:
        return default
    text = re.sub(r'[\\/:*?"<>|\r\n]+', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:48].strip() or default


def _build_change_request_export_filename(change_request):
    title_text = _get_pdf_text(change_request.title)
    request_content = _get_pdf_text(change_request.request_content)
    reason = _get_pdf_text(change_request.reason)
    first_rule_purpose = ''
    if change_request.request_type == 'assistance' and change_request.assistance_type == 'firewall_port_open':
        first_rule = change_request.firewall_rules.order_by('sort_order', 'id').first()
        if first_rule:
            first_rule_purpose = _get_pdf_text(first_rule.purpose)

    default_name = _get_assistance_request_title(change_request).replace('申请单', '') if change_request.request_type == 'assistance' else '机房设备变更申请'
    filename_base = next(
        (
            _sanitize_pdf_filename_part(candidate, default_name)
            for candidate in [first_rule_purpose, request_content, reason, title_text, default_name]
            if _get_pdf_text(candidate)
        ),
        default_name,
    )
    return f'{filename_base}.pdf'


def _set_pdf_download_filename(response, filename):
    ascii_base = re.sub(r'[^A-Za-z0-9._-]+', '_', os.path.splitext(filename)[0]).strip('._') or 'request'
    ascii_filename = f'{ascii_base}.pdf'
    response['Content-Disposition'] = f"attachment; filename=\"{ascii_filename}\"; filename*=UTF-8''{quote(filename)}"


def _build_change_request_pdf(response_buffer, change_request):
    try:
        registerFont(UnicodeCIDFont('STSong-Light'))
    except Exception:
        pass

    styles = getSampleStyleSheet()
    base_font = 'STSong-Light'
    title_style = ParagraphStyle(
        'ChangeRequestTitle',
        parent=styles['Title'],
        fontName=base_font,
        fontSize=18,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=10,
    )
    heading_style = ParagraphStyle(
        'ChangeRequestHeading',
        parent=styles['Heading2'],
        fontName=base_font,
        fontSize=12,
        leading=18,
        textColor=colors.HexColor('#1d4ed8'),
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        'ChangeRequestBody',
        parent=styles['BodyText'],
        fontName=base_font,
        fontSize=10,
        leading=15,
        textColor=colors.HexColor('#334155'),
    )
    intro_style = ParagraphStyle(
        'ChangeRequestIntro',
        parent=body_style,
        fontName=base_font,
        fontSize=10,
        leading=16,
        textColor=colors.HexColor('#64748b'),
        alignment=1,
        spaceAfter=4 * mm,
    )
    signature_style = ParagraphStyle(
        'ChangeRequestSignature',
        parent=body_style,
        fontName=base_font,
        fontSize=11,
        leading=18,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=2 * mm,
    )

    doc = SimpleDocTemplate(
        response_buffer,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )

    type_label = dict(DatacenterChangeRequest._meta.get_field('request_type').choices).get(
        change_request.request_type,
        change_request.request_type,
    )
    assistance_label = dict(DatacenterChangeRequest._meta.get_field('assistance_type').choices).get(
        change_request.assistance_type,
        change_request.assistance_type,
    )

    if change_request.request_type == 'assistance':
        title_text = _get_assistance_request_title(change_request)
    else:
        title_text = '机房设备变更申请单'

    elements = [
        Paragraph(title_text, title_style),
        Paragraph('请核对申请重点信息与实施内容后签字确认。', intro_style),
        Spacer(1, 2 * mm),
    ]
    section_index = 1

    info_rows = []
    if change_request.request_type == 'assistance':
        info_rows = [
            ['协助分类', _get_pdf_value(assistance_label), '申请标题', _get_pdf_value(change_request.title or title_text)],
            ['申请单位', _get_pdf_value(change_request.company), '需求处室', _get_pdf_value(change_request.department)],
            ['需求联系人', _get_pdf_value(change_request.applicant_name), '联系方式', _get_pdf_value(change_request.applicant_phone)],
            ['联系邮箱', _get_pdf_value(change_request.applicant_email), '项目名称', _get_pdf_value(change_request.project_name)],
        ]
    else:
        info_rows = [
            ['申请类型', _get_pdf_value(type_label), '申请标题', _get_pdf_value(change_request.title or type_label)],
            ['所属单位', _get_pdf_value(change_request.company), '所属部门', _get_pdf_value(change_request.department)],
            ['申请人', _get_pdf_value(change_request.applicant_name), '联系电话', _get_pdf_value(change_request.applicant_phone)],
            ['联系邮箱', _get_pdf_value(change_request.applicant_email), '所属项目', _get_pdf_value(change_request.project_name)],
        ]
        if change_request.requires_power_down:
            info_rows.append(['是否需要下电', '是', '', ''])

    elements.append(Paragraph(_get_section_heading(section_index, '申请信息'), heading_style))
    section_index += 1
    info_table = Table(info_rows, colWidths=[22 * mm, 60 * mm, 22 * mm, 60 * mm])
    info_table.setStyle(
        TableStyle(
            [
                ('FONTNAME', (0, 0), (-1, -1), base_font),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('LEADING', (0, 0), (-1, -1), 14),
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#eef5ff')),
                ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#eef5ff')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#334155')),
                ('BOX', (0, 0), (-1, -1), 0.8, colors.HexColor('#cbd5e1')),
                ('INNERGRID', (0, 0), (-1, -1), 0.55, colors.HexColor('#d7e0ea')),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]
        )
    )
    elements.append(info_table)
    elements.append(Spacer(1, 5 * mm))

    detail_rows = []
    _append_pdf_detail_row(detail_rows, '申请原因', change_request.reason)
    if change_request.request_type == 'assistance':
        _append_pdf_detail_row(detail_rows, '协助内容', change_request.request_content)
        if change_request.assistance_type == 'firewall_port_open':
            firewall_rules = list(change_request.firewall_rules.all())
            if not firewall_rules and (change_request.destination_ip or change_request.destination_port):
                firewall_rules = [
                    DatacenterChangeFirewallRule(
                        rule_type='destination',
                        destination_ip=change_request.destination_ip or '',
                        destination_port=change_request.destination_port or '',
                        purpose='',
                    )
                ]
            _append_pdf_detail_row(detail_rows, '规则开通时间', _format_change_datetime(change_request.firewall_open_at))
            if change_request.related_links:
                _append_pdf_detail_row(detail_rows, '相关链接', change_request.related_links)
        elif change_request.assistance_type == 'ip_open':
            _append_pdf_detail_row(detail_rows, 'IP 开通说明', change_request.ip_open_details)
            _append_pdf_detail_row(detail_rows, 'IP 开通时间', _format_change_datetime(change_request.ip_open_at))
            if change_request.related_links:
                _append_pdf_detail_row(detail_rows, '相关链接', change_request.related_links)
        elif change_request.assistance_type == 'external_terminal_access':
            _append_pdf_detail_row(detail_rows, '接入位置', change_request.access_location)
            _append_pdf_detail_row(detail_rows, '接入时间', _format_change_datetime(change_request.access_at))
            _append_pdf_detail_row(detail_rows, '是否已杀毒', '是' if change_request.antivirus_installed else '')
            _append_pdf_detail_row(detail_rows, '终端 MAC 地址', change_request.terminal_mac)
            if change_request.related_links:
                _append_pdf_detail_row(detail_rows, '相关链接', change_request.related_links)
        elif change_request.related_links:
            _append_pdf_detail_row(detail_rows, '相关链接', change_request.related_links)
    else:
        _append_pdf_detail_row(detail_rows, '影响范围', change_request.impact_scope)

    has_firewall_table = change_request.request_type == 'assistance' and change_request.assistance_type == 'firewall_port_open'
    if detail_rows or has_firewall_table:
        detail_heading = '协助内容' if change_request.request_type == 'assistance' else '变更说明'
        elements.append(Paragraph(_get_section_heading(section_index, detail_heading), heading_style))
        section_index += 1
    if detail_rows:
        detail_table = Table(detail_rows, colWidths=[28 * mm, 136 * mm])
        detail_table.setStyle(
            TableStyle(
                [
                    ('FONTNAME', (0, 0), (-1, -1), base_font),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('LEADING', (0, 0), (-1, -1), 14),
                    ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#eff6ff')),
                    ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#334155')),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ]
            )
        )
        elements.append(detail_table)
    if has_firewall_table:
        elements.append(Spacer(1, 2 * mm))
        elements.append(Paragraph('访问规则', signature_style))
        elements.append(Spacer(1, 2 * mm))
        rule_rows = [['序号', '规则类型', '地址', '端口', '用途说明']]
        if firewall_rules:
            for index, rule in enumerate(firewall_rules, start=1):
                rule_rows.append(
                    [
                        str(index),
                        _get_firewall_rule_type_label(getattr(rule, 'rule_type', 'destination')),
                        _get_pdf_text(rule.destination_ip),
                        _get_pdf_text(rule.destination_port),
                        _get_pdf_text(rule.purpose),
                    ]
                )
        if len(rule_rows) > 1:
            firewall_table = Table(rule_rows, colWidths=[12 * mm, 24 * mm, 38 * mm, 28 * mm, 68 * mm], repeatRows=1)
            firewall_table.setStyle(
                TableStyle(
                    [
                        ('FONTNAME', (0, 0), (-1, -1), base_font),
                        ('FONTSIZE', (0, 0), (-1, -1), 9),
                        ('LEADING', (0, 0), (-1, -1), 13),
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ('LEFTPADDING', (0, 0), (-1, -1), 5),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                        ('TOPPADDING', (0, 0), (-1, -1), 5),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                    ]
                )
            )
            elements.append(firewall_table)
    elements.append(Spacer(1, 5 * mm))

    show_item_table = change_request.request_type != 'assistance' or _is_equipment_assistance(change_request)
    if show_item_table:
        item_heading = '设备明细' if change_request.request_type != 'assistance' else '设备信息'
        elements.append(Paragraph(_get_section_heading(section_index, item_heading), heading_style))
        section_index += 1
        item_rows = [[
            '设备名称',
            '型号/序列号',
            '数量/U',
            '网络',
            'IP/动作',
            '位置',
            '备注',
        ]]
        for item in change_request.items.all():
            network_label = dict(DatacenterChangeItem._meta.get_field('network_role').choices).get(
                item.network_role,
                item.network_role,
            )
            ip_action_label = dict(DatacenterChangeItem._meta.get_field('ip_action').choices).get(
                item.ip_action,
                item.ip_action,
            )
            ip_lines = []
            if item.assigned_management_ip:
                ip_lines.append(f'管理：{item.assigned_management_ip}')
            if item.assigned_service_ip:
                ip_lines.append(f'业务：{item.assigned_service_ip}')
            ip_lines.append(f'动作：{ip_action_label}')
            location_lines = []
            if item.source_rack_id:
                location_lines.append(f'源：{item.source_rack.code} / {item.source_u_start or "-"}-{item.source_u_end or "-"}')
            if item.target_rack_id:
                location_lines.append(f'目标：{item.target_rack.code} / {item.target_u_start or "-"}-{item.target_u_end or "-"}')
            item_rows.append(
                [
                    _get_pdf_text(item.device_name),
                    _get_pdf_text(' / '.join(filter(None, [item.device_model, item.serial_number]))),
                    f'{item.quantity} 台 / {item.u_height}U',
                    network_label,
                    '\n'.join(ip_lines),
                    _get_pdf_text('\n'.join(location_lines)),
                    _get_pdf_text(item.notes),
                ]
            )

        item_table = Table(
            item_rows,
            colWidths=[28 * mm, 34 * mm, 18 * mm, 18 * mm, 30 * mm, 34 * mm, 20 * mm],
            repeatRows=1,
        )
        item_table.setStyle(
            TableStyle(
                [
                    ('FONTNAME', (0, 0), (-1, -1), base_font),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('FONTSIZE', (0, 1), (-1, -1), 8.5),
                    ('LEADING', (0, 0), (-1, -1), 12),
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dbeafe')),
                    ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#334155')),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 5),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ]
            )
        )
        elements.append(item_table)
        elements.append(Spacer(1, 5 * mm))

    signature_heading = '签字确认'
    elements.append(Paragraph(_get_section_heading(section_index, signature_heading), heading_style))
    elements.append(Paragraph('以下签字用于确认申请内容、业务需求与领导审批意见。', body_style))
    elements.append(Spacer(1, 2 * mm))
    if change_request.request_type == 'assistance':
        signature_rows = [
            ['申请人确认', '已确认本申请内容真实、完整。', '签字：____________________', '日期：____________________'],
            ['业务处室审核', '已核对本次协助需求与实施范围。', '签字：____________________', '日期：____________________'],
            ['科信处领导审批', '同意按本申请内容安排实施。', '签字：____________________', '日期：____________________'],
        ]
    else:
        signature_rows = [
            ['申请人确认', '已确认本次变更内容与影响范围。', '签字：____________________', '日期：____________________'],
            ['审批领导签字', '同意按本申请单安排实施。', '签字：____________________', '日期：____________________'],
            ['执行确认签字', '已确认实施完成情况。', '签字：____________________', '日期：____________________'],
        ]
    signature_table = Table(signature_rows, colWidths=[26 * mm, 60 * mm, 42 * mm, 34 * mm])
    signature_table.setStyle(
        TableStyle(
            [
                ('FONTNAME', (0, 0), (-1, -1), base_font),
                ('FONTSIZE', (0, 0), (-1, -1), 10.5),
                ('LEADING', (0, 0), (-1, -1), 18),
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#eef5ff')),
                ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#f8fbff')),
                ('BOX', (0, 0), (-1, -1), 0.8, colors.HexColor('#cbd5e1')),
                ('INNERGRID', (0, 0), (-1, -1), 0.55, colors.HexColor('#d7e0ea')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 12),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ]
        )
    )
    elements.append(signature_table)
    doc.build(elements)


@api_view(['GET'])
@permission_classes([AllowAny])
@authentication_classes([])
def api_csrf(request):
    return Response({'status': 'success', 'csrfToken': get_token(request)})


@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def api_login(request):
    username = (request.data.get('username') or '').strip()
    password = request.data.get('password') or ''

    if not username or not password:
        return Response({'status': 'error', 'message': '用户名和密码不能为空'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(username=username).first()
    profile = get_user_profile(user) if user else None

    if user and not user.is_active:
        record_login(username, request, 'login', 'inactive')
        return Response({'status': 'error', 'message': '该账号已被停用'}, status=status.HTTP_403_FORBIDDEN)

    if profile and profile.locked_until and profile.locked_until > timezone.now():
        remain_seconds = int((profile.locked_until - timezone.now()).total_seconds())
        remain_minutes = max(1, remain_seconds // 60)
        record_login(username, request, 'login', 'locked')
        return Response(
            {'status': 'error', 'message': f'账号已锁定，请 {remain_minutes} 分钟后重试'},
            status=status.HTTP_423_LOCKED,
        )

    auth_user = authenticate(request, username=username, password=password)
    if auth_user is None:
        if profile:
            profile.failed_login_attempts += 1
            if profile.failed_login_attempts >= LOGIN_LOCK_THRESHOLD:
                profile.locked_until = timezone.now() + timedelta(minutes=LOGIN_LOCK_MINUTES)
            profile.save(update_fields=['failed_login_attempts', 'locked_until'])
        record_login(username, request, 'login', 'failed')
        return Response({'status': 'error', 'message': '用户名或密码错误'}, status=status.HTTP_401_UNAUTHORIZED)

    profile = get_user_profile(auth_user)
    profile.failed_login_attempts = 0
    profile.locked_until = None
    profile.save(update_fields=['failed_login_attempts', 'locked_until'])

    login(request, auth_user)
    token = get_token(request)
    record_login(username, request, 'login', 'success')

    response = Response(
        {
            'status': 'success',
            'csrfToken': token,
            'user': UserSerializer(auth_user).data,
            'requires_password_change': profile.must_change_password,
        }
    )
    response.set_cookie('csrftoken', token, httponly=False, samesite='Lax', path='/')
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@authentication_classes([SessionAuthentication, BasicAuthentication])
def api_me(request):
    return Response({'status': 'success', 'user': UserSerializer(request.user).data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([SessionAuthentication, BasicAuthentication])
def api_logout(request):
    record_login(request.user.username, request, 'logout', 'success')
    logout(request)
    return Response({'status': 'success'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([SessionAuthentication, BasicAuthentication])
def api_change_password(request):
    current_password = request.data.get('current_password') or ''
    new_password = request.data.get('new_password') or ''

    if not current_password or not new_password:
        return Response({'status': 'error', 'message': '当前密码和新密码不能为空'}, status=status.HTTP_400_BAD_REQUEST)

    if not request.user.check_password(current_password):
        return Response({'status': 'error', 'message': '当前密码不正确'}, status=status.HTTP_400_BAD_REQUEST)

    request.user.set_password(new_password)
    request.user.save(update_fields=['password'])

    profile = get_user_profile(request.user)
    profile.must_change_password = False
    profile.last_password_changed_at = timezone.now()
    profile.failed_login_attempts = 0
    profile.locked_until = None
    profile.save(update_fields=['must_change_password', 'last_password_changed_at', 'failed_login_attempts', 'locked_until'])

    update_session_auth_hash(request, request.user)
    record_login(request.user.username, request, 'change_password', 'success')
    record_audit(request, 'user', 'change_password', request.user, '用户修改了自己的登录密码')
    return Response({'status': 'success', 'user': UserSerializer(request.user).data})


class BaseViewSet(viewsets.ModelViewSet):
    authentication_classes = (SessionAuthentication, BasicAuthentication)
    permission_classes = [IsAuthenticated]
    audit_module = 'generic'

    def perform_create(self, serializer):
        instance = serializer.save()
        record_audit(self.request, self.audit_module, 'create', instance, '新增记录')

    def perform_update(self, serializer):
        instance = serializer.save()
        record_audit(self.request, self.audit_module, 'update', instance, '更新记录')

    def perform_destroy(self, instance):
        detail = f'删除记录：{resolve_target_display(instance)}'
        record_audit(self.request, self.audit_module, 'delete', instance, detail)
        instance.delete()


class NetworkSectionViewSet(OptionalPaginationMixin, BaseViewSet):
    audit_module = 'network_section'
    permission_classes = [IpamAccessPermission]
    queryset = NetworkSection.objects.all()
    serializer_class = NetworkSectionSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description']


class SubnetViewSet(OptionalPaginationMixin, BaseViewSet):
    audit_module = 'subnet'
    permission_classes = [IpamAccessPermission]
    queryset = Subnet.objects.select_related('section').all()
    serializer_class = SubnetSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'cidr', 'location', 'circuit_id']


class IPAddressViewSet(OptionalPaginationMixin, BaseViewSet):
    audit_module = 'ip_address'
    permission_classes = [IpamAccessPermission]
    queryset = IPAddress.objects.select_related('subnet').all()
    serializer_class = IPAddressSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['ip_address', 'device_name', 'owner', 'description', 'nat_ip']


class UserViewSet(BaseViewSet):
    audit_module = 'user'
    permission_classes = [IsAdminUser]
    queryset = User.objects.all().select_related('profile').order_by('username')
    serializer_class = UserSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        role = request.data.get('role')
        is_active = request.data.get('is_active')

        if instance == request.user:
            if is_active in (False, 'false', 'False', '0', 0):
                return Response(
                    {'detail': '不能停用当前登录账号'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if role and role != 'admin':
                return Response(
                    {'detail': '不能移除当前登录账号的超级管理员权限'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        return super().update(request, *args, partial=partial, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance == request.user:
            return Response(
                {'detail': '不能删除当前登录账号'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def unlock(self, request, pk=None):
        user = self.get_object()
        profile = get_user_profile(user)
        profile.failed_login_attempts = 0
        profile.locked_until = None
        profile.save(update_fields=['failed_login_attempts', 'locked_until'])
        record_audit(request, self.audit_module, 'unlock', user, '管理员手动解锁账号')
        return Response({'status': 'success', 'user': UserSerializer(user).data})


class LoginLogViewSet(viewsets.ReadOnlyModelViewSet):
    authentication_classes = (SessionAuthentication, BasicAuthentication)
    permission_classes = [IsAdminUser]
    queryset = LoginLog.objects.all().order_by('-timestamp')
    serializer_class = LoginLogSerializer
    pagination_class = OptionalPaginationMixin.pagination_class
    filter_backends = [filters.SearchFilter]
    search_fields = ['username', 'ip_address', 'action', 'status']

    def list(self, request, *args, **kwargs):
        return OptionalPaginationMixin.list(self, request, *args, **kwargs)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    authentication_classes = (SessionAuthentication, BasicAuthentication)
    permission_classes = [IsAdminUser]
    queryset = AuditLog.objects.all().order_by('-created_at')
    serializer_class = AuditLogSerializer
    pagination_class = OptionalPaginationMixin.pagination_class
    filter_backends = [filters.SearchFilter]
    search_fields = ['actor_name', 'module', 'action', 'target_display', 'detail', 'ip_address']

    def list(self, request, *args, **kwargs):
        return OptionalPaginationMixin.list(self, request, *args, **kwargs)


def record_secret_audit(request, secret, action, result='success', reason=''):
    return SecretAuditEvent.objects.create(
        secret=secret,
        user=request.user if request.user.is_authenticated else None,
        secret_name=secret.name if secret else '',
        action=action,
        result=result,
        reason=reason,
        ip_address=get_client_ip(request),
    )


SECRET_BULK_FIELD_ALIASES = {
    'name': {'name', '名称', '凭据名称', '密码名称'},
    'management_ip': {'management_ip', 'mgmt_ip', 'ip', '管理ip', '管理IP', '设备IP', '目标IP', '地址'},
    'device_name': {'device_name', '设备名称', '资产名称', '主机名'},
    'username': {'username', 'secret_username', '账号', '用户名', '登录账号'},
    'password': {'password', 'secret_value', '密码', '口令', '密钥'},
    'credential_type': {'credential_type', '凭据类型', '类型'},
    'owner_team': {'owner_team', '责任团队', '团队', '部门', '负责人'},
    'environment': {'environment', '环境'},
    'sensitivity': {'sensitivity', '敏感级别', '密级'},
    'rotation_days': {'rotation_days', '轮换周期', '轮换天数'},
    'expires_at': {'expires_at', '到期时间', '过期时间'},
    'status': {'status', '状态'},
    'notes': {'notes', '备注', '说明'},
}

SECRET_BULK_CHOICE_ALIASES = {
    'credential_type': {
        'ssh': 'ssh',
        'SSH': 'ssh',
        '设备账号': 'device',
        'device': 'device',
        '数据库': 'database',
        'database': 'database',
        'web': 'web',
        'Web 后台': 'web',
        'api_key': 'api_key',
        'API Key': 'api_key',
        'other': 'other',
        '其他': 'other',
    },
    'environment': {
        'production': 'production',
        '生产': 'production',
        'test': 'test',
        '测试': 'test',
        'development': 'development',
        '开发': 'development',
        'other': 'other',
        '其他': 'other',
    },
    'sensitivity': {
        'internal': 'internal',
        '内部': 'internal',
        'confidential': 'confidential',
        '机密': 'confidential',
        'restricted': 'restricted',
        '严格受限': 'restricted',
    },
    'status': {
        'active': 'active',
        '有效': 'active',
        'disabled': 'disabled',
        '停用': 'disabled',
    },
}


def _canonical_secret_bulk_field(name):
    raw = str(name or '').strip()
    lowered = raw.lower().replace(' ', '_')
    for field_name, aliases in SECRET_BULK_FIELD_ALIASES.items():
        if raw in aliases or lowered in {str(alias).lower().replace(' ', '_') for alias in aliases}:
            return field_name
    return lowered


def _parse_secret_bulk_rows(csv_text):
    content = str(csv_text or '').lstrip('\ufeff').strip()
    if not content:
        raise ValueError('请粘贴 CSV 内容。')
    try:
        dialect = csv.Sniffer().sniff(content[:2048], delimiters=',;\t')
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(content), dialect=dialect)
    if not reader.fieldnames:
        raise ValueError('CSV 需要包含表头。')
    rows = []
    for row in reader:
        normalized = {}
        for key, value in (row or {}).items():
            field_name = _canonical_secret_bulk_field(key)
            if field_name not in SECRET_BULK_FIELD_ALIASES:
                continue
            normalized[field_name] = str(value or '') if field_name == 'password' else str(value or '').strip()
        if any(str(value or '').strip() for value in normalized.values()):
            rows.append(normalized)
    if not rows:
        raise ValueError('CSV 中没有可导入的数据行。')
    return rows


def _normalize_secret_bulk_choice(field_name, value, default):
    raw = str(value or '').strip()
    if not raw:
        return default
    aliases = SECRET_BULK_CHOICE_ALIASES.get(field_name, {})
    return aliases.get(raw) or aliases.get(raw.lower()) or raw


def _parse_secret_bulk_datetime(value):
    raw = str(value or '').strip()
    if not raw:
        return None
    parsed = parse_datetime(raw)
    if parsed is None:
        try:
            parsed = datetime.fromisoformat(raw)
        except ValueError:
            return raw
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed.isoformat()


def _resolve_secret_bulk_target(row):
    management_ip = _extract_management_host(row.get('management_ip'))
    device_name = str(row.get('device_name') or '').strip()
    rack_device = None
    ip_asset = None
    if management_ip:
        rack_device = RackDevice.objects.filter(mgmt_ip__iexact=management_ip).select_related(
            'rack',
            'rack__datacenter',
        ).first()
        ip_asset = IPAddress.objects.filter(ip_address=management_ip).first()
    if rack_device is None and device_name:
        rack_device = RackDevice.objects.filter(name__iexact=device_name).select_related(
            'rack',
            'rack__datacenter',
        ).first()
    if rack_device is not None:
        return {
            'target_type': 'device',
            'rack_device': rack_device.pk,
            'ip_address': None,
            'target_label': f'{rack_device.rack.datacenter.name} / {rack_device.rack.code} / {rack_device.name}',
            'management_ip': management_ip or rack_device.mgmt_ip or '',
        }
    if ip_asset is not None:
        return {
            'target_type': 'ip',
            'rack_device': None,
            'ip_address': ip_asset.pk,
            'target_label': ip_asset.ip_address,
            'management_ip': management_ip,
        }
    return {
        'target_type': 'general',
        'rack_device': None,
        'ip_address': None,
        'target_label': management_ip or device_name or '通用凭据',
        'management_ip': management_ip,
    }


def _build_secret_bulk_payload(row):
    username = str(row.get('username') or '').strip()
    secret_value = str(row.get('password') or '')
    if not username:
        raise ValueError('账号不能为空。')
    if secret_value == '':
        raise ValueError('密码不能为空。')

    target = _resolve_secret_bulk_target(row)
    rotation_days = row.get('rotation_days') or 90
    try:
        rotation_days = int(rotation_days)
    except (TypeError, ValueError) as exc:
        raise ValueError('轮换周期必须是数字。') from exc
    display_name = str(row.get('name') or '').strip() or f'{target["target_label"]} {username}'
    payload = {
        'name': display_name[:160],
        'credential_type': _normalize_secret_bulk_choice('credential_type', row.get('credential_type'), 'ssh'),
        'target_type': target['target_type'],
        'rack_device': target['rack_device'],
        'ip_address': target['ip_address'],
        'datacenter': None,
        'rack': None,
        'secret_username': username,
        'secret_value': secret_value,
        'owner_team': str(row.get('owner_team') or '').strip(),
        'environment': _normalize_secret_bulk_choice('environment', row.get('environment'), 'production'),
        'sensitivity': _normalize_secret_bulk_choice('sensitivity', row.get('sensitivity'), 'confidential'),
        'expires_at': _parse_secret_bulk_datetime(row.get('expires_at')),
        'rotation_days': rotation_days,
        'status': _normalize_secret_bulk_choice('status', row.get('status'), 'active'),
        'notes': str(row.get('notes') or '').strip(),
    }
    return payload, target


def _find_secret_bulk_conflict(payload):
    username = payload.get('secret_username') or ''
    queryset = SecretRecord.objects.filter(username_hint=username).order_by('-updated_at', '-id')
    target_type = payload.get('target_type')
    if target_type == 'device' and payload.get('rack_device'):
        return queryset.filter(target_type='device', rack_device_id=payload['rack_device']).first()
    if target_type == 'ip' and payload.get('ip_address'):
        return queryset.filter(target_type='ip', ip_address_id=payload['ip_address']).first()
    return queryset.filter(target_type='general', name__iexact=payload.get('name') or '').first()


def _parse_id_list(value):
    if value in (None, ''):
        return []
    if isinstance(value, str):
        candidates = [item.strip() for item in value.split(',')]
    elif isinstance(value, (list, tuple, set)):
        candidates = value
    else:
        candidates = [value]
    ids = []
    for item in candidates:
        if item in (None, ''):
            continue
        try:
            ids.append(int(item))
        except (TypeError, ValueError):
            raise ValueError('ID 列表只能包含数字。')
    return ids


def _parse_positive_int(value, default, *, minimum=1, maximum=None, field_name='数值'):
    try:
        parsed = int(value if value not in (None, '') else default)
    except (TypeError, ValueError):
        raise ValueError(f'{field_name}必须是数字。')
    if parsed < minimum:
        raise ValueError(f'{field_name}不能小于 {minimum}。')
    if maximum is not None and parsed > maximum:
        raise ValueError(f'{field_name}不能大于 {maximum}。')
    return parsed


def _backup_device_type_with_template_state(value):
    raw = str(value or '').strip()
    lowered = raw.lower()
    device_type = _normalize_backup_device_type(raw)
    known_markers = {
        'switch': ('switch', '交换'),
        'router': ('router', 'route', '路由'),
        'firewall': ('firewall', 'fw', '防火'),
    }
    recognized = bool(raw) and any(marker in lowered for marker in known_markers.get(device_type, ()))
    if not recognized:
        return device_type, 'warning', '设备类型未明确匹配到网络备份模板，请先确认厂商/命令模板。'
    return device_type, 'ok', ''


def _resolve_secret_login_target(secret):
    rack_device = secret.rack_device if getattr(secret, 'rack_device_id', None) else None
    ip_asset = secret.ip_address if getattr(secret, 'ip_address_id', None) else None
    management_ip = ''
    raw_device_type = ''
    name = secret.name
    target_label = secret.name
    location = ''

    if rack_device is not None:
        management_ip = _extract_management_host(rack_device.mgmt_ip)
        raw_device_type = rack_device.device_type
        name = rack_device.name or secret.name
        rack_label = ''
        if rack_device.rack_id:
            rack_label = f'{rack_device.rack.datacenter.name if rack_device.rack.datacenter_id else ""} / {rack_device.rack.code}'
        target_label = f'{name}{f" / {management_ip}" if management_ip else ""}'
        location = rack_label.strip(' /')
    elif ip_asset is not None:
        management_ip = _extract_management_host(ip_asset.ip_address)
        raw_device_type = ip_asset.device_type
        name = ip_asset.device_name or secret.name or ip_asset.ip_address
        target_label = f'{name} / {ip_asset.ip_address}'

    device_type, template_status, template_detail = _backup_device_type_with_template_state(raw_device_type)
    return {
        'management_ip': management_ip,
        'rack_device': rack_device,
        'ip_asset': ip_asset,
        'name': name,
        'target_label': target_label,
        'location': location,
        'raw_device_type': raw_device_type,
        'device_type': device_type,
        'template_status': template_status,
        'template_detail': template_detail,
    }


def _classify_login_failure(detail):
    message = str(detail or '')
    lowered = message.lower()
    if '认证' in message or '密码' in message or 'authentication' in lowered or 'auth' in lowered:
        return 'auth_failed', '账号或密码错误'
    if '超时' in message or 'timed out' in lowered or 'timeout' in lowered:
        return 'timeout', '连接超时'
    if '拒绝' in message or 'connection refused' in lowered:
        return 'refused', '端口拒绝连接'
    if '不可达' in message or 'no route to host' in lowered or 'network is unreachable' in lowered:
        return 'unreachable', '网络不可达'
    if '解析' in message or 'name or service not known' in lowered or 'temporary failure in name resolution' in lowered:
        return 'resolve_failed', '管理地址无法解析'
    if 'paramiko' in lowered or '依赖' in message:
        return 'dependency', '后端依赖缺失'
    return 'other', '其他失败'


class SecretRecordViewSet(OptionalPaginationMixin, BaseViewSet):
    audit_module = 'secret_record'
    permission_classes = [SecretRecordPermission]
    queryset = SecretRecord.objects.select_related(
        'datacenter',
        'rack',
        'rack__datacenter',
        'rack_device',
        'rack_device__rack',
        'rack_device__rack__datacenter',
        'ip_address',
        'created_by',
    ).all()
    serializer_class = SecretRecordSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'username_hint', 'owner_team', 'notes']

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        payload = instance._pending_secret_payload
        try:
            vault_write_secret(
                instance.vault_path,
                payload['username'],
                payload['secret_value'],
                {'record_id': instance.pk, 'name': instance.name},
            )
        except VaultError as exc:
            raise VaultServiceUnavailable(str(exc)) from exc
        instance.last_rotated_at = timezone.now()
        instance.save(update_fields=['last_rotated_at', 'updated_at'])
        record_secret_audit(self.request, instance, 'create', reason='创建密码台账')
        record_audit(self.request, self.audit_module, 'create', instance, '创建密码台账（密文存储于 OpenBao）')

    def perform_update(self, serializer):
        instance = serializer.save()
        payload = getattr(instance, '_pending_secret_payload', None)
        if payload:
            try:
                vault_write_secret(
                    instance.vault_path,
                    payload['username'],
                    payload['secret_value'],
                    {'record_id': instance.pk, 'name': instance.name},
                )
            except VaultError as exc:
                raise VaultServiceUnavailable(str(exc)) from exc
            instance.last_rotated_at = timezone.now()
            instance.save(update_fields=['last_rotated_at', 'updated_at'])
        record_secret_audit(
            self.request,
            instance,
            'rotate' if payload else 'update',
            reason='轮换密码' if payload else '更新密码台账',
        )
        record_audit(self.request, self.audit_module, 'update', instance, '更新密码台账')

    @action(detail=False, methods=['post'], url_path='bulk-import')
    def bulk_import(self, request):
        conflict_mode = str(request.data.get('conflict_mode') or 'update').strip().lower()
        if conflict_mode not in {'update', 'skip', 'create'}:
            return Response({'detail': '冲突策略只能是 update、skip 或 create。'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            rows = _parse_secret_bulk_rows(request.data.get('csv_text') or request.data.get('content') or '')
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        results = []
        counters = {'created': 0, 'updated': 0, 'skipped': 0, 'failed': 0}
        for index, row in enumerate(rows, start=2):
            management_ip = _extract_management_host(row.get('management_ip'))
            try:
                payload, target = _build_secret_bulk_payload(row)
            except ValueError as exc:
                counters['failed'] += 1
                results.append(
                    {
                        'row': index,
                        'status': 'failed',
                        'action': 'validate',
                        'name': row.get('name') or '',
                        'management_ip': management_ip,
                        'target': '-',
                        'detail': str(exc),
                    }
                )
                continue

            existing = None if conflict_mode == 'create' else _find_secret_bulk_conflict(payload)
            if existing is not None and conflict_mode == 'skip':
                counters['skipped'] += 1
                results.append(
                    {
                        'row': index,
                        'status': 'skipped',
                        'action': 'skip',
                        'id': existing.pk,
                        'name': existing.name,
                        'management_ip': target['management_ip'],
                        'target': target['target_label'],
                        'detail': '已存在同一资产和账号的凭据。',
                    }
                )
                continue

            serializer = self.get_serializer(existing, data=payload, partial=existing is not None)
            if not serializer.is_valid():
                counters['failed'] += 1
                field_errors = []
                for field_name, messages in serializer.errors.items():
                    if isinstance(messages, (list, tuple)):
                        field_errors.append(f'{field_name}: {"; ".join(str(message) for message in messages)}')
                    else:
                        field_errors.append(f'{field_name}: {messages}')
                results.append(
                    {
                        'row': index,
                        'status': 'failed',
                        'action': 'validate',
                        'name': payload.get('name') or '',
                        'management_ip': target['management_ip'],
                        'target': target['target_label'],
                        'detail': '；'.join(field_errors) or '数据校验失败。',
                    }
                )
                continue

            action_name = 'updated' if existing is not None else 'created'
            try:
                with transaction.atomic():
                    if existing is not None:
                        instance = serializer.save()
                    else:
                        instance = serializer.save(created_by=request.user)
                    pending_payload = getattr(instance, '_pending_secret_payload', None)
                    if not pending_payload:
                        raise VaultError('没有可写入 OpenBao 的密文内容。')
                    vault_write_secret(
                        instance.vault_path,
                        pending_payload['username'],
                        pending_payload['secret_value'],
                        {'record_id': instance.pk, 'name': instance.name, 'source': 'bulk_import'},
                    )
                    instance.last_rotated_at = timezone.now()
                    instance.save(update_fields=['last_rotated_at', 'updated_at'])
                    record_secret_audit(
                        request,
                        instance,
                        'rotate' if existing is not None else 'create',
                        reason='批量导入密码台账',
                    )
                    record_audit(
                        request,
                        self.audit_module,
                        'bulk_update' if existing is not None else 'bulk_create',
                        instance,
                        '批量导入密码台账（密文存储于 OpenBao）',
                    )
            except VaultError as exc:
                counters['failed'] += 1
                results.append(
                    {
                        'row': index,
                        'status': 'failed',
                        'action': action_name,
                        'name': payload.get('name') or '',
                        'management_ip': target['management_ip'],
                        'target': target['target_label'],
                        'detail': str(exc),
                    }
                )
                continue

            counters[action_name] += 1
            results.append(
                {
                    'row': index,
                    'status': 'success',
                    'action': action_name,
                    'id': instance.pk,
                    'name': instance.name,
                    'management_ip': target['management_ip'],
                    'target': target['target_label'],
                    'detail': '已更新 OpenBao 密文。' if existing is not None else '已写入 OpenBao 密文。',
                }
            )

        return Response(
            {
                'status': 'success' if counters['failed'] == 0 else 'partial',
                'total': len(rows),
                **counters,
                'results': results,
            }
        )

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        try:
            vault_delete_secret(instance.vault_path)
        except VaultError as exc:
            raise VaultServiceUnavailable(str(exc)) from exc
        record_secret_audit(self.request, instance, 'delete', reason='删除密码台账及 OpenBao 密文')
        record_audit(self.request, self.audit_module, 'delete', instance, '删除密码台账及 OpenBao 密文')
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[SecretActionPermission], url_path='request-access')
    def request_access(self, request, pk=None):
        secret = self.get_object()
        role = get_user_role(request.user)
        if role not in ('admin', 'dc_operator', 'ip_manager'):
            record_secret_audit(request, secret, 'request', 'denied', '当前角色无取用权限')
            raise PermissionDenied('当前角色不能申请取用密码。')
        reason = str(request.data.get('reason') or '').strip()
        if not reason:
            return Response({'detail': '请填写取用原因。'}, status=status.HTTP_400_BAD_REQUEST)
        pending = SecretAccessRequest.objects.filter(
            secret=secret,
            requester=request.user,
            status='pending',
        ).first()
        if pending:
            return Response(SecretAccessRequestSerializer(pending).data, status=status.HTTP_200_OK)
        access_request = SecretAccessRequest.objects.create(
            secret=secret,
            requester=request.user,
            reason=reason,
        )
        record_secret_audit(request, secret, 'request', reason=reason)
        return Response(SecretAccessRequestSerializer(access_request).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[SecretActionPermission])
    def reveal(self, request, pk=None):
        secret = self.get_object()
        reason = str(request.data.get('reason') or '直接查看密码记录').strip()

        role = get_user_role(request.user)
        if role not in ('admin', 'dc_operator', 'ip_manager'):
            record_secret_audit(request, secret, 'reveal', 'denied', f'角色无权限：{reason}')
            raise PermissionDenied('当前角色不能查看密码。')
        if secret.status != 'active':
            record_secret_audit(request, secret, 'reveal', 'denied', f'条目已停用：{reason}')
            raise PermissionDenied('该密码条目已停用。')

        try:
            payload = vault_read_secret(secret.vault_path)
        except VaultError as exc:
            record_secret_audit(request, secret, 'reveal', 'error', f'OpenBao 读取失败：{reason}')
            raise VaultServiceUnavailable(str(exc)) from exc
        if not payload.get('secret_value'):
            record_secret_audit(request, secret, 'reveal', 'error', f'OpenBao 返回空凭据：{reason}')
            raise VaultServiceUnavailable('OpenBao 中的凭据内容为空。')

        record_secret_audit(request, secret, 'reveal', reason=reason)
        response = Response(
            {
                'username': payload.get('username', ''),
                'secret_value': payload['secret_value'],
                'expires_in': 60,
            }
        )
        response['Cache-Control'] = 'no-store, private, max-age=0'
        response['Pragma'] = 'no-cache'
        return response

    @action(detail=True, methods=['post'], permission_classes=[SecretActionPermission])
    def rotate(self, request, pk=None):
        secret = self.get_object()
        if get_user_role(request.user) != 'admin':
            raise PermissionDenied('仅超级管理员可以轮换密码。')
        current_password = request.data.get('current_password') or ''
        secret_value = request.data.get('secret_value') or ''
        username = request.data.get('secret_username')
        reason = str(request.data.get('reason') or '管理员轮换密码').strip()
        if not request.user.check_password(current_password):
            record_secret_audit(request, secret, 'rotate', 'denied', '二次验证失败')
            raise PermissionDenied('当前登录密码验证失败。')
        if not secret_value:
            return Response({'detail': '新密码或密钥不能为空。'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            vault_write_secret(
                secret.vault_path,
                username if username is not None else secret.username_hint,
                secret_value,
                {'record_id': secret.pk, 'name': secret.name},
            )
        except VaultError as exc:
            record_secret_audit(request, secret, 'rotate', 'error', reason)
            raise VaultServiceUnavailable(str(exc)) from exc
        if username is not None:
            secret.username_hint = username
        secret.last_rotated_at = timezone.now()
        secret.save(update_fields=['username_hint', 'last_rotated_at', 'updated_at'])
        record_secret_audit(request, secret, 'rotate', reason=reason)
        return Response(SecretRecordSerializer(secret, context={'request': request}).data)

    @action(detail=True, methods=['post'], permission_classes=[SecretActionPermission], url_path='test-login')
    def test_login(self, request, pk=None):
        secret = self.get_object()
        role = get_user_role(request.user)
        if role not in ('admin', 'dc_operator', 'ip_manager'):
            raise PermissionDenied('当前角色不能测试设备登录。')
        management_ip = _extract_management_host(request.data.get('management_ip') or '')
        if not management_ip:
            return Response({'detail': '请提供管理 IP。'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            ssh_port = int(request.data.get('ssh_port') or 22)
            timeout_seconds = int(request.data.get('timeout_seconds') or 30)
        except (TypeError, ValueError):
            return Response({'detail': 'SSH 端口和超时时间必须是数字。'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            payload = test_secret_login(
                credential=secret,
                management_ip=management_ip,
                ssh_port=ssh_port,
                timeout_seconds=timeout_seconds,
                read_secret=vault_read_secret,
            )
        except (ConfigBackupConnectionError, ConfigBackupError, VaultError) as exc:
            record_secret_audit(request, secret, 'test_login', 'error', str(exc))
            return Response({'status': 'failed', 'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        record_secret_audit(request, secret, 'test_login', reason=f'{management_ip}:{ssh_port}')
        return Response(payload)

    @action(detail=False, methods=['post'], permission_classes=[SecretActionPermission], url_path='bulk-test-login')
    def bulk_test_login(self, request):
        role = get_user_role(request.user)
        if role not in ('admin', 'dc_operator', 'ip_manager'):
            raise PermissionDenied('当前角色不能批量测试设备登录。')
        try:
            secret_ids = _parse_id_list(request.data.get('secret_ids'))
            ssh_port = _parse_positive_int(
                request.data.get('ssh_port'),
                22,
                minimum=1,
                maximum=65535,
                field_name='SSH 端口',
            )
            timeout_seconds = _parse_positive_int(
                request.data.get('timeout_seconds'),
                30,
                minimum=5,
                maximum=600,
                field_name='连接超时',
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset().filter(status='active').order_by('name', 'id')
        if secret_ids:
            queryset = queryset.filter(pk__in=secret_ids)
        else:
            queryset = queryset.filter(target_type__in=('device', 'ip'))

        results = []
        counters = {
            'success': 0,
            'failed': 0,
            'skipped': 0,
            'auth_failed': 0,
            'timeout': 0,
            'refused': 0,
            'unreachable': 0,
            'resolve_failed': 0,
            'dependency': 0,
            'other': 0,
            'template_warning': 0,
        }
        for secret in queryset:
            target = _resolve_secret_login_target(secret)
            base_payload = {
                'id': secret.pk,
                'name': secret.name,
                'username_hint': secret.username_hint,
                'credential_type': secret.credential_type,
                'target': target['target_label'],
                'management_ip': target['management_ip'],
                'location': target['location'],
                'device_type': target['device_type'],
                'raw_device_type': target['raw_device_type'],
                'template_status': target['template_status'],
                'template_detail': target['template_detail'],
            }
            if not target['management_ip']:
                counters['skipped'] += 1
                results.append(
                    {
                        **base_payload,
                        'status': 'skipped',
                        'category': 'missing_management_ip',
                        'category_label': '缺少管理地址',
                        'detail': '该凭据没有绑定可测试的设备管理 IP。',
                    }
                )
                continue

            if target['template_status'] == 'warning':
                counters['template_warning'] += 1

            try:
                payload = test_secret_login(
                    credential=secret,
                    management_ip=target['management_ip'],
                    ssh_port=ssh_port,
                    timeout_seconds=timeout_seconds,
                    read_secret=vault_read_secret,
                )
            except (ConfigBackupConnectionError, ConfigBackupError, VaultError) as exc:
                category, category_label = _classify_login_failure(exc)
                counters['failed'] += 1
                counters[category] = counters.get(category, 0) + 1
                record_secret_audit(request, secret, 'test_login', 'error', f'批量测试：{exc}')
                results.append(
                    {
                        **base_payload,
                        'status': 'failed',
                        'category': category,
                        'category_label': category_label,
                        'detail': str(exc),
                    }
                )
                continue

            counters['success'] += 1
            record_secret_audit(request, secret, 'test_login', reason=f'批量测试：{target["management_ip"]}:{ssh_port}')
            results.append(
                {
                    **base_payload,
                    'status': 'success',
                    'category': 'ok',
                    'category_label': '登录成功',
                    'detail': payload.get('message') or 'SSH 登录测试成功。',
                    'duration_seconds': payload.get('duration_seconds', 0),
                }
            )

        return Response(
            {
                'status': 'success' if counters['failed'] == 0 else 'partial',
                'total': len(results),
                'ssh_port': ssh_port,
                'timeout_seconds': timeout_seconds,
                **counters,
                'results': results,
            }
        )

    @action(detail=False, methods=['post'], permission_classes=[SecretActionPermission], url_path='provision-backup-targets')
    def provision_backup_targets(self, request):
        role = get_user_role(request.user)
        if role not in ('admin', 'dc_operator'):
            raise PermissionDenied('当前角色不能批量纳入配置备份。')
        try:
            secret_ids = _parse_id_list(request.data.get('secret_ids'))
            ssh_port = _parse_positive_int(
                request.data.get('ssh_port'),
                22,
                minimum=1,
                maximum=65535,
                field_name='SSH 端口',
            )
            timeout_seconds = _parse_positive_int(
                request.data.get('timeout_seconds'),
                30,
                minimum=5,
                maximum=600,
                field_name='连接超时',
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if not secret_ids:
            return Response({'detail': '请先选择登录测试成功的凭据。'}, status=status.HTTP_400_BAD_REQUEST)

        command_profile = str(request.data.get('command_profile') or 'huawei_vrp').strip() or 'huawei_vrp'
        allow_template_warnings = _coerce_bool(request.data.get('allow_template_warnings'), False)
        queryset = self.get_queryset().filter(status='active', pk__in=secret_ids).order_by('name', 'id')
        results = []
        counters = {'created': 0, 'updated': 0, 'skipped': 0, 'failed': 0}

        for secret in queryset:
            target = _resolve_secret_login_target(secret)
            base_payload = {
                'id': secret.pk,
                'name': secret.name,
                'target': target['target_label'],
                'management_ip': target['management_ip'],
                'device_type': target['device_type'],
                'template_status': target['template_status'],
                'template_detail': target['template_detail'],
            }
            if not target['management_ip']:
                counters['skipped'] += 1
                results.append({**base_payload, 'status': 'skipped', 'detail': '缺少管理 IP，无法纳入配置备份。'})
                continue
            if target['template_status'] == 'warning' and not allow_template_warnings:
                counters['skipped'] += 1
                results.append({**base_payload, 'status': 'skipped', 'detail': target['template_detail']})
                continue
            try:
                config_target, created = ConfigBackupTarget.objects.update_or_create(
                    management_ip=target['management_ip'],
                    defaults={
                        'name': target['name'] or secret.name or target['management_ip'],
                        'rack_device': target['rack_device'],
                        'ip_address': target['ip_asset'],
                        'device_type': target['device_type'],
                        'command_profile': command_profile,
                        'ssh_port': ssh_port,
                        'timeout_seconds': timeout_seconds,
                        'save_before_backup': _coerce_bool(request.data.get('save_before_backup'), True),
                        'credential': secret,
                        'enabled': True,
                        'created_by': request.user if request.user.is_authenticated else None,
                    },
                )
            except Exception as exc:
                counters['failed'] += 1
                results.append({**base_payload, 'status': 'failed', 'detail': str(exc)})
                continue

            action_name = 'created' if created else 'updated'
            counters[action_name] += 1
            record_audit(
                request,
                'config_backup_target',
                'bulk_provision',
                config_target,
                '从批量登录测试结果纳入配置备份目标' if created else '从批量登录测试结果更新配置备份目标',
            )
            results.append(
                {
                    **base_payload,
                    'status': 'success',
                    'action': action_name,
                    'backup_target_id': config_target.pk,
                    'detail': '已创建配置备份目标。' if created else '已更新配置备份目标。',
                }
            )

        return Response(
            {
                'status': 'success' if counters['failed'] == 0 else 'partial',
                'total': len(results),
                'command_profile': command_profile,
                'ssh_port': ssh_port,
                'timeout_seconds': timeout_seconds,
                **counters,
                'results': results,
            }
        )


class SecretAccessRequestViewSet(OptionalPaginationMixin, viewsets.ReadOnlyModelViewSet):
    authentication_classes = (SessionAuthentication, BasicAuthentication)
    permission_classes = [SecretActionPermission]
    serializer_class = SecretAccessRequestSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['secret__name', 'requester__username', 'reason', 'review_comment']

    def get_queryset(self):
        queryset = SecretAccessRequest.objects.select_related(
            'secret', 'requester', 'reviewed_by'
        ).all()
        if get_user_role(self.request.user) in ('admin', 'auditor'):
            return queryset
        return queryset.filter(requester=self.request.user)

    def _review(self, request, approved):
        if get_user_role(request.user) != 'admin':
            raise PermissionDenied('仅超级管理员可以审批密码取用申请。')
        access_request = self.get_object()
        if access_request.status != 'pending':
            return Response({'detail': '该申请已经处理。'}, status=status.HTTP_400_BAD_REQUEST)
        access_request.status = 'approved' if approved else 'rejected'
        access_request.reviewed_by = request.user
        access_request.reviewed_at = timezone.now()
        access_request.review_comment = str(request.data.get('review_comment') or '').strip()
        if approved:
            try:
                requested_minutes = int(request.data.get('valid_minutes') or 30)
            except (TypeError, ValueError):
                requested_minutes = 30
            minutes = max(5, min(requested_minutes, 240))
            access_request.approved_expires_at = timezone.now() + timedelta(minutes=minutes)
        access_request.save()
        record_secret_audit(
            request,
            access_request.secret,
            'approve' if approved else 'reject',
            reason=access_request.review_comment,
        )
        return Response(self.get_serializer(access_request).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        return self._review(request, True)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        return self._review(request, False)


class SecretAuditEventViewSet(OptionalPaginationMixin, viewsets.ReadOnlyModelViewSet):
    authentication_classes = (SessionAuthentication, BasicAuthentication)
    permission_classes = [SecretAuditPermission]
    queryset = SecretAuditEvent.objects.select_related('secret', 'user').all()
    serializer_class = SecretAuditEventSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['secret_name', 'user__username', 'action', 'result', 'reason', 'ip_address']


def _find_backup_credential(rack_device=None, ip_asset=None):
    queryset = SecretRecord.objects.filter(status='active').order_by('-updated_at', '-id')
    if rack_device is not None:
        credential = queryset.filter(rack_device=rack_device).first()
        if credential is not None:
            return credential
        if rack_device.mgmt_ip:
            ip_asset = ip_asset or IPAddress.objects.filter(ip_address=rack_device.mgmt_ip).first()
    if ip_asset is not None:
        credential = queryset.filter(ip_address=ip_asset).first()
        if credential is not None:
            return credential
    return None


def _normalize_backup_device_type(value):
    normalized = str(value or '').strip().lower()
    if 'firewall' in normalized or '防火' in normalized or 'fw' == normalized:
        return 'firewall'
    if 'router' in normalized or '路由' in normalized:
        return 'router'
    if 'switch' in normalized or '交换' in normalized or normalized in {'switch_core', 'switch_access'}:
        return 'switch'
    return normalized if normalized in {'switch', 'router', 'firewall'} else 'switch'


def _extract_management_host(value):
    text = str(value or '').strip()
    if not text:
        return ''
    parse_target = text if '://' in text else f'//{text}'
    parsed = urlparse(parse_target)
    if parsed.hostname:
        return parsed.hostname
    return re.sub(r'^[a-z][a-z0-9+.-]*://', '', text, flags=re.IGNORECASE).split('/')[0].split(':')[0].strip()


def _coerce_bool(value, default=True):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() not in {'0', 'false', 'no', 'off', 'disabled'}


ANSIBLE_MANAGE_ROLES = {'admin', 'dc_operator'}
ANSIBLE_DEVICE_KEYWORDS = {
    'server',
    'switch',
    'router',
    'firewall',
    'load_balancer',
    'storage',
    'security',
    'network',
    '交换',
    '路由',
    '防火',
    '服务器',
}


def _ansible_token(value, fallback='default'):
    token = re.sub(r'[^A-Za-z0-9]+', '_', str(value or '').strip().lower()).strip('_')
    return token or fallback


def _ansible_inventory_name(name, management_ip):
    source = name or management_ip or 'host'
    token = re.sub(r'[^A-Za-z0-9_.-]+', '_', str(source).strip()).strip('_')
    if token and token[0].isdigit():
        token = f'host_{token}'
    return token or f'host_{_ansible_token(management_ip, "unknown")}'


def _is_ansible_asset_type(value):
    normalized = str(value or '').strip().lower()
    if not normalized:
        return False
    return any(marker in normalized for marker in ANSIBLE_DEVICE_KEYWORDS)


def _normalize_ansible_device_type(value):
    normalized = str(value or '').strip().lower()
    if not normalized:
        return 'unknown'
    if 'firewall' in normalized or '防火' in normalized or normalized == 'fw':
        return 'firewall'
    if 'router' in normalized or '路由' in normalized:
        return 'router'
    if 'switch' in normalized or '交换' in normalized:
        return 'switch'
    if 'server' in normalized or '服务器' in normalized:
        return 'server'
    if 'storage' in normalized or '存储' in normalized:
        return 'storage'
    return _ansible_token(normalized, 'unknown')


def _config_backup_device_type_for_ansible(value):
    normalized = str(value or '').strip().lower()
    if 'server' in normalized or '服务器' in normalized or 'storage' in normalized or '存储' in normalized:
        return 'other'
    return _normalize_backup_device_type(value)


def _ansible_location_for_device(device):
    if not device or not device.rack_id:
        return ''
    datacenter = device.rack.datacenter.name if device.rack.datacenter_id else ''
    return ' / '.join(part for part in [datacenter, device.rack.code, device.name] if part)


def _ansible_groups(datacenter='', device_type='', vendor='', managed=False):
    groups = ['managed' if managed else 'unmanaged']
    if datacenter:
        groups.append(f'dc_{_ansible_token(datacenter)}')
    if device_type:
        groups.append(f'type_{_ansible_token(device_type)}')
    if vendor:
        groups.append(f'vendor_{_ansible_token(vendor)}')
    return groups


def _ansible_target_queryset():
    return ConfigBackupTarget.objects.select_related(
        'rack_device',
        'rack_device__rack',
        'rack_device__rack__datacenter',
        'ip_address',
        'credential',
    ).prefetch_related('versions')


def _ansible_row_from_target(target):
    device = target.rack_device if target.rack_device_id else None
    ip_asset = target.ip_address if target.ip_address_id else None
    latest = None
    versions = list(target.versions.all())
    if versions:
        latest = versions[0]
    datacenter = device.rack.datacenter.name if device and device.rack_id and device.rack.datacenter_id else ''
    rack_code = device.rack.code if device and device.rack_id else ''
    vendor = device.brand if device else ''
    raw_type = target.device_type or (device.device_type if device else '') or (ip_asset.device_type if ip_asset else '')
    credential = target.credential if target.credential_id else _find_backup_credential(rack_device=device, ip_asset=ip_asset)
    management_ip = _extract_management_host(target.management_ip)
    managed = bool(target.enabled and management_ip and credential)
    location = _ansible_location_for_device(device) or (ip_asset.ip_address if ip_asset else '')
    return {
        'id': f'target-{target.id}',
        'source': 'target',
        'asset_id': f'device-{device.id}' if device else (f'ip-{ip_asset.id}' if ip_asset else f'target-{target.id}'),
        'target_id': target.id,
        'rack_device_id': device.id if device else None,
        'ip_address_id': ip_asset.id if ip_asset else None,
        'name': target.name or (device.name if device else '') or (ip_asset.device_name if ip_asset else '') or management_ip,
        'management_ip': management_ip,
        'device_type': _normalize_ansible_device_type(raw_type),
        'raw_device_type': raw_type,
        'vendor': vendor,
        'datacenter': datacenter,
        'rack_code': rack_code,
        'location': location,
        'inventory_name': _ansible_inventory_name(target.name or (device.name if device else ''), management_ip),
        'groups': _ansible_groups(datacenter, raw_type or target.device_type, vendor, managed),
        'managed': managed,
        'enabled': bool(target.enabled),
        'credential_id': credential.id if credential else None,
        'credential_name': credential.name if credential else '',
        'username_hint': credential.username_hint if credential else '',
        'credential_status': credential.status if credential else 'missing',
        'backup_target_id': target.id,
        'backup_status': target.last_status,
        'backup_status_label': dict(ConfigBackupTarget.STATUS_CHOICES).get(target.last_status, target.last_status),
        'backup_enabled': bool(target.enabled),
        'version_count': len(versions),
        'latest_version': latest.filename if latest else '',
        'latest_version_time': (latest.finished_at or latest.started_at).isoformat() if latest else '',
        'ssh_port': target.ssh_port or 22,
        'timeout_seconds': target.timeout_seconds or 30,
        'command_profile': target.command_profile,
        'last_job_status': dict(ConfigBackupTarget.STATUS_CHOICES).get(target.last_status, target.last_status),
        'last_job_detail': target.last_error or '',
        'readiness': {
            'management_ip': bool(management_ip),
            'credential': bool(credential),
            'backup_target': True,
            'template': bool(target.command_profile),
        },
    }


def _ansible_row_from_device(device):
    management_ip = _extract_management_host(device.mgmt_ip)
    credential = _find_backup_credential(rack_device=device)
    datacenter = device.rack.datacenter.name if device.rack_id and device.rack.datacenter_id else ''
    rack_code = device.rack.code if device.rack_id else ''
    raw_type = device.device_type or ''
    return {
        'id': f'device-{device.id}',
        'source': 'device',
        'asset_id': f'device-{device.id}',
        'target_id': None,
        'rack_device_id': device.id,
        'ip_address_id': None,
        'name': device.name or management_ip,
        'management_ip': management_ip,
        'device_type': _normalize_ansible_device_type(raw_type),
        'raw_device_type': raw_type,
        'vendor': device.brand or '',
        'datacenter': datacenter,
        'rack_code': rack_code,
        'location': _ansible_location_for_device(device),
        'inventory_name': _ansible_inventory_name(device.name, management_ip),
        'groups': _ansible_groups(datacenter, raw_type, device.brand, False),
        'managed': False,
        'enabled': False,
        'credential_id': credential.id if credential else None,
        'credential_name': credential.name if credential else '',
        'username_hint': credential.username_hint if credential else '',
        'credential_status': credential.status if credential else 'missing',
        'backup_target_id': None,
        'backup_status': 'missing',
        'backup_status_label': '未接入',
        'backup_enabled': False,
        'version_count': 0,
        'latest_version': '',
        'latest_version_time': '',
        'ssh_port': 22,
        'timeout_seconds': 30,
        'command_profile': 'huawei_vrp',
        'last_job_status': '未执行',
        'last_job_detail': '',
        'readiness': {
            'management_ip': bool(management_ip),
            'credential': bool(credential),
            'backup_target': False,
            'template': bool(raw_type),
        },
    }


def _ansible_row_from_ip(ip_asset):
    management_ip = _extract_management_host(ip_asset.ip_address)
    credential = _find_backup_credential(ip_asset=ip_asset)
    raw_type = ip_asset.device_type or ''
    return {
        'id': f'ip-{ip_asset.id}',
        'source': 'ip',
        'asset_id': f'ip-{ip_asset.id}',
        'target_id': None,
        'rack_device_id': None,
        'ip_address_id': ip_asset.id,
        'name': ip_asset.device_name or management_ip,
        'management_ip': management_ip,
        'device_type': _normalize_ansible_device_type(raw_type),
        'raw_device_type': raw_type,
        'vendor': '',
        'datacenter': '',
        'rack_code': '',
        'location': management_ip,
        'inventory_name': _ansible_inventory_name(ip_asset.device_name, management_ip),
        'groups': _ansible_groups('', raw_type, '', False),
        'managed': False,
        'enabled': False,
        'credential_id': credential.id if credential else None,
        'credential_name': credential.name if credential else '',
        'username_hint': credential.username_hint if credential else '',
        'credential_status': credential.status if credential else 'missing',
        'backup_target_id': None,
        'backup_status': 'missing',
        'backup_status_label': '未接入',
        'backup_enabled': False,
        'version_count': 0,
        'latest_version': '',
        'latest_version_time': '',
        'ssh_port': 22,
        'timeout_seconds': 30,
        'command_profile': 'huawei_vrp',
        'last_job_status': '未执行',
        'last_job_detail': '',
        'readiness': {
            'management_ip': bool(management_ip),
            'credential': bool(credential),
            'backup_target': False,
            'template': bool(raw_type),
        },
    }


def _build_ansible_hosts():
    hosts = []
    used_device_ids = set()
    used_ip_ids = set()
    used_management_ips = set()

    for target in _ansible_target_queryset().order_by('management_ip', 'id'):
        row = _ansible_row_from_target(target)
        hosts.append(row)
        if row['rack_device_id']:
            used_device_ids.add(row['rack_device_id'])
        if row['ip_address_id']:
            used_ip_ids.add(row['ip_address_id'])
        if row['management_ip']:
            used_management_ips.add(row['management_ip'])

    device_queryset = RackDevice.objects.select_related('rack', 'rack__datacenter').all().order_by('name', 'id')
    for device in device_queryset:
        management_ip = _extract_management_host(device.mgmt_ip)
        if device.id in used_device_ids or not management_ip or management_ip in used_management_ips:
            continue
        if not _is_ansible_asset_type(device.device_type):
            continue
        row = _ansible_row_from_device(device)
        hosts.append(row)
        used_device_ids.add(device.id)
        used_management_ips.add(management_ip)

    ip_queryset = IPAddress.objects.exclude(device_name='').order_by('ip_address', 'id')
    for ip_asset in ip_queryset:
        management_ip = _extract_management_host(ip_asset.ip_address)
        if ip_asset.id in used_ip_ids or not management_ip or management_ip in used_management_ips:
            continue
        if not _is_ansible_asset_type(ip_asset.device_type):
            continue
        row = _ansible_row_from_ip(ip_asset)
        hosts.append(row)
        used_ip_ids.add(ip_asset.id)
        used_management_ips.add(management_ip)

    return hosts


def _build_ansible_inventory(hosts):
    grouped = {}
    for row in hosts:
        if not row.get('managed') or not row.get('management_ip') or not row.get('credential_id'):
            continue
        group = row['groups'][0] if row.get('groups') else 'managed'
        grouped.setdefault(group, []).append(row)
    lines = []
    for group in sorted(grouped):
        lines.append(f'[{group}]')
        for row in sorted(grouped[group], key=lambda item: item.get('inventory_name') or ''):
            user_part = f" ansible_user={row['username_hint']}" if row.get('username_hint') else ''
            lines.append(
                f"{row['inventory_name']} ansible_host={row['management_ip']} ansible_port={row.get('ssh_port') or 22}{user_part}"
            )
        lines.append('')
    return '\n'.join(lines).strip()


def _ansible_host_selection(hosts, payload):
    host_ids = []
    for key in ('host_ids', 'asset_ids'):
        value = payload.get(key)
        if isinstance(value, str):
            host_ids.extend(item.strip() for item in value.split(',') if item.strip())
        elif isinstance(value, (list, tuple, set)):
            host_ids.extend(str(item).strip() for item in value if str(item).strip())
    target_ids = payload.get('target_ids')
    if target_ids:
        try:
            host_ids.extend(f'target-{item}' for item in _parse_id_list(target_ids))
        except ValueError:
            host_ids.extend(str(item).strip() for item in target_ids if str(item).strip())
    if not host_ids:
        return [row for row in hosts if row.get('managed')]
    selected = set(host_ids)
    return [row for row in hosts if row.get('id') in selected or row.get('asset_id') in selected]


def _ansible_summary_payload():
    hosts = _build_ansible_hosts()
    managed = [row for row in hosts if row.get('managed')]
    credential_missing = [row for row in hosts if not row.get('credential_id')]
    backup_missing = [row for row in hosts if not row.get('backup_target_id')]
    failed = [row for row in hosts if row.get('backup_status') == 'failed' or row.get('last_job_detail')]
    groups = {}
    for row in hosts:
        for group in row.get('groups') or []:
            groups.setdefault(group, {'name': group, 'count': 0, 'managed': 0})
            groups[group]['count'] += 1
            if row.get('managed'):
                groups[group]['managed'] += 1
    return {
        'stats': {
            'total_hosts': len(hosts),
            'managed_hosts': len(managed),
            'unmanaged_hosts': len(hosts) - len(managed),
            'credential_missing': len(credential_missing),
            'backup_missing': len(backup_missing),
            'failed_hosts': len(failed),
        },
        'hosts': hosts,
        'groups': sorted(groups.values(), key=lambda item: (-item['managed'], item['name'])),
        'inventory': _build_ansible_inventory(hosts),
    }


@api_view(['GET'])
@authentication_classes((SessionAuthentication, BasicAuthentication))
@permission_classes([DcimAccessPermission])
def ansible_summary(request):
    return Response(_ansible_summary_payload())


@api_view(['POST'])
@authentication_classes((SessionAuthentication, BasicAuthentication))
@permission_classes([DcimAccessPermission])
def ansible_test(request):
    if get_user_role(request.user) not in ANSIBLE_MANAGE_ROLES:
        raise PermissionDenied('当前角色无权执行 Ansible 登录测试。')
    hosts = _build_ansible_hosts()
    selected_hosts = _ansible_host_selection(hosts, request.data)
    results = []
    counters = {'total': len(selected_hosts), 'success': 0, 'failed': 0, 'skipped': 0}
    for row in selected_hosts:
        credential = SecretRecord.objects.filter(pk=row.get('credential_id'), status='active').first()
        if not row.get('management_ip'):
            counters['skipped'] += 1
            results.append({**row, 'status': 'skipped', 'category': 'missing_ip', 'detail': '缺少管理 IP。'})
            continue
        if credential is None:
            counters['skipped'] += 1
            results.append({**row, 'status': 'skipped', 'category': 'credential_missing', 'detail': '缺少可用登录凭据。'})
            continue
        try:
            payload = test_secret_login(
                credential=credential,
                management_ip=row['management_ip'],
                read_secret=vault_read_secret,
                ssh_port=row.get('ssh_port') or 22,
                timeout_seconds=row.get('timeout_seconds') or 30,
            )
            counters['success'] += 1
            results.append({**row, 'status': 'success', 'category': 'success', 'detail': payload.get('message') or 'SSH 登录测试成功。', 'duration_seconds': payload.get('duration_seconds', 0)})
        except (ConfigBackupConnectionError, ConfigBackupError, VaultError) as exc:
            category, label = _classify_login_failure(str(exc))
            counters['failed'] += 1
            results.append({**row, 'status': 'failed', 'category': category, 'category_label': label, 'detail': str(exc)})
    record_audit(request, 'ansible', 'test', detail=f'批量测试 Ansible 登录：成功 {counters["success"]}，失败 {counters["failed"]}，跳过 {counters["skipped"]}')
    return Response({'summary': counters, 'results': results})


def _provision_ansible_host(row, request, defaults):
    management_ip = _extract_management_host(row.get('management_ip'))
    if not management_ip:
        return None, False, '缺少管理 IP。'
    rack_device = RackDevice.objects.filter(pk=row.get('rack_device_id')).first() if row.get('rack_device_id') else None
    ip_asset = IPAddress.objects.filter(pk=row.get('ip_address_id')).first() if row.get('ip_address_id') else None
    credential = SecretRecord.objects.filter(pk=row.get('credential_id'), status='active').first()
    if credential is None:
        credential = _find_backup_credential(rack_device=rack_device, ip_asset=ip_asset)
    if credential is None:
        return None, False, '缺少可用登录凭据。'
    target, created = ConfigBackupTarget.objects.update_or_create(
        management_ip=management_ip,
        defaults={
            'name': row.get('name') or management_ip,
            'rack_device': rack_device,
            'ip_address': ip_asset,
            'device_type': _config_backup_device_type_for_ansible(row.get('raw_device_type') or row.get('device_type')),
            'command_profile': defaults['command_profile'],
            'ssh_port': defaults['ssh_port'],
            'timeout_seconds': defaults['timeout_seconds'],
            'save_before_backup': defaults['save_before_backup'],
            'retention_count': defaults['retention_count'],
            'credential': credential,
            'enabled': True,
            'created_by': request.user if request.user.is_authenticated else None,
        },
    )
    return target, created, ''


@api_view(['POST'])
@authentication_classes((SessionAuthentication, BasicAuthentication))
@permission_classes([DcimAccessPermission])
def ansible_provision(request):
    if get_user_role(request.user) not in ANSIBLE_MANAGE_ROLES:
        raise PermissionDenied('当前角色无权纳入 Ansible Inventory。')
    defaults = {
        'command_profile': request.data.get('command_profile') or 'huawei_vrp',
        'ssh_port': _parse_positive_int(request.data.get('ssh_port'), 22, minimum=1, maximum=65535, field_name='SSH 端口'),
        'timeout_seconds': _parse_positive_int(request.data.get('timeout_seconds'), 30, minimum=5, maximum=600, field_name='连接超时'),
        'save_before_backup': _coerce_bool(request.data.get('save_before_backup'), True),
        'retention_count': _parse_positive_int(request.data.get('retention_count'), 12, minimum=1, maximum=200, field_name='保留版本'),
    }
    hosts = _build_ansible_hosts()
    selected_hosts = _ansible_host_selection(hosts, request.data)
    results = []
    counters = {'total': len(selected_hosts), 'created': 0, 'updated': 0, 'failed': 0}
    for row in selected_hosts:
        target, created, error = _provision_ansible_host(row, request, defaults)
        if error:
            counters['failed'] += 1
            results.append({**row, 'status': 'failed', 'detail': error})
            continue
        if created:
            counters['created'] += 1
        else:
            counters['updated'] += 1
        results.append(
            {
                **row,
                'status': 'created' if created else 'updated',
                'detail': '已纳入 Ansible Inventory。',
                'target': ConfigBackupTargetSerializer(target, context={'request': request}).data,
            }
        )
    record_audit(request, 'ansible', 'provision', detail=f'纳入 Ansible Inventory：新增 {counters["created"]}，更新 {counters["updated"]}，失败 {counters["failed"]}')
    return Response({'summary': counters, 'results': results})


class ConfigBackupTargetViewSet(OptionalPaginationMixin, BaseViewSet):
    audit_module = 'config_backup_target'
    permission_classes = [DcimAccessPermission]
    queryset = ConfigBackupTarget.objects.select_related(
        'rack_device',
        'rack_device__rack',
        'rack_device__rack__datacenter',
        'ip_address',
        'credential',
        'created_by',
    ).prefetch_related('versions').all()
    serializer_class = ConfigBackupTargetSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'management_ip', 'device_type', 'rack_device__name', 'ip_address__device_name']

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        record_audit(self.request, self.audit_module, 'create', instance, '新增配置备份目标')

    @action(detail=False, methods=['post'])
    def provision(self, request):
        rack_device_id = request.data.get('rack_device') or request.data.get('rack_device_id')
        ip_address_id = request.data.get('ip_address') or request.data.get('ip_address_id')
        rack_device = RackDevice.objects.filter(pk=rack_device_id).first() if rack_device_id else None
        ip_asset = IPAddress.objects.filter(pk=ip_address_id).first() if ip_address_id else None
        management_ip = _extract_management_host(request.data.get('management_ip'))

        if rack_device is not None and not management_ip:
            management_ip = _extract_management_host(rack_device.mgmt_ip)
        if ip_asset is not None and not management_ip:
            management_ip = _extract_management_host(ip_asset.ip_address)
        if not management_ip:
            return Response({'detail': '请先为资产设置管理 IP。'}, status=status.HTTP_400_BAD_REQUEST)

        credential_id = request.data.get('credential')
        credential = SecretRecord.objects.filter(pk=credential_id).first() if credential_id else None
        if credential is None:
            credential = _find_backup_credential(rack_device=rack_device, ip_asset=ip_asset)

        name = (
            str(request.data.get('name') or '').strip()
            or (rack_device.name if rack_device else '')
            or (ip_asset.device_name if ip_asset else '')
            or management_ip
        )
        device_type = _normalize_backup_device_type(
            request.data.get('device_type')
            or (rack_device.device_type if rack_device else '')
            or (ip_asset.device_type if ip_asset else '')
        )
        target, created = ConfigBackupTarget.objects.update_or_create(
            management_ip=management_ip,
            defaults={
                'name': name,
                'rack_device': rack_device,
                'ip_address': ip_asset,
                'device_type': device_type,
                'command_profile': request.data.get('command_profile') or 'huawei_vrp',
                'ssh_port': request.data.get('ssh_port') or 22,
                'timeout_seconds': request.data.get('timeout_seconds') or 30,
                'save_before_backup': _coerce_bool(request.data.get('save_before_backup'), True),
                'credential': credential,
                'enabled': True,
                'created_by': request.user if request.user.is_authenticated else None,
            },
        )
        record_audit(
            request,
            self.audit_module,
            'provision',
            target,
            '从资产中心创建配置备份目标' if created else '从资产中心更新配置备份目标',
        )
        return Response(
            self.get_serializer(target).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='test')
    def test(self, request, pk=None):
        target = self.get_object()
        try:
            payload = test_config_backup_target(target=target, read_secret=vault_read_secret)
        except (ConfigBackupConnectionError, ConfigBackupError, VaultError) as exc:
            target.last_status = 'failed'
            target.last_error = str(exc)[:2000]
            target.save(update_fields=['last_status', 'last_error', 'updated_at'])
            return Response({'status': 'failed', 'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)

    @action(detail=True, methods=['post'])
    def run(self, request, pk=None):
        target = self.get_object()
        try:
            version = run_config_backup_target(
                target=target,
                base_dir=settings.BASE_DIR,
                read_secret=vault_read_secret,
            )
        except (ConfigBackupError, VaultError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        target.refresh_from_db()
        record_audit(request, self.audit_module, 'run', target, f'执行配置备份，结果：{version.status}')
        detail = version.error_message if version.status != 'success' else ''
        return Response(
            {
                'status': version.status,
                'detail': detail,
                'target': self.get_serializer(target).data,
                'version': ConfigBackupVersionSerializer(version).data,
            },
            status=status.HTTP_200_OK if version.status == 'success' else status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    @action(detail=False, methods=['post'], url_path='run-all')
    def run_all(self, request):
        target_ids = request.data.get('target_ids') or []
        strategy = request.data.get('strategy') or 'all'
        policy = get_or_create_config_backup_policy()
        queryset = self.get_queryset()
        if target_ids:
            queryset = queryset.filter(enabled=True, pk__in=target_ids)
        else:
            queryset = select_policy_targets(
                policy,
                strategy=strategy,
                device_type=request.data.get('device_type') or '',
                datacenter=request.data.get('datacenter') or '',
                queryset=queryset,
            )
        targets = list(queryset.order_by('management_ip', 'id'))
        run_result = run_config_backup_targets(
            targets=targets,
            base_dir=settings.BASE_DIR,
            read_secret=vault_read_secret,
        )
        email_result = {'sent': False, 'detail': ''}
        if request.data.get('notify'):
            try:
                email_result = send_config_backup_notification(policy, run_result, force=True)
            except ConfigBackupPolicyError as exc:
                email_result = {'sent': False, 'detail': str(exc)}
        results = [
            {
                'target': ConfigBackupTargetSerializer(item['target'], context={'request': request}).data,
                'status': item['status'],
                'detail': item['detail'],
                'version': ConfigBackupVersionSerializer(item['version']).data if item['version'] else None,
            }
            for item in run_result.results
        ]
        return Response(
            {
                'total': run_result.total,
                'success': run_result.success,
                'failed': run_result.failed,
                'results': results,
                'email': email_result,
            }
        )


def _resolve_config_backup_version_path(version):
    if not version.relative_path:
        raise FileNotFoundError('该版本没有关联文件路径。')
    backup_dir = os.path.abspath(get_config_backup_dir(settings.BASE_DIR))
    relative_path = version.relative_path.replace('/', os.sep)
    file_path = os.path.abspath(os.path.join(backup_dir, relative_path))
    if file_path != backup_dir and not file_path.startswith(f'{backup_dir}{os.sep}'):
        raise PermissionDenied('备份文件路径非法。')
    if not os.path.isfile(file_path):
        raise FileNotFoundError('没有找到对应的配置备份文件。')
    return backup_dir, file_path


def _read_config_backup_file(file_path, limit=1024 * 1024):
    opener = gzip.open if file_path.endswith('.gz') else open
    with opener(file_path, 'rb') as handle:
        content = handle.read(limit + 1)
    truncated = len(content) > limit
    if truncated:
        content = content[:limit]
    return content.decode('utf-8', errors='replace'), truncated


class ConfigBackupVersionViewSet(OptionalPaginationMixin, viewsets.ReadOnlyModelViewSet):
    authentication_classes = (SessionAuthentication, BasicAuthentication)
    permission_classes = [DcimAccessPermission]
    queryset = ConfigBackupVersion.objects.select_related('target', 'target__rack_device', 'target__ip_address').all()
    serializer_class = ConfigBackupVersionSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['target__name', 'target__management_ip', 'filename', 'relative_path', 'error_message']

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        version = self.get_object()
        try:
            _, file_path = _resolve_config_backup_version_path(version)
        except FileNotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        record_audit(request, 'config_backup_version', 'download', version, f'下载配置备份：{version.filename}')
        return FileResponse(open(file_path, 'rb'), as_attachment=True, filename=version.filename or os.path.basename(file_path))

    @action(detail=True, methods=['get'])
    def content(self, request, pk=None):
        version = self.get_object()
        try:
            backup_dir, file_path = _resolve_config_backup_version_path(version)
            content, truncated = _read_config_backup_file(file_path)
        except FileNotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            {
                'id': version.id,
                'filename': version.filename,
                'relative_path': version.relative_path,
                'container_full_path': file_path,
                'container_storage_path': backup_dir,
                'content': content,
                'truncated': truncated,
            }
        )


class BlocklistViewSet(OptionalPaginationMixin, BaseViewSet):
    audit_module = 'blocklist'
    permission_classes = [IsAdminUser]
    queryset = Blocklist.objects.all()
    serializer_class = BlocklistSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['ip_address', 'reason']


class DatacenterViewSet(OptionalPaginationMixin, BaseViewSet):
    audit_module = 'datacenter'
    permission_classes = [DcimAccessPermission]
    queryset = Datacenter.objects.prefetch_related('racks').all()
    serializer_class = DatacenterSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'location', 'contact_phone']


class RackViewSet(OptionalPaginationMixin, BaseViewSet):
    audit_module = 'rack'
    permission_classes = [DcimAccessPermission]
    queryset = Rack.objects.select_related('datacenter').prefetch_related('devices').all()
    serializer_class = RackSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['code', 'name', 'datacenter__name', 'description']


class RackDeviceViewSet(OptionalPaginationMixin, BaseViewSet):
    audit_module = 'rack_device'
    permission_classes = [DcimAccessPermission]
    queryset = RackDevice.objects.select_related('rack', 'rack__datacenter').all()
    serializer_class = RackDeviceSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'brand', 'sn', 'asset_tag', 'mgmt_ip', 'project', 'contact', 'rack__code', 'rack__datacenter__name']


class ResidentStaffViewSet(OptionalPaginationMixin, BaseViewSet):
    audit_module = 'resident_staff'
    permission_classes = [ResidentAccessPermission]
    queryset = ResidentStaff.objects.all().prefetch_related('devices')
    serializer_class = ResidentStaffSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['registration_code', 'company', 'name', 'phone', 'email', 'project_name']

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, intake_source='manual')
        record_audit(self.request, self.audit_module, 'create', instance, '后台新增驻场人员')

    def _review(self, request, status_value):
        resident = self.get_object()
        resident.approval_status = status_value
        resident.reviewer_name = (
            request.user.profile.display_name
            if hasattr(request.user, 'profile') and request.user.profile.display_name
            else request.user.username
        )
        resident.reviewed_at = timezone.now()
        resident.save(update_fields=['approval_status', 'reviewer_name', 'reviewed_at', 'updated_at'])
        record_audit(
            request,
            self.audit_module,
            status_value == 'approved' and 'approve' or 'reject',
            resident,
            f'驻场申请状态更新为：{resident.get_approval_status_display()}',
        )
        return Response({'status': 'success', 'resident': ResidentStaffSerializer(resident).data})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        return self._review(request, 'approved')

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        return self._review(request, 'rejected')

    @action(detail=True, methods=['get'])
    def export_sheet(self, request, pk=None):
        resident = self.get_object()

        info_rows = [
            {'字段': '登记编号', '内容': resident.registration_code},
            {'字段': '姓名', '内容': resident.name},
            {'字段': '公司', '内容': resident.company},
            {'字段': '职务', '内容': resident.title},
            {'字段': '联系电话', '内容': resident.phone},
            {'字段': '邮箱', '内容': resident.email},
            {'字段': '驻场类型', '内容': resident.get_resident_type_display()},
            {'字段': '所属项目', '内容': resident.project_name},
            {'字段': '归属部门', '内容': resident.department},
            {'字段': '是否需要安排座位', '内容': '是' if resident.needs_seat else '否'},
            {'字段': '办公区域', '内容': resident.office_location},
            {'字段': '座位号', '内容': resident.seat_number},
            {'字段': '驻场开始日期', '内容': resident.start_date},
            {'字段': '驻场结束日期', '内容': resident.end_date},
            {'字段': '审批状态', '内容': resident.get_approval_status_display()},
            {'字段': '审核人', '内容': resident.reviewer_name},
            {'字段': '审核时间', '内容': resident.reviewed_at},
            {'字段': '备注', '内容': resident.remarks},
        ]

        device_rows = []
        for device in resident.devices.all():
            device_rows.append(
                {
                    '设备名称': device.device_name,
                    '序列号': device.serial_number,
                    '品牌': device.brand,
                    '型号': device.model,
                    '有线 MAC': device.wired_mac,
                    '无线 MAC': device.wireless_mac,
                    '已安装安全防护软件': '是' if device.security_software_installed else '否',
                    '操作系统正版激活': '是' if device.os_activated else '否',
                    '已修补已知漏洞': '是' if device.vulnerabilities_patched else '否',
                    '最近杀毒日期': device.last_antivirus_at,
                    '是否发现病毒木马': '是' if device.malware_found else '否',
                    '病毒木马说明': device.malware_notes,
                    '备注': device.remarks,
                }
            )

        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            pd.DataFrame(info_rows).to_excel(writer, index=False, sheet_name='驻场申请单')
            pd.DataFrame(device_rows or [{'设备名称': '', '序列号': '', '品牌': '', '型号': ''}]).to_excel(
                writer,
                index=False,
                sheet_name='设备备案',
            )

        buffer.seek(0)
        filename = f"resident_{resident.registration_code}.xlsx"
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=['get'])
    def export_pdf(self, request, pk=None):
        resident = self.get_object()
        buffer = io.BytesIO()
        _build_resident_pdf(buffer, resident, request)
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="resident_{resident.registration_code}.pdf"'
        return response

    @action(detail=False, methods=['get'])
    def registration_qr(self, request):
        token = request.query_params.get('token', '')
        if token:
            intake_link, error_response = _resolve_resident_intake_link(token)
            if error_response is not None:
                return error_response
            token = intake_link.token
        image_buffer = _build_resident_qr_png(request, token=token)
        response = HttpResponse(image_buffer.getvalue(), content_type='image/png')
        response['Content-Disposition'] = 'attachment; filename="resident_intake_qr.png"'
        return response

    @action(detail=False, methods=['post'])
    def create_intake_link(self, request):
        expires_in_hours = max(int(request.data.get('expires_in_hours') or 24), 1)
        intake_link = ResidentIntakeLink.objects.create(
            created_by=request.user if request.user.is_authenticated else None,
            expires_at=timezone.now() + timedelta(hours=expires_in_hours),
        )
        record_audit(
            request,
            self.audit_module,
            'create_intake_link',
            detail=f'生成驻场公开登记链接，有效期 {expires_in_hours} 小时',
        )
        return Response(
            {
                'status': 'success',
                'link': ResidentIntakeLinkSerializer(intake_link, context={'request': request}).data,
            }
        )

    @action(detail=False, methods=['get'])
    def download_template(self, request):
        template_rows = [
            {
                '序号': 1,
                '登记编号': '',
                '公司': '示例公司',
                '姓名': '张三',
                '职务': '驻场工程师',
                '联系方式': '13800000000',
                '邮箱': 'zhangsan@example.com',
                '驻场类型': '实施驻场',
                '所属项目': '大模型实施',
                '归属部门': '信息中心',
                '是否需要安排座位': '是',
                '目前在厅办公地点': '3F 指挥中心',
                '座位号': 'A-01',
                '驻场开始日期': '2026-03-25',
                '驻场结束日期': '2026-06-30',
                '审批状态': '已通过',
                '设备名称': '办公笔记本',
                '序列号': 'SN-EXAMPLE-001',
                '品牌': 'Lenovo',
                '型号': 'ThinkPad',
                '有线网卡mac地址': '',
                '无线网卡mac地址': 'AA:BB:CC:DD:EE:FF',
                '是否安装安全防护软件': '是',
                '操作系统是否正版激活': '是',
                '是否已对终端已知安全漏洞进行修补': '是',
                '最近杀毒时间': '2026-03-20',
                '是否发现病毒、木马': '否',
                '病毒木马说明': '',
                '备注': '模板示例行，可直接覆盖后导入',
            }
        ]
        tips_rows = [
            {'字段': '一人多设备', '说明': '同一人员多台设备时，复制该人员所在行，仅修改设备相关列。'},
            {'字段': '登记编号', '说明': '为空时按新人员导入；填写已有登记编号时会更新对应人员。'},
            {'字段': '审批状态', '说明': '支持：待审核、已通过、已驳回、已离场。留空默认按“已通过”导入。'},
            {'字段': '是否类字段', '说明': '支持填写：是/否、true/false、1/0。'},
            {'字段': '最近杀毒时间', '说明': '支持 Excel 日期、YYYY-MM-DD 或原始日期序列号。'},
        ]

        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            pd.DataFrame(template_rows, columns=RESIDENT_EXPORT_HEADERS).to_excel(
                writer,
                index=False,
                sheet_name='驻场人员导入模板',
            )
            pd.DataFrame(tips_rows).to_excel(writer, index=False, sheet_name='填写说明')

        buffer.seek(0)
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename="resident_staff_template.xlsx"'
        return response

    @action(detail=False, methods=['get'])
    def export_excel(self, request):
        rows = build_resident_export_rows(self.get_queryset())
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            pd.DataFrame(rows or [{header: '' for header in RESIDENT_EXPORT_HEADERS}], columns=RESIDENT_EXPORT_HEADERS).to_excel(
                writer,
                index=False,
                sheet_name='驻场人员导出',
            )
        buffer.seek(0)
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename="resident_staff_export.xlsx"'
        return response

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def preview_import_excel(self, request):
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'detail': '请先选择要导入的 Excel 或 CSV 文件。'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            dataframe, header_rows = _read_resident_import_dataframe(uploaded_file)
        except Exception as exc:
            logger.exception('Resident staff preview failed while reading file.')
            return Response({'detail': f'文件读取失败：{exc}'}, status=status.HTTP_400_BAD_REQUEST)

        if dataframe.empty:
            return Response({'detail': '表格中没有可导入的数据。'}, status=status.HTTP_400_BAD_REQUEST)

        grouped_rows, errors, failed_rows = _build_resident_import_groups(dataframe, header_rows)
        preview = _build_resident_import_preview(grouped_rows, errors, failed_rows)

        return Response(
            {
                'status': 'success',
                'detected_encoding': dataframe.attrs.get('source_encoding'),
                'preview': preview,
            }
        )

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    @transaction.atomic
    def import_excel(self, request):
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'detail': '请先选择要导入的 Excel 或 CSV 文件。'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            dataframe, header_rows = _read_resident_import_dataframe(uploaded_file)
        except Exception as exc:
            logger.exception('Resident staff import failed while reading file.')
            return Response({'detail': f'文件读取失败：{exc}'}, status=status.HTTP_400_BAD_REQUEST)

        if dataframe.empty:
            return Response({'detail': '表格中没有可导入的数据。'}, status=status.HTTP_400_BAD_REQUEST)

        grouped_rows, errors, _ = _build_resident_import_groups(dataframe, header_rows)

        if not grouped_rows:
            return Response({'detail': '没有解析到有效人员，请检查模板表头和必填字段。'}, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        updated_count = 0
        registration_map, identity_map = build_resident_lookup_maps(grouped_rows, ResidentStaff)

        for grouped in grouped_rows.values():
            resident_data = grouped['resident']
            registration_code = resident_data.pop('registration_code')
            devices = grouped['devices']

            resident = None
            if registration_code:
                resident = registration_map.get(registration_code)
            if resident is None:
                resident = identity_map.get((resident_data['company'], resident_data['name'], resident_data['phone']))

            if resident is None:
                resident = ResidentStaff(**resident_data)
                resident.intake_source = 'manual'
                if request.user.is_authenticated:
                    resident.created_by = request.user
                resident.save()
                if registration_code:
                    resident.registration_code = registration_code
                    resident.save(update_fields=['registration_code'])
                registration_map[resident.registration_code] = resident
                identity_map[(resident.company, resident.name, resident.phone)] = resident
                created_count += 1
            else:
                for field, value in resident_data.items():
                    setattr(resident, field, value)
                if request.user.is_authenticated and resident.created_by_id is None:
                    resident.created_by = request.user
                resident.intake_source = 'manual'
                resident.save()
                if registration_code:
                    registration_map[registration_code] = resident
                identity_map[(resident.company, resident.name, resident.phone)] = resident
                updated_count += 1

            if devices:
                resident.devices.all().delete()
                ResidentDevice.objects.bulk_create(
                    [
                        ResidentDevice(
                            resident=resident,
                            **normalize_resident_device_payload(device_payload),
                        )
                        for device_payload in devices
                    ]
                )

        return Response(
            {
                'status': 'success',
                'created': created_count,
                'updated': updated_count,
                'errors': errors,
                'message': f'导入完成：新增 {created_count} 人，更新 {updated_count} 人。',
            }
        )


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def api_resident_intake(request):
    token = (request.query_params.get('token') or request.data.get('token') or '').strip()
    intake_link = None
    if token:
        intake_link, error_response = _resolve_resident_intake_link(token)
        if error_response is not None:
            return error_response
    elif not permanent_resident_intake_allowed():
        return Response(
            {'detail': '驻场登记必须使用管理员生成的有效链接。'},
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.method == 'GET':
        return Response(
            {
                'status': 'success',
                'link': _build_resident_intake_link_payload(request, intake_link),
            }
        )

    payload = request.data
    staff_members = payload.get('staff_members')
    company_profile = payload.get('company_profile') or {}

    if isinstance(company_profile, str):
        try:
            company_profile = json.loads(company_profile)
        except json.JSONDecodeError:
            company_profile = {}

    if isinstance(staff_members, str):
        try:
            staff_members = json.loads(staff_members)
        except json.JSONDecodeError:
            staff_members = None

    if isinstance(staff_members, list):
        common_payload = {
            'company': (company_profile.get('company') or '').strip(),
            'project_name': (company_profile.get('project_name') or '').strip(),
            'department': (company_profile.get('department') or '').strip(),
            'resident_type': company_profile.get('resident_type') or 'implementation',
            'start_date': company_profile.get('start_date') or None,
            'end_date': company_profile.get('end_date') or None,
        }

        if not common_payload['company']:
            return Response(
                {'status': 'error', 'errors': {'company': ['所属公司不能为空。']}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not staff_members:
            return Response(
                {'status': 'error', 'errors': {'staff_members': ['至少要填写一名驻场人员。']}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializers_to_save = []
        errors = {}
        for index, member in enumerate(staff_members, start=1):
            existing_resident = _resolve_existing_resident_for_intake(
                company=common_payload['company'],
                name=member.get('name'),
                phone=member.get('phone'),
                email=member.get('email'),
            )
            merged_payload = {
                **common_payload,
                'name': (member.get('name') or '').strip(),
                'title': (member.get('title') or '').strip(),
                'phone': (member.get('phone') or '').strip(),
                'email': (member.get('email') or '').strip(),
                'needs_seat': bool(member.get('needs_seat')),
                'office_location': (member.get('office_location') or '').strip(),
                'seat_number': (member.get('seat_number') or '').strip(),
                'remarks': (member.get('remarks') or '').strip(),
                'devices': member.get('devices') or [],
                'approval_status': 'pending',
                'intake_source': 'qr',
            }
            serializer = ResidentStaffSerializer(existing_resident, data=merged_payload)
            if serializer.is_valid():
                serializers_to_save.append((serializer, existing_resident is None))
            else:
                errors[f'staff_members[{index - 1}]'] = serializer.errors

        if errors:
            return Response({'status': 'error', 'errors': errors}, status=status.HTTP_400_BAD_REQUEST)

        saved_residents = []
        created_count = 0
        updated_count = 0
        with transaction.atomic():
            for serializer, is_create in serializers_to_save:
                saved_residents.append(serializer.save())
                if is_create:
                    created_count += 1
                else:
                    updated_count += 1

        response_status = status.HTTP_201_CREATED if created_count and not updated_count else status.HTTP_200_OK

        return Response(
            {
                'status': 'success',
                'link': _build_resident_intake_link_payload(request, intake_link),
                'message': f'提交完成：新增 {created_count} 人，更新 {updated_count} 人。',
                'created': created_count,
                'updated': updated_count,
                'registration_codes': [resident.registration_code for resident in saved_residents],
                'export_token': issue_resident_export_token(
                    resident.registration_code for resident in saved_residents
                ),
                'residents': ResidentStaffSerializer(saved_residents, many=True).data,
            },
            status=response_status,
        )

    payload = payload.copy()
    payload['approval_status'] = 'pending'
    payload['intake_source'] = 'qr'
    existing_resident = _resolve_existing_resident_for_intake(
        company=payload.get('company'),
        name=payload.get('name'),
        phone=payload.get('phone'),
        email=payload.get('email'),
    )
    serializer = ResidentStaffSerializer(existing_resident, data=payload)
    if serializer.is_valid():
        resident = serializer.save()
        response_status = status.HTTP_201_CREATED if existing_resident is None else status.HTTP_200_OK
        return Response(
            {
                'status': 'success',
                'link': _build_resident_intake_link_payload(request, intake_link),
                'message': '提交完成：新增 1 人，更新 0 人。' if existing_resident is None else '提交完成：新增 0 人，更新 1 人。',
                'created': 1 if existing_resident is None else 0,
                'updated': 0 if existing_resident is None else 1,
                'registration_code': resident.registration_code,
                'registration_codes': [resident.registration_code],
                'export_token': issue_resident_export_token([resident.registration_code]),
                'resident': ResidentStaffSerializer(resident).data,
                'residents': [ResidentStaffSerializer(resident).data],
            },
            status=response_status,
        )
    return Response({'status': 'error', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def api_resident_intake_export_pdf(request):
    registration_codes = request.data.get('registration_codes') or []
    export_token = request.data.get('export_token') or ''
    if isinstance(registration_codes, str):
        try:
            registration_codes = json.loads(registration_codes)
        except json.JSONDecodeError:
            registration_codes = [registration_codes]

    registration_codes = [str(code).strip() for code in registration_codes if str(code).strip()]
    if not registration_codes:
        return Response({'detail': '请先提供要导出的登记编号。'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        if not validate_resident_export_token(export_token, registration_codes):
            raise signing.BadSignature('Requested records are not covered by the token.')
    except signing.SignatureExpired:
        return Response({'detail': '导出凭证已过期，请重新提交登记。'}, status=status.HTTP_410_GONE)
    except signing.BadSignature:
        return Response({'detail': '导出凭证无效。'}, status=status.HTTP_403_FORBIDDEN)

    residents_map = {
        resident.registration_code: resident
        for resident in ResidentStaff.objects.filter(registration_code__in=registration_codes).prefetch_related('devices')
    }
    residents = [residents_map[code] for code in registration_codes if code in residents_map]
    if not residents:
        return Response({'detail': '没有找到可导出的驻场申请记录。'}, status=status.HTTP_404_NOT_FOUND)

    buffer = io.BytesIO()
    _build_resident_batch_pdf(buffer, residents, request)
    buffer.seek(0)
    filename = (
        f"resident_batch_{timezone.localtime().strftime('%Y%m%d%H%M%S')}.pdf"
        if len(residents) > 1
        else f"resident_{residents[0].registration_code}.pdf"
    )
    response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def public_change_request_entry(request):
    if request.method == 'POST':
        return Response({'detail': '请使用管理员发送的独立链接填写申请。'}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {
            'status': 'success',
            'entry': {
                'public_link': '',
                'is_permanent': False,
                'requires_token': True,
            },
            'request': None,
        }
    )


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def public_change_request_detail(request, token):
    change_request = (
        DatacenterChangeRequest.objects.prefetch_related(
            'items',
            'items__source_datacenter',
            'items__source_rack',
            'items__target_datacenter',
            'items__target_rack',
            'firewall_rules',
        )
        .filter(public_token=token)
        .first()
    )
    if change_request is None:
        return Response({'detail': '申请链接不存在。'}, status=status.HTTP_404_NOT_FOUND)
    if change_request.token_expires_at and change_request.token_expires_at < timezone.now():
        return Response({'detail': '申请链接已过期。'}, status=status.HTTP_410_GONE)

    if request.method == 'POST':
        if change_request.status in {'completed', 'cancelled', 'approved', 'scheduled'}:
            return Response({'detail': '当前申请不允许继续填写。'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = DatacenterChangeRequestPublicSubmitSerializer(change_request, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        topology = build_change_request_topology_rows(
            Datacenter.objects.prefetch_related('racks__devices').all(),
            include_sensitive=False,
        )
        return Response(
            {
                'status': 'success',
                'message': '申请信息已提交。',
                'topology': topology,
                'request': DatacenterChangeRequestPublicSerializer(change_request, context={'request': request}).data,
            }
        )

    serializer = DatacenterChangeRequestPublicSerializer(change_request, context={'request': request})
    topology = build_change_request_topology_rows(
        Datacenter.objects.prefetch_related('racks__devices').all(),
        include_sensitive=False,
    )
    return Response({'status': 'success', 'request': serializer.data, 'topology': topology})


@api_view(['GET'])
@permission_classes([AllowAny])
@authentication_classes([])
def public_change_request_export_pdf(request, token):
    change_request = (
        DatacenterChangeRequest.objects.prefetch_related(
            'items',
            'items__source_rack',
            'items__target_rack',
            'firewall_rules',
        )
        .filter(public_token=token)
        .first()
    )
    if change_request is None:
        return Response({'detail': '申请链接不存在。'}, status=status.HTTP_404_NOT_FOUND)
    if change_request.token_expires_at and change_request.token_expires_at < timezone.now():
        return Response({'detail': '申请链接已过期。'}, status=status.HTTP_410_GONE)

    buffer = io.BytesIO()
    _build_change_request_pdf(buffer, change_request)
    buffer.seek(0)
    response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
    _set_pdf_download_filename(response, _build_change_request_export_filename(change_request))
    return response


@api_view(['POST'])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([IpamWritePermission])
def scan_subnet(request):
    subnet_id = request.data.get('subnet_id')
    try:
        subnet = Subnet.objects.get(id=subnet_id)
    except Subnet.DoesNotExist:
        return Response({'status': 'error', 'message': '网段不存在'}, status=status.HTTP_404_NOT_FOUND)

    if not re.match(r'^[\d\./]+$', subnet.cidr):
        return Response({'status': 'error', 'message': 'CIDR 格式非法'}, status=status.HTTP_400_BAD_REQUEST)

    cmd = ['nmap', '-sn', '-n', subnet.cidr]
    try:
        logger.info('[Scan] scanning subnet %s', subnet.cidr)
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        found_ips = re.findall(r'Nmap scan report for (\d{1,3}(?:\.\d{1,3}){3})', result.stdout)

        updated = 0
        created_num = 0
        now = timezone.now()

        for ip in found_ips:
            obj, created = IPAddress.objects.get_or_create(
                ip_address=ip,
                subnet=subnet,
                defaults={
                    'status': 'online',
                    'device_name': 'Auto-Discovered',
                    'owner': 'System Scan',
                    'last_online': now,
                },
            )
            if created:
                created_num += 1
                continue

            if obj.status != 'online':
                obj.status = 'online'
                updated += 1
            obj.last_online = now
            obj.save(update_fields=['status', 'last_online'])

        detail = f'扫描网段 {subnet.cidr}，发现 {len(found_ips)} 个在线地址，新增 {created_num} 条，更新 {updated} 条'
        record_audit(request, 'ip_address', 'scan', subnet, detail=detail)
        return Response(
            {
                'status': 'success',
                'message': (
                    f'扫描完成\n'
                    f'发现在线地址: {len(found_ips)}\n'
                    f'新增资产: {created_num}\n'
                    f'状态更新: {updated}'
                ),
            }
        )

    except FileNotFoundError:
        return Response({'status': 'error', 'message': '服务器未安装 nmap'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as exc:
        logger.exception('Subnet scan failed.')
        return Response({'status': 'error', 'message': f'扫描失败: {exc}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DatacenterChangeRequestViewSet(OptionalPaginationMixin, BaseViewSet):
    audit_module = 'datacenter_change_request'
    permission_classes = [DatacenterChangeAccessPermission]
    queryset = (
        DatacenterChangeRequest.objects.select_related('created_by')
        .prefetch_related(
            'items',
            'items__rack_device',
            'items__source_datacenter',
            'items__source_rack',
            'items__target_datacenter',
            'items__target_rack',
            'firewall_rules',
        )
        .all()
    )
    serializer_class = DatacenterChangeRequestSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'request_code',
        'title',
        'applicant_name',
        'company',
        'department',
        'project_name',
        'items__device_name',
        'items__serial_number',
    ]

    def _enforce_reviewer_separation(self, change_request):
        if (
            change_request.created_by_id
            and change_request.created_by_id == self.request.user.id
            and get_user_role(self.request.user) != 'admin'
        ):
            raise PermissionDenied('申请创建人不能审批或驳回自己的申请。')

    def destroy(self, request, *args, **kwargs):
        change_request = self.get_object()
        if change_request.status != 'draft':
            return Response({'detail': '仅允许删除草稿状态的设备变更申请。'}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, status='draft')
        record_audit(self.request, self.audit_module, 'create', instance, '新增机房设备变更申请草稿并生成独立链接')

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        change_request = self.get_object()
        transition_change_request(change_request, 'submit')
        record_audit(request, self.audit_module, 'submit', change_request, '机房设备变更申请已提交审批')
        return Response({'status': 'success', 'request': self.get_serializer(change_request).data})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        change_request = self.get_object()
        self._enforce_reviewer_separation(change_request)
        transition_change_request(
            change_request,
            'approve',
            actor_name=get_actor_name(request.user),
            updates={
                'approval_code': request.data.get('approval_code'),
                'department_comment': request.data.get('department_comment'),
                'it_comment': request.data.get('it_comment'),
                'review_comment': request.data.get('review_comment'),
            },
        )
        record_audit(request, self.audit_module, 'approve', change_request, '机房设备变更申请已批准')
        return Response({'status': 'success', 'request': self.get_serializer(change_request).data})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        change_request = self.get_object()
        self._enforce_reviewer_separation(change_request)
        transition_change_request(
            change_request,
            'reject',
            actor_name=get_actor_name(request.user),
            updates={'review_comment': request.data.get('review_comment')},
        )
        record_audit(request, self.audit_module, 'reject', change_request, '机房设备变更申请已驳回')
        return Response({'status': 'success', 'request': self.get_serializer(change_request).data})

    @action(detail=True, methods=['post'])
    def schedule(self, request, pk=None):
        change_request = self.get_object()
        transition_change_request(
            change_request,
            'schedule',
            actor_name=get_actor_name(request.user),
            updates={
                'planned_execute_at': request.data.get('planned_execute_at'),
                'review_comment': request.data.get('review_comment'),
                'department_comment': request.data.get('department_comment'),
                'it_comment': request.data.get('it_comment'),
            },
        )
        record_audit(request, self.audit_module, 'schedule', change_request, '机房设备变更申请已排期')
        return Response({'status': 'success', 'request': self.get_serializer(change_request).data})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        change_request = self.get_object()
        items_payload = request.data.get('items')

        with transaction.atomic():
            if items_payload is not None:
                serializer = self.get_serializer(change_request, data={'items': items_payload}, partial=True)
                serializer.is_valid(raise_exception=True)
                change_request = serializer.save()

            execution_rows = apply_change_request_execution(change_request)
            transition_change_request(
                change_request,
                'complete',
                actor_name=get_actor_name(request.user),
                updates={
                    'executor_name': request.data.get('executor_name'),
                    'execution_comment': request.data.get('execution_comment', change_request.execution_comment),
                },
            )

        record_audit(
            request,
            self.audit_module,
            'complete',
            change_request,
            f'机房设备变更申请已执行完成，回填 {len(execution_rows)} 条设备结果',
        )
        return Response(
            {
                'status': 'success',
                'request': self.get_serializer(change_request).data,
                'execution_report': execution_rows,
            }
        )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        change_request = self.get_object()
        transition_change_request(
            change_request,
            'cancel',
            actor_name=get_actor_name(request.user),
            updates={'review_comment': request.data.get('review_comment')},
        )
        record_audit(request, self.audit_module, 'cancel', change_request, '机房设备变更申请已取消')
        return Response({'status': 'success', 'request': self.get_serializer(change_request).data})

    @action(detail=True, methods=['post'])
    def regenerate_link(self, request, pk=None):
        change_request = self.get_object()
        change_request.public_token = secrets.token_urlsafe(24)
        expires_in_days = max(int(request.data.get('expires_in_days') or 14), 1)
        change_request.token_expires_at = timezone.now() + timedelta(days=expires_in_days)
        change_request.save(update_fields=['public_token', 'token_expires_at', 'updated_at'])
        record_audit(request, self.audit_module, 'regenerate_link', change_request, '重新生成了公开申请链接')
        return Response({'status': 'success', 'request': self.get_serializer(change_request).data})

    @action(detail=True, methods=['post'])
    def set_link_expiry(self, request, pk=None):
        change_request = self.get_object()
        expires_in_days = max(int(request.data.get('expires_in_days') or 14), 1)
        change_request.token_expires_at = timezone.now() + timedelta(days=expires_in_days)
        change_request.save(update_fields=['token_expires_at', 'updated_at'])
        record_audit(
            request,
            self.audit_module,
            'set_link_expiry',
            change_request,
            f'设置公开申请链接有效期为 {expires_in_days} 天',
        )
        return Response({'status': 'success', 'request': self.get_serializer(change_request).data})

    @action(detail=True, methods=['post'])
    def revoke_link(self, request, pk=None):
        change_request = self.get_object()
        change_request.token_expires_at = timezone.now() - timedelta(seconds=1)
        change_request.save(update_fields=['token_expires_at', 'updated_at'])
        record_audit(request, self.audit_module, 'revoke_link', change_request, '作废了公开申请链接')
        return Response({'status': 'success', 'request': self.get_serializer(change_request).data})

    @action(detail=True, methods=['post'])
    def restore_link(self, request, pk=None):
        change_request = self.get_object()
        expires_in_days = max(int(request.data.get('expires_in_days') or 14), 1)
        change_request.token_expires_at = timezone.now() + timedelta(days=expires_in_days)
        change_request.save(update_fields=['token_expires_at', 'updated_at'])
        record_audit(
            request,
            self.audit_module,
            'restore_link',
            change_request,
            f'恢复公开申请链接并设置有效期为 {expires_in_days} 天',
        )
        return Response({'status': 'success', 'request': self.get_serializer(change_request).data})

    @action(detail=True, methods=['get'])
    def export_pdf(self, request, pk=None):
        change_request = self.get_object()
        buffer = io.BytesIO()
        _build_change_request_pdf(buffer, change_request)
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        _set_pdf_download_filename(response, _build_change_request_export_filename(change_request))
        return response

    @action(detail=False, methods=['get'])
    def topology(self, request):
        datacenter_rows = build_change_request_topology_rows(
            Datacenter.objects.prefetch_related('racks__devices').all()
        )
        return Response({'status': 'success', 'datacenters': datacenter_rows})


@api_view(['GET'])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([IpamAccessPermission])
def subnet_usage_matrix(request, pk=None):
    try:
        subnet = Subnet.objects.get(id=pk)
    except Subnet.DoesNotExist:
        return Response({'status': 'error', 'message': '网段不存在'}, status=status.HTTP_404_NOT_FOUND)

    try:
        network = ipaddress.ip_network(subnet.cidr, strict=False)
    except ValueError:
        return Response({'status': 'error', 'message': 'CIDR 格式错误'}, status=status.HTTP_400_BAD_REQUEST)

    registered_ips = {ip.ip_address: ip.status for ip in IPAddress.objects.filter(subnet=subnet)}
    matrix = []

    for count, ip in enumerate(network.hosts()):
        if count >= 255:
            break
        ip_str = str(ip)
        matrix.append(
            {
                'ip': ip_str,
                'status': registered_ips.get(ip_str, 'free'),
                'last_octet': ip_str.split('.')[-1],
            }
        )

    return Response(
        {
            'cidr': subnet.cidr,
            'total': max(network.num_addresses - 2, 0),
            'used': len(registered_ips),
            'matrix': matrix,
        }
    )


@api_view(['GET'])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([IsAdminUser])
def list_backups(request):
    backup_dir = get_backup_dir(settings.BASE_DIR)
    try:
        files = collect_backup_files(backup_dir)
        return Response([{key: value for key, value in item.items() if key != 'full_path' and key != 'created_at'} for item in files])
    except Exception:
        logger.exception('List backups failed.')
        return Response([])


@api_view(['POST'])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([IsAdminUser])
def trigger_backup(request):
    try:
        backup_info = create_manual_backup(
            base_dir=settings.BASE_DIR,
            database_settings=settings.DATABASES['default'],
            get_backup_dir=get_backup_dir,
            run=subprocess.run,
        )
        filename = backup_info['filename']
        record_audit(request, 'backup', 'trigger_backup', detail=f'手动创建备份文件：{filename}')
        return Response(
            {
                'status': 'success',
                'filename': filename,
                'size': backup_info['size'],
            }
        )
    except Exception as exc:
        logger.exception('Trigger backup failed.')
        return Response({'status': 'error', 'message': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([IsAdminUser])
def backup_summary(request):
    backup_dir = get_backup_dir(settings.BASE_DIR)
    files = collect_backup_files(backup_dir)
    return Response(build_backup_summary(files, backup_dir))


@api_view(['GET'])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([DcimAccessPermission])
def config_backup_summary(request):
    backup_dir = get_config_backup_dir(settings.BASE_DIR)
    host_backup_dir = os.environ.get('CONFIG_BACKUP_HOST_DIR') or os.environ.get('NETWORK_CONFIG_BACKUP_HOST_DIR') or './data/config_backups'
    files = collect_config_backup_files(backup_dir)
    payload = build_config_backup_summary(files, backup_dir)
    policy = get_or_create_config_backup_policy()
    payload['container_storage_path'] = backup_dir
    payload['host_storage_path'] = host_backup_dir
    payload['policy'] = ConfigBackupPolicySerializer(policy).data
    payload['targets'] = {}
    targets = ConfigBackupTarget.objects.select_related(
        'rack_device',
        'rack_device__rack',
        'rack_device__rack__datacenter',
        'ip_address',
        'credential',
        'created_by',
    ).prefetch_related('versions').all()
    latest_db_version = None
    for target in targets:
        target_payload = ConfigBackupTargetSerializer(target, context={'request': request}).data
        ip_key = str(target.management_ip)
        payload['targets'][ip_key] = target_payload
        device_group = payload['devices'].setdefault(
            ip_key,
            {
                'ip': ip_key,
                'device_type': target.device_type,
                'version_count': 0,
                'latest': None,
                'versions': [],
            },
        )
        device_group['target'] = target_payload
        db_versions = list(target.versions.all().order_by('-started_at', '-id')[:20])
        if db_versions and (latest_db_version is None or db_versions[0].started_at > latest_db_version.started_at):
            latest_db_version = db_versions[0]
        if not device_group.get('versions') and db_versions:
            serialized_versions = ConfigBackupVersionSerializer(db_versions, many=True).data
            device_group['versions'] = serialized_versions
            device_group['version_count'] = len(serialized_versions)
            device_group['latest'] = serialized_versions[0]
    payload['target_count'] = len(payload['targets'])
    payload['enabled_target_count'] = sum(1 for target in targets if target.enabled)
    payload['total_devices'] = len(payload['devices'])
    payload['failure_summary'] = summarize_failure_reasons(targets)
    payload['versions'] = ConfigBackupVersionSerializer(
        ConfigBackupVersion.objects.select_related('target', 'target__rack_device', 'target__ip_address').order_by('-started_at', '-id')[:200],
        many=True,
    ).data
    if latest_db_version is not None and not payload.get('latest_backup_at'):
        latest_payload = ConfigBackupVersionSerializer(latest_db_version).data
        payload['latest_backup_at'] = latest_payload.get('time_iso') or ''
        payload['latest_backup_name'] = latest_payload.get('filename') or ''
    return Response(payload)


@api_view(['GET', 'PATCH', 'POST'])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([DcimAccessPermission])
def config_backup_policy(request):
    policy = get_or_create_config_backup_policy()
    if request.method == 'GET':
        return Response(ConfigBackupPolicySerializer(policy).data)
    serializer = ConfigBackupPolicySerializer(policy, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    if request.data.get('apply_retention_to_targets'):
        ConfigBackupTarget.objects.update(retention_count=serializer.instance.retention_count)
    record_audit(request, 'config_backup_policy', 'update', detail='更新网络配置备份计划与通知策略')
    return Response(ConfigBackupPolicySerializer(serializer.instance).data)


@api_view(['POST'])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([DcimAccessPermission])
def config_backup_test_email(request):
    policy = get_or_create_config_backup_policy()
    serializer = ConfigBackupPolicySerializer(policy, data=request.data or {}, partial=True)
    serializer.is_valid(raise_exception=True)
    policy = serializer.save()
    fake_result = type(
        'ConfigBackupEmailTestResult',
        (),
        {
            'total': 0,
            'success': 0,
            'failed': 0,
            'message': '配置备份邮件测试',
            'results': [],
        },
    )()
    try:
        result = send_config_backup_notification(policy, fake_result, force=True)
    except ConfigBackupPolicyError as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(result)


@api_view(['GET'])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([IsAdminUser])
def download_backup(request):
    filename = (request.GET.get('filename') or '').strip()
    if not filename:
        return Response({'detail': '请先提供备份文件名。'}, status=status.HTTP_400_BAD_REQUEST)

    safe_name, file_path = resolve_backup_download_path(
        base_dir=settings.BASE_DIR,
        filename=filename,
        get_backup_dir=get_backup_dir,
    )
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return Response({'detail': '没有找到对应的备份文件。'}, status=status.HTTP_404_NOT_FOUND)

    record_audit(request, 'backup', 'download', detail=f'下载备份文件：{safe_name}')
    return FileResponse(open(file_path, 'rb'), as_attachment=True, filename=safe_name)


@api_view(['GET'])
@permission_classes([AllowAny])
def public_dcim_overview(request):
    if not public_dcim_access_allowed(request):
        return Response({'detail': '公开机房视图未启用或访问令牌无效。'}, status=status.HTTP_403_FORBIDDEN)

    include_sensitive = bool(getattr(settings, 'PUBLIC_DCIM_INCLUDE_SENSITIVE', False))
    datacenters = Datacenter.objects.prefetch_related('racks__devices').order_by('name')
    return Response(
        build_public_dcim_payload(
            datacenters,
            include_sensitive=include_sensitive,
            updated_at=timezone.localtime().strftime('%Y-%m-%d %H:%M'),
        )
    )


def _dcim_import_sheets(file_obj):
    workbook = pd.ExcelFile(file_obj, engine='openpyxl')
    racks_sheet = '机柜资产' if '机柜资产' in workbook.sheet_names else workbook.sheet_names[0]
    devices_sheet = '设备资产' if '设备资产' in workbook.sheet_names else (
        workbook.sheet_names[1] if len(workbook.sheet_names) > 1 else None
    )
    racks_df = normalize_dataframe_text(pd.read_excel(workbook, sheet_name=racks_sheet, engine='openpyxl').fillna(''))
    devices_df = (
        normalize_dataframe_text(pd.read_excel(workbook, sheet_name=devices_sheet, engine='openpyxl').fillna(''))
        if devices_sheet
        else pd.DataFrame(columns=DCIM_DEVICE_HEADERS)
    )
    return racks_df, devices_df


def _build_dcim_import_preview(racks_df, devices_df, preview_limit=20):
    preview = {
        'can_import': True,
        'summary': {
            'rack_rows': 0,
            'device_rows': 0,
            'rack_create_rows': 0,
            'rack_update_rows': 0,
            'device_create_rows': 0,
            'device_update_rows': 0,
            'invalid_rows': 0,
        },
        'errors': [],
        'warnings': [],
        'rows': [],
        'failed_rows': [],
    }

    existing_datacenters = {item.name: item for item in Datacenter.objects.all()}
    existing_racks = {
        (rack.datacenter.name, rack.code): rack
        for rack in Rack.objects.select_related('datacenter').all()
    }
    existing_devices_by_asset = {}
    existing_devices_by_position = {}
    for device in RackDevice.objects.select_related('rack', 'rack__datacenter').all():
        rack_key = (device.rack.datacenter.name, device.rack.code)
        if device.asset_tag:
            existing_devices_by_asset[(rack_key, device.asset_tag)] = device
        existing_devices_by_position[(rack_key, device.position)] = device

    staged_rack_keys = set()

    for row_index, (_, row) in enumerate(racks_df.iterrows(), start=2):
        datacenter_name = str(row.get('机房名称', '')).strip()
        rack_code = str(row.get('机柜编号', '')).strip()
        rack_name = str(row.get('机柜名称', '')).strip()

        if not datacenter_name and not rack_code and not rack_name:
            continue

        preview['summary']['rack_rows'] += 1

        if not datacenter_name or not rack_code:
            preview['summary']['invalid_rows'] += 1
            reason = '缺少机房名称或机柜编号'
            preview['errors'].append(f'机柜资产表第 {row_index} 行缺少必填字段：机房名称或机柜编号。')
            preview['failed_rows'].append(
                {
                    'sheet': '机柜资产',
                    'row_number': row_index,
                    'record_type': 'rack',
                    'title': rack_name or rack_code or '未命名机柜',
                    'action': 'invalid',
                    'reason': reason,
                }
            )
            if len(preview['rows']) < preview_limit:
                preview['rows'].append(
                    {
                        'sheet': '机柜资产',
                        'row_number': row_index,
                        'record_type': 'rack',
                        'title': rack_name or rack_code or '未命名机柜',
                        'action': 'invalid',
                        'reason': reason,
                    }
                )
            continue

        rack_key = (datacenter_name, rack_code)
        staged_rack_keys.add(rack_key)
        existing_rack = existing_racks.get(rack_key)
        action = 'update' if existing_rack else 'create'
        preview['summary'][f'rack_{action}_rows'] += 1

        if datacenter_name not in existing_datacenters and action == 'create':
            warning = f'机房“{datacenter_name}”不存在，导入时将自动创建。'
            if warning not in preview['warnings']:
                preview['warnings'].append(warning)

        if len(preview['rows']) < preview_limit:
            preview['rows'].append(
                {
                    'sheet': '机柜资产',
                    'row_number': row_index,
                    'record_type': 'rack',
                    'title': rack_name or rack_code,
                    'subtitle': f'{datacenter_name} · {rack_code}',
                    'action': action,
                    'reason': action == 'create' and '将新增机柜' or '将更新机柜信息',
                }
            )

    for row_index, (_, row) in enumerate(devices_df.iterrows(), start=2):
        datacenter_name = str(row.get('机房名称', '')).strip()
        rack_code = str(row.get('机柜编号', '')).strip()
        device_name = str(row.get('设备名称', '')).strip()
        asset_tag = str(row.get('固定资产编号', '')).strip()
        position = int(row.get('起始U位', 1) or 1)

        if not datacenter_name and not rack_code and not device_name:
            continue

        preview['summary']['device_rows'] += 1

        if not datacenter_name or not rack_code or not device_name:
            preview['summary']['invalid_rows'] += 1
            reason = '缺少机房名称、机柜编号或设备名称'
            preview['errors'].append(f'设备资产表第 {row_index} 行缺少必填字段：机房名称、机柜编号或设备名称。')
            preview['failed_rows'].append(
                {
                    'sheet': '设备资产',
                    'row_number': row_index,
                    'record_type': 'device',
                    'title': device_name or '未命名设备',
                    'action': 'invalid',
                    'reason': reason,
                }
            )
            if len(preview['rows']) < preview_limit:
                preview['rows'].append(
                    {
                        'sheet': '设备资产',
                        'row_number': row_index,
                        'record_type': 'device',
                        'title': device_name or '未命名设备',
                        'action': 'invalid',
                        'reason': reason,
                    }
                )
            continue

        rack_key = (datacenter_name, rack_code)
        existing_device = None
        if asset_tag:
            existing_device = existing_devices_by_asset.get((rack_key, asset_tag))
        if existing_device is None:
            existing_device = existing_devices_by_position.get((rack_key, position))

        action = 'update' if existing_device else 'create'
        preview['summary'][f'device_{action}_rows'] += 1

        if rack_key not in existing_racks and rack_key not in staged_rack_keys:
            warning = f'设备资产表第 {row_index} 行引用的机柜 {datacenter_name}/{rack_code} 当前不存在。'
            if warning not in preview['warnings']:
                preview['warnings'].append(warning)

        if len(preview['rows']) < preview_limit:
            preview['rows'].append(
                {
                    'sheet': '设备资产',
                    'row_number': row_index,
                    'record_type': 'device',
                    'title': device_name,
                    'subtitle': f'{datacenter_name} · {rack_code} · U{position}',
                    'action': action,
                    'reason': action == 'create' and '将新增设备' or '将更新设备信息',
                    'has_warning': rack_key not in existing_racks and rack_key not in staged_rack_keys,
                }
            )

    if preview['errors']:
        preview['can_import'] = False

    return preview


@api_view(['GET'])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([DcimAccessPermission])
def download_dcim_template(request):
    rack_template = pd.DataFrame(
        [
            {
                '机房名称': '7F 核心机房',
                '机房位置': '708',
                '机柜编号': 'RK-01',
                '机柜名称': '核心交换机柜',
                '高度(U)': 42,
                '额定功率(W)': 8000,
                'PDU数量': 2,
                'PDU实测功率(W)': 1200,
                '备注': '请勿删除表头，可按机柜逐行维护。',
            }
        ],
        columns=DCIM_RACK_HEADERS,
    )
    device_template = pd.DataFrame(
        [
            {
                '机房名称': '7F 核心机房',
                '机柜编号': 'RK-01',
                '机柜名称': '核心交换机柜',
                '设备名称': '核心交换机 A',
                '起始U位': 40,
                '占用高度(U)': 2,
                '设备类型': 'switch',
                '品牌': 'Huawei',
                '型号': 'CloudEngine',
                '管理IP': '172.25.1.10',
                '项目名称': '骨干网络',
                '负责人': '张三',
                '额定功率(W)': 350,
                '典型功率(W)': 260,
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
        columns=DCIM_DEVICE_HEADERS,
    )

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        rack_template.to_excel(writer, sheet_name='机柜资产', index=False)
        device_template.to_excel(writer, sheet_name='设备资产', index=False)

    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename="dcim_asset_template.xlsx"'
    response.write(buffer.getvalue())
    record_audit(request, 'dcim', 'download_template', detail='下载了 DCIM 资产导入模板')
    return response


@api_view(['GET'])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([DcimAccessPermission])
def export_dcim_excel(request):
    rack_rows = []
    for rack in Rack.objects.select_related('datacenter').all().order_by('datacenter__name', 'code'):
        rack_rows.append(
            {
                '机房名称': rack.datacenter.name,
                '机房位置': rack.datacenter.location,
                '机柜编号': rack.code,
                '机柜名称': rack.name,
                '高度(U)': rack.height,
                '额定功率(W)': rack.power_limit,
                'PDU数量': rack.pdu_count,
                'PDU实测功率(W)': rack.pdu_power,
                '备注': rack.description,
            }
        )

    device_rows = []
    for device in RackDevice.objects.select_related('rack', 'rack__datacenter').all().order_by(
        'rack__datacenter__name', 'rack__code', '-position'
    ):
        device_rows.append(
            {
                '机房名称': device.rack.datacenter.name,
                '机房位置': device.rack.datacenter.location,
                '机柜编号': device.rack.code,
                '机柜名称': device.rack.name,
                '设备名称': device.name,
                '起始U位': device.position,
                '占用高度(U)': device.u_height,
                '设备类型': device.device_type,
                '品牌': device.brand,
                '型号': device.model,
                '管理IP': device.mgmt_ip,
                '项目名称': device.project,
                '负责人': device.contact,
                '额定功率(W)': device.power_usage,
                '典型功率(W)': device.typical_power,
                '配置信息': device.specs,
                '序列号(SN)': device.sn,
                '固定资产编号': device.asset_tag,
                '设备状态': device.status,
                '采购日期': device.purchase_date.isoformat() if device.purchase_date else '',
                '维保到期': device.warranty_date.isoformat() if device.warranty_date else '',
                '供应商': device.supplier,
                'OS/固件': device.os_version,
            }
        )

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        pd.DataFrame(rack_rows, columns=DCIM_RACK_HEADERS).to_excel(writer, sheet_name='机柜资产', index=False)
        pd.DataFrame(device_rows, columns=DCIM_DEVICE_HEADERS).to_excel(writer, sheet_name='设备资产', index=False)

    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = (
        f'attachment; filename="dcim_assets_{datetime.now().strftime("%Y%m%d")}.xlsx"'
    )
    response.write(buffer.getvalue())
    record_audit(request, 'dcim', 'export', detail='导出了 DCIM 资产 Excel')
    return response


@api_view(['POST'])
@parser_classes([MultiPartParser])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([DcimWritePermission])
def preview_dcim_import_excel(request):
    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({'status': 'error', 'message': '请先上传 Excel 文件。'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        racks_df, devices_df = _dcim_import_sheets(file_obj)
        preview = _build_dcim_import_preview(racks_df, devices_df)
        return Response(
            {
                'status': 'success',
                'detected_encoding': 'xlsx',
                'preview': preview,
            }
        )
    except Exception as exc:
        logger.exception('Preview dcim import excel failed.')
        return Response({'status': 'error', 'message': f'DCIM 导入预览失败: {exc}'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@parser_classes([MultiPartParser])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([DcimWritePermission])
@transaction.atomic
def import_dcim_excel(request):
    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({'status': 'error', 'message': '请先上传 Excel 文件。'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        racks_df, devices_df = _dcim_import_sheets(file_obj)
        imported_racks = 0
        imported_devices = 0
        rack_map = {}

        for _, row in racks_df.iterrows():
            datacenter_name = str(row.get('机房名称', '')).strip()
            rack_code = str(row.get('机柜编号', '')).strip()
            if not datacenter_name or not rack_code:
                continue

            datacenter, _ = Datacenter.objects.get_or_create(
                name=datacenter_name,
                defaults={'location': str(row.get('机房位置', '')).strip()},
            )
            if str(row.get('机房位置', '')).strip() and datacenter.location != str(row.get('机房位置', '')).strip():
                datacenter.location = str(row.get('机房位置', '')).strip()
                datacenter.save(update_fields=['location'])

            rack_defaults = {
                'name': str(row.get('机柜名称', '')).strip(),
                'height': int(row.get('高度(U)', 42) or 42),
                'power_limit': int(row.get('额定功率(W)', 0) or 0),
                'pdu_count': int(row.get('PDU数量', 2) or 2),
                'pdu_power': int(row.get('PDU实测功率(W)', 0) or 0),
                'description': str(row.get('备注', '')).strip(),
            }
            rack, _ = Rack.objects.update_or_create(
                datacenter=datacenter,
                code=rack_code,
                defaults=rack_defaults,
            )
            rack_map[(datacenter.name, rack.code)] = rack
            imported_racks += 1

        for _, row in devices_df.iterrows():
            datacenter_name = str(row.get('机房名称', '')).strip()
            rack_code = str(row.get('机柜编号', '')).strip()
            device_name = str(row.get('设备名称', '')).strip()
            if not datacenter_name or not rack_code or not device_name:
                continue

            rack = rack_map.get((datacenter_name, rack_code))
            if not rack:
                datacenter = Datacenter.objects.filter(name=datacenter_name).first()
                if not datacenter:
                    continue
                rack = Rack.objects.filter(datacenter=datacenter, code=rack_code).first()
                if not rack:
                    continue

            defaults = {
                'name': device_name,
                'u_height': int(row.get('占用高度(U)', 1) or 1),
                'device_type': str(row.get('设备类型', 'server') or 'server').strip(),
                'brand': str(row.get('品牌', '')).strip(),
                'model': str(row.get('型号', '')).strip(),
                'mgmt_ip': str(row.get('管理IP', '')).strip() or None,
                'project': str(row.get('项目名称', '')).strip(),
                'contact': str(row.get('负责人', '')).strip(),
                'power_usage': int(row.get('额定功率(W)', 0) or 0),
                'typical_power': int(row.get('典型功率(W)', 0) or 0),
                'specs': str(row.get('配置信息', '')).strip(),
                'sn': str(row.get('序列号(SN)', '')).strip() or None,
                'asset_tag': str(row.get('固定资产编号', '')).strip(),
                'status': str(row.get('设备状态', 'active') or 'active').strip(),
                'purchase_date': _parse_date(row.get('采购日期')),
                'warranty_date': _parse_date(row.get('维保到期')),
                'supplier': str(row.get('供应商', '')).strip(),
                'os_version': str(row.get('OS/固件', '')).strip(),
            }

            position = int(row.get('起始U位', 1) or 1)
            match_kwargs = {'rack': rack, 'position': position}
            if defaults['asset_tag']:
                match_kwargs = {'rack': rack, 'asset_tag': defaults['asset_tag']}

            existing_device = RackDevice.objects.filter(**match_kwargs).first()
            device_serializer = RackDeviceSerializer(
                existing_device,
                data={
                    **defaults,
                    'rack': rack.id,
                    'position': position,
                },
            )
            device_serializer.is_valid(raise_exception=True)
            device_serializer.save()
            imported_devices += 1

        record_audit(
            request,
            'dcim',
            'import',
            detail=f'批量导入 DCIM 资产：机柜 {imported_racks} 个，设备 {imported_devices} 台',
        )
        return Response(
            {
                'status': 'success',
                'message': f'已导入/更新 {imported_racks} 个机柜，{imported_devices} 台设备。',
            }
        )
    except serializers.ValidationError as exc:
        return Response(
            {'status': 'error', 'message': 'DCIM 资产数据校验失败。', 'errors': exc.detail},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as exc:
        logger.exception('Import dcim excel failed.')
        return Response(
            {'status': 'error', 'message': f'DCIM 资产导入失败: {exc}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['GET'])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([IpamAccessPermission])
def download_template(request):
    data = [
        {
            'IP地址': '192.168.1.10',
            '设备名称': '示例服务器',
            '状态': 'online',
            '设备类型': 'server',
            '负责人': '张三',
            '备注': '请勿删除这一行示例',
        }
    ]
    df = pd.DataFrame(data)
    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename=ip_import_template.xlsx'
    df.to_excel(response, index=False, engine='openpyxl')
    record_audit(request, 'ip_address', 'download_template', detail='下载了 IP 台账导入模板')
    return response


@api_view(['GET'])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([IpamAccessPermission])
def export_excel(request):
    try:
        ips = IPAddress.objects.all().select_related('subnet')
        rows = []
        for ip in ips:
            rows.append(
                {
                    'IP地址': ip.ip_address,
                    '状态': ip.status,
                    '设备名称': ip.device_name,
                    '设备类型': ip.device_type,
                    '负责人': ip.owner,
                    '所属网段': ip.subnet.cidr if ip.subnet else '未分配',
                    'NAT类型': ip.nat_type,
                    'NAT地址': ip.nat_ip,
                    '备注': ip.description,
                    '最后在线': ip.last_online.strftime('%Y-%m-%d %H:%M') if ip.last_online else '',
                }
            )

        df = pd.DataFrame(rows)
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        filename = f"ip_assets_{datetime.now().strftime('%Y%m%d')}.xlsx"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        df.to_excel(response, index=False, engine='openpyxl')
        record_audit(request, 'ip_address', 'export', detail='导出了 IP 台账 Excel')
        return response
    except Exception as exc:
        logger.exception('Export excel failed.')
        return Response({'status': 'error', 'message': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _load_ip_import_dataframe(file_obj, header_row):
    detected_encoding = ''
    if str(file_obj.name).lower().endswith('.csv'):
        df = read_csv_with_fallback(file_obj, header=header_row).fillna('')
        detected_encoding = df.attrs.get('detected_encoding', '')
        df['__sheet_name__'] = ''
        return df, detected_encoding

    sheet_frames = pd.read_excel(file_obj, sheet_name=None, engine='openpyxl', header=header_row)
    normalized_frames = []
    for sheet_name, frame in sheet_frames.items():
        normalized = normalize_dataframe_text(frame.fillna('').copy())
        normalized['__sheet_name__'] = sheet_name
        normalized_frames.append(normalized)
    df = pd.concat(normalized_frames, ignore_index=True) if normalized_frames else pd.DataFrame()
    return df, 'xlsx'


def _resolve_import_config(config_raw):
    try:
        import_config = json.loads(config_raw) if config_raw else {}
    except (TypeError, json.JSONDecodeError):
        import_config = {}

    skip_rows = max(int(import_config.get('skipRows') or 1), 1)
    return {
        'raw': import_config,
        'skip_rows': skip_rows,
        'header_row': max(skip_rows - 1, 0),
        'conflict_mode': str(import_config.get('conflictMode') or 'overwrite').lower(),
        'sheet_mapping': str(import_config.get('sheetMapping') or 'none').lower(),
    }


def _match_subnet_for_ip(target_ip, all_subnets, sheet_name='', sheet_mapping='none'):
    matched_subnet = None
    for subnet in all_subnets:
        try:
            if target_ip in ipaddress.ip_network(subnet.cidr, strict=False):
                matched_subnet = subnet
                break
        except ValueError:
            continue

    if not matched_subnet and sheet_name and sheet_mapping == 'subnet':
        matched_subnet = next(
            (
                subnet for subnet in all_subnets
                if sheet_name in str(subnet.name)
                or sheet_name in str(subnet.cidr)
                or sheet_name in str(subnet.location or '')
            ),
            None,
        )

    return matched_subnet


def _build_ip_import_preview(df, all_subnets, conflict_mode='overwrite', sheet_mapping='none', preview_limit=20):
    required_cols = ['IP地址', '设备名称']
    missing_columns = [column for column in required_cols if column not in df.columns]
    preview = {
        'columns': [str(column) for column in df.columns if str(column)],
        'missing_required_columns': missing_columns,
        'can_import': not missing_columns,
        'summary': {
            'total_rows': 0,
            'actionable_rows': 0,
            'create_rows': 0,
            'update_rows': 0,
            'skip_rows': 0,
            'invalid_rows': 0,
            'unmatched_subnet_rows': 0,
        },
        'errors': [],
        'warnings': [],
        'rows': [],
        'failed_rows': [],
    }

    if missing_columns:
        reason = f"缺少必要列：{'、'.join(missing_columns)}"
        preview['errors'].append(reason)
        preview['failed_rows'].append(
            {
                'row_number': '',
                'action': 'invalid',
                'title': '模板校验失败',
                'subtitle': 'IP 台账导入',
                'sheet': 'IP 台账导入',
                'reason': reason,
            }
        )
        return preview

    existing_ip_map = {item.ip_address: item for item in IPAddress.objects.filter(ip_address__in=df['IP地址'].astype(str).tolist())}

    for row_index, (_, row) in enumerate(df.iterrows(), start=1):
        ip_str = str(row.get('IP地址', '')).strip()
        if not ip_str:
            continue

        preview['summary']['total_rows'] += 1
        sheet_name = str(row.get('__sheet_name__', '')).strip()
        device_name = str(row.get('设备名称', '')).strip()

        try:
            target_ip = ipaddress.ip_address(ip_str)
        except ValueError:
            preview['summary']['invalid_rows'] += 1
            reason = 'IP 地址格式无效'
            preview['errors'].append(f'第 {row_index} 行 IP 地址无效：{ip_str}')
            preview['failed_rows'].append(
                {
                    'row_number': row_index,
                    'action': 'invalid',
                    'title': device_name or '未填写设备名称',
                    'subtitle': ip_str,
                    'sheet': sheet_name or 'IP 台账导入',
                    'reason': reason,
                }
            )
            if len(preview['rows']) < preview_limit:
                preview['rows'].append(
                    {
                        'row_number': row_index,
                        'ip_address': ip_str,
                        'device_name': device_name,
                        'sheet_name': sheet_name,
                        'action': 'invalid',
                        'reason': reason,
                    }
                )
            continue

        matched_subnet = _match_subnet_for_ip(target_ip, all_subnets, sheet_name=sheet_name, sheet_mapping=sheet_mapping)
        existing_ip = existing_ip_map.get(ip_str)
        action = 'create'
        reason = '将新增记录'

        if existing_ip and conflict_mode == 'skip':
            action = 'skip'
            reason = '目标 IP 已存在，按策略跳过'
            preview['summary']['skip_rows'] += 1
        elif existing_ip:
            action = 'update'
            reason = '目标 IP 已存在，将覆盖现有信息'
            preview['summary']['update_rows'] += 1
            preview['summary']['actionable_rows'] += 1
        else:
            preview['summary']['create_rows'] += 1
            preview['summary']['actionable_rows'] += 1

        if matched_subnet is None:
            preview['summary']['unmatched_subnet_rows'] += 1
            warning = f'第 {row_index} 行未匹配到网段：{ip_str}'
            if warning not in preview['warnings']:
                preview['warnings'].append(warning)

        if len(preview['rows']) < preview_limit:
            preview['rows'].append(
                {
                    'row_number': row_index,
                    'ip_address': ip_str,
                    'device_name': device_name,
                    'status': str(row.get('状态', 'offline')).strip() or 'offline',
                    'device_type': str(row.get('设备类型', 'other')).strip() or 'other',
                    'owner': str(row.get('负责人', row.get('使用人', ''))).strip(),
                    'sheet_name': sheet_name,
                    'subnet': {
                        'id': matched_subnet.id,
                        'name': matched_subnet.name,
                        'cidr': matched_subnet.cidr,
                    }
                    if matched_subnet
                    else None,
                    'action': action,
                    'reason': reason,
                    'has_warning': matched_subnet is None,
                }
            )

    return preview


def _append_sheet_mapping_description(description, sheet_name, sheet_mapping):
    normalized_description = str(description or '').strip()
    if sheet_name and sheet_mapping == 'location' and sheet_name not in normalized_description:
        return f'{normalized_description}\n工作表:{sheet_name}'.strip() if normalized_description else f'工作表:{sheet_name}'
    return normalized_description


@api_view(['POST'])
@parser_classes([MultiPartParser])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([IpamWritePermission])
def preview_import_excel(request):
    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({'status': 'error', 'message': '未上传文件'}, status=status.HTTP_400_BAD_REQUEST)

    config = _resolve_import_config(request.data.get('config'))

    try:
        df, detected_encoding = _load_ip_import_dataframe(file_obj, header_row=config['header_row'])
        all_subnets = list(Subnet.objects.select_related('section').all())
        preview = _build_ip_import_preview(
            df,
            all_subnets,
            conflict_mode=config['conflict_mode'],
            sheet_mapping=config['sheet_mapping'],
        )
        return Response(
            {
                'status': 'success',
                'detected_encoding': detected_encoding,
                'config': config['raw'],
                'preview': preview,
            }
        )
    except Exception as exc:
        logger.exception('Preview import excel failed.')
        return Response({'status': 'error', 'message': f'导入预览失败: {exc}'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@parser_classes([MultiPartParser])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([IpamWritePermission])
@transaction.atomic
def import_excel(request):
    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({'status': 'error', 'message': '未上传文件'}, status=status.HTTP_400_BAD_REQUEST)

    config = _resolve_import_config(request.data.get('config'))

    try:
        df, detected_encoding = _load_ip_import_dataframe(file_obj, header_row=config['header_row'])
        all_subnets = list(Subnet.objects.select_related('section').all())
        preview = _build_ip_import_preview(
            df,
            all_subnets,
            conflict_mode=config['conflict_mode'],
            sheet_mapping=config['sheet_mapping'],
        )
        if not preview['can_import']:
            return Response(
                {'status': 'error', 'message': 'Excel 缺少必要列：IP地址、设备名称', 'preview': preview},
                status=status.HTTP_400_BAD_REQUEST,
            )

        success_count = 0
        skipped_count = 0

        for _, row in df.iterrows():
            ip_str = str(row.get('IP地址', '')).strip()
            if not ip_str:
                continue

            try:
                target_ip = ipaddress.ip_address(ip_str)
            except ValueError:
                skipped_count += 1
                continue

            sheet_name = str(row.get('__sheet_name__', '')).strip()
            matched_subnet = _match_subnet_for_ip(
                target_ip,
                all_subnets,
                sheet_name=sheet_name,
                sheet_mapping=config['sheet_mapping'],
            )
            existing_ip = IPAddress.objects.filter(ip_address=ip_str).first()
            if existing_ip and config['conflict_mode'] == 'skip':
                skipped_count += 1
                continue

            description = _append_sheet_mapping_description(
                row.get('备注', ''),
                sheet_name,
                config['sheet_mapping'],
            )

            IPAddress.objects.update_or_create(
                ip_address=ip_str,
                defaults={
                    'device_name': row.get('设备名称', ''),
                    'status': row.get('状态', 'offline'),
                    'device_type': row.get('设备类型', 'other'),
                    'owner': row.get('负责人', row.get('使用人', '')),
                    'description': description,
                    'subnet': matched_subnet,
                },
            )
            success_count += 1

        detail = (
            f'批量导入 IP 台账：成功/更新 {success_count} 条，跳过 {skipped_count} 条，'
            f'冲突策略 {config["conflict_mode"]}，工作表映射 {config["sheet_mapping"]}，源编码 {detected_encoding or "unknown"}'
        )
        record_audit(request, 'ip_address', 'import', detail=detail)
        return Response(
            {
                'status': 'success',
                'message': f'成功导入 / 更新 {success_count} 条数据，跳过 {skipped_count} 条',
                'detected_encoding': detected_encoding,
                'report': {
                    **preview['summary'],
                    'imported_rows': success_count,
                    'skipped_rows': skipped_count,
                },
                'warnings': preview['warnings'],
            }
        )
    except Exception as exc:
        logger.exception('Import excel failed.')
        return Response({'status': 'error', 'message': f'导入失败: {exc}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@authentication_classes([SessionAuthentication])
def api_version(request):
    return Response({'status': 'success', 'backend': get_backend_version_payload()})


@api_view(['GET'])
@permission_classes([AllowAny])
@authentication_classes([])
def api_health(request):
    return Response({'status': 'ok'})


@api_view(['GET'])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([IsAuthenticated])
def system_overview(request):
    backup_files = collect_backup_files(get_backup_dir(settings.BASE_DIR))
    payload = build_system_overview_payload(
        backend_version=get_backend_version_payload(),
        counts={
            'datacenters': Datacenter.objects.count(),
            'racks': Rack.objects.count(),
            'devices': RackDevice.objects.count(),
            'ips': IPAddress.objects.count(),
            'resident_staff': ResidentStaff.objects.count(),
        },
        backup_files=backup_files,
        data_quality_summary=get_data_quality_summary(now=timezone.now(), build_report=build_encoding_report),
    )
    return Response(payload)


@api_view(['GET'])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([IsAdminUser])
def encoding_report(request):
    limit, report = build_encoding_report_payload(
        raw_limit=request.GET.get('limit'),
        build_report=build_encoding_report,
    )
    record_audit(request, 'data_quality', 'scan_encoding', detail=f'扫描疑似乱码数据，样本上限 {limit} 条')
    return Response(report)


@api_view(['POST', 'GET'])
@authentication_classes([SessionAuthentication, BasicAuthentication])
@permission_classes([IsAdminUser])
def init_datacenters(request):
    defaults = [
        {'name': '7F 核心机房', 'location': '7 楼东侧核心区'},
        {'name': '3F 指挥中心', 'location': '3 楼大厅'},
        {'name': '3F 值班机房', 'location': '3 楼西侧'},
        {'name': '13F 机房', 'location': '13 楼备份区'},
    ]
    try:
        count = 0
        for item in defaults:
            _, created = Datacenter.objects.get_or_create(
                name=item['name'],
                defaults={'location': item['location']},
            )
            if created:
                count += 1
        return Response({'status': 'success', 'message': f'成功初始化 {count} 个机房'})
    except Exception as exc:
        logger.exception('Init datacenters failed.')
        return Response({'status': 'error', 'message': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
