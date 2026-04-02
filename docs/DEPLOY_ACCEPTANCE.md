# 部署验收清单 / Deployment Acceptance Checklist

## 文档目的 / Purpose

这份文档用于固定化服务器更新后的验收步骤，帮助快速判断“代码是否真的生效”。  
This document provides a fixed post-deployment acceptance checklist so you can quickly verify whether an update actually took effect.

如需执行乱码修复前后的专项抽样核对，请同时参考 `docs/ENCODING_CLEANUP_BATCH_01.md`。  
For dedicated sampling checks before and after encoding cleanup, also see `docs/ENCODING_CLEANUP_BATCH_01.md`.

## 第一步：检查仓库状态 / Step 1: Check Repository State

在服务器仓库根目录执行：  
Run from the repository root on the server:

```bash
cd /opt/ipam/ipam
git log -1 --oneline
git status
git sparse-checkout list
```

核对要点：  
Check:

- 最新提交号是否就是本次准备发布的版本。  
  The latest commit should match the intended deployment.
- 工作区是否干净；除非你明确保留了本地改动。  
  The worktree should be clean unless you intentionally keep local changes.
- 正常部署时，不应只稀疏检出单个目录。  
  Sparse checkout should not hide required directories during normal deployment.

如果意外开启了稀疏检出：  
If sparse checkout is enabled unexpectedly:

```bash
git sparse-checkout disable
```

## 第二步：检查前端构建 / Step 2: Check Frontend Build

```bash
cd /opt/ipam/ipam/frontend
npm run build
cd ..
cat frontend/dist/index.html
```

核对要点：  
Check:

- `frontend/dist/index.html` 是否引用了最新 JS hash。  
  `frontend/dist/index.html` should reference the newest JS hash.
- 浏览器强刷后加载的 JS hash 是否与这里一致。  
  The browser should load the same hash after a hard refresh.

## 第三步：检查后端运行状态 / Step 3: Check Backend Runtime

```bash
cd /opt/ipam/ipam
docker compose restart backend
docker compose logs --tail=50 backend
```

核对要点：  
Check:

- 后端是否正常重启。  
  Backend should restart successfully.
- 日志里是否出现 traceback。  
  Logs should not contain traceback errors.
- 版本接口和系统概览接口是否可正常访问。  
  Version and overview APIs should return valid data.

## 第四步：检查前端网关状态 / Step 4: Check Frontend Gateway Runtime

```bash
cd /opt/ipam/ipam
docker compose restart nginx
docker compose logs --tail=50 nginx
```

核对要点：  
Check:

- `nginx` 是否正常重启。  
  nginx should restart successfully.
- 日志里是否出现配置错误或挂载错误。  
  Logs should not show config or mount errors.

## 第五步：浏览器侧验收 / Step 5: Browser-Side Verification

- 强制刷新页面。  
  Hard refresh the page.
- 打开开发者工具，确认页面加载的 JS 文件与 `frontend/dist/index.html` 一致。  
  Open DevTools and confirm the loaded JS file matches `frontend/dist/index.html`.
- 打开系统内置的版本 / 部署检查弹层，确认提交号、分支和备份状态。  
  Open the in-app deployment/version modal and verify commit, branch, and backup status.
- 如果页面看起来还是旧的，先核对实际加载的 hash，再判断是不是发布失败。  
  If a page still looks old, compare the actual loaded hash before assuming deployment failed.

## 第六步：数据质量检查 / Step 6: Data Quality Verification

如果页面文案已经更新，但业务数据本身仍然显示乱码，可以执行：  
If UI copy is updated but business data still looks garbled, run:

```bash
cd /opt/ipam/ipam/backend
python manage.py scan_encoding_issues --limit 10 --json
python manage.py repair_encoding_issues --snapshot ./encoding_cleanup_snapshot.json
```

确认快照后再执行修复：  
Only apply after reviewing the snapshot:

```bash
python manage.py repair_encoding_issues --apply --snapshot ./encoding_cleanup_snapshot.json
```

如果修复结果不满意，可按快照回滚：  
Rollback if the result is not satisfactory:

```bash
python manage.py repair_encoding_issues --restore ./encoding_cleanup_snapshot.json
```

## 推荐的最小验收命令 / Recommended Minimal Acceptance Commands

如果只想快速确认这次更新是否生效，优先看这几条：  
If you only want a fast deployment sanity check, start with these commands:

```bash
git log -1 --oneline
git sparse-checkout list
cat frontend/dist/index.html
docker compose ps
```

这四步能最快帮助你判断：  
These four checks are usually the fastest way to confirm:

- 当前仓库版本是否正确  
  whether the repo version is correct
- 服务器目录是否完整  
  whether required directories exist on the server
- 前端是否重新构建  
  whether the frontend has been rebuilt
- 运行中的服务是否正常  
  whether the running services are healthy
