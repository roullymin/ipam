import gzip
import hashlib
import logging
import os
import re
import socket
import struct
import time
from types import SimpleNamespace

from django.utils import timezone

from .selectors import get_config_backup_dir
from ...models import ConfigBackupVersion


PROMPT_PATTERN = re.compile(r'[<\[][\w\-_.]+[>\]]\s*$')
logger = logging.getLogger(__name__)
logging.getLogger('paramiko.transport').setLevel(logging.CRITICAL)

SSH_NEGOTIATION_MARKERS = (
    'incompatible ssh peer',
    'no acceptable kex',
    'no matching',
    'unable to agree',
    'kex',
    'cipher',
    'host key',
    'algorithm',
)

LEGACY_SSH_KEX_ALGORITHMS = (
    'diffie-hellman-group-exchange-sha256',
    'diffie-hellman-group14-sha256',
    'diffie-hellman-group16-sha512',
    'diffie-hellman-group18-sha512',
    'diffie-hellman-group14-sha1',
    'diffie-hellman-group-exchange-sha1',
    'diffie-hellman-group1-sha1',
    'ecdh-sha2-nistp256',
    'ecdh-sha2-nistp384',
    'ecdh-sha2-nistp521',
    'curve25519-sha256',
    'curve25519-sha256@libssh.org',
)
LEGACY_SSH_CIPHERS = (
    'aes128-ctr',
    'aes192-ctr',
    'aes256-ctr',
    'aes128-cbc',
    'aes192-cbc',
    'aes256-cbc',
    '3des-cbc',
    'blowfish-cbc',
    'arcfour256',
    'arcfour128',
    'arcfour',
)
LEGACY_SSH_DIGESTS = (
    'hmac-sha2-256',
    'hmac-sha2-512',
    'hmac-sha1',
    'hmac-sha1-96',
    'hmac-md5',
    'hmac-md5-96',
)
LEGACY_SSH_KEY_TYPES = (
    'rsa-sha2-512',
    'rsa-sha2-256',
    'ssh-rsa',
    'ssh-dss',
)


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


def _readonly_probe_commands(command_profile):
    if command_profile in ('cisco_ios', 'generic_show_run'):
        return ['show version']
    return ['display version', 'display clock']


def _fact_probe_commands(command_profile):
    if command_profile in ('cisco_ios', 'generic_show_run'):
        return ['show version', 'show inventory']
    return [
        'display version',
        'display device manuinfo',
        'display device manufacture-info',
        'display esn',
        'display clock',
    ]


def _normalize_fact_value(value):
    value = re.sub(r'\s+', ' ', str(value or '')).strip(' :：\t\r\n"\'')
    value = re.sub(r'^(?:HUAWEI|Huawei|H3C|Cisco)\s+', '', value).strip()
    return value[:180]


def _is_valid_serial_number(value):
    value = str(value or '').strip()
    if not value:
        return False
    if value.lower() in {'of', 'the', 'none', 'null', 'unknown', 'n/a', 'na', '-'}:
        return False
    if len(value) < 4:
        return False
    if not re.fullmatch(r'[A-Za-z0-9_.-]+', value):
        return False
    return bool(re.search(r'\d', value))


def _first_match(patterns, text):
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
        if match:
            value = match.group(1) if match.groups() else match.group(0)
            value = _normalize_fact_value(value)
            if value:
                return value[:180]
    return ''


