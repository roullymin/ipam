import gzip
import io
import ipaddress
import json
import logging
import os
import re
import secrets
import subprocess
from functools import lru_cache
from datetime import date, datetime, timedelta

import pandas as pd
import qrcode
from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.models import User
from django.db import transaction
from django.http import FileResponse, HttpResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.pdfmetrics import registerFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from rest_framework import filters, status, viewsets
from rest_framework.authentication import BasicAuthentication, SessionAuthentication
from rest_framework.decorators import action, api_view, authentication_classes, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from .models import (
    AuditLog,
    Blocklist,
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
)
from .domains.backup.selectors import build_backup_summary, collect_backup_files, get_backup_dir
from .domains.backup.services import create_manual_backup, resolve_backup_download_path
from .domains.change_requests.selectors import build_change_request_topology_rows
from .domains.change_requests.services import apply_change_request_execution
from .domains.data_quality.services import build_encoding_report_payload
from .domains.data_quality.selectors import get_data_quality_summary
from .domains.platform.selectors import build_system_overview_payload
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
from .serializers import (
    AuditLogSerializer,
    BlocklistSerializer,
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
    SubnetSerializer,
    UserSerializer,
    normalize_resident_device_payload,
)
from .text_encoding import build_encoding_report, normalize_dataframe_text, normalize_text_value, read_csv_with_fallback

logger = logging.getLogger('django')

