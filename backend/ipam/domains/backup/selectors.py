import os
from datetime import datetime


def get_backup_dir(base_dir, env=os.environ):
    return env.get('BACKUP_DIR') or os.path.join(base_dir, 'backups')


def collect_backup_files(backup_dir):
    if not os.path.exists(backup_dir):
        return []

    files = []
    for filename in os.listdir(backup_dir):
        if not (filename.endswith('.gz') or filename.endswith('.sql')):
            continue
        full_path = os.path.join(backup_dir, filename)
        if not os.path.isfile(full_path):
            continue
        stat = os.stat(full_path)
        files.append(
            {
                'filename': filename,
                'full_path': full_path,
                'bytes': stat.st_size,
                'size': f'{stat.st_size / 1024 / 1024:.2f} MB',
                'time': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M'),
                'type': '手动' if 'manual' in filename else '自动',
                'created_at': stat.st_mtime,
            }
        )

    files.sort(key=lambda item: item['created_at'], reverse=True)
    return files


def build_backup_summary(files, backup_dir):
    total_bytes = sum(item['bytes'] for item in files)
    latest = files[0] if files else None
    return {
        'latest_backup_time': latest['time'] if latest else '',
        'latest_backup_name': latest['filename'] if latest else '',
        'latest_backup_type': latest['type'] if latest else '',
        'backup_count': len(files),
        'manual_count': len([item for item in files if item['type'] == '手动']),
        'auto_count': len([item for item in files if item['type'] == '自动']),
        'total_bytes': total_bytes,
        'total_size': f'{total_bytes / 1024 / 1024:.2f} MB',
        'storage_path': backup_dir,
        'status': 'normal' if files else 'empty',
        'restore_tip': '恢复前请先停止业务容器，并先校验备份文件是否完整。',
    }