def _parse_device_facts(raw_outputs, management_ip=''):
    text = '\n'.join(raw_outputs or [])
    lowered = text.lower()
    prompt_match = re.search(r'[<\[]([^<>\[\]\s]+)[>\]]\s*$', text, flags=re.MULTILINE)
    hostname = _first_match(
        [
            r'^\s*sysname\s+([^\s]+)',
            r'^\s*hostname\s+([^\s]+)',
        ],
        text,
    ) or (prompt_match.group(1) if prompt_match else '')

    vendor = ''
    if 'huawei' in lowered or 'vrp' in lowered:
        vendor = 'Huawei'
    elif 'h3c' in lowered or 'comware' in lowered or 'secpath' in lowered:
        vendor = 'H3C'
    elif 'cisco' in lowered:
        vendor = 'Cisco'

    model = _first_match(
        [
            r'^\s*(?:DEVICE_NAME|DeviceName|Device\s+Name|Device\s+name|Product\s+Name|Product\s+name|Product\s+Type|Board\s+Type|Board\s+type|Chassis\s+Type|Machine\s+Type)\s*[:：]\s*([^\r\n]+)',
            r'^\s*(?:Device|Product|Chassis|Model)(?:\s+(?:name|type|model|number))?\s*[:：]\s*([^\r\n]+)',
            r'^\s*(?:HUAWEI|Huawei)\s+([A-Za-z0-9_.-]+).*\buptime\b',
            r'^\s*(?:H3C)\s+([A-Za-z0-9_.-]+).*\buptime\b',
            r'^\s*((?:S|CE|NE|AR|USG|SecPath|LS-|MSR|CR|SR)[A-Za-z0-9_.-]+)\s+.*\buptime\b',
            r'PID\s*[:：]\s*([A-Za-z0-9_.-]+)',
            r'NAME:\s*"[^"]+",\s*DESCR:\s*"([^"]+)"',
        ],
        text,
    )
    serial_number = _first_match(
        [
            r'^\s*(?:DEVICE_SERIAL_NUMBER|Device\s+serial\s+number|Device\s+Serial\s+Number|Serial\s+Number|Serial\s+No\.?|SN|S/N|BarCode|Barcode|Board\s+BarCode|Chassis\s+SN|ESN)\s*[:：]\s*([A-Za-z0-9_.-]{4,})',
            r'^\s*(?:Device\s+serial\s+number|Serial\s+Number|Serial\s+No\.?)\s+(?:is\s+)?([A-Za-z0-9_.-]{4,})\s*$',
            r'SNMP\s+Board\s+Serial\s+Number\s*:\s*([A-Za-z0-9_.-]+)',
        ],
        text,
    )
    if not _is_valid_serial_number(serial_number):
        serial_number = ''
    version = _first_match(
        [
            r'VRP\s*\(R\)\s*software,\s*Version\s+([^\r\n]+)',
            r'VRP \(R\).*?Version\s+([^\r\n]+)',
            r'Huawei\s+Versatile\s+Routing\s+Platform\s+Software.*?Version\s+([^\r\n]+)',
            r'Comware Software,\s*Version\s+([^\r\n]+)',
            r'Cisco IOS Software.*?Version\s+([^,\r\n]+)',
            r'^\s*Version\s+([^\r\n]+)',
            r'^\s*Software Version\s*[:：]\s*([^\r\n]+)',
        ],
        text,
    )
    uptime = _first_match(
        [
            r'uptime is\s+([^\r\n]+)',
            r'Uptime is\s+([^\r\n]+)',
            r'^\s*System uptime\s*[:：]\s*([^\r\n]+)',
        ],
        text,
    )
    return {
        'hostname': hostname,
        'vendor': vendor,
        'model': model,
        'serial_number': serial_number,
        'version': version,
        'uptime': uptime,
        'management_ip': management_ip,
    }


def _friendly_error_message(exc, probe=None):
    message = str(exc) or exc.__class__.__name__
    lowered = message.lower()
    if _is_ssh_algorithm_error(message):
        probe_text = _probe_summary(probe)
        probe_suffix = f' SSH peer algorithms: {probe_text}' if probe_text else ''
        return (
            'SSH 算法协商失败：设备只支持较旧的 KEX/HostKey/Cipher 算法，'
            '系统已尝试兼容旧 SSH 协议仍未成功。请检查设备 SSH 算法配置、固件版本，'
            f'或在设备侧启用 diffie-hellman-group14-sha1 / group1-sha1。原始错误：{message[:500]}'
        ) + probe_suffix
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


def _is_ssh_algorithm_error(message):
    text = str(message or '')
    lowered = text.lower()
    return any(marker in lowered for marker in SSH_NEGOTIATION_MARKERS) or '算法' in text


def _socket_read_exact(sock, size):
    chunks = []
    remaining = size
    while remaining > 0:
        chunk = sock.recv(remaining)
        if not chunk:
            raise OSError('connection closed while reading SSH packet')
        chunks.append(chunk)
        remaining -= len(chunk)
    return b''.join(chunks)


def _read_ssh_banner(sock):
    banner = b''
    for _ in range(256):
        chunk = sock.recv(1)
        if not chunk:
            break
        banner += chunk
        if banner.endswith(b'\n'):
            line = banner.decode('utf-8', errors='replace').strip()
            if line.startswith('SSH-'):
                return line
            banner = b''
    return ''


def _read_name_list(payload, offset):
    if offset + 4 > len(payload):
        return [], offset
    length = struct.unpack('>I', payload[offset:offset + 4])[0]
    offset += 4
    raw = payload[offset:offset + length]
    offset += length
    if not raw:
        return [], offset
    return raw.decode('ascii', errors='ignore').split(','), offset


