import gzip
import hashlib
import os
import re
import time

from django.utils import timezone

from .selectors import get_config_backup_dir
from ...models import ConfigBackupVersion


PROMPT_PATTERN = re.compile(r'[<\[][\w\-_.]+[>\]]\s*$')


class ConfigBackupError(RuntimeError):
    pass


def _safe_token(value, fallback='device'):
    token = re.sub(r'[^A-Za-z0-9_.-]+', '_', str(value or '').strip()).strip('_')
    return token or fallback


def _read_secret_payload(target, read_secret):
    if target.credential is None:
        raise ConfigBackupError('该备份目标未绑定密码凭据。')
    payload = read_secret(target.credential.vault_path)
    username = str(payload.get('username') or target.credential.username_hint or '').strip()
    secret_value = payload.get('secret_value') or ''
    if not username or not secret_value:
        raise ConfigBackupError('密码库返回的账号或密码为空。')
    return username, secret_value


def _receive(channel, timeout=30):
    started = time.time()
    output = ''
    while time.time() - started < timeout:
        if channel.recv_ready():
            output += channel.recv(8192).decode('utf-8', errors='replace')
            if output.splitlines() and PROMPT_PATTERN.search(output.splitlines()[-1].strip()):
                return output
        elif channel.exit_status_ready():
            break
        else:
            time.sleep(0.2)
    return output


def _send_command(channel, command, timeout=30, confirm=False):
    while channel.recv_ready():
        channel.recv(8192)

    channel.send(command if command.endswith('\n') else f'{command}\n')
    started = time.time()
    output = ''
    while time.time() - started < timeout:
        if channel.recv_ready():
            chunk = channel.recv(8192).decode('utf-8', errors='replace')
            output += chunk
            lowered = chunk.lower()
            if confirm and ('y/n' in lowered or 'yes/no' in lowered or 'confirm' in lowered):
                channel.send('y\n')
                time.sleep(0.5)
                continue
            lines = [line.strip() for line in output.splitlines() if line.strip()]
            if lines and PROMPT_PATTERN.search(lines[-1]):
                return output
        elif channel.exit_status_ready():
            break
        else:
            time.sleep(0.2)

    raise TimeoutError(f'等待命令完成超时：{command.strip()}')


def _profile_commands(command_profile):
    if command_profile == 'generic_show_run':
        return {
            'prepare': ['terminal length 0'],
            'save': [],
            'collect': 'show running-config',
        }
    return {
        'prepare': ['screen-length 0 temporary', 'undo terminal monitor'],
        'save': ['save'],
        'collect': 'display current-configuration',
    }


def _clean_config_output(raw_output, commands):
    skip_tokens = [item.lower() for item in commands if item]
    cleaned = []
    for line in raw_output.splitlines():
        stripped = line.strip()
        lowered = stripped.lower()
        if not stripped:
            cleaned.append(line)
            continue
        if any(token in lowered for token in skip_tokens):
            continue
        if PROMPT_PATTERN.search(stripped):
            continue
        cleaned.append(line.rstrip('\r\n'))
    return '\n'.join(cleaned).strip()


def _write_backup_file(target, config_text, backup_dir, now):
    device_type = _safe_token(target.device_type, 'other').lower()
    target_dir = os.path.join(backup_dir, device_type)
    os.makedirs(target_dir, exist_ok=True)

    stamp = now.strftime('%Y%m%d_%H%M%S')
    filename = f'{target.management_ip}_{stamp}.txt.gz'
    full_path = os.path.join(target_dir, filename)
    encoded = config_text.encode('utf-8')
    with gzip.open(full_path, 'wb') as output:
        output.write(encoded)

    relative_path = os.path.relpath(full_path, backup_dir).replace(os.sep, '/')
    return {
        'filename': filename,
        'relative_path': relative_path,
        'bytes': os.path.getsize(full_path),
        'sha256': hashlib.sha256(encoded).hexdigest(),
    }


def _enforce_retention(target, backup_dir):
    retention_count = max(int(target.retention_count or 0), 1)
    versions = list(target.versions.filter(status='success').order_by('-started_at', '-id'))
    for version in versions[retention_count:]:
        if version.relative_path:
            file_path = os.path.join(backup_dir, version.relative_path.replace('/', os.sep))
            try:
                if os.path.isfile(file_path):
                    os.remove(file_path)
            except OSError:
                pass
        version.delete()


def run_config_backup_target(*, target, base_dir, read_secret, ssh_client_factory=None):
    if not target.enabled:
        raise ConfigBackupError('该备份目标已停用。')

    try:
        import paramiko
    except ImportError as exc:
        raise ConfigBackupError('后端缺少 paramiko 依赖，无法执行 SSH 备份。') from exc

    username, password = _read_secret_payload(target, read_secret)
    commands = _profile_commands(target.command_profile)
    backup_dir = get_config_backup_dir(base_dir)
    started_at = timezone.now()
    started_monotonic = time.monotonic()
    client = None

    target.last_status = 'running'
    target.last_error = ''
    target.save(update_fields=['last_status', 'last_error', 'updated_at'])

    try:
        client = ssh_client_factory() if ssh_client_factory else paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            str(target.management_ip),
            username=username,
            password=password,
            timeout=30,
            banner_timeout=30,
            auth_timeout=30,
            look_for_keys=False,
            allow_agent=False,
        )
        channel = client.invoke_shell()
        time.sleep(0.5)
        _receive(channel, timeout=10)

        for command in commands['prepare']:
            _send_command(channel, command, timeout=30)
        for command in commands['save']:
            _send_command(channel, command, timeout=300, confirm=True)

        raw_output = _send_command(channel, commands['collect'], timeout=300)
        config_text = _clean_config_output(
            raw_output,
            [*commands['prepare'], *commands['save'], commands['collect']],
        )
        if len(config_text) < 20:
            raise ConfigBackupError('采集到的配置内容过短，疑似命令未成功返回。')

        finished_at = timezone.now()
        file_info = _write_backup_file(target, config_text, backup_dir, finished_at)
        duration = max(int(time.monotonic() - started_monotonic), 0)
        version = ConfigBackupVersion.objects.create(
            target=target,
            status='success',
            filename=file_info['filename'],
            relative_path=file_info['relative_path'],
            bytes=file_info['bytes'],
            sha256=file_info['sha256'],
            started_at=started_at,
            finished_at=finished_at,
            duration_seconds=duration,
            command_profile=target.command_profile,
        )
        target.last_status = 'success'
        target.last_backup_at = finished_at
        target.last_duration_seconds = duration
        target.last_error = ''
        target.save(update_fields=['last_status', 'last_backup_at', 'last_duration_seconds', 'last_error', 'updated_at'])
        _enforce_retention(target, backup_dir)
        return version
    except Exception as exc:
        finished_at = timezone.now()
        duration = max(int(time.monotonic() - started_monotonic), 0)
        message = str(exc)
        version = ConfigBackupVersion.objects.create(
            target=target,
            status='failed',
            started_at=started_at,
            finished_at=finished_at,
            duration_seconds=duration,
            command_profile=target.command_profile,
            error_message=message,
        )
        target.last_status = 'failed'
        target.last_error = message[:2000]
        target.last_duration_seconds = duration
        target.save(update_fields=['last_status', 'last_error', 'last_duration_seconds', 'updated_at'])
        return version
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass
