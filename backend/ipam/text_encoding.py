import io
from copy import deepcopy
from collections import OrderedDict

import pandas as pd
from django.apps import apps
from django.db import transaction

from .models import (
    AuditLog,
    Datacenter,
    IPAddress,
    NetworkSection,
    Rack,
    RackDevice,
    ResidentDevice,
    ResidentStaff,
    Subnet,
    UserProfile,
)

CSV_ENCODING_CANDIDATES = (
    'utf-8-sig',
    'utf-8',
    'gb18030',
    'gbk',
    'cp936',
    'big5',
    'latin1',
)

ROUNDTRIP_REPAIR_ENCODINGS = (
    'latin1',
    'cp1252',
    'gb18030',
    'gbk',
    'cp936',
)

SUSPICIOUS_MARKERS = OrderedDict(
    [
        ('\ufeff', 5),
        ('�', 5),
        ('ï»¿', 5),
        ('Ã', 3),
        ('Â', 2),
        ('â€', 3),
        ('æ', 2),
        ('ç', 2),
        ('å', 2),
        ('鍙', 2),
        ('闂', 2),
        ('锟', 4),
        ('妗', 2),
        ('鏃', 2),
        ('鐨', 2),
        ('鍚', 2),
        ('鎴', 2),
        ('鏍', 2),
        ('鏈', 2),
        ('瀛', 2),
        ('浜', 2),
        ('閲', 2),
        ('缁', 2),
        ('鍔', 2),
        ('璁', 2),
        ('閫', 2),
    ]
)

ENCODING_SCAN_FIELD_MAP = OrderedDict(
    [
        (Datacenter, ['name', 'location', 'contact_phone']),
        (Rack, ['code', 'name', 'description']),
        (
            RackDevice,
            [
                'name',
                'brand',
                'mgmt_ip',
                'project',
                'contact',
                'specs',
                'sn',
                'asset_tag',
                'supplier',
                'os_version',
            ],
        ),
        (NetworkSection, ['name', 'description', 'color_theme']),
        (Subnet, ['name', 'cidr', 'circuit_id', 'isp', 'bandwidth', 'location', 'function_usage']),
        (IPAddress, ['device_name', 'device_type', 'owner', 'description', 'nat_port']),
        (UserProfile, ['display_name', 'department', 'phone', 'title']),
        (
            ResidentStaff,
            [
                'registration_code',
                'company',
                'name',
                'title',
                'phone',
                'email',
                'project_name',
                'department',
                'office_location',
                'seat_number',
                'reviewer_name',
                'remarks',
            ],
        ),
        (
            ResidentDevice,
            [
                'device_name',
                'serial_number',
                'brand',
                'model',
                'wired_mac',
                'wireless_mac',
                'malware_notes',
                'remarks',
            ],
        ),
        (AuditLog, ['actor_name', 'module', 'action', 'target_type', 'target_id', 'target_display', 'detail']),
    ]
)


def mojibake_score(value):
    text = str(value or '')
    if not text:
        return 0

    score = 0
    for marker, weight in SUSPICIOUS_MARKERS.items():
        score += text.count(marker) * weight
    return score


def normalize_text_value(value):
    if value is None:
        return ''
    if isinstance(value, float) and pd.isna(value):
        return ''
    if pd.isna(value):
        return ''
    if not isinstance(value, str):
        return value
    return repair_mojibake_text(value.replace('\ufeff', '').strip())


def repair_mojibake_text(value):
    if not isinstance(value, str):
        return value

    text = value.replace('\ufeff', '').strip()
    baseline = mojibake_score(text)
    if baseline == 0:
        return text

    best_text = text
    best_score = baseline

    for encoding in ROUNDTRIP_REPAIR_ENCODINGS:
        try:
            candidate = text.encode(encoding).decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue

        candidate = candidate.replace('\ufeff', '').strip()
        candidate_score = mojibake_score(candidate)
        if candidate and candidate_score + 1 < best_score:
            best_text = candidate
            best_score = candidate_score

    return best_text


def decode_csv_bytes(raw_bytes):
    best_text = None
    best_encoding = None
    best_score = None

    for encoding in CSV_ENCODING_CANDIDATES:
        try:
            text = raw_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue

        score = mojibake_score(text)
        if best_text is None or score < best_score:
            best_text = text
            best_encoding = encoding
            best_score = score
            if score == 0 and encoding in {'utf-8-sig', 'utf-8'}:
                break

    if best_text is None:
        best_text = raw_bytes.decode('utf-8', errors='replace')
        best_encoding = 'utf-8-replace'

    repaired = repair_mojibake_text(best_text)
    if mojibake_score(repaired) < mojibake_score(best_text):
        best_text = repaired

    return best_text, best_encoding


def read_csv_with_fallback(uploaded_file, header=0):
    raw_bytes = uploaded_file.read()
    try:
        uploaded_file.seek(0)
    except Exception:
        pass

    text, encoding = decode_csv_bytes(raw_bytes)
    dataframe = pd.read_csv(io.StringIO(text), header=header, keep_default_na=False).fillna('')
    dataframe = normalize_dataframe_text(dataframe)
    dataframe.attrs['detected_encoding'] = encoding
    return dataframe


