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
additive Django migrations for structured IP/DCIM metadata and the password-vault
ledger, so a verified backup is required before the first start.

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
- keep `OPENBAO_ENABLED=False` until OpenBao has been initialized and unsealed
- after initialization, configure a scoped `OPENBAO_TOKEN` rather than the root token

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

## DCIM data appears empty after an update

Migration `0014_structured_asset_metadata` does not delete datacenters, racks, or rack
devices. First identify whether the API failed or Docker mounted a different MySQL
directory:

```bash
docker compose exec backend python manage.py dcim_status
docker inspect ipam_db --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
docker compose logs --tail=200 backend db
```

- If the command reports non-zero DCIM counts, do not restore data. Update the
  frontend and inspect the visible API error banner.
- If the command reports zero counts, compare the MySQL mount source with the old
  project directory. Do not create replacement racks until the correct data source is
  confirmed.
- If migration `0014` is missing, run `docker compose exec backend python manage.py
  migrate --noinput` and repeat the status command.

The `ipam_bak.tar.gz` archive contains non-empty `dcim_datacenter`, `dcim_rack`, and
`dcim_rack_device` InnoDB files. To recover only DCIM rows without replacing the
current database, start the archived MySQL directory in an isolated temporary
container and produce a data-only dump:

```bash
mkdir -p /srv/ipam-recovery
tar -xzf /path/to/ipam_bak.tar.gz -C /srv/ipam-recovery \
  ipam_bak/data/mysql ipam_bak/.env
cp -a /srv/ipam-recovery/ipam_bak/data/mysql /srv/ipam-recovery/mysql-work
chown -R 999:999 /srv/ipam-recovery/mysql-work

set -a
. /srv/ipam-recovery/ipam_bak/.env
set +a

docker rm -f ipam_recovery_db 2>/dev/null || true
docker run -d --name ipam_recovery_db \
  -v /srv/ipam-recovery/mysql-work:/var/lib/mysql \
  mysql:8.0 --default-authentication-plugin=mysql_native_password

until docker exec -e MYSQL_PWD="$MYSQL_PASSWORD" ipam_recovery_db \
  mysqladmin ping -u "$MYSQL_USER" --silent; do sleep 3; done

docker exec -e MYSQL_PWD="$MYSQL_PASSWORD" ipam_recovery_db \
  mysqldump -u "$MYSQL_USER" --single-transaction --no-tablespaces \
  --no-create-info "$MYSQL_DATABASE" \
  dcim_datacenter dcim_rack dcim_rack_device \
  > /srv/ipam-recovery/dcim-data.sql
```

Only when `dcim_status` confirms the current three DCIM counts are all zero, import
the dump and backfill the structured fields:

```bash
docker compose exec -T db sh -lc \
  'MYSQL_PWD="$MYSQL_PASSWORD" mysqldump -u "$MYSQL_USER" \
  --single-transaction --no-tablespaces "$MYSQL_DATABASE"' \
  > /srv/ipam-recovery/current-before-dcim-restore.sql

docker compose exec -T db sh -lc \
  'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" "$MYSQL_DATABASE"' \
  < /srv/ipam-recovery/dcim-data.sql

docker compose exec backend python manage.py backfill_structured_asset_metadata
docker compose exec backend python manage.py dcim_status
docker rm -f ipam_recovery_db
```

If any current DCIM count is non-zero, stop before importing because primary-key
conflicts or partial duplication require a merge plan rather than a direct restore.

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

## Password vault migration

Migration `0015_secretrecord_secretauditevent_secretaccessrequest` adds only password
ledger metadata, access requests, and audit events. It does not add a plaintext
password column.

Before enabling the password-book module in production:

1. Follow `docs/PASSWORD_VAULT.md` to initialize and unseal OpenBao.
2. Put the scoped application token in the server `.env`.
3. Set `OPENBAO_ENABLED=True`.
4. Start the updated stack and verify the migration:

```bash
docker compose up -d --build
docker compose exec backend python manage.py showmigrations ipam
docker compose logs --tail=100 openbao backend
```

The OpenBao data directory is `./data/openbao`. Preserve and back it up together with
`data/mysql`; losing one side leaves either orphaned metadata or inaccessible secrets.

## Public-link behavior

- Resident intake requires a managed, expiring token by default.
- Resident PDF exports require a short-lived signed export token.
- Public DCIM pages require both feature enablement and an access token.
- Public change-request topology no longer exposes management IPs, contacts, serial
  numbers, asset tags, or real occupied-device names.

## Network Configuration Backups

The asset center can read the old Python backup files and also write new built-in
backup versions. The supported filename formats are:

```text
/backup/{switch|router|firewall}/{management_ip}_{YYYYMMDD}.txt.gz
/backup/{switch|router|firewall}/{management_ip}_{YYYYMMDD_HHMMSS}.txt.gz
```

Set these values in `.env` before restarting the backend:

```env
CONFIG_BACKUP_HOST_DIR=/backup
CONFIG_BACKUP_DIR=/backup
```

`CONFIG_BACKUP_HOST_DIR` is the host path that stores configuration backup files.
It can point to the old Python backup directory during migration.
`CONFIG_BACKUP_DIR` is the writable path mounted inside the backend container.
The asset-center summary API scans metadata such as filename, size, and modified
time; it does not expose configuration file contents.

Manual built-in backup run:

```bash
docker compose exec backend python manage.py run_config_backups --all --continue-on-error
```

Example weekly schedule on the server:

```cron
0 3 * * 0 cd /opt/ipam && docker compose exec -T backend python manage.py run_config_backups --all --continue-on-error >> /var/log/ipam_config_backup.log 2>&1
```

## Recommended future split

For long-term maintenance, separate this project into:

- source code repository
- runtime data directory
- backup directory

This lowers the risk of deleting production data during updates.
