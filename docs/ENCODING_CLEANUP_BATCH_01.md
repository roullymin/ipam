# 首批乱码清洗批次 / Encoding Cleanup Batch 01

## 文档目的 / Purpose

这份文档用于定义首批生产环境乱码清洗的安全执行方式，包括抽样核对、执行批次、回滚口径和验收标准。  
This document defines the first production-safe encoding cleanup batch, including sampling checks, execution batches, rollback rules, and acceptance criteria.

适用前提：  
Applies when:

- 已完成部署更新。  
  the latest code has already been deployed
- 后端已具备 `scan_encoding_issues` 和 `repair_encoding_issues` 命令。  
  the backend already includes `scan_encoding_issues` and `repair_encoding_issues`
- 需要在生产环境按小批次清理历史乱码数据。  
  historical mojibake needs to be cleaned in controlled production batches

## 总体原则 / Operating Principles

- 先扫描，再抽样，再快照，再执行。  
  Scan first, sample-check second, snapshot third, apply last.
- 首批只做“建议修复值明确、影响可人工复核”的记录。  
  The first batch should only include records whose suggested fixes are clear and easy to verify manually.
- 不一次性清全库，优先从影响最大的页面开始。  
  Do not clean the whole database at once; start with the most visible UI impact.
- 每次执行后都必须保留快照文件。  
  Always keep the snapshot file after each apply.
- 如果抽样结果不稳定，停止执行，只保留预览结果。  
  If sample checks look unstable, stop and keep the preview only.

## 执行前准备 / Pre-Execution Preparation

在服务器上进入后端目录：  
Enter the backend directory on the server:

```bash
cd /opt/ipam/ipam/backend
```

先做只读扫描：  
Run a read-only scan first:

```bash
python manage.py scan_encoding_issues --limit 10 --json
```

再生成预览和快照，不写库：  
Then generate a preview and snapshot without writing to the database:

```bash
python manage.py repair_encoding_issues --snapshot ./encoding_cleanup_batch01_snapshot.json --json
```

## 首批优先模型 / First-Batch Priority Models

首批建议优先看这些模型：  
For the first batch, start with these models:

1. `RackDevice`  
   机房设备页最容易暴露乱码，优先核对设备名称、品牌、项目、规格、序列号旁的说明字段。  
   DCIM is the most visible area; verify device name, brand, project, specs, and adjacent descriptive fields first.

2. `ResidentStaff`  
   驻场列表会直接显示公司、姓名、项目、办公位置、备注。  
   Resident operations directly expose company, person name, project, office location, and remarks.

3. `ResidentDevice`  
   驻场设备里常见备注、病毒说明、设备名称乱码。  
   Resident device records often contain broken remarks, malware notes, or device names.

4. `IPAddress`  
   IPAM 页面上的设备名、归属人、说明字段需要抽样核对。  
   Sample-check device name, owner, and description in IPAM.

5. `Rack` / `Datacenter`  
   作为位置主数据，名称和描述一旦乱码会影响多个页面。  
   As master location data, garbled rack or datacenter fields affect multiple pages.

## 抽样核对清单 / Sampling Checklist

### A. DCIM 页面 / DCIM Views

- 核对机柜名称是否可读。  
  Verify rack names are readable.
- 核对设备名称、项目名称、规格说明是否变成正常中文。  
  Verify device names, project names, and specification text become readable Chinese.
- 核对不应被改动的字段，例如序列号、管理 IP、资产标签，没有被错误替换。  
  Verify fields that should not change, such as serial number, management IP, and asset tags, remain untouched.

### B. 驻场列表 / Resident Views

- 核对公司、人员姓名、项目名称、办公地点是否恢复正常。  
  Verify company, person name, project name, and office location are restored correctly.
- 核对设备备注、病毒说明、设备型号没有被误修。  
  Verify device remarks, malware notes, and models were not incorrectly rewritten.
- 核对筛选功能按姓名、公司、电话、MAC 还能正常匹配。  
  Verify list filters still work for name, company, phone, and MAC.

### C. IPAM 页面 / IPAM Views