LOGIN_LOCK_THRESHOLD = 5
LOGIN_LOCK_MINUTES = 30
APP_VERSION = os.environ.get('APP_VERSION', 'v1')


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
    '管理IP',
    '项目名称',
    '负责人',
    '额定功率(W)',
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
            'is_permanent': True,
        }

    payload = ResidentIntakeLinkSerializer(intake_link, context={'request': request}).data
    payload['is_permanent'] = False
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
    status_label = dict(DatacenterChangeRequest._meta.get_field('status').choices).get(
        change_request.status,
        change_request.status,
    )

    title_text = '协助事项申请单' if change_request.request_type == 'assistance' else '机房设备变更申请单'

    elements = [
        Paragraph(title_text, title_style),
        Paragraph(
            f'申请编号：{change_request.request_code}　　导出时间：{timezone.localtime().strftime("%Y-%m-%d %H:%M")}',
            body_style,
        ),
        Spacer(1, 5 * mm),
    ]

    if change_request.request_type == 'assistance':
        info_rows = [
            ['申请类型', type_label, '当前状态', status_label],
            ['申请标题', change_request.title or '未填写', '审批编号', change_request.approval_code or '未填写'],
            ['需求联系人', change_request.applicant_name or '未填写', '联系方式', change_request.applicant_phone or '未填写'],
            ['联系邮箱', change_request.applicant_email or '未填写', '申请单位', change_request.company or '未填写'],
            ['需求处室', change_request.department or '未填写', '项目名称', change_request.project_name or '未填写'],
            ['期望协助时间', _format_change_datetime(change_request.planned_execute_at), '链接状态', _format_change_link_status(change_request)],
            ['处理完成时间', _format_change_datetime(change_request.executed_at), '创建人', get_actor_name(change_request.created_by)],
        ]
    else:
        info_rows = [
            ['申请类型', type_label, '当前状态', status_label],
            ['申请标题', change_request.title or '未填写', '审批编号', change_request.approval_code or '未填写'],
            ['申请人', change_request.applicant_name or '未填写', '联系电话', change_request.applicant_phone or '未填写'],
            ['联系邮箱', change_request.applicant_email or '未填写', '所属单位', change_request.company or '未填写'],
            ['所属部门', change_request.department or '未填写', '所属项目', change_request.project_name or '未填写'],
            ['计划执行时间', _format_change_datetime(change_request.planned_execute_at), '链接状态', _format_change_link_status(change_request)],
            ['是否需要下电', '是' if change_request.requires_power_down else '否', '执行状态', status_label],
            ['处理执行时间', _format_change_datetime(change_request.executed_at), '创建人', get_actor_name(change_request.created_by)],
        ]

    elements.append(Paragraph('一、申请信息', heading_style))
    info_table = Table(info_rows, colWidths=[24 * mm, 58 * mm, 24 * mm, 56 * mm])
    info_table.setStyle(
        TableStyle(
            [
                ('FONTNAME', (0, 0), (-1, -1), base_font),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('LEADING', (0, 0), (-1, -1), 14),
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

    detail_heading = '二、协助内容' if change_request.request_type == 'assistance' else '二、变更说明'
    elements.append(Paragraph(detail_heading, heading_style))
    elements.append(Paragraph(f'申请原因：{change_request.reason or "未填写"}', body_style))
    elements.append(Spacer(1, 2 * mm))
    if change_request.request_type == 'assistance':
        elements.append(Paragraph(f'协助内容：{change_request.request_content or "未填写"}', body_style))
    else:
        elements.append(Paragraph(f'影响范围：{change_request.impact_scope or "未填写"}', body_style))
    elements.append(Spacer(1, 5 * mm))

    if change_request.request_type != 'assistance':
        elements.append(Paragraph('三、设备明细', heading_style))
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
                    item.device_name or '未填写',
                    ' / '.join(filter(None, [item.device_model, item.serial_number])) or '未填写',
                    f'{item.quantity} 台 / {item.u_height}U',
                    network_label,
                    '\n'.join(ip_lines),
                    '\n'.join(location_lines) or '未填写',
                    item.notes or '未填写',
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

    action_heading = '三、审批与处理记录' if change_request.request_type == 'assistance' else '四、审批与执行记录'
    elements.append(Paragraph(action_heading, heading_style))
    action_rows = [
        ['业务处室意见' if change_request.request_type == 'assistance' else '部门意见', change_request.department_comment or '未填写'],
        ['科技与信息化处意见' if change_request.request_type == 'assistance' else '信息化意见', change_request.it_comment or '未填写'],
        ['审批意见', change_request.review_comment or '未填写'],
        ['审批人 / 时间', f'{change_request.reviewer_name or "未填写"} / {_format_change_datetime(change_request.reviewed_at)}'],
        ['处理人 / 时间' if change_request.request_type == 'assistance' else '执行人 / 时间', f'{change_request.executor_name or "未填写"} / {_format_change_datetime(change_request.executed_at)}'],
        ['处理备注' if change_request.request_type == 'assistance' else '执行备注', change_request.execution_comment or '未填写'],
    ]
    action_table = Table(action_rows, colWidths=[28 * mm, 136 * mm])
    action_table.setStyle(
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
    elements.append(action_table)

    elements.append(Spacer(1, 5 * mm))
    signature_heading = '四、签字栏' if change_request.request_type == 'assistance' else '五、签字确认'
    elements.append(Paragraph(signature_heading, heading_style))
    if change_request.request_type == 'assistance':
        signature_rows = [
            ['申请单位（盖章）', change_request.company or '____________________'],
            ['业务处室签名', '签字：____________________    日期：____________________'],
            ['科信处领导签名', f'签字：{change_request.reviewer_name or "____________________"}    日期：{_format_change_datetime(change_request.reviewed_at) if change_request.reviewed_at else "____________________"}'],
            ['协助处理人', f'{change_request.executor_name or "____________________"}    日期：{_format_change_datetime(change_request.executed_at) if change_request.executed_at else "____________________"}'],
        ]
    else:
        signature_rows = [
            ['申请部门签字', '签字：____________________    日期：____________________'],
            ['审批领导签字', f'签字：{change_request.reviewer_name or "____________________"}    日期：{_format_change_datetime(change_request.reviewed_at) if change_request.reviewed_at else "____________________"}'],
            ['执行确认签字', f'签字：{change_request.executor_name or "____________________"}    日期：{_format_change_datetime(change_request.executed_at) if change_request.executed_at else "____________________"}'],
        ]
    signature_table = Table(signature_rows, colWidths=[38 * mm, 126 * mm])
    signature_table.setStyle(
        TableStyle(
            [
                ('FONTNAME', (0, 0), (-1, -1), base_font),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('LEADING', (0, 0), (-1, -1), 16),
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#eff6ff')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#334155')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
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
            'start_date': company_profile.get('start_date') or '',
            'end_date': company_profile.get('end_date') or '',
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
    if isinstance(registration_codes, str):
        try:
            registration_codes = json.loads(registration_codes)
        except json.JSONDecodeError:
            registration_codes = [registration_codes]

    registration_codes = [str(code).strip() for code in registration_codes if str(code).strip()]
    if not registration_codes:
        return Response({'detail': '请先提供要导出的登记编号。'}, status=status.HTTP_400_BAD_REQUEST)

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
def public_change_request_detail(request, token):
    change_request = (
        DatacenterChangeRequest.objects.prefetch_related(
            'items',
            'items__source_datacenter',
            'items__source_rack',
            'items__target_datacenter',
            'items__target_rack',
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
        return Response(
            {
                'status': 'success',
                'message': '申请信息已提交。',
                'request': DatacenterChangeRequestPublicSerializer(change_request).data,
            }
        )

    serializer = DatacenterChangeRequestPublicSerializer(change_request)
    return Response({'status': 'success', 'request': serializer.data})


@api_view(['GET'])
@permission_classes([AllowAny])
@authentication_classes([])
def public_change_request_export_pdf(request, token):
    change_request = (
        DatacenterChangeRequest.objects.prefetch_related(
            'items',
            'items__source_rack',
            'items__target_rack',
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
    response['Content-Disposition'] = f'attachment; filename="change_request_{change_request.request_code}.pdf"'
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
        if change_request.status not in {'draft', 'rejected'}:
            return Response({'detail': '当前状态不支持提交审批。'}, status=status.HTTP_400_BAD_REQUEST)
        change_request.status = 'submitted'
        change_request.save(update_fields=['status', 'updated_at'])
        record_audit(request, self.audit_module, 'submit', change_request, '机房设备变更申请已提交审批')
        return Response({'status': 'success', 'request': self.get_serializer(change_request).data})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        change_request = self.get_object()
        change_request.status = 'approved'
        change_request.reviewer_name = get_actor_name(request.user)
        change_request.reviewed_at = timezone.now()
        if request.data.get('approval_code') is not None:
            change_request.approval_code = request.data.get('approval_code')
        if request.data.get('department_comment') is not None:
            change_request.department_comment = request.data.get('department_comment')
        if request.data.get('it_comment') is not None:
            change_request.it_comment = request.data.get('it_comment')
        comment = request.data.get('review_comment')
        if comment is not None:
            change_request.review_comment = comment
        change_request.save(
            update_fields=[
                'status',
                'reviewer_name',
                'reviewed_at',
                'approval_code',
                'department_comment',
                'it_comment',
                'review_comment',
                'updated_at',
            ]
        )
        record_audit(request, self.audit_module, 'approve', change_request, '机房设备变更申请已批准')
        return Response({'status': 'success', 'request': self.get_serializer(change_request).data})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        change_request = self.get_object()
        change_request.status = 'rejected'
        change_request.reviewer_name = get_actor_name(request.user)
        change_request.reviewed_at = timezone.now()
        comment = request.data.get('review_comment')
        if comment is not None:
            change_request.review_comment = comment
        change_request.save(update_fields=['status', 'reviewer_name', 'reviewed_at', 'review_comment', 'updated_at'])
        record_audit(request, self.audit_module, 'reject', change_request, '机房设备变更申请已驳回')
        return Response({'status': 'success', 'request': self.get_serializer(change_request).data})

    @action(detail=True, methods=['post'])
    def schedule(self, request, pk=None):
        change_request = self.get_object()
        change_request.status = 'scheduled'
        if request.data.get('planned_execute_at'):
            change_request.planned_execute_at = request.data.get('planned_execute_at')
        if request.data.get('review_comment') is not None:
            change_request.review_comment = request.data.get('review_comment')
        if request.data.get('department_comment') is not None:
            change_request.department_comment = request.data.get('department_comment')
        if request.data.get('it_comment') is not None:
            change_request.it_comment = request.data.get('it_comment')
        change_request.save(
            update_fields=[
                'status',
                'planned_execute_at',
                'review_comment',
                'department_comment',
                'it_comment',
                'updated_at',
            ]
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
            change_request.status = 'completed'
            change_request.executor_name = request.data.get('executor_name') or get_actor_name(request.user)
            change_request.execution_comment = request.data.get('execution_comment', change_request.execution_comment)
            change_request.executed_at = timezone.now()
            change_request.save(update_fields=['status', 'executor_name', 'execution_comment', 'executed_at', 'updated_at'])

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
        response['Content-Disposition'] = f'attachment; filename="change_request_{change_request.request_code}.pdf"'
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
    datacenter_rows = []
    total_racks = 0
    total_devices = 0
    total_capacity = 0
    total_used = 0
    total_planned_power = 0
    total_actual_power = 0

    datacenters = Datacenter.objects.all().order_by('name')
    for datacenter in datacenters:
        racks = list(datacenter.racks.all().order_by('code', 'id'))
        rack_payload = []
        dc_devices = 0
        dc_capacity = 0
        dc_used = 0
        dc_planned_power = 0
        dc_actual_power = 0

        for rack in racks:
            devices = list(rack.devices.all().order_by('-position', 'id'))
            rack_height = int(rack.height or 42)
            used_units = sum(max(1, int(device.u_height or 1)) for device in devices)
            free_units = max(0, rack_height - used_units)
            utilization = min(100, round((used_units / rack_height) * 100)) if rack_height else 0
            planned_power, actual_power = _resolve_rack_power_snapshot(rack, devices)
            device_payload = [
                {
                    'id': device.id,
                    'name': device.name,
                    'position': device.position,
                    'u_height': device.u_height,
                    'device_type': device.device_type,
                    'mgmt_ip': device.mgmt_ip,
                    'project': device.project,
                    'contact': device.contact,
                    'power_usage': device.power_usage,
                }
                for device in devices
            ]

            rack_payload.append(
                {
                    'id': rack.id,
                    'code': rack.code,
                    'name': rack.name or rack.code,
                    'height': rack_height,
                    'device_count': len(devices),
                    'used_units': used_units,
                    'free_units': free_units,
                    'utilization': utilization,
                    'planned_power': planned_power,
                    'actual_power': actual_power,
                    'devices': device_payload,
                }
            )

            dc_devices += len(devices)
            dc_capacity += rack_height
            dc_used += used_units
            dc_planned_power += planned_power
            dc_actual_power += actual_power

        dc_free = max(0, dc_capacity - dc_used)
        datacenter_rows.append(
            {
                'id': datacenter.id,
                'name': datacenter.name,
                'location': datacenter.location,
                'contact_phone': datacenter.contact_phone,
                'rack_count': len(racks),
                'device_count': dc_devices,
                'total_u': dc_capacity,
                'used_u': dc_used,
                'free_u': dc_free,
                'utilization': min(100, round((dc_used / dc_capacity) * 100)) if dc_capacity else 0,
                'planned_power': dc_planned_power,
                'actual_power': dc_actual_power,
                'racks': rack_payload,
            }
        )

        total_racks += len(racks)
        total_devices += dc_devices
        total_capacity += dc_capacity
        total_used += dc_used
        total_planned_power += dc_planned_power
        total_actual_power += dc_actual_power

    return Response(
        {
            'updated_at': timezone.localtime().strftime('%Y-%m-%d %H:%M'),
            'summary': {
                'datacenter_count': len(datacenter_rows),
                'rack_count': total_racks,
                'device_count': total_devices,
                'total_u': total_capacity,
                'used_u': total_used,
                'free_u': max(0, total_capacity - total_used),
                'utilization': min(100, round((total_used / total_capacity) * 100)) if total_capacity else 0,
                'planned_power': total_planned_power,
                'actual_power': total_actual_power,
            },
            'datacenters': datacenter_rows,
        }
    )


def _split_rack_description(description):
    raw_description = description or ''
    pdu_count = 2
    pdu_power = 0
    match = re.search(r'__PDU_META__:({.*})$', raw_description, re.MULTILINE)
    if match:
        try:
            meta = json.loads(match.group(1))
            pdu_count = int(meta.get('count') or 2)
            pdu_power = int(meta.get('power') or 0)
        except (TypeError, ValueError, json.JSONDecodeError):
            pdu_count = 2
            pdu_power = 0
        raw_description = re.sub(r'__PDU_META__:({.*})$', '', raw_description, flags=re.MULTILINE).strip()
    return raw_description, pdu_count, pdu_power


def _resolve_rack_power_snapshot(rack, devices):
    planned_from_devices = sum(max(0, int(device.power_usage or 0)) for device in devices)
    planned_power = planned_from_devices or max(0, int(rack.power_limit or 0))
    _, _, pdu_power = _split_rack_description(rack.description)
    actual_power = max(0, int(pdu_power or 0)) or planned_power
    return planned_power, actual_power


def _merge_rack_description(description, pdu_count, pdu_power):
    cleaned = (description or '').strip()
    meta = json.dumps({'count': int(pdu_count or 2), 'power': int(pdu_power or 0)}, ensure_ascii=False)
    return f'{cleaned}\n__PDU_META__:{meta}'.strip() if cleaned else f'__PDU_META__:{meta}'


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
        description, pdu_count, pdu_power = _split_rack_description(rack.description)
        rack_rows.append(
            {
                '机房名称': rack.datacenter.name,
                '机房位置': rack.datacenter.location,
                '机柜编号': rack.code,
                '机柜名称': rack.name,
                '高度(U)': rack.height,
                '额定功率(W)': rack.power_limit,
                'PDU数量': pdu_count,
                'PDU实测功率(W)': pdu_power,
                '备注': description,
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
                '管理IP': device.mgmt_ip,
                '项目名称': device.project,
                '负责人': device.contact,
                '额定功率(W)': device.power_usage,
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
                'description': _merge_rack_description(
                    str(row.get('备注', '')).strip(),
                    row.get('PDU数量', 2) or 2,
                    row.get('PDU实测功率(W)', 0) or 0,
                ),
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
                'mgmt_ip': str(row.get('管理IP', '')).strip() or None,
                'project': str(row.get('项目名称', '')).strip(),
                'contact': str(row.get('负责人', '')).strip(),
                'power_usage': int(row.get('额定功率(W)', 0) or 0),
                'specs': str(row.get('配置信息', '')).strip(),
                'sn': str(row.get('序列号(SN)', '')).strip() or None,
                'asset_tag': str(row.get('固定资产编号', '')).strip(),
                'status': str(row.get('设备状态', 'active') or 'active').strip(),
                'purchase_date': _parse_date(row.get('采购日期')),
                'warranty_date': _parse_date(row.get('维保到期')),
                'supplier': str(row.get('供应商', '')).strip(),
                'os_version': str(row.get('OS/固件', '')).strip(),
            }

            match_kwargs = {'rack': rack, 'position': int(row.get('起始U位', 1) or 1)}
            if defaults['asset_tag']:
                match_kwargs = {'rack': rack, 'asset_tag': defaults['asset_tag']}

            RackDevice.objects.update_or_create(defaults=defaults, **match_kwargs)
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
@permission_classes([AllowAny])
@authentication_classes([])
def api_version(request):
    return Response({'status': 'success', 'backend': get_backend_version_payload()})


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

