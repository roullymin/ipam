import gzip
import hashlib
import os
import re
import time
from types import SimpleNamespace

from django.utils import timezone

from .selectors import get_config_backup_dir
from ...models import ConfigBackupVersion


PROMPT_PATTERN = re.compile(r'[<\[][\w\-_.]+[>\]]\s*$')


class ConfigBackupError(RuntimeError):
    pass


class ConfigBackupConnectionError(ConfigBackupError):
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
    if command_profile == 'cisco_ios':
        return {
            'prepare': ['terminal length 0'],
            'save': ['write memory'],
            'collect': 'show running-config',
        }
    if command_profile == 'generic_show_run':
        return {
            'prepare': ['terminal length 0'],
            'save': [],
            'collect': 'show running-config',
        }
    if command_profile == 'h3c_comware':
        return {
            'prepare': ['screen-length disable'],
            'save': ['save force'],
            'collect': 'display current-configuration',
        }
    return {
        'prepare': ['screen-length 0 temporary', 'undo terminal monitor'],
        'save': ['save'],
        'collect': 'display current-configuration',
    }


def _friendly_error_message(exc):
    message = str(exc) or exc.__class__.__name__
    lowered = message.lower()
    if 'authentication' in lowered or 'auth' in lowered or 'not allowed' in lowered:
        return '登录认证失败，请检查账号、密码和设备 SSH 登录权限。'
    if 'timed out' in lowered or 'timeout' in lowered:
        return '连接或命令执行超时，请检查管理 IP、SSH 端口、防火墙策略和设备响应速度。'
    if 'name or service not known' in lowered or 'temporary failure in name resolution' in lowered:
        return '管理地址无法解析，请确认资产管理 IP 为纯 IP 或可解析主机名。'
    if 'connection refused' in lowered:
        return '设备拒绝连接，请确认 SSH 服务已开启且端口正确。'
    if 'no route to host' in lowered or 'network is unreachable' in lowered:
        return '网络不可达，请检查服务器到设备管理网的路由和 ACL。'
    return message[:2000]


def _connect_ssh_client(target, username, password, ssh_client_factory=None):
    try:
        import paramiko
    except ImportError as exc:
        raise ConfigBackupError('后端缺少 paramiko 依赖，无法执行 SSH 操作。') from exc

    timeout_seconds = max(int(getattr(target, 'timeout_seconds', 30) or 30), 5)
    ssh_port = int(getattr(target, 'ssh_port', 22) or 22)
    client = ssh_client_factory() if ssh_client_factory else paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(
            str(target.management_ip),
            port=ssh_port,
            username=username,
            password=password,
            timeout=timeout_seconds,
            banner_timeout=timeout_seconds,
            auth_timeout=timeout_seconds,
            look_for_keys=False,
            allow_agent=False,
        )
    except Exception:
        try:
            client.close()
        except Exception:
            pass
        raise
    return client


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

    username, password = _read_secret_payload(target, read_secret)
    commands = _profile_commands(target.command_profile)
    backup_dir = get_config_backup_dir(base_dir)
    started_at = timezone.now()
    started_monotonic = time.monotonic()
    client = None
    timeout_seconds = max(int(getattr(target, 'timeout_seconds', 30) or 30), 5)

    target.last_status = 'running'
    target.last_error = ''
    target.save(update_fields=['last_status', 'last_error', 'updated_at'])

    try:
        client = _connect_ssh_client(target, username, password, ssh_client_factory=ssh_client_factory)
        channel = client.invoke_shell()
        time.sleep(0.5)
        _receive(channel, timeout=min(timeout_seconds, 15))

        for command in commands['prepare']:
            _send_command(channel, command, timeout=timeout_seconds)
        if getattr(target, 'save_before_backup', True):
            for command in commands['save']:
                _send_command(channel, command, timeout=max(timeout_seconds, 300), confirm=True)

        raw_output = _send_command(channel, commands['collect'], timeout=max(timeout_seconds, 300))
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
        message = _friendly_error_message(exc)
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


def test_config_backup_target(*, target, read_secret, ssh_client_factory=None):
    if not target.enabled:
        raise ConfigBackupError('该备份目标已停用。')
    username, password = _read_secret_payload(target, read_secret)
    client = None
    started = time.monotonic()
    try:
        client = _connect_ssh_client(target, username, password, ssh_client_factory=ssh_client_factory)
        return {
            'status': 'success',
            'message': 'SSH 登录测试成功。',
            'duration_seconds': max(int(time.monotonic() - started), 0),
        }
    except Exception as exc:
        raise ConfigBackupConnectionError(_friendly_error_message(exc)) from exc
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass


def test_secret_login(*, credential, management_ip, read_secret, ssh_port=22, timeout_seconds=30, ssh_client_factory=None):
    target = SimpleNamespace(
        credential=credential,
        management_ip=management_ip,
        ssh_port=ssh_port,
        timeout_seconds=timeout_seconds,
    )
    username, password = _read_secret_payload(target, read_secret)
    client = None
    started = time.monotonic()
    try:
        client = _connect_ssh_client(target, username, password, ssh_client_factory=ssh_client_factory)
        return {
            'status': 'success',
            'message': 'SSH 登录测试成功。',
            'username': username,
            'duration_seconds': max(int(time.monotonic() - started), 0),
        }
    except Exception as exc:
        raise ConfigBackupConnectionError(_friendly_error_message(exc)) from exc
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass
