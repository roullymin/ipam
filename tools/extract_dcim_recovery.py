import argparse
import csv
import json
import re
from pathlib import Path


DATASETS = {
    'datacenters': {
        'columns': ['id', 'name', 'location', 'contact_phone'],
        'text_indexes': {1, 2, 3},
    },
    'racks': {
        'columns': [
            'id',
            'code',
            'name',
            'height',
            'power_limit',
            'description',
            'datacenter_id',
        ],
        'text_indexes': {1, 2, 5},
        'integer_indexes': {0, 3, 4, 6},
    },
    'devices': {
        'columns': [
            'id',
            'name',
            'position',
            'u_height',
            'device_type',
            'brand',
            'mgmt_ip',
            'project',
            'contact',
            'power_usage',
            'specs',
            'created_at',
            'updated_at',
            'rack_id',
            'asset_tag',
            'os_version',
            'purchase_date',
            'sn',
            'status',
            'supplier',
            'warranty_date',
        ],
        'text_indexes': {1, 4, 5, 6, 7, 8, 10, 14, 15, 17, 18, 19},
        'integer_indexes': {0, 2, 3, 9, 13},
    },
}


PDU_PATTERN = re.compile(r'__PDU_META__:({.*})$', re.MULTILINE)
DEVICE_PATTERN = re.compile(r'__META__:({.*})$', re.MULTILINE)


def read_rows(path):
    # ibd2sql's normal output follows the host console encoding, while its hex
    # output is ASCII. Latin-1 preserves delimiters and bytes losslessly; all
    # text values are reconstructed from the matching hex file below.
    with Path(path).open('r', encoding='latin-1', newline='') as stream:
        return list(csv.reader(stream, delimiter=',', quotechar="'", escapechar='\\'))


def decode_hex_text(value):
    if value.lower() == 'null':
        return None
    if not value.startswith('0x'):
        return value
    raw = bytes.fromhex(value[2:])
    return raw.decode('utf-8')


def parse_integer(value):
    if value is None or str(value).lower() == 'null' or value == '':
        return None
    return int(value)


def parse_dataset(normal_path, hex_path, config):
    normal_rows = read_rows(normal_path)
    hex_rows = read_rows(hex_path)
    if len(normal_rows) != len(hex_rows):
        raise ValueError(f'Row count mismatch: {normal_path} vs {hex_path}')

    records = []
    for normal_row, hex_row in zip(normal_rows, hex_rows):
        if len(normal_row) != len(config['columns']) or len(hex_row) != len(config['columns']):
            raise ValueError(f'Unexpected column count in {normal_path}')
        record = {}
        for index, column in enumerate(config['columns']):
            if index in config.get('text_indexes', set()):
                value = decode_hex_text(hex_row[index])
            elif index in config.get('integer_indexes', set()):
                value = parse_integer(normal_row[index])
            else:
                value = normal_row[index]
            record[column] = value
        records.append(record)
    return records


def normalize_records(payload):
    for rack in payload['racks']:
        description = rack.get('description') or ''
        match = PDU_PATTERN.search(description)
        metadata = {}
        if match:
            try:
                metadata = json.loads(match.group(1))
            except (TypeError, ValueError, json.JSONDecodeError):
                metadata = {}
        rack['pdu_count'] = max(0, int(metadata.get('count') or 2))
        rack['pdu_power'] = max(0, int(metadata.get('power') or 0))
        rack['description'] = PDU_PATTERN.sub('', description).strip()

    for device in payload['devices']:
        specs = device.get('specs') or ''
        match = DEVICE_PATTERN.search(specs)
        metadata = {}
        if match:
            try:
                metadata = json.loads(match.group(1))
            except (TypeError, ValueError, json.JSONDecodeError):
                metadata = {}
        device['model'] = str(metadata.get('model') or '')
        device['typical_power'] = max(0, int(metadata.get('typical_power') or 0))
        device['specs'] = DEVICE_PATTERN.sub('', specs).strip()


def main():
    parser = argparse.ArgumentParser(description='Decode ibd2sql normal and hex outputs into DCIM JSON.')
    for dataset in DATASETS:
        parser.add_argument(f'--{dataset}-normal', required=True)
        parser.add_argument(f'--{dataset}-hex', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    payload = {}
    for dataset, config in DATASETS.items():
        payload[dataset] = parse_dataset(
            getattr(args, f'{dataset}_normal'),
            getattr(args, f'{dataset}_hex'),
            config,
        )
    normalize_records(payload)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')

    print(
        f"Extracted datacenters={len(payload['datacenters'])}, "
        f"racks={len(payload['racks'])}, devices={len(payload['devices'])}"
    )


if __name__ == '__main__':
    main()
