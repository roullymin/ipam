import json

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from ipam.domains.config_backup.services import (
    ConfigBackupConnectionError,
    ConfigBackupError,
    collect_secret_device_facts,
)
from ipam.domains.vault.services import VaultError, read_secret
from ipam.models import AnsibleTaskRun, SecretRecord
from ipam.views import (
    _apply_ansible_facts_to_asset,
    _ansible_fact_writeback_preview,
    _build_ansible_hosts,
    _classify_login_failure,
    _default_ansible_managed_hosts,
    _serialize_ansible_task_run,
)


class Command(BaseCommand):
    help = 'Collect facts from managed Ansible hosts and write them back to asset records.'

    def add_arguments(self, parser):
        parser.add_argument('--all', action='store_true', help='Collect facts from all managed hosts.')
        parser.add_argument('--ip', dest='ips', action='append', default=[], help='Collect one management IP. Can be repeated.')
        parser.add_argument('--target-id', dest='target_ids', action='append', type=int, default=[], help='Collect one ConfigBackupTarget id. Can be repeated.')
        parser.add_argument('--host-id', dest='host_ids', action='append', default=[], help='Collect one Ansible host row id, such as target-19. Can be repeated.')
        parser.add_argument('--limit', type=int, default=0, help='Limit host count after filters.')
        parser.add_argument('--include-unmanaged', action='store_true', help='Also include candidate hosts that are not fully managed.')
        parser.add_argument('--include-non-priority', action='store_true', help='When --all is used, collect every managed host instead of the priority import set.')
        parser.add_argument('--no-write-back', action='store_true', help='Collect facts without writing them back to assets.')
        parser.add_argument('--overwrite', action='store_true', help='Overwrite existing asset fields when writing back.')

    def handle(self, *args, **options):
        use_all = options['all']
        ips = {str(value).strip() for value in options['ips'] if str(value).strip()}
        target_ids = set(options['target_ids'])
        host_ids = {str(value).strip() for value in options['host_ids'] if str(value).strip()}

        if not use_all and not ips and not target_ids and not host_ids:
            raise CommandError('Please provide --all, --ip, --target-id, or --host-id.')

        hosts = _build_ansible_hosts()
        if not options['include_unmanaged']:
            if use_all and not ips and not target_ids and not host_ids and not options['include_non_priority']:
                hosts = _default_ansible_managed_hosts(hosts)
            else:
                hosts = [row for row in hosts if row.get('managed')]

        if ips:
            hosts = [row for row in hosts if row.get('management_ip') in ips]
        if target_ids:
            hosts = [row for row in hosts if row.get('target_id') in target_ids]
        if host_ids:
            hosts = [row for row in hosts if row.get('id') in host_ids]
        if options['limit'] and options['limit'] > 0:
            hosts = hosts[: options['limit']]

        if not hosts:
            raise CommandError('No matching Ansible hosts found.')

        started_at = timezone.now()
        write_back = not options['no_write_back']
        counters = {
            'total': len(hosts),
            'success': 0,
            'failed': 0,
            'skipped': 0,
            'written_back': 0,
        }
        results = []

        for row in hosts:
            credential = SecretRecord.objects.filter(pk=row.get('credential_id'), status='active').first()
            if not credential:
                counters['skipped'] += 1
                results.append(
                    {
                        **row,
                        'status': 'skipped',
                        'category': 'credential_missing',
                        'category_label': '缺少凭据',
                        'detail': '缺少可用登录凭据。',
                    }
                )
                continue

            try:
                payload = collect_secret_device_facts(
                    credential=credential,
                    management_ip=row['management_ip'],
                    read_secret=read_secret,
                    ssh_port=row.get('ssh_port') or 22,
                    timeout_seconds=row.get('timeout_seconds') or 30,
                    command_profile=row.get('command_profile') or 'huawei_vrp',
                )
                facts = payload.get('facts') or {}
                writeback_preview = _ansible_fact_writeback_preview(row, facts, overwrite=options['overwrite'])
                applied_fields = (
                    _apply_ansible_facts_to_asset(row, facts, overwrite=options['overwrite'])
                    if write_back
                    else []
                )
                if applied_fields:
                    counters['written_back'] += 1
                counters['success'] += 1
                results.append(
                    {
                        **row,
                        'status': 'success',
                        'category': 'success',
                        'category_label': '采集成功',
                        'detail': payload.get('message') or '设备信息采集成功。',
                        'duration_seconds': payload.get('duration_seconds', 0),
                        'commands': payload.get('commands') or [],
                        'facts': facts,
                        'applied_fields': applied_fields,
                        'writeback_preview': writeback_preview,
                        'writeback_policy': {'write_back': write_back, 'overwrite': options['overwrite']},
                        'username': payload.get('username') or credential.username_hint,
                    }
                )
            except (ConfigBackupConnectionError, ConfigBackupError, VaultError) as exc:
                category, label = _classify_login_failure(str(exc))
                counters['failed'] += 1
                counters[category] = counters.get(category, 0) + 1
                results.append(
                    {
                        **row,
                        'status': 'failed',
                        'category': category,
                        'category_label': label,
                        'detail': str(exc),
                    }
                )
            except Exception as exc:
                category, label = _classify_login_failure(str(exc))
                counters['failed'] += 1
                counters[category] = counters.get(category, 0) + 1
                results.append(
                    {
                        **row,
                        'status': 'failed',
                        'category': category,
                        'category_label': label,
                        'detail': str(exc),
                    }
                )

        finished_at = timezone.now()
        status_value = 'success' if counters['success'] == counters['total'] and counters['failed'] == 0 and counters['skipped'] == 0 else 'partial'
        if counters['success'] == 0:
            status_value = 'failed'
        detail = (
            f'命令行设备信息采集：成功 {counters["success"]}，失败 {counters["failed"]}，'
            f'跳过 {counters["skipped"]}，回写 {counters["written_back"]}'
        )
        run = AnsibleTaskRun.objects.create(
            action='facts_collect',
            status=status_value,
            total=counters['total'],
            success_count=counters['success'],
            failed_count=counters['failed'],
            skipped_count=counters['skipped'],
            actor_name='system-cli',
            detail=detail,
            results=results,
            started_at=started_at,
            finished_at=finished_at,
            duration_seconds=max(0, int((finished_at - started_at).total_seconds())),
        )

        output = {
            'summary': counters,
            'run': _serialize_ansible_task_run(run),
        }
        self.stdout.write(json.dumps(output, ensure_ascii=True, indent=2))
