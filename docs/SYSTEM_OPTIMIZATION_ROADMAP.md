# 系统优化路线图 / System Optimization Roadmap

## 文档目的 / Purpose

这份文档用于汇总当前 `ipam` 系统下一阶段最值得推进的优化方向，帮助后续规划和执行。  
This document summarizes the most valuable next-step improvements for the `ipam` system and serves as a planning guide for future execution.

## 当前基础 / Current State

系统目前已经具备这些基础能力：  
The system already has the following foundations:

- 已有 IPAM、DCIM、驻场运营、安全审计、备份恢复、用户管理等核心模块。  
  Core modules already exist for IPAM, DCIM, resident operations, security audit, backup, and user management.
- 前端整体品牌和壳层风格已经统一。  
  The frontend shell and branding have been unified.
- 后端核心流程已有基础冒烟测试。  
  Major backend flows already have basic smoke-test coverage.
- IPAM、DCIM、驻场导入都已具备预览能力。  
  IPAM, DCIM, and resident imports already support preview before execution.
- 页面内已经可以查看版本和部署状态。  
  Version and deployment state are already visible inside the UI.
- 已具备乱码扫描、修复、快照和回滚工具。  
  Encoding scan, repair, snapshot, and rollback tooling already exists.

## 当前主要问题 / Main Problems

### 1. 前端文案还没有完全收口 / Frontend copy is not fully closed

部分页面仍然存在零散英文、术语不一致或界面文案未完全统一的问题。  
Some pages still contain scattered English, inconsistent terminology, or unfinished UI copy.

这会带来两个直接影响：  
This causes two direct problems:

- 页面观感仍然像“未完全收尾”的版本。  
  The UI still feels like an unfinished release.
- 当服务器没有同步到最新前端包时，更难快速判断到底是缓存问题还是代码没更新。  
  It becomes harder to tell whether a stale page is caused by caching or by an incomplete deployment.

### 2. 部署验收仍然依赖人工经验 / Deployment verification still depends too much on manual judgment

虽然已经增加了版本和部署状态展示，但服务器部署仍然可能因为以下原因出问题：  
Even after adding version visibility, deployment can still fail in practice because of:

- 前端源码已更新，但没有重新构建。  
  frontend source updated, but not rebuilt
- `nginx` 仍在提供旧的静态文件 hash。  
  nginx still serving an old static hash
- `sparse-checkout` 只展开了部分目录。  
  sparse-checkout hiding part of the repo
- 后端代码已更新，但服务没有重启。  
  backend code updated, but the service was not restarted

### 3. 历史数据质量问题仍然存在 / Historical data quality remains a long-tail issue

即使界面文案完全修好，业务数据本身仍然可能包含乱码或破损文本。  
Even if the UI copy is fully fixed, business data may still contain mojibake or corrupted text.

常见问题包括：  
Common examples include:

- 设备名称乱码  
  garbled device names
- 项目名称损坏  
  corrupted project names
- 备注、说明、导入文本被写坏  
  broken remarks, descriptions, or imported text

### 4. 前端结构仍需继续整理 / Frontend structure still needs more cleanup

`frontend/src/App.jsx` 虽然已经比之前更轻，但项目仍然需要：  
`frontend/src/App.jsx` is smaller than before, but the project still needs:

- 更明确的页面级模块职责  
  clearer page-level ownership
- 更干净的状态边界  
  cleaner state boundaries
- 清理历史噪声注释和旧逻辑包袱  
  removal of noisy legacy comments and historical baggage

### 5. 运维流程还没有完全闭环 / Operational workflows are not fully closed-loop yet

当前系统已经能较好地记录资产和活动，但以下高价值流程还需要继续完善：  
The system already records assets and activity well, but several high-value workflows still need closure:

- 恢复流程  
  restore workflow
- 机柜上架或设备变更审批流程  
  rack onboarding and device-change approval workflow
- 告警升级与通知处理流程  
  alert escalation and notification handling

## 优先级路线 / Optimization Priorities

## 第一优先级 / Priority A

### 1. 前端文案与术语彻底收口 / Full cleanup of frontend copy and terminology

目标：  
Target:

- 清掉界面里残留的英文。  
  Remove remaining English from primary business UI.
- 统一按钮、状态、页面标题和操作提示的术语。  
  Unify terminology for buttons, statuses, headings, and operational prompts.
- 只有在明确合理的地方保留英文，例如品牌名或技术标识。  
  Keep English only where it is intentional, such as product branding or technical identifiers.

建议覆盖范围：  
Recommended scope:

- 备份页 / Backup page
- 安全页 / Security page
- 壳层公共区域 / Shared shell copy
- 导入结果提示 / Import result messaging
- 版本与部署状态弹层 / Deployment and version modal

完成标准：  
Success criteria:

- 正常业务界面不再出现意外英文。  
  No accidental English appears in regular business UI.
