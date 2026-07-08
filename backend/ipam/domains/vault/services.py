import json
from urllib import error, request

from django.conf import settings


class VaultError(Exception):
    pass


class VaultConfigurationError(VaultError):
    pass


class VaultUnavailable(VaultError):
    pass


def _configuration():
    if not settings.OPENBAO_ENABLED:
        raise VaultConfigurationError('密码库尚未启用，请先完成 OpenBao 初始化和令牌配置。')
    if not settings.OPENBAO_TOKEN:
        raise VaultConfigurationError('未配置 OPENBAO_TOKEN。')
    return {
        'address': settings.OPENBAO_ADDR.rstrip('/'),
        'token': settings.OPENBAO_TOKEN,
        'mount': settings.OPENBAO_KV_MOUNT.strip('/'),
        'namespace': settings.OPENBAO_NAMESPACE,
        'timeout': settings.OPENBAO_TIMEOUT_SECONDS,
    }


def _call(method, path, payload=None):
    config = _configuration()
    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Vault-Token': config['token'],
    }
    if config['namespace']:
        headers['X-Vault-Namespace'] = config['namespace']

    body = json.dumps(payload).encode('utf-8') if payload is not None else None
    api_request = request.Request(
        f"{config['address']}/v1/{path.lstrip('/')}",
        data=body,
        headers=headers,
        method=method,
    )
    try:
        with request.urlopen(api_request, timeout=config['timeout']) as response:
            raw = response.read()
            return json.loads(raw.decode('utf-8')) if raw else {}
    except error.HTTPError as exc:
        if exc.code in (401, 403):
            raise VaultConfigurationError('OpenBao 令牌无效或权限不足。') from exc
        if exc.code == 404:
            raise VaultUnavailable('OpenBao 中未找到对应凭据。') from exc
        raise VaultUnavailable(f'OpenBao 请求失败（HTTP {exc.code}）。') from exc
    except (error.URLError, TimeoutError, ValueError) as exc:
        raise VaultUnavailable('OpenBao 暂时不可用，请检查服务状态和网络。') from exc


def write_secret(vault_path, username, secret_value, metadata=None):
    config = _configuration()
    return _call(
        'POST',
        f"{config['mount']}/data/{vault_path.strip('/')}",
        {
            'data': {
                'username': username or '',
                'secret_value': secret_value,
                'metadata': metadata or {},
            }
        },
    )


def read_secret(vault_path):
    config = _configuration()
    payload = _call('GET', f"{config['mount']}/data/{vault_path.strip('/')}")
    return payload.get('data', {}).get('data', {})


def delete_secret(vault_path):
    config = _configuration()
    return _call('DELETE', f"{config['mount']}/metadata/{vault_path.strip('/')}")
