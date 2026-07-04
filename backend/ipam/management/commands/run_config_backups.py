from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from ipam.domains.config_backup.services import ConfigBackupError, run_config_backup_target
from ipam.domains.vault.services import VaultError, read_secret
from ipam.models import ConfigBackupTarget


class Command(BaseCommand):
    help = 'Run built-in network configuration backups for one target or all enabled targets.'

    def add_arguments(self, parser):
        parser.add_argument('--target-id', type=int, help='Only run one ConfigBackupTarget id.')
        parser.add_argument('--all', action='store_true', help='Run all enabled ConfigBackupTargets.')
        parser.add_argument('--continue-on-error', action='store_true', help='Continue when one target fails before a version can be recorded.')

    def handle(self, *args, **options):
        target_id = options.get('target_id')
        run_all = options.get('all')
        continue_on_error = options.get('continue_on_error')
        if not target_id and not run_all:
            raise CommandError('Please provide --target-id or --all.')
        if target_id and run_all:
            raise CommandError('--target-id and --all cannot be used together.')

        queryset = ConfigBackupTarget.objects.select_related('credential').filter(enabled=True).order_by('management_ip')
        if target_id:
            queryset = queryset.filter(pk=target_id)

        targets = list(queryset)
        if not targets:
            self.stdout.write(self.style.WARNING('No enabled config backup targets found.'))
            return

        success_count = 0
        failed_count = 0
        for target in targets:
            self.stdout.write(f'Running config backup: {target.name} ({target.management_ip})')
            try:
                version = run_config_backup_target(
                    target=target,
                    base_dir=settings.BASE_DIR,
                    read_secret=read_secret,
                )
            except (ConfigBackupError, VaultError) as exc:
                failed_count += 1
                self.stderr.write(self.style.ERROR(f'  failed before run record: {exc}'))
                if not continue_on_error:
                    raise CommandError(str(exc)) from exc
                continue

            if version.status == 'success':
                success_count += 1
                self.stdout.write(self.style.SUCCESS(f'  success: {version.relative_path}'))
            else:
                failed_count += 1
                self.stderr.write(self.style.ERROR(f'  failed: {version.error_message}'))
                if not continue_on_error:
                    raise CommandError(version.error_message or 'Config backup failed.')

        self.stdout.write(
            self.style.SUCCESS(
                f'Config backup run completed: success={success_count}, failed={failed_count}, total={len(targets)}'
            )
        )
