# IPAM Deployment Notes

## Goal

Keep the current MySQL data while updating code and configuration.

## What must not be deleted

- `data/mysql`
- `data/backups`
- `certs` if you are using internal HTTPS
- the real `.env`

These directories/files contain runtime state. They are not source code.

## Safe update rule

When you migrate changes to the server, update only these parts first:

- `backend/`
- `frontend/`
- `config/`
- `docker-compose.yml`

Do not remove or overwrite `data/mysql`.

## Why existing database data should remain

This project keeps MySQL data in a bind mount:

- host path: `./data/mysql`
- container path: `/var/lib/mysql`

As long as the server still uses the same `data/mysql` directory, MySQL data will remain after code updates.

## Current code-change policy

The release preserves the existing database name and MySQL volume path. It includes
an additive Django migration for structured IP/DCIM metadata, so a verified backup is
required before the first start.

## Recommended deployment flow

1. Back up the current server project directory.
2. Back up the MySQL data directory or create a dump.
3. Replace code/config files only.
4. Keep `.env`, `data/mysql`, `data/backups`, and `certs`.
5. Rebuild and restart containers.
6. Verify login, API access, and existing business data.

## Before rebuilding on the server

Check these items:

- `.env` still exists and contains the real passwords
- `data/mysql` still exists
- `docker-compose.yml` still points to `./data/mysql:/var/lib/mysql`
- no accidental cleanup command is used against `data/`

## Required environment changes

Before deploying this refactor, update the production `.env`:

- set `DJANGO_SECRET_KEY` to a random value of at least 50 characters
- set `DJANGO_ENFORCE_SECURE_SETTINGS=True`
- keep `DJANGO_SECURE_COOKIES=True` when HTTPS is enabled
- keep `DJANGO_TRUST_PROXY_HEADERS=True` behind the bundled Nginx proxy
- leave `ALLOW_PERMANENT_RESIDENT_INTAKE=False` unless a permanent public form is explicitly required
- leave `PUBLIC_DCIM_OVERVIEW_ENABLED=False` unless a public DCIM board is explicitly required
- when enabling the public DCIM board, set a long `PUBLIC_DCIM_ACCESS_TOKEN`

Generate a production key without displaying the existing key:

```bash
docker compose build backend
docker compose run --rm --no-deps backend \
  python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Copy the generated value into `DJANGO_SECRET_KEY` in `.env`. Changing the Django
secret invalidates old browser sessions, but it does not change usernames, password
hashes, or business data.

## Login recovery after upgrading from an older environment

Older deployments may have a short `DJANGO_SECRET_KEY`. If
`DJANGO_ENFORCE_SECURE_SETTINGS=True` is enabled with a key shorter than 50
characters, the backend intentionally refuses to start and the login page cannot call
`/api/login/`.

Recovery:

1. Generate a new key with the command above.
2. Replace only `DJANGO_SECRET_KEY` in the server `.env`.
3. Keep the existing MySQL passwords and `data/mysql` directory unchanged.
4. Restart and inspect the services:

```bash
docker compose up -d --build --remove-orphans
docker compose ps
docker compose logs --tail=200 backend db nginx
curl -k https://127.0.0.1/api/health/
```

For emergency diagnosis only, `DJANGO_ENFORCE_SECURE_SETTINGS=False` can be used
temporarily. Generate a proper key and re-enable the setting before returning the
system to normal operation.

The IP blocklist is controlled by `SECURITY_BLOCKLIST_ENABLED`. Existing installations
that do not define this variable keep the middleware disabled until production
hardening is explicitly enabled, which prevents a legacy entry from locking
administrators out during an upgrade.

The MySQL port is no longer published to the host. Database administration should be
performed through `docker compose exec db ...` or an explicitly secured temporary port
mapping.

## Migration added by this refactor

Migration `0014_structured_asset_metadata` moves historical hidden metadata into real
columns:

- IP tag and lock state
- rack PDU count and measured power
- device model and typical power

The backend container now runs `migrate` and `collectstatic` before Gunicorn starts.
Create a database backup before the first deployment and verify these fields after the
container becomes healthy.

## Public-link behavior

- Resident intake requires a managed, expiring token by default.
- Resident PDF exports require a short-lived signed export token.
- Public DCIM pages require both feature enablement and an access token.
- Public change-request topology no longer exposes management IPs, contacts, serial
  numbers, asset tags, or real occupied-device names.

## Recommended future split

For long-term maintenance, separate this project into:

- source code repository
- runtime data directory
- backup directory

This lowers the risk of deleting production data during updates.
