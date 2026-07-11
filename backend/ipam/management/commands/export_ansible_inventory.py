from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from ipam.views import _build_ansible_hosts, _build_ansible_inventory, _default_ansible_managed_hosts


class Command(BaseCommand):
    help = 'Export the platform-generated Ansible inventory without exposing passwords.'

    def add_arguments(self, parser):
        parser.add_argument('--output', default='', help='Write inventory to this path. Defaults to stdout.')
        parser.add_argument('--scope', choices=('managed', 'all'), default='managed', help='Inventory scope.')
        parser.add_argument(
            '--include-non-priority',
            action='store_true',
            help='With managed scope, export every managed host instead of preferring the priority import set.',
        )

    def handle(self, *args, **options):
        hosts = _build_ansible_hosts()
        if options['scope'] == 'all':
            selected_hosts = hosts
        else:
            managed_hosts = [row for row in hosts if row.get('managed')]
            selected_hosts = managed_hosts if options['include_non_priority'] else _default_ansible_managed_hosts(hosts)

        if not selected_hosts:
            raise CommandError('No hosts matched the requested inventory scope.')

        inventory = _build_ansible_inventory(selected_hosts)
        output = options['output'].strip()
        if output:
            path = Path(output)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(inventory + '\n', encoding='utf-8')
            self.stdout.write(f'Wrote {len(selected_hosts)} hosts to {path}')
        else:
            self.stdout.write(inventory)
