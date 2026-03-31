import json

from django.core.management.base import BaseCommand

from ipam.text_encoding import build_encoding_report


class Command(BaseCommand):
    help = '扫描库内疑似乱码文本，输出各模型字段的疑似问题样本。'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=5, help='每个模型最多输出多少条样本，默认 5 条。')
        parser.add_argument('--json', action='store_true', help='输出 JSON 报告。')

    def handle(self, *args, **options):
        report = build_encoding_report(limit_per_model=max(int(options['limit'] or 5), 1))

        if options['json']:
            self.stdout.write(json.dumps(report, ensure_ascii=False, indent=2))
            return

        summary = report['summary']
        self.stdout.write(
            self.style.SUCCESS(
                f"已扫描 {summary['models_scanned']} 个模型，发现 {summary['suspected_records']} 条疑似乱码记录，"
                f"{summary['suspected_fields']} 个疑似字段。"
            )
        )

        for model_report in report['models']:
            self.stdout.write(
                f"\n[{model_report['model']}] 表 {model_report['table']} "
                f"- 记录 {model_report['suspected_records']} 条，字段 {model_report['suspected_fields']} 个"
            )
            for sample in model_report['samples']:
                self.stdout.write(f"  - #{sample['id']} {sample['display']}")
                for field_name, detail in sample['fields'].items():
                    self.stdout.write(f"      {field_name}: {detail['value']}")
                    if detail['suggested']:
                        self.stdout.write(f"      建议修复: {detail['suggested']}")