- 一个术语只对应一个概念。  
  One term consistently maps to one concept.

### 2. 部署验收流程固定化 / Deployment acceptance process standardization

目标：  
Target:

- 让“这次更新是否真的生效”变成可重复检查的过程。  
  Make “did the update really take effect?” a repeatable verification process.

建议动作：  
Recommended actions:

- 固定使用 `docs/DEPLOY_ACCEPTANCE.md` 做部署后验收。  
  Use `docs/DEPLOY_ACCEPTANCE.md` as the fixed post-deploy checklist.
- 继续强化版本、hash、提交号的页面可见性。  
  Improve visibility of version, hash, and commit in the UI.
- 每次都用 `frontend/dist/index.html` 对照浏览器实际加载的 JS hash。  
  Always compare `frontend/dist/index.html` with the JS hash loaded in the browser.
- 如果服务器目录不完整，第一时间检查 `sparse-checkout`。  
  If directories look incomplete on the server, check sparse-checkout immediately.

完成标准：  
Success criteria:

- 发布验证可以重复执行。  
  Deployment verification becomes repeatable.
- 服务器更新问题能在几分钟内被定位。  
  Server update mistakes can be isolated within minutes.

### 3. 清理源码里的历史乱码注释 / Clean historical mojibake comments from source files

目标：  
Target:

- 删除旧文件里破损的注释和不可读的历史残留内容。  
  Remove broken comments and unreadable historical debris from old files.

建议范围：  
Recommended scope:

- `frontend/src/App.jsx`
- 维护时会碰到的旧前端页面  
  old frontend views touched during maintenance
- 导入、数据质量相关的后端辅助逻辑  
  backend helpers touched during import or data-quality work

完成标准：  
Success criteria:

- 代码阅读成本下降。  
  Code becomes easier to read and maintain.
- 后续维护时不需要继续跳过乱码注释。  
  Future maintenance no longer needs to mentally skip broken comments.

## 第二优先级 / Priority B

### 4. 真正执行数据库乱码清洗 / Execute real database encoding cleanup

目标：  
Target:

- 从“已经有工具”推进到“按可控批次真正清理生产数据”。  
  Move from “we have the tooling” to “we are cleaning real production data in controlled batches.”

建议流程：  
Recommended flow:

1. 先扫描疑似乱码记录。 / Scan suspected records.  
2. 生成快照预览。 / Generate a snapshot preview.  
3. 人工确认影响范围。 / Review the impact manually.  
4. 分批执行修复。 / Apply fixes in batches.  
5. 修完后重新扫描并抽样核对页面显示。 / Re-scan and sample-check the UI afterward.

优先检查模块：  
Priority modules to inspect first:

- DCIM 里的机柜名称、设备名称、备注  
  rack names, device names, and remarks in DCIM
- IPAM 里的备注、标签、设备名  
  remarks, labels, and device names in IPAM
- 驻场里的公司、项目、设备信息  
  company, project, and device information in resident operations

完成标准：  
Success criteria:

- 页面上最明显的乱码业务数据明显减少。  
  The most visible garbled business data is significantly reduced.
- 后续导入不会再反复把同类问题写回数据库。  
  Future imports no longer reintroduce the same issue.

### 5. 统一导入预览和结果报告体验 / Unify import preview and result-report UX

目标：  
Target:

- 让 IPAM、DCIM、驻场三套导入体验看起来像同一个系统。  
  Make IPAM, DCIM, and resident imports feel like one unified system.

建议动作：  
Recommended actions:

- 统一摘要卡、预警提示和阻断错误的展示方式。  
  Standardize summary cards, warnings, and blocking errors.
- 增加失败行导出或错误报告下载。  
  Add downloadable failed-row reports or error reports.
- 统一导入完成后的结果摘要结构。  
  Standardize post-import result summaries.

完成标准：  
Success criteria:

- 运维人员能快速看懂导入结果。  
  Operators can understand import outcomes immediately.
- 导入排错速度明显提升。  
  Import debugging becomes faster.

### 6. 继续拆分 `App.jsx` / Continue decomposing `App.jsx`

目标：  
Target:

- 进一步降低主应用装配层的复杂度。  
  Further reduce orchestration complexity in the main app shell.

建议动作：  
Recommended actions:

- 把更多页面专属逻辑移到页面级 hook。  
  Move more page-specific logic into page-level hooks.
- 在 `App.jsx` 中只保留装配、公共弹层入口和高层路由。  
  Keep only composition, shared modal entry points, and high-level routing in `App.jsx`.
- 避免新需求继续把逻辑堆回根文件。  
  Prevent new features from drifting back into the root file.

完成标准：  
Success criteria:

- 新功能接入时，不再让 `App.jsx` 再次膨胀。  
  New features no longer cause `App.jsx` to balloon again.