def probe_ssh_algorithms(host, port=22, timeout=5):
    probe = {
        'ok': False,
        'host': str(host),
        'port': int(port or 22),
        'banner': '',
        'kex_algorithms': [],
        'server_host_key_algorithms': [],
        'encryption_algorithms': [],
        'mac_algorithms': [],
        'error': '',
    }
    try:
        with socket.create_connection((probe['host'], probe['port']), timeout=timeout) as sock:
            sock.settimeout(timeout)
            probe['banner'] = _read_ssh_banner(sock)
            if not probe['banner'].startswith('SSH-'):
                raise OSError('missing SSH banner')
            sock.sendall(b'SSH-2.0-AtlasOps-SSH-Probe\r\n')
            packet_length = struct.unpack('>I', _socket_read_exact(sock, 4))[0]
            padding_length = _socket_read_exact(sock, 1)[0]
            if packet_length < padding_length + 1 or packet_length > 262144:
                raise OSError('invalid SSH packet length')
            packet = _socket_read_exact(sock, packet_length - 1)
            payload = packet[:packet_length - padding_length - 1]
            if not payload or payload[0] != 20:
                raise OSError('server did not send SSH_MSG_KEXINIT')

            offset = 17
            probe['kex_algorithms'], offset = _read_name_list(payload, offset)
            probe['server_host_key_algorithms'], offset = _read_name_list(payload, offset)
            ciphers_c2s, offset = _read_name_list(payload, offset)
            ciphers_s2c, offset = _read_name_list(payload, offset)
            macs_c2s, offset = _read_name_list(payload, offset)
            macs_s2c, offset = _read_name_list(payload, offset)
            probe['encryption_algorithms'] = sorted(set(ciphers_c2s + ciphers_s2c))
            probe['mac_algorithms'] = sorted(set(macs_c2s + macs_s2c))
            probe['ok'] = True
    except Exception as exc:
        probe['error'] = str(exc) or exc.__class__.__name__
    return probe


def _probe_summary(probe):
    if not probe:
        return ''
    if not probe.get('ok'):
        error = probe.get('error') or 'unknown probe error'
        return f'SSH probe failed: {error}'
    sections = []
    for key, label in (
        ('kex_algorithms', 'KEX'),
        ('server_host_key_algorithms', 'HostKey'),
        ('encryption_algorithms', 'Cipher'),
        ('mac_algorithms', 'MAC'),
    ):
        values = probe.get(key) or []
        if values:
            sections.append(f"{label}: {', '.join(values[:8])}")
    return ' | '.join(sections)


def _prepend_security_algorithms(security_options, attr, algorithms):
    try:
        current = tuple(getattr(security_options, attr) or ())
    except (AttributeError, TypeError):
        return
    if not current:
        return
    preferred = []
    for algorithm in algorithms:
        if algorithm in preferred:
            continue
        candidate = tuple(preferred + [algorithm] + [item for item in current if item not in preferred and item != algorithm])
        try:
            setattr(security_options, attr, candidate)
        except (AttributeError, TypeError, ValueError):
            continue
        preferred.append(algorithm)
        current = tuple(getattr(security_options, attr) or current)


def _peer_algorithms(probe, key, fallback):
    if probe and probe.get('ok') and probe.get(key):
        return tuple(probe.get(key) or ()) + tuple(fallback)
    return fallback


def _legacy_transport_factory(paramiko_module, peer_probe=None):
    def factory(*args, **kwargs):
        transport = paramiko_module.Transport(*args, **kwargs)
        security_options = transport.get_security_options()
        _prepend_security_algorithms(
            security_options,
            'kex',
            _peer_algorithms(peer_probe, 'kex_algorithms', LEGACY_SSH_KEX_ALGORITHMS),
        )
        _prepend_security_algorithms(
            security_options,
            'ciphers',
            _peer_algorithms(peer_probe, 'encryption_algorithms', LEGACY_SSH_CIPHERS),
        )
        _prepend_security_algorithms(
            security_options,
            'digests',
            _peer_algorithms(peer_probe, 'mac_algorithms', LEGACY_SSH_DIGESTS),
        )
        _prepend_security_algorithms(
            security_options,
            'key_types',
            _peer_algorithms(peer_probe, 'server_host_key_algorithms', LEGACY_SSH_KEY_TYPES),
        )
        return transport

    return factory


def _is_auth_failure(exc):
    text = str(exc or '').lower()
    exc_name = exc.__class__.__name__.lower()
    return (
        'authentication' in text
        or 'auth' in text
        or 'permission denied' in text
        or 'not allowed' in text
        or 'authentication' in exc_name
    )


