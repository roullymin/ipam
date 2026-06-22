import json
import re

from django.core.management.base import BaseCommand
from django.db import transaction

from ipam.models import IPAddress, Rack, RackDevice


TAG_PATTERN = re.compile(r'__TAG__:(.*)$', re.MULTILINE)
LOCK_PATTERN = re.compile(r'__LOCKED__:(true|false)', re.MULTILINE)
PDU_PATTERN = re.compile(r'__PDU_META__:({.*})$', re.MULTILINE)
DEVICE_PATTERN = re.compile(r'__META__:({.*})$', re.MULTILINE)


def parse_metadata(match):
    if not match:
        return {}
    try:
        return json.loads(match.group(1))
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}


class Command(BaseCommand):
    help = 'Idempotently move legacy hidden IP/DCIM metadata into the structured fields added by migration 0014.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        dry_run = options['dry_run']
        changed = {'ip_addresses': 0, 'racks': 0, 'rack_devices': 0}

        for address in IPAddress.objects.all().iterator():
            description = address.description or ''
            tag_match = TAG_PATTERN.search(description)
            lock_match = LOCK_PATTERN.search(description)
            if not tag_match and not lock_match:
                continue
            address.tag = tag_match.group(1).strip()[:64] if tag_match else address.tag
            if lock_match:
                address.is_locked = lock_match.group(1) == 'true'
            address.description = LOCK_PATTERN.sub('', TAG_PATTERN.sub('', description)).strip()
            changed['ip_addresses'] += 1
            if not dry_run:
                address.save(update_fields=['tag', 'is_locked', 'description'])

        for rack in Rack.objects.all().iterator():
            description = rack.description or ''
            match = PDU_PATTERN.search(description)
            if not match:
                continue
            metadata = parse_metadata(match)
            rack.pdu_count = max(0, int(metadata.get('count') or rack.pdu_count or 2))
            rack.pdu_power = max(0, int(metadata.get('power') or rack.pdu_power or 0))
            rack.description = PDU_PATTERN.sub('', description).strip()
            changed['racks'] += 1
            if not dry_run:
                rack.save(update_fields=['pdu_count', 'pdu_power', 'description'])

        for device in RackDevice.objects.all().iterator():
            specs = device.specs or ''
            match = DEVICE_PATTERN.search(specs)
            if not match:
                continue
            metadata = parse_metadata(match)
            device.model = str(metadata.get('model') or device.model or '')[:100]
            device.typical_power = max(
                0,
                int(metadata.get('typical_power') or device.typical_power or 0),
            )
            device.specs = DEVICE_PATTERN.sub('', specs).strip()
            changed['rack_devices'] += 1
            if not dry_run:
                device.save(update_fields=['model', 'typical_power', 'specs'])

        if dry_run:
            transaction.set_rollback(True)

        prefix = 'Dry run' if dry_run else 'Updated'
        self.stdout.write(
            f"{prefix}: ip_addresses={changed['ip_addresses']}, "
            f"racks={changed['racks']}, rack_devices={changed['rack_devices']}"
        )