## 第三优先级 / Priority C

### 7. 全局搜索与高级筛选 / Global search and advanced filtering

目标：  
Target:

- 把系统从“逐页查找”升级成“统一检索入口”。  
  Upgrade the system from page-by-page lookup to a unified retrieval entry point.

建议范围：  
Recommended scope:

- 按 IP 搜索 / search by IP
- 按设备名搜索 / search by device name
- 按机柜或机房搜索 / search by rack or datacenter
- 按驻场人员或项目搜索 / search by resident or project
- 支持保存常用筛选条件 / saved filters for recurring views

完成标准：  
Success criteria:

- 高频检索不需要逐个页面翻找。  
  Common lookups can be completed from one place.

### 8. 告警中心 / Alert center

目标：  
Target:

- 让系统从“被动记录”继续走向“主动提醒”。  
  Move the system from passive recording toward proactive operations.

建议告警类型：  
Recommended alert types:

- IP 冲突 / IP conflict
- 子网容量接近耗尽 / subnet nearly full
- 备份失败 / backup failure
- 异常登录激增 / abnormal login spikes
- 驻场即将到期 / resident expiration soon
- 机柜容量或功耗达到阈值 / rack capacity or power threshold reached

完成标准：  
Success criteria:

- 总览页更偏向行动视图。  
  The dashboard becomes more action-oriented.
- 运维人员不需要靠人工去发现所有问题。  
  Operators do not need to discover every issue manually.

### 9. 运维流程闭环模块 / Workflow modules for operations closure

目标：  
Target:

- 支持更真实的运维流程，而不是只做数据录入和展示。  
  Support real operational workflows instead of only storing and showing data.

建议后续模块：  
Recommended future workflow modules:

- 机柜上架申请 / rack onboarding request
- 设备变更申请 / device change request
- 资产退役或下架申请 / asset retirement or decommission request
- 高风险操作的审批与审计闭环 / approval and audit closure for high-risk operations

完成标准：  
Success criteria:

- 平台更像基础设施运营平台，而不仅是台账系统。  
  The platform becomes closer to an infrastructure operations center than a registry.

## 中长期方向 / Long-Term Direction

### 1. 更强的角色与权限模型 / Stronger role and permission model

后续可补：  
Future improvements can include:

- 模块级权限 / module-level permissions
- 操作级权限 / action-level permissions
- 数据范围权限 / data-scope permissions
- 审批权限 / approval permissions

### 2. 恢复流程与恢复审计 / Restore workflow and restore-specific audit

未来引入恢复能力后，建议补齐：  
When restore features are introduced, the system should support:

- 恢复前预览 / restore preview
- 恢复确认 / restore confirmation
- 恢复专用审计日志 / restore-specific audit logs
- 恢复结果跟踪 / restore result tracking

### 3. 统一设计系统与文案字典 / Unified design system and copy dictionary

建议后续抽出统一基础层：  
Recommended future base layer:

- 公共术语字典 / shared terminology map
- 页面标题规范 / page heading rules
- 状态标签规范 / status badge rules
- 空状态和错误状态模板 / empty-state and error-state templates

## 建议执行顺序 / Recommended Execution Order

### 第一阶段 / Phase 1

- 收口前端残留文案和术语。  
  Close remaining frontend copy and terminology.
- 继续清理源码历史乱码注释。  
  Continue cleaning historical source-level mojibake comments.
- 固化部署验收步骤。  
  Standardize deployment acceptance.

### 第二阶段 / Phase 2

- 按批次执行真实数据库乱码清洗。  
  Execute controlled production data cleanup.
- 统一导入预览与结果报告体验。  
  Unify import preview and reporting UX.
- 继续拆分 `App.jsx`。  
  Continue decomposing `App.jsx`.

### 第三阶段 / Phase 3

- 增加全局搜索和更强的服务端筛选。  
  Add global search and stronger server-side filtering.
- 建设告警中心。  
  Build the alert center.
- 扩展运维流程闭环模块。  
  Expand workflow-closure features.

## 建议的下一步 / Suggested Next Steps

如果接下来只选一个方向继续推进，建议优先顺序如下：  
If only one area is chosen next, use this order:

1. 先把前端残留文案彻底收口。 / Finish frontend copy closure.  
2. 按快照机制真正执行数据库乱码清洗。 / Execute real database encoding cleanup with snapshots.  
3. 统一三类导入的预览和结果报告体验。 / Unify import report UX.  
4. 继续清理源码里的历史乱码注释。 / Continue removing historical mojibake comments from source files.  
5. 再进入全局搜索和告警中心建设。 / Build global search and the alert center.

## 相关文档 / Related Documents

- `docs/NEXT_STEPS.md`
- `docs/UPDATE_WORKFLOW.md`
- `docs/DEPLOY_ACCEPTANCE.md`
- `docs/UI_REDESIGN.md`
