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

## Recommended future split

For long-term maintenance, separate this project into:

- source code repository
- runtime data directory
- backup directory

This lowers the risk of deleting production data during updates.