def normalize_dataframe_text(dataframe):
    normalized = dataframe.copy()
    normalized.columns = [normalize_text_value(column) for column in normalized.columns]

    for column in normalized.columns:
        if normalized[column].dtype == object:
            normalized[column] = normalized[column].map(normalize_text_value)

    return normalized


def build_encoding_report(limit_per_model=5):
    models_report = []
    suspected_records = 0
    suspected_fields = 0

    for model, field_names in ENCODING_SCAN_FIELD_MAP.items():
        samples = []
        model_record_count = 0
        model_field_count = 0

        for instance in model.objects.only('id', *field_names).iterator():
            flagged_fields = {}
            for field_name in field_names:
                value = getattr(instance, field_name, '')
                if not isinstance(value, str):
                    continue

                score = mojibake_score(value)
                if score <= 0:
                    continue

                repaired = repair_mojibake_text(value)
                flagged_fields[field_name] = {
                    'score': score,
                    'value': value,
                    'suggested': repaired if repaired != value else '',
                }

            if flagged_fields:
                model_record_count += 1
                model_field_count += len(flagged_fields)
                if len(samples) < limit_per_model:
                    samples.append(
                        {
                            'id': instance.pk,
                            'display': str(instance),
                            'fields': flagged_fields,
                        }
                    )

        if model_record_count:
            suspected_records += model_record_count
            suspected_fields += model_field_count
            models_report.append(
                {
                    'model': model.__name__,
                    'table': model._meta.db_table,
                    'suspected_records': model_record_count,
                    'suspected_fields': model_field_count,
                    'samples': samples,
                }
            )

    return {
        'summary': {
            'models_scanned': len(ENCODING_SCAN_FIELD_MAP),
            'suspected_records': suspected_records,
            'suspected_fields': suspected_fields,
        },
        'models': models_report,
    }


def build_cleanup_plan(limit_per_model=None):
    models_report = []
    records_to_fix = 0
    fields_to_fix = 0

    for model, field_names in ENCODING_SCAN_FIELD_MAP.items():
        records = []
        model_record_count = 0
        model_field_count = 0

        for instance in model.objects.only('id', *field_names).iterator():
            fixable_fields = {}
            for field_name in field_names:
                value = getattr(instance, field_name, '')
                if not isinstance(value, str):
                    continue

                score = mojibake_score(value)
                if score <= 0:
                    continue

                repaired = repair_mojibake_text(value)
                if repaired == value:
                    continue

                fixable_fields[field_name] = {
                    'score': score,
                    'original': value,
                    'suggested': repaired,
                }

            if fixable_fields:
                model_record_count += 1
                model_field_count += len(fixable_fields)
                if limit_per_model is None or len(records) < limit_per_model:
                    records.append(
                        {
                            'model_label': f'{model._meta.app_label}.{model.__name__}',
                            'model': model.__name__,
                            'table': model._meta.db_table,
                            'id': instance.pk,
                            'display': str(instance),
                            'fields': fixable_fields,
                        }
                    )

        if model_record_count:
            records_to_fix += model_record_count
            fields_to_fix += model_field_count
            models_report.append(
                {
                    'model_label': f'{model._meta.app_label}.{model.__name__}',
                    'model': model.__name__,
                    'table': model._meta.db_table,
                    'records_to_fix': model_record_count,
                    'fields_to_fix': model_field_count,
                    'records': records,
                }
            )

    return {
        'summary': {
            'models_scanned': len(ENCODING_SCAN_FIELD_MAP),
            'records_to_fix': records_to_fix,
            'fields_to_fix': fields_to_fix,
        },
        'models': models_report,
    }


def apply_cleanup_plan(plan, source='suggested'):
    summary = {
        'records_updated': 0,
        'fields_updated': 0,
        'models_updated': 0,
    }

    with transaction.atomic():
        for model_report in plan.get('models', []):
            model_label = model_report.get('model_label') or f"ipam.{model_report['model']}"
            app_label, model_name = model_label.split('.', 1)
            model = apps.get_model(app_label, model_name)
            model_updated = False

            for record in model_report.get('records', []):
                instance = model.objects.filter(pk=record['id']).first()
                if instance is None:
                    continue

                changed_fields = []
                for field_name, detail in record.get('fields', {}).items():
                    target_value = detail.get(source, '')
                    if getattr(instance, field_name, '') == target_value:
                        continue
                    setattr(instance, field_name, target_value)
                    changed_fields.append(field_name)

                if changed_fields:
                    instance.save(update_fields=changed_fields)
                    model_updated = True
                    summary['records_updated'] += 1
                    summary['fields_updated'] += len(changed_fields)

            if model_updated:
                summary['models_updated'] += 1

    return summary


def snapshot_cleanup_plan(plan):
    return deepcopy(plan)
