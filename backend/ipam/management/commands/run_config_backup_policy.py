from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from ipam.domains.config_backup.policy import (
    ConfigBackupPolicyError,
    get_or_create_config_backup_policy,
    run_config_backup_targets,
    select_policy_targets,
    send_config_backup_notification,
    update_policy_run_state,
)
from ipam.domains.vault.services import read_secret


class Command(BaseCommand):
    help = 'Run network config backups using the policy configured in the web UI.'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Run even when the policy is disabled.')
        parser.add_argument('--notify', action='store_true', help='Force email notification after the run.')

    def handle(self, *args, **options):
        policy = get_or_create_config_backup_policy()
        if not policy.enabled and not options.get('force'):
            self.stdout.write(self.style.WARNING('Config backup policy is disabled. Use --force to run once.'))
            return

        targets = list(select_policy_targets(policy))
        result = run_config_backup_targets(
            targets=targets,
            base_dir=settings.BASE_DIR,
            read_secret=read_secret,
        )
        update_policy_run_state(policy, result)
        self.stdout.write(result.message)

        try:
            email_result = send_config_backup_notification(policy, result, force=options.get('notify'))
        except ConfigBackupPolicyError as exc:
            raise CommandError(str(exc)) from exc
        if email_result.get('sent'):
            self.stdout.write(self.style.SUCCESS(email_result.get('detail')))

        if result.failed:
            raise CommandError(result.message)
