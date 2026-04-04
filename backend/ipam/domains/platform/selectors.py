def build_system_overview_payload(*, backend_version, counts, backup_files, data_quality_summary):
    latest_backup = backup_files[0] if backup_files else None
    return {
        'status': 'success',
        'backend': backend_version,
        'counts': counts,
        'backup': {
            'status': 'normal' if backup_files else 'empty',
            'latest_backup_time': latest_backup['time'] if latest_backup else '',
            'backup_count': len(backup_files),
        },
        'data_quality': data_quality_summary,
    }