def _connect_keyboard_interactive_client(paramiko_module, target, username, password, timeout_seconds, ssh_port, peer_probe):
    sock = None
    transport = None
    try:
        sock = socket.create_connection((str(target.management_ip), ssh_port), timeout=timeout_seconds)
        sock.settimeout(timeout_seconds)
        transport = _legacy_transport_factory(paramiko_module, peer_probe)(sock)
        transport.banner_timeout = timeout_seconds
        transport.auth_timeout = timeout_seconds
        transport.start_client(timeout=timeout_seconds)

        def password_handler(title, instructions, prompts):
            return [password for _prompt, _echo in prompts]

        transport.auth_interactive(username, password_handler)
        if not transport.is_authenticated():
            raise paramiko_module.AuthenticationException('keyboard-interactive authentication failed')

        client = paramiko_module.SSHClient()
        client.set_missing_host_key_policy(paramiko_module.AutoAddPolicy())
        client._transport = transport
        return client
    except Exception:
        if transport is not None:
            transport.close()
        elif sock is not None:
            sock.close()
        raise


def _connect_ssh_client(target, username, password, ssh_client_factory=None):
    try:
        import paramiko
    except ImportError as exc:
        raise ConfigBackupError('后端缺少 paramiko 依赖，无法执行 SSH 操作。') from exc

    timeout_seconds = max(int(getattr(target, 'timeout_seconds', 30) or 30), 5)
    ssh_port = int(getattr(target, 'ssh_port', 22) or 22)
    client = ssh_client_factory() if ssh_client_factory else paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    peer_probe = None if ssh_client_factory else probe_ssh_algorithms(target.management_ip, ssh_port, min(timeout_seconds, 8))
    connect_kwargs = {
        'port': ssh_port,
        'username': username,
        'password': password,
        'timeout': timeout_seconds,
        'banner_timeout': timeout_seconds,
        'auth_timeout': timeout_seconds,
        'look_for_keys': False,
        'allow_agent': False,
    }
    if ssh_client_factory is None:
        connect_kwargs['transport_factory'] = _legacy_transport_factory(paramiko, peer_probe)
    try:
        client.connect(
            str(target.management_ip),
            **connect_kwargs,
        )
    except Exception as exc:
        try:
            client.close()
        except Exception:
            pass
        if ssh_client_factory is None and _is_auth_failure(exc):
            try:
                return _connect_keyboard_interactive_client(
                    paramiko,
                    target,
                    username,
                    password,
                    timeout_seconds,
                    ssh_port,
                    peer_probe,
                )
            except Exception as interactive_exc:
                if _is_ssh_algorithm_error(interactive_exc):
                    raise ConfigBackupConnectionError(_friendly_error_message(interactive_exc, peer_probe)) from interactive_exc
                raise interactive_exc from exc
        if _is_ssh_algorithm_error(exc):
            raise ConfigBackupConnectionError(_friendly_error_message(exc, peer_probe)) from exc
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


def _delete_version_file(version, backup_dir):
    if not version.relative_path:
        return
    file_path = os.path.abspath(os.path.join(backup_dir, version.relative_path.replace('/', os.sep)))
    backup_root = os.path.abspath(backup_dir)
    if file_path != backup_root and not file_path.startswith(f'{backup_root}{os.sep}'):
        return
    try:
        if os.path.isfile(file_path):
            os.remove(file_path)
    except OSError:
        pass


def _enforce_retention(target, backup_dir):
    retention_count = 1
    if getattr(target, 'retention_count', None):
        retention_count = min(max(int(target.retention_count or 1), 1), 1)

    for version in target.versions.filter(status='failed'):
        _delete_version_file(version, backup_dir)
        version.delete()

    versions = list(target.versions.filter(status='success').order_by('-started_at', '-id'))
    for version in versions[retention_count:]:
        _delete_version_file(version, backup_dir)
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
        message = str(exc) if isinstance(exc, ConfigBackupConnectionError) else _friendly_error_message(exc)
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
    except ConfigBackupConnectionError:
        raise
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
    except ConfigBackupConnectionError:
        raise
    except Exception as exc:
        raise ConfigBackupConnectionError(_friendly_error_message(exc)) from exc
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass


