import json
from datetime import datetime
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from ipam.text_encoding import apply_cleanup_plan, build_cleanup_plan, snapshot_cleanup_plan


class Command(BaseCommand):
    help = '生成乱码修复快照、执行修复，或根据快照回滚。'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=None, help='仅预览时限制每个模型输出多少条记录。')
        parser.add_argument('--apply', action='store_true', help='执行建议修复。')
        parser.add_argument('--snapshot', help='快照文件路径。执行修复时必填，也可用于仅导出快照。')
        parser.add_argument('--restore', help='根据快照文件回滚原始值。')
        parser.add_argument('--json', action='store_true', help='输出 JSON 结果。')

    def handle(self, *args, **options):
        apply_mode = options['apply']
        restore_path = options.get('restore')
        snapshot_path = options.get('snapshot')
        limit = options.get('limit')
        output_json = options.get('json')

        if apply_mode and restore_path:
            raise CommandError('--apply 和 --restore 不能同时使用。')

        if restore_path:
            plan = self._load_plan(restore_path)
            result = apply_cleanup_plan(plan, source='original')
            payload = {
                'mode': 'restore',
                'snapshot': restore_path,
                'result': result,
            }
            self._write_output(payload, output_json, success_message='已根据快照回滚乱码修复。')
            return

        plan = build_cleanup_plan(limit_per_model=limit)

        if apply_mode:
            if not snapshot_path:
                raise CommandError('执行修复时必须提供 --snapshot，用于保存可回滚快照。')
            saved_snapshot_path = self._save_plan(snapshot_path, snapshot_cleanup_plan(plan))
            result = apply_cleanup_plan(plan, source='suggested')
            payload = {
                'mode': 'apply',
                'snapshot': str(saved_snapshot_path),
                'plan': plan['summary'],
                'result': result,
            }
            self._write_output(payload, output_json, success_message='乱码修复已执行，并保存了回滚快照。')
            return

        if snapshot_path:
            snapshot_path = str(self._save_plan(snapshot_path, snapshot_cleanup_plan(plan)))

        payload = {
            'mode': 'preview',
            'snapshot': snapshot_path or '',
            'plan': plan,
        }
        self._write_output(payload, output_json, success_message='已生成乱码修复预览。')

    def _save_plan(self, path_value, payload):
        path = Path(path_value)
        if not path.suffix:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            path = path / f'encoding_cleanup_snapshot_{timestamp}.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
        return path

    def _load_plan(self, path_value):
        path = Path(path_value)
        if not path.exists():
            raise CommandError(f'快照文件不存在：{path}')
        return json.loads(path.read_text(encoding='utf-8'))

    def _write_output(self, payload, output_json, success_message):
        if output_json:
            self.stdout.write(json.dumps(payload, ensure_ascii=False, indent=2))
            return

        self.stdout.write(self.style.SUCCESS(success_message))
        if payload['mode'] == 'preview':
            summary = payload['plan']['summary']
            self.stdout.write(
                f"预计修复 {summary['records_to_fix']} 条记录、{summary['fields_to_fix']} 个字段。"
            )
            if payload.get('snapshot'):
                self.stdout.write(f"快照已写入：{payload['snapshot']}")
            for model_report in payload['plan']['models']:
                self.stdout.write(
                    f"[{model_report['model']}] 记录 {model_report['records_to_fix']} 条，字段 {model_report['fields_to_fix']} 个"
                )
        else:
            result = payload['result']
            self.stdout.write(
                f"已更新 {result['records_updated']} 条记录，{result['fields_updated']} 个字段，涉及 {result['models_updated']} 个模型。"
            )
            if payload.get('snapshot'):
                self.stdout.write(f"快照文件：{payload['snapshot']}")
