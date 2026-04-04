# 组件化开发指南 / Componentization Guide

## 目标 / Goal

把 AtlasOps 从“单一壳层下堆积页面逻辑”的结构，逐步整理成“统一平台壳层 + 业务模块”的前端组织方式。
Move AtlasOps from a single-shell, page-heavy structure toward a unified platform shell with clearly scoped feature modules.

## 当前原则 / Current Principles

- 保留一个统一的登录、导航、权限、系统状态和共享弹层壳层。
- 业务能力按模块组织，而不是继续直接挂在 `frontend/src/components/` 下。
- 优先做代码级模块化，不直接拆成多服务或多前端工程。

- Keep one shared shell for login, navigation, permissions, system status, and shared overlays.
- Organize business capabilities by module instead of continuing to place them directly under `frontend/src/components/`.
- Start with code-level modularization, not multiple services or separate frontend apps.

## 目录建议 / Suggested Structure

```text
frontend/src/
  modules/
    changeRequests/
      views/
      hooks/
      api/
      constants/
      index.js
    resident/
      views/
      hooks/
      api/
      index.js
    ipam/
      views/
      hooks/
      api/
      index.js
    dcim/
      views/
      hooks/
      api/
      index.js
  components/
    common/
    shell/
  lib/
  App.jsx
```

## 模块边界 / Module Boundaries

### 共享壳层 / Shared Shell

保留在壳层或共享目录中的内容：
Keep these in the shell or shared directories:

- 顶栏、侧边栏、登录态、权限守卫
- 通知、确认弹窗、调试弹层、系统状态弹层
- 全局路由分发和 URL 模式识别

- header, sidebar, session state, permission guards
- notifications, confirmation modal, debug modal, system status modal
- top-level routing and URL mode detection

### 业务模块 / Feature Modules

应放在模块目录中的内容：
Put these inside feature modules:

- 模块专属页面
- 模块专属 hooks
- 模块专属 API 适配
- 模块专属常量、状态映射和表单辅助函数

- module-specific views
- module-specific hooks
- module-specific API helpers
- module-specific constants, status maps, and form helpers

## 当前已落地 / What Is Already Done

- `frontend/src/modules/changeRequests/` 已建立。
- 设备变更列表页和公开填报页已迁入该模块。
- `frontend/src/modules/resident/` 已建立。
- 驻场管理页和公开登记页已迁入该模块。
- `frontend/src/modules/ipam/` 已建立。
- IPAM 视图和专属 hook 已迁入该模块。
- `frontend/src/modules/dcim/` 已建立。
- DCIM 主视图、只读总览页和专属 hook 已迁入该模块。
- `frontend/src/modules/security/` 已建立。
- 安全审计页已迁入该模块。
- `frontend/src/modules/backup/` 已建立。
- 备份恢复页已迁入该模块。
- `frontend/src/modules/dashboard/` 已建立。
- 总览页已迁入该模块。
- `frontend/src/modules/users/` 已建立。
- 用户管理页已迁入该模块。
- 壳层级 `AppScreenRouter` 已建立，用于承接 activeTab 对应页面分发。
- 壳层级 `useAppScreenProps` 已建立，用于集中组装页面 props。

- `frontend/src/modules/changeRequests/` now exists.
- The change-request dashboard and public intake page have been moved into that module.
- `frontend/src/modules/resident/` now exists.
- The resident dashboard and public intake page have been moved into that module.
- `frontend/src/modules/ipam/` now exists.
- The IPAM view and IPAM-specific hooks have been moved into that module.
- `frontend/src/modules/dcim/` now exists.
- The DCIM primary view, read-only overview page, and DCIM-specific hooks have been moved into that module.
- `frontend/src/modules/security/` now exists.
- The security audit view has been moved into that module.
- `frontend/src/modules/backup/` now exists.
- The backup and recovery view has been moved into that module.
- `frontend/src/modules/dashboard/` now exists.
- The dashboard view has been moved into that module.
- `frontend/src/modules/users/` now exists.
- The user-management view has been moved into that module.
- A shell-level `AppScreenRouter` now owns activeTab-based screen routing.
- A shell-level `useAppScreenProps` hook now centralizes per-screen prop assembly.

## 下一步拆分顺序 / Recommended Next Moves

1. 驻场运营模块化：列表页、公开登记页、筛选逻辑。
2. IPAM 模块化：视图、筛选、扫描、导入入口。
3. DCIM 模块化：机房视图、立面视图、机柜/设备编排。
4. 再回头收缩 `App.jsx`，让它只保留壳层装配。

1. The main business and platform views now live under `modules/` for dashboard, users, change requests, resident, IPAM, DCIM, security, and backup.
2. Continue shrinking `App.jsx` by moving more shell-only decisions into helper hooks or router helpers.
3. Keep new feature work inside module boundaries instead of re-expanding the root shell.
4. Prefer module-level exports and avoid importing deep files from unrelated modules.

## Import 规则 / Import Rules

- 模块内部优先从本模块导入，不跨模块直接引用深层文件。
- 共享 UI 统一从 `components/common` 或壳层目录导入。
- `App.jsx` 只从模块的 `index.js` 或公开出口导入，不直接依赖模块内部细节。

- Prefer module-local imports inside a module; avoid deep cross-module imports.
- Shared UI should come from `components/common` or shell-level directories.
- `App.jsx` should import only from a module's public `index.js` or equivalent entry point.
