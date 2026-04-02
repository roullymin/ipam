# NEXT STEPS

## Purpose / 说明

This file is the default backlog for the local `ipam` Codex skill. When a request is broad, continue from the highest-priority unfinished task here unless the user gives a more specific direction.

此文件是本地 `ipam` Codex skill 的默认任务清单。当用户的要求比较宽泛时，优先从这里继续处理“优先级最高且尚未完成”的任务；如果用户给了更具体的方向，则以用户要求为准。

## Auto Mode Rules / 自动推进规则

- Pick the first unchecked item in the highest-priority section.
- Finish work end to end when practical: context, implementation, verification, and brief summary.
- After completing an item, change `[ ]` to `[x]`.
- If a task is too large, split it into smaller unchecked items directly below it.
- If a task is blocked, add a short `Blocked:` note under the relevant section instead of silently skipping it.

- 优先选择最高优先级分组里第一个未勾选的任务。
- 尽量端到端完成任务：先看上下文，再实现，再验证，最后给出简短说明。
- 任务完成后，把 `[ ]` 改成 `[x]`。
- 如果任务太大，就在该任务下面拆成更小的未完成子任务。
- 如果任务被阻塞，就在对应分组下加一条 `Blocked:` 说明，不要直接跳过不写。

## Priority 1 / 最高优先级

- [x] Add backend smoke tests for login, import, backup, IP CRUD, and rack/device CRUD.
- [x] Cover at least one failure path for import APIs.
- [x] Cover at least one failure path for backup APIs.

- [x] 为登录、导入、备份、IP 增删改查、机柜/设备增删改查补充后端冒烟测试。
- [x] 至少覆盖一条导入接口的失败路径。
- [x] 至少覆盖一条备份接口的失败路径。

## Priority 2 / 前端结构整理

- [x] Continue decomposing `frontend/src/App.jsx` into smaller hooks and feature components.
- [x] Extract data-loading logic out of `frontend/src/App.jsx`.
- [x] Extract import and export action handlers out of `frontend/src/App.jsx`.
- [x] Continue extracting modal and entity-management handlers out of `frontend/src/App.jsx`.

- [x] 继续拆分 `frontend/src/App.jsx`，把逻辑抽到更小的 hooks 和功能组件里。
- [x] 把数据加载逻辑从 `frontend/src/App.jsx` 中拆出去。
- [x] 把导入导出相关的操作处理函数从 `frontend/src/App.jsx` 中拆出去。
- [x] 继续把弹窗控制和实体管理相关的处理函数从 `frontend/src/App.jsx` 中拆出去。

## Priority 3 / 文案与可读性

- [x] Clean remaining historical mojibake when touching related files.
- [x] Normalize user-facing copy across import/export, backup, and DCIM flows.
- [x] Keep frontend and backend terminology aligned for backup and import/export paths.

- [x] 在修改相关文件时，继续清理残留历史乱码。
- [x] 统一导入/导出、备份、DCIM 流程中的用户可见文案。
- [x] 在备份和导入导出路径上保持前后端术语一致。

## Priority 4 / 性能与扩展性

- [x] Improve scalability with pagination for large lists.
- [x] Narrow refresh paths further to avoid unnecessary full-tab reloads.
- [x] Add or expand server-side filtering for large datasets.
- [x] Continue looking for repeated queries in Django views and serializers.

- [x] 为大列表场景补充分页能力。
- [x] 继续缩小刷新范围，避免不必要的整页级全量刷新。
- [x] 为大数据量场景增加或完善服务端筛选。
- [x] 继续检查 Django views 和 serializers 里的重复查询问题。

## Priority 5 / 权限与审计

- [x] Tighten permission enforcement for high-risk operations.
- [x] Expand audit coverage for bulk import overwrite flows and subnet scan results.
- [ ] Add restore-specific audit coverage when a restore endpoint is introduced.
- Blocked: no restore endpoint exists in the current backend yet, so restore-specific audit work cannot be implemented safely.

- [x] 收紧高风险操作的权限控制。
- [x] 为批量导入覆盖流程和网段扫描结果补强审计记录。
- [ ] 在未来引入恢复接口时补充恢复专用审计。
- Blocked: 当前后端还没有恢复接口，因此暂时无法安全实现恢复专用审计。

## Priority 6 / 发布与运维

- [x] Extend import preview and error reporting from IPAM to DCIM import.
- [x] Extend import preview and error reporting from IPAM to resident staff import.
- [x] Surface build/version state on dashboard or settings, not only in the top bar modal.
- [x] Add an operator-facing deployment checklist view or settings panel.
- [x] Continue cleaning source-level historical mojibake comments when touching old files.

- [x] 把导入预览和错误报告从 IPAM 扩展到 DCIM 导入流程。
- [x] 把导入预览和错误报告从 IPAM 扩展到驻场人员导入流程。
- [x] 除顶栏弹层外，在总览页或设置页继续展示构建版本和部署状态。
- [x] 为运维人员增加部署检查页或设置面板。
- [x] 在后续修改旧文件时，继续清理源码里的历史乱码注释。

## Priority 7 / 下一阶段优化

- [x] Surface backend version and commit in the shared shell, not only inside the status modal.
- [x] Finish a full frontend copy sweep for remaining business pages and shell edge cases.
- [x] Add downloadable failed-row reports for IPAM, DCIM, and resident import previews.
- [x] Prepare the first production-safe encoding cleanup batch with a sampling checklist.

- [x] 在共享壳层中继续展示后端版本和提交号，不只放在状态弹层里。
- [x] 对剩余业务页面和壳层边角文案做一轮完整收口。
- [x] 为 IPAM、DCIM、驻场导入预览补充失败行报告下载。
- [x] 为首批生产环境乱码清洗准备抽样核对清单和执行批次。

## Priority 8 / 中期能力扩展

- [ ] Continue moving page-specific orchestration out of `frontend/src/App.jsx`.
- [x] Extract IPAM page state, filters, and scan actions from `frontend/src/App.jsx` into a dedicated hook.
- [x] Extract DCIM page state and rack/device orchestration from `frontend/src/App.jsx` into a dedicated hook.
- [ ] Extract shared page routing or active-tab rendering branches from `frontend/src/App.jsx`.
- [ ] Design a global search MVP covering IP, device, rack, resident, and project entities.
- [ ] Design an alert-center MVP around backup, security, and data-quality signals.

- [ ] 继续把页面专属编排逻辑从 `frontend/src/App.jsx` 中迁出。
- [x] 把 IPAM 页状态、筛选逻辑和扫描动作从 `frontend/src/App.jsx` 拆到独立 hook。
- [x] 把 DCIM 页状态和机柜/设备编排逻辑从 `frontend/src/App.jsx` 拆到独立 hook。
- [ ] 把公共页面路由或 `activeTab` 渲染分支从 `frontend/src/App.jsx` 中继续迁出。
- [ ] 设计覆盖 IP、设备、机柜、驻场和项目实体的全局搜索 MVP。
- [ ] 围绕备份、安全和数据质量信号设计告警中心 MVP。
