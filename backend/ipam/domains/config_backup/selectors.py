import os
import re
from datetime import datetime


CONFIG_BACKUP_FILENAME_RE = re.compile(
    r'^(?P<ip>(?:\d{1,3}\.){3}\d{1,3})_(?P<date>\d{8})(?:[_-]?(?P<time>\d{4,6}))?\.txt(?:\.gz)?$',
    re.IGNORECASE,
)


def get_config_backup_dir(base_dir, env=os.environ):
    return (
        env.get('CONFIG_BACKUP_DIR')
        or env.get('NETWORK_CONFIG_BACKUP_DIR')
        or '/backup'
    )


def _format_bytes(size):
    if size < 1024:
        return f'{size} B'
    if size < 1024 * 1024:
        return f'{size / 1024:.1f} KB'
    if size < 1024 * 1024 * 1024:
        return f'{size / 1024 / 1024:.2f} MB'
    return f'{size / 1024 / 1024 / 1024:.2f} GB'


def _parse_backup_filename(filename):
    match = CONFIG_BACKUP_FILENAME_RE.match(filename)
    if not match:
        return None

    date_token = match.group('date')
    time_token = match.group('time') or ''
    backup_date = f'{date_token[:4]}-{date_token[4:6]}-{date_token[6:8]}'
    backup_time = ''
    if len(time_token) >= 4:
        backup_time = f'{time_token[:2]}:{time_token[2:4]}'
    if len(time_token) == 6:
        backup_time = f'{backup_time}:{time_token[4:6]}'

    return {
        'ip': match.group('ip'),
        'backup_date': backup_date,
        'backup_time': backup_time,
    }


def collect_config_backup_files(backup_dir):
    if not os.path.isdir(backup_dir):
        return []

    files = []
    for root, dirnames, filenames in os.walk(backup_dir):
        dirnames[:] = [dirname for dirname in dirnames if not dirname.startswith('.')]
        device_type = os.path.basename(root).lower() or 'unknown'
        for filename in filenames:
            if not (filename.endswith('.gz') or filename.endswith('.txt')):
                continue

            parsed = _parse_backup_filename(filename)
            if not parsed:
                continue

            full_path = os.path.join(root, filename)
            if not os.path.isfile(full_path):
                continue

            stat = os.stat(full_path)
            created_at = datetime.fromtimestamp(stat.st_mtime)
            relative_path = os.path.relpath(full_path, backup_dir).replace(os.sep, '/')
            status_value = 'empty' if stat.st_size <= 0 else 'success'
            files.append(
                {
                    'id': relative_path,
                    'filename': filename,
                    'relative_path': relative_path,
                    'device_type': device_type,
                    'ip': parsed['ip'],
                    'backup_date': parsed['backup_date'],
                    'backup_time': parsed['backup_time'],
                    'bytes': stat.st_size,
                    'size': _format_bytes(stat.st_size),
                    'time': created_at.strftime('%Y-%m-%d %H:%M'),
                    'time_iso': created_at.isoformat(),
                    'created_at': stat.st_mtime,
                    'status': status_value,
                    'status_label': '空文件' if status_value == 'empty' else '成功',
                }
            )

    files.sort(key=lambda item: item['created_at'], reverse=True)
    return files


def build_config_backup_summary(files, backup_dir):
    by_ip = {}
    for item in files:
        ip_address = item['ip']
        group = by_ip.setdefault(
            ip_address,
            {
                'ip': ip_address,
                'device_type': item['device_type'],
                'version_count': 0,
                'latest': None,
                'versions': [],
            },
        )
        group['version_count'] += 1
        group['versions'].append({key: value for key, value in item.items() if key != 'created_at'})
        if group['latest'] is None:
            group['latest'] = group['versions'][-1]

    for group in by_ip.values():
        group['versions'].sort(key=lambda version: version.get('time_iso') or '', reverse=True)
        group['latest'] = group['versions'][0] if group['versions'] else None

    latest_file = files[0] if files else None
    total_bytes = sum(item['bytes'] for item in files)
    return {
        'storage_path': backup_dir,
        'directory_exists': os.path.isdir(backup_dir),
        'status': 'normal' if files else 'empty',
        'total_files': len(files),
        'total_devices': len(by_ip),
        'total_bytes': total_bytes,
        'total_size': _format_bytes(total_bytes),
        'latest_backup_at': latest_file['time_iso'] if latest_file else '',
        'latest_backup_name': latest_file['filename'] if latest_file else '',
        'devices': by_ip,
        'files': [{key: value for key, value in item.items() if key != 'created_at'} for item in files[:200]],
    }