def test_secret_readonly_commands(
    *,
    credential,
    management_ip,
    read_secret,
    ssh_port=22,
    timeout_seconds=30,
    command_profile='huawei_vrp',
    ssh_client_factory=None,
):
    target = SimpleNamespace(
        credential=credential,
        management_ip=management_ip,
        ssh_port=ssh_port,
        timeout_seconds=timeout_seconds,
        command_profile=command_profile,
    )
    username, password = _read_secret_payload(target, read_secret)
    commands = _profile_commands(command_profile)
    readonly_commands = _readonly_probe_commands(command_profile)
    client = None
    started = time.monotonic()
    command_results = []
    try:
        client = _connect_ssh_client(target, username, password, ssh_client_factory=ssh_client_factory)
        channel = client.invoke_shell()
        time.sleep(0.5)
        _receive(channel, timeout=min(max(int(timeout_seconds or 30), 5), 15))

        for command in commands['prepare']:
            try:
                _send_command(channel, command, timeout=max(int(timeout_seconds or 30), 5))
            except TimeoutError:
                # Some network devices do not support every terminal paging command.
                # The probe can still continue with the read-only commands below.
                continue

        for command in readonly_commands:
            try:
                raw_output = _send_command(channel, command, timeout=max(int(timeout_seconds or 30), 30))
                output_excerpt = _clean_config_output(raw_output, [command])[:1200]
                command_results.append(
                    {
                        'command': command,
                        'ok': True,
                        'bytes': len(raw_output.encode('utf-8', errors='ignore')),
                        'output_excerpt': output_excerpt,
                    }
                )
            except TimeoutError as exc:
                command_results.append(
                    {
                        'command': command,
                        'ok': False,
                        'error': f'命令超时：{exc}',
                    }
                )

        if not any(result.get('ok') for result in command_results):
            error_parts = [
                f"{result.get('command')}: {result.get('error') or '未返回可用输出'}"
                for result in command_results
            ]
            raise ConfigBackupConnectionError(f"只读命令执行失败：{'；'.join(error_parts)}")

        return {
            'status': 'success',
            'message': '只读命令执行成功。'
            if all(result.get('ok') for result in command_results)
            else '只读命令部分成功，请检查失败命令。',
            'username': username,
            'duration_seconds': max(int(time.monotonic() - started), 0),
            'commands': command_results,
        }
    except ConfigBackupConnectionError:
        raise
    except Exception as exc:
        raise ConfigBackupConnectionError(_friendly_error_message(exc)) from exc
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass


def collect_secret_device_facts(
    *,
    credential,
    management_ip,
    read_secret,
    ssh_port=22,
    timeout_seconds=30,
    command_profile='huawei_vrp',
    ssh_client_factory=None,
):
    target = SimpleNamespace(
        credential=credential,
        management_ip=management_ip,
        ssh_port=ssh_port,
        timeout_seconds=timeout_seconds,
        command_profile=command_profile,
    )
    username, password = _read_secret_payload(target, read_secret)
    commands = _profile_commands(command_profile)
    fact_commands = _fact_probe_commands(command_profile)
    client = None
    started = time.monotonic()
    command_results = []
    raw_outputs = []
    timeout_value = max(int(timeout_seconds or 30), 5)
    try:
        client = _connect_ssh_client(target, username, password, ssh_client_factory=ssh_client_factory)
        channel = client.invoke_shell()
        time.sleep(0.5)
        _receive(channel, timeout=min(timeout_value, 15))

        for command in commands['prepare']:
            try:
                _send_command(channel, command, timeout=timeout_value)
            except TimeoutError:
                continue

        for command in fact_commands:
            try:
                raw_output = _send_command(channel, command, timeout=max(timeout_value, 45))
                output_excerpt = _clean_config_output(raw_output, [command])[:2000]
                raw_outputs.append(output_excerpt)
                command_results.append(
                    {
                        'command': command,
                        'ok': True,
                        'bytes': len(raw_output.encode('utf-8', errors='ignore')),
                        'output_excerpt': output_excerpt,
                    }
                )
            except TimeoutError as exc:
                command_results.append(
                    {
                        'command': command,
                        'ok': False,
                        'error': f'命令超时：{exc}',
                    }
                )

        if not any(result.get('ok') for result in command_results):
            error_parts = [
                f"{result.get('command')}: {result.get('error') or '未返回可用输出'}"
                for result in command_results
            ]
            raise ConfigBackupConnectionError(f"设备信息采集失败：{'；'.join(error_parts)}")

        facts = _parse_device_facts(raw_outputs, management_ip=management_ip)
        collected_fields = [key for key, value in facts.items() if value and key != 'management_ip']
        return {
            'status': 'success',
            'message': '设备信息采集成功。' if collected_fields else '命令执行成功，但未识别到型号、序列号或版本字段。',
            'username': username,
            'duration_seconds': max(int(time.monotonic() - started), 0),
            'commands': command_results,
            'facts': facts,
            'collected_fields': collected_fields,
        }
    except ConfigBackupConnectionError:
        raise
    except Exception as exc:
        raise ConfigBackupConnectionError(_friendly_error_message(exc)) from exc
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass
