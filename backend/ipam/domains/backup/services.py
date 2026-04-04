import gzip
import os
import subprocess
from datetime import datetime


def create_manual_backup(*, base_dir, database_settings, get_backup_dir, makedirs=os.makedirs, gzip_open=gzip.open, run=subprocess.run, getsize=os.path.getsize):
    backup_dir = get_backup_dir(base_dir)
    makedirs(backup_dir, exist_ok=True)

    filename = f"manual_{datetime.now().strftime('%Y%m%d%H%M')}.sql.gz"
    file_path = os.path.join(backup_dir, filename)
    command = [
        'mysqldump',
        '-h', str(database_settings.get('HOST') or '127.0.0.1'),
        '-u', str(database_settings.get('USER') or ''),
        f"-p{database_settings.get('PASSWORD') or ''}",
        str(database_settings.get('NAME') or ''),
    ]

    with gzip_open(file_path, 'wb') as backup_stream:
        result = run(command, stdout=backup_stream, stderr=subprocess.PIPE, check=False)

    if result.returncode != 0:
        error_message = result.stderr.decode('utf-8', errors='ignore').strip() or 'mysqldump failed'
        raise RuntimeError(error_message)

    return {
        'filename': filename,
        'file_path': file_path,
        'size': f'{getsize(file_path) / 1024 / 1024:.2f} MB',
    }


def resolve_backup_download_path(*, base_dir, filename, get_backup_dir):
    safe_name = os.path.basename(str(filename or '').strip())
    if not safe_name:
        return None, None
    return safe_name, os.path.join(get_backup_dir(base_dir), safe_name)
