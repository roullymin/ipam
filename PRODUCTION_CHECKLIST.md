# Production Checklist

## Before deployment

- Confirm `data/mysql` exists on the server.
- Confirm the real `.env` file exists on the server.
- Confirm backups are available.
- Confirm you are updating code only, not replacing runtime data.
- Confirm `DJANGO_SECRET_KEY` is a long random production value.
- Confirm `DJANGO_SECRET_KEY` contains at least 50 characters before enabling secure enforcement.
- Confirm `DJANGO_ENFORCE_SECURE_SETTINGS=True`.
- Confirm `SECURITY_BLOCKLIST_ENABLED` matches the intended rollout state.
- Confirm public intake and DCIM feature flags match the intended exposure.

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
- Confirm migration `0014_structured_asset_metadata` is applied.
- Confirm IP tags/locks, rack PDU values, and device model/typical power remain correct.
- Confirm an expired or missing resident intake token is rejected.
- Confirm the public DCIM endpoint is closed unless explicitly enabled.
- Review backend, nginx, and db logs.
- Confirm `/api/health/` returns HTTP 200 before testing login.

## Safety rules

- Do not run `docker compose down -v` on production.
- Do not delete `data/mysql`.
- Do not overwrite the production `.env` with a local file.
- Do not copy local backup files over the server backup directory.
