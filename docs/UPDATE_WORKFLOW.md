# 更新工作流 / Update Workflow

## 文档目的 / Purpose

这份文档是本地 `ipam` 项目与服务器更新的操作手册。  
This document is the operational playbook for updating the local `ipam` project and the production server.

如需固定的部署后验收清单，请同时参考 `docs/DEPLOY_ACCEPTANCE.md`。  
For a fixed post-deploy acceptance checklist, also see `docs/DEPLOY_ACCEPTANCE.md`.

## 本地开发流程 / Local Development Flow

1. 在仓库根目录开始，先检查当前改动状态。  
   Start from the repo root and inspect current changes.
2. 端到端完成任务。  
   Implement the task end to end.
3. 运行针对性验证。  
   Run targeted verification.
4. 只提交与当前任务相关的文件。  
   Commit only task-related files.
5. 推送到 GitHub。  
   Push to GitHub.

### 推荐命令 / Recommended Commands

```powershell
cd C:\Users\roull\Desktop\ipam
git status --short
```

后端改动：  
Backend changes:

```powershell
cd backend
python manage.py test ipam.tests --settings=core.settings_test
python manage.py check --settings=core.settings_test
```

前端改动：  
Frontend changes:

```powershell
cd frontend
npm run build
```

提交并推送：  
Commit and push:

```powershell
cd C:\Users\roull\Desktop\ipam
git add <relevant files>
git commit -m "your message"
git push origin main
```

## 服务器更新流程 / Server Update Flow

服务器上更新时，默认应在仓库根目录整体更新；除非是紧急热修，不要只手工覆盖单个源码目录。  
Always update from the repo root on the server, not by copying only one source folder unless it is an emergency hotfix.

### 标准更新 / Standard Update

```bash
cd /opt/ipam/ipam
git pull origin main
cd frontend
npm run build
cd ..
docker compose restart nginx
docker compose restart backend
```

如果只有前端变更：  
If only frontend changed:

```bash
cd /opt/ipam/ipam
git pull origin main
cd frontend
npm run build
cd ..
docker compose restart nginx
```

如果只有后端逻辑变更：  
If only backend logic changed:

```bash
cd /opt/ipam/ipam
git pull origin main
docker compose restart backend
```

## 部署后核对 / Deployment Verification

### 仓库与构建 / Repository and Build

```bash
git log -1 --oneline
git sparse-checkout list
cat frontend/dist/index.html
```

### 运行状态 / Runtime

```bash
docker compose ps
docker compose logs --tail=50 backend
docker compose logs --tail=50 nginx
```

### 浏览器侧 / Browser

- 强制刷新页面。  
  Hard refresh the page.
- 确认浏览器加载的 JS hash 与 `frontend/dist/index.html` 一致。  
  Confirm the loaded JS hash matches `frontend/dist/index.html`.
- 先看系统内置的版本 / 部署检查弹层，再判断服务器是否没更新。  
  Use the in-app deployment/version modal first before assuming the server is stale.

## 数据质量与导入流程 / Data Quality and Import Flow

### 导入前预览 / Preview Before Import

- 先走 IP 导入预览。  
  Use the IP import preview first.
- 重点看编码、每行动作、必填列缺失和网段匹配情况。  
  Check encoding, row actions, missing required columns, and subnet matching.

### 乱码清洗 / Encoding Cleanup

扫描：  
Scan:

```bash
cd /opt/ipam/ipam/backend
python manage.py scan_encoding_issues --limit 10 --json
```

预览和快照：  
Preview and snapshot:

```bash
python manage.py repair_encoding_issues --snapshot ./encoding_cleanup_snapshot.json
```

应用修复：  
Apply:

```bash
python manage.py repair_encoding_issues --apply --snapshot ./encoding_cleanup_snapshot.json
```

回滚：  
Rollback:

```bash
python manage.py repair_encoding_issues --restore ./encoding_cleanup_snapshot.json
```

## 下一步优先方向 / What To Build Next

1. 把导入预览和结果报告从 IPAM 扩展到 DCIM 和驻场导入。  
   Extend import preview and reporting from IPAM to DCIM and resident imports.
2. 在总览页或设置页继续强化版本与部署状态展示。  
   Surface version and deployment state in more user-visible places such as dashboard or settings.
3. 继续清理残留用户可见文案，以及源码里的历史乱码注释。  
   Continue cleaning remaining user-facing copy and historical source-level mojibake comments.
4. 继续拆分 `frontend/src/App.jsx`。  
   Continue decomposing `frontend/src/App.jsx`.
5. 为运维人员补一个部署检查页或设置面板。  
   Add a deployment checklist page or settings panel for operators.
