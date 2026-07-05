import os
from dataclasses import dataclass

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from ...models import ConfigBackupPolicy, ConfigBackupTarget
from ..vault.services import VaultError
from .services import ConfigBackupError, run_config_backup_target


WEEKDAY_CRON_MAP = {
    0: 1,
    1: 2,
    2: 3,
    3: 4,
    4: 5,
    5: 6,
    6: 0,
}


class ConfigBackupPolicyError(RuntimeError):
    pass


@dataclass
class BackupRunResult:
    total: int
    success: int
    failed: int
    results: list

    @property
    def status(self):
        if self.total == 0:
            return 'failed'
        if self.failed == 0:
            return 'success'
        if self.success == 0:
            return 'failed'
        return 'partial'

    @property
    def message(self):
        return f'配置备份执行完成：总数 {self.total}，成功 {self.success}，失败 {self.failed}。'


def get_or_create_config_backup_policy():
    policy = ConfigBackupPolicy.objects.order_by('id').first()
    if policy is None:
        policy = ConfigBackupPolicy.objects.create()
    return policy


def build_policy_cron_expression(policy):
    hour = int(policy.schedule_time.hour)
    minute = int(policy.schedule_time.minute)
    if policy.schedule_frequency == 'manual':
        return ''
    if policy.schedule_frequency == 'daily':
        return f'{minute} {hour} * * *'
    weekday = WEEKDAY_CRON_MAP.get(int(policy.schedule_weekday or 6), 0)
    return f'{minute} {hour} * * {weekday}'


def build_policy_cron_command(policy):
    cron = build_policy_cron_expression(policy)
    if not cron:
        return ''
    workdir = os.environ.get('CONFIG_BACKUP_CRON_WORKDIR', '/opt/ipam')
    return f'{cron} cd {workdir} && docker compose exec -T backend python manage.py run_config_backup_policy'


def parse_email_recipients(raw_value):
    return [
        item.strip()
        for item in str(raw_value or '').replace(';', ',').split(',')
        if item.strip()
    ]


def select_policy_targets(policy=None, *, strategy=None, device_type='', datacenter='', queryset=None):
    policy = policy or get_or_create_config_backup_policy()
    strategy = strategy or policy.execution_strategy or 'all'
    device_type = device_type or policy.strategy_device_type
    datacenter = datacenter or policy.strategy_datacenter
    qs = queryset or ConfigBackupTarget.objects.select_related(
        'rack_device',
        'rack_device__rack',
        'rack_device__rack__datacenter',
        'credential',
        'ip_address',
    )
    qs = qs.filter(enabled=True)
    if strategy == 'failed':
        qs = qs.filter(last_status='failed')
    elif strategy == 'device_type' and device_type:
        qs = qs.filter(device_type=device_type)
    elif strategy == 'datacenter' and datacenter:
        qs = qs.filter(rack_device__rack__datacenter__name=datacenter)
    return qs.order_by('management_ip', 'id')


def run_config_backup_targets(*, targets, base_dir=None, read_secret):
    results = []
    success_count = 0
    failed_count = 0
    base_dir = base_dir or settings.BASE_DIR
    for target in targets:
        try:
            version = run_config_backup_target(
                target=target,
                base_dir=base_dir,
                read_secret=read_secret,
            )
            status_value = version.status
            detail = version.error_message if version.status != 'success' else ''
        except (ConfigBackupError, VaultError) as exc:
            status_value = 'failed'
            detail = str(exc)
            version = None
        if status_value == 'success':
            success_count += 1
        else:
            failed_count += 1
        target.refresh_from_db()
        results.append(
            {
                'target': target,
                'status': status_value,
                'detail': detail,
                'version': version,
            }
        )
    return BackupRunResult(
        total=len(results),
        success=success_count,
        failed=failed_count,
        results=results,
    )


def summarize_failure_reasons(targets):
    summary = {}
    for target in targets:
        if target.last_status != 'failed':
            continue
        reason = classify_failure_reason(target.last_error)
        summary[reason] = summary.get(reason, 0) + 1
    return [{'reason': reason, 'count': count} for reason, count in sorted(summary.items(), key=lambda item: item[0])]


def classify_failure_reason(error_message):
    text = str(error_message or '').lower()
    if not text:
        return '未知失败'
    if '认证' in text or 'auth' in text or 'password' in text:
        return '认证失败'
    if '超时' in text or 'timeout' in text or 'timed out' in text:
        return '连接超时'
    if '无法解析' in text or 'name or service' in text or 'resolve' in text:
        return '地址解析'
    if '拒绝' in text or 'refused' in text:
        return '拒绝连接'
    if '不可达' in text or 'unreachable' in text or 'no route' in text:
        return '网络不可达'
    return '其他失败'


def build_email_body(result, policy):
    lines = [
        result.message,
        '',
        f'执行策略：{policy.get_execution_strategy_display()}',
        f'计划频率：{policy.get_schedule_frequency_display()}',
        f'执行时间：{timezone.localtime(timezone.now()).strftime("%Y-%m-%d %H:%M:%S")}',
        '',
        '明细：',
    ]
    for item in result.results[:50]:
        target = item['target']
        detail = f' - {target.name} ({target.management_ip}): {item["status"]}'
        if item.get('detail'):
            detail += f'，{item["detail"]}'
        elif item.get('version'):
            detail += f'，{item["version"].relative_path}'
        lines.append(detail)
    if len(result.results) > 50:
        lines.append(f'... 还有 {len(result.results) - 50} 条结果未在邮件中展开。')
    return '\n'.join(lines)


def should_notify(policy, result):
    if not policy.email_enabled:
        return False
    if result.failed > 0:
        return policy.notify_on_failure
    return policy.notify_on_success


def send_config_backup_notification(policy, result, *, force=False):
    recipients = parse_email_recipients(policy.email_recipients)
    if not recipients:
        raise ConfigBackupPolicyError('请先配置邮件收件人。')
    if not force and not should_notify(policy, result):
        return {'sent': False, 'detail': '当前通知策略不需要发送邮件。'}
    if not getattr(settings, 'EMAIL_HOST', '') and getattr(settings, 'EMAIL_BACKEND', '').endswith('smtp.EmailBackend'):
        raise ConfigBackupPolicyError('SMTP 未配置，请先在 .env 中配置 EMAIL_HOST、EMAIL_PORT、DEFAULT_FROM_EMAIL。')
    subject = f'{policy.email_subject_prefix} {result.message}'
    send_mail(
        subject,
        build_email_body(result, policy),
        getattr(settings, 'DEFAULT_FROM_EMAIL', 'ipam@example.local'),
        recipients,
        fail_silently=False,
    )
    return {'sent': True, 'detail': f'已发送给 {len(recipients)} 个收件人。'}


def update_policy_run_state(policy, result):
    policy.last_run_at = timezone.now()
    policy.last_run_status = result.status
    policy.last_run_message = result.message
    policy.save(update_fields=['last_run_at', 'last_run_status', 'last_run_message', 'updated_at'])
