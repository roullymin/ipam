# Production Checklist

## Before deployment

- Confirm `data/mysql` exists on the server.
- Confirm the real `.env` file exists on the server.
- Confirm backups are available.
- Confirm you are updating code only, not replacing runtime data.

## Files to update

- `backend/`
- `frontend/`
- `config/`
- `docker-compose.yml`

## Files to preserve

- `data/`
- `.env`
- `certs/`

## After deployment

- Open the system and test login.
- Confirm existing IP data still appears.
- Confirm datacenter, rack, and device data still appears.
- Confirm backup list loads.
- Confirm import and export pages open normally.
- Review backend, nginx, and db logs.

## Safety rules

- Do not run `docker compose down -v` on production.
- Do not delete `data/mysql`.
- Do not overwrite the production `.env` with a local file.
- Do not copy local backup files over the server backup directory.