- 核对设备名、责任人、说明字段是否恢复正常。  
  Verify device name, owner, and description fields are readable.
- 核对 IP、端口、NAT 信息这类技术字段没有被修改。  
  Verify technical fields such as IP, port, and NAT data were not changed.

### D. 审计与用户字段 / Audit and User Fields

- 抽查审计日志 `detail`、`target_display`、`actor_name` 是否保持可读。  
  Spot-check audit-log `detail`, `target_display`, and `actor_name`.
- 抽查用户资料中的部门、职位、电话未被错误修复。  
  Spot-check user profile department, title, and phone values.

## 首批执行批次 / Batch Plan

### Batch 01-A / 第一批

范围：  
Scope:

- `RackDevice`
- `Rack`
- `Datacenter`

原因：  
Reason:

- 这些记录在页面中最直观，且人工核对成本最低。  
  These records are highly visible and easy to verify manually.

### Batch 01-B / 第二批

范围：  
Scope:

- `ResidentStaff`
- `ResidentDevice`

原因：  
Reason:

- 驻场页面字段丰富，建议在 DCIM 核对稳定后再执行。  
  Resident records are denser and should follow after DCIM proves stable.

### Batch 01-C / 第三批

范围：  
Scope:

- `IPAddress`
- `AuditLog`
- `UserProfile`

原因：  
Reason:

- 这些模型里技术字段和自由文本混合，风险略高，适合最后执行。  
  These models mix technical identifiers and free text, so they carry slightly higher risk.

## 推荐执行命令 / Recommended Commands

### 1. 只读扫描 / Read-Only Scan

```bash
python manage.py scan_encoding_issues --limit 10 --json
```

### 2. 生成首批快照 / Generate the First Snapshot

```bash
python manage.py repair_encoding_issues --snapshot ./encoding_cleanup_batch01_snapshot.json --json
```

### 3. 人工核对快照 / Review the Snapshot Manually

重点看：  
Focus on:

- `model`
- `display`
- `fields.original`
- `fields.suggested`

如果建议修复值明显不对，不要执行 `--apply`。  
If suggested values look suspicious, do not run `--apply`.

### 4. 执行首批修复 / Apply the First Batch

```bash
python manage.py repair_encoding_issues --apply --snapshot ./encoding_cleanup_batch01_snapshot.json
```

### 5. 修复后复扫 / Re-Scan After Apply

```bash
python manage.py scan_encoding_issues --limit 10 --json
```

## 回滚规则 / Rollback Rules

出现以下任一情况时，建议立即回滚：  
Rollback immediately if any of the following happens:

- 抽样页面出现正常中文被误改。  
  Valid Chinese text was incorrectly changed.
- 序列号、IP、MAC、资产编号等技术字段被污染。  
  Technical fields such as serial number, IP, MAC, or asset tags were altered.
- 关键业务页面出现大面积意外文案变化。  
  Major business pages show widespread unexpected text changes.

回滚命令：  
Rollback command:

```bash
python manage.py repair_encoding_issues --restore ./encoding_cleanup_batch01_snapshot.json
```

## 执行后验收 / Post-Apply Acceptance

修复后至少抽查这些页面：  
After applying, sample-check at least these pages:

- DCIM 机柜卡片和设备详情  
  DCIM rack cards and device details
- 驻场运营列表及展开详情  
  Resident operations list and expanded detail rows
- IPAM 列表中设备名、负责人、描述  
  IPAM list device names, owners, and descriptions
- 审计日志列表  
  Audit log lists

建议验收标准：  
Suggested acceptance criteria:

- 页面上最明显的历史乱码明显减少。  
  The most visible mojibake is clearly reduced.
- 技术字段未出现误改。  
  Technical fields remain untouched.
- `scan_encoding_issues` 的疑似记录数量下降。  
  The number of suspected records decreases after the apply.

## 相关文档 / Related Documents

- `docs/UPDATE_WORKFLOW.md`
- `docs/DEPLOY_ACCEPTANCE.md`
- `docs/NEXT_STEPS.md`
