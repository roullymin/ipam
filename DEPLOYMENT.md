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

The local hardening changes made in this workspace are intentionally non-destructive:

- no new Django migrations
- no model field changes
- no database rename
- no volume path change for MySQL

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
