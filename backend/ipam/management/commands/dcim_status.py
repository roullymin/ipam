import json

from django.core.management.base import BaseCommand
from django.db import connection
from django.db.migrations.recorder import MigrationRecorder

from ipam.models import Datacenter, Rack, RackDevice


class Command(BaseCommand):
    help = 'Report the active database, DCIM table availability, migration state, and record counts.'

    def add_arguments(self, parser):
        parser.add_argument('--json', action='store_true', dest='as_json')

    def handle(self, *args, **options):
        table_names = set(connection.introspection.table_names())
        required_tables = {
            Datacenter._meta.db_table,
            Rack._meta.db_table,
            RackDevice._meta.db_table,
        }
        migration_applied = MigrationRecorder.Migration.objects.filter(
            app='ipam',
            name='0014_structured_asset_metadata',
        ).exists()
        settings_dict = connection.settings_dict
        payload = {
            'database': {
                'vendor': connection.vendor,
                'name': settings_dict.get('NAME') or '',
                'host': settings_dict.get('HOST') or '',
                'port': str(settings_dict.get('PORT') or ''),
            },
            'migration_0014_applied': migration_applied,
            'tables': {
                table: table in table_names
                for table in sorted(required_tables)
            },
            'counts': {
                'datacenters': Datacenter.objects.count(),
                'racks': Rack.objects.count(),
                'rack_devices': RackDevice.objects.count(),
            },
        }

        if options['as_json']:
            self.stdout.write(json.dumps(payload, ensure_ascii=False))
            return

        database = payload['database']
        self.stdout.write(
            f"Database: {database['vendor']}://{database['host']}:{database['port']}/{database['name']}"
        )
        self.stdout.write(f"Migration 0014 applied: {'yes' if migration_applied else 'no'}")
        for table, exists in payload['tables'].items():
            self.stdout.write(f"Table {table}: {'present' if exists else 'missing'}")
        self.stdout.write(
            'DCIM counts: '
            f"datacenters={payload['counts']['datacenters']}, "
            f"racks={payload['counts']['racks']}, "
            f"rack_devices={payload['counts']['rack_devices']}"
        )
