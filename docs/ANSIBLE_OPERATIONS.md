# Ansible Operations

## Managed Device Fact Collection

After priority devices are imported, credentials are written to OpenBao, and backup targets are provisioned, use the built-in command to collect device facts and write them back to asset records.

```bash
docker compose exec backend python manage.py run_ansible_facts --all
```

By default, `--all` prefers the priority-import set when those credentials are present. This keeps the first rollout focused on the manually supplied key devices instead of every historical backup target. To collect every managed host, run:

```bash
docker compose exec backend python manage.py run_ansible_facts --all --include-non-priority
```

Useful scoped runs:

```bash
docker compose exec backend python manage.py run_ansible_facts --ip 172.25.254.130
docker compose exec backend python manage.py run_ansible_facts --target-id 30
docker compose exec backend python manage.py run_ansible_facts --all --limit 5
```

Safe dry-style collection without writing back:

```bash
docker compose exec backend python manage.py run_ansible_facts --all --no-write-back
```

Overwrite existing asset fields only after spot-checking collected values:

```bash
docker compose exec backend python manage.py run_ansible_facts --all --overwrite
```

The command creates an `AnsibleTaskRun` record, so the Ansible center can show the latest task summary, success and failure counts, and a preview of collected facts.

In the Ansible center, the default pool is intentionally strict: a host is shown by default only when it came from the priority import set and has an enabled backup target, a management IP, and an active credential. If no priority-import markers exist yet, the page falls back to all managed hosts. Use the "all candidates" scope only when you want to inspect devices that are not ready yet.

The Inventory panel can copy or download the generated `.ini` content. It does not include passwords; it only references the managed hosts and connection metadata.

The same inventory can be exported on the server:

```bash
docker compose exec backend python manage.py export_ansible_inventory --output /app/media/ansible/inventory.ini
```

To export every managed target instead of the priority-import set:

```bash
docker compose exec backend python manage.py export_ansible_inventory --include-non-priority --output /app/media/ansible/inventory-all-managed.ini
```

Fact parsing is tuned for common Huawei VRP and H3C Comware outputs from:

- `display version`
- `display device manuinfo`
- `display device manufacture-info`
- `display esn`

Recommended rollout order:

1. Run `--all --limit 3` and confirm the Ansible center task record.
2. Run `--all --no-write-back` if you only want to validate connectivity and parsing.
3. Run `--all` to collect and write missing model, version, serial number, vendor, host name, and management IP fields.
4. Use the Ansible center `missing facts` filter to focus on devices still missing facts.

## Password Rotation Planning

The Ansible center has a password rotation planning entry. It only creates a task record and a human-checkable plan. It does not change device passwords and does not overwrite OpenBao.

Recommended usage:

1. Select 1, 3, or 5 managed hosts in the Ansible center.
2. Click the rotation plan button.
3. Review the task record preview:
   - generate candidate password
   - test old password
   - test new password on the device side
   - confirm switch and then update OpenBao

The backend endpoint is:

```http
POST /api/ansible/rotation-plan/
```

Example payload:

```json
{
  "batch_size": 3,
  "host_ids": ["target-30", "target-27", "target-3"]
}
```

When `host_ids` is omitted, the platform takes the first managed hosts up to `batch_size`.
