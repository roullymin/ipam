# 机房设备变更申请中心设计 / Datacenter Change Request Center Design

## 设计目标 / Design Goal

这份设计不再把需求限制为“机房设备搬出申请表”，而是统一升级成一个可长期扩展的模块：
**机房设备变更申请中心**。

This design no longer treats the requirement as only a “datacenter equipment removal form”.  
Instead, it upgrades the concept into a long-term extensible module:
**Datacenter Change Request Center**.

这样后续的上架、下架、搬入、搬出、迁移、退役都可以放进同一套模型、流程和页面里。

This allows rack-in, rack-out, move-in, move-out, relocation, and decommission flows to share one model, one workflow, and one UI pattern.

## 为什么要统一设计 / Why This Should Be Unified

如果只做“搬出申请”，很快还会继续冒出这些需求：

If we build only a “removal request”, the system will soon need more related flows:

- 上架申请
- 下架申请
- 设备搬入申请
- 设备迁移申请
- 设备退役申请

- Rack-in requests
- Rack-out requests
- Device move-in requests
- Device relocation requests
- Device decommission requests

这些流程本质上都属于“设备变更申请”，如果拆成多套独立表单，会造成：

These are all device change workflows. If implemented as isolated forms, they will create:

- 数据结构重复
- 审批逻辑重复
- 审计逻辑重复
- PDF 模板重复
- 后续维护复杂度上升

- Duplicate data structures
- Duplicate approval logic
- Duplicate audit logic
- Duplicate PDF templates
- Higher maintenance cost

## 模块定位 / Module Positioning

建议模块中文名：
**机房设备变更申请中心**

Recommended Chinese module name:
**机房设备变更申请中心**

建议英文名：
**Datacenter Change Requests**

Recommended English name:
**Datacenter Change Requests**

## 覆盖的申请类型 / Covered Request Types

建议在一张申请主表上用 `request_type` 区分：

Use a single request header with `request_type` to distinguish change scenarios:

- `rack_in`：设备上架
- `rack_out`：设备下架
- `move_in`：设备搬入
- `move_out`：设备搬出
- `relocate`：机柜迁移
- `decommission`：设备退役
- `power_change`：加电 / 下电变更

- `rack_in`: rack-in
- `rack_out`: rack-out
- `move_in`: move-in
- `move_out`: move-out
- `relocate`: relocation
- `decommission`: decommission
- `power_change`: power change

## 对原始搬出表单的继承 / What We Keep From The Original Removal Form

从 [机房设备搬出申请表.docx](c:/Users/roull/Desktop/机房设备搬出申请表.docx) 中抽取出来的核心信息仍然保留，只是放进统一模型中：

The key information from [机房设备搬出申请表.docx](c:/Users/roull/Desktop/机房设备搬出申请表.docx) is still preserved, but placed into the unified model:

- 申请人信息
- 联系方式和邮箱
- 申请单位
- 设备清单
- 是否上架
- 是否加电
- 下电影响信息
- 审批意见
- 审批编号

- Applicant information
- Contact phone and email
- Applicant organization
- Device list
- Whether the equipment is rack-mounted
- Whether the equipment is powered on
- Power-down impact details
- Approval opinions
- Approval code

## 关键新增设计 / Key New Design Decisions

### 1. 一单一链接 / One Request, One Link

这一点是必须的，不建议所有申请人共用一个固定公开链接。

This is mandatory. Different requests should not share one public link.

正确做法是：

The correct design is:

- 每创建一张申请单，系统生成一个独立访问链接
- 链接和这张申请单一一对应
- 链接中带 `request_code` 和安全 `token`
- 链接可设置有效期和状态

- Each created request gets its own unique access link
- The link maps to exactly one request
- The link includes `request_code` and a secure `token`
- The link can have expiration and status rules

示例：

Example:

`/datacenter-change-intake/CR20260401A001?token=xxxxx`

适合的流程是：

The recommended flow is:

1. 管理员先在系统里创建申请骨架
2. 系统生成专属链接
3. 将链接发给申请人补充信息
4. 申请人提交后进入审批流

1. Admin creates the request shell first
2. System generates a dedicated link
3. The link is sent to the applicant for completion
4. After submission, the request enters approval flow

### 2. IP 不是申请人手填结果，而是“网络需求” / IP Is A Requirement, Not A Free-Typed Final Result

你提的这个点非常关键。

This point is extremely important.

申请人不应该随便填写具体 IP 地址。  
更合理的是，申请人填写：

Applicants should not freely type final IP addresses.  
Instead, they should submit:

- 设备位置需求
- 网络用途
- 需要几个 IP
- 需要管理 IP、业务 IP，还是两者都要
- 是否要求固定 IP
- 是否需要保留原 IP

- Intended device location
- Network purpose
- How many IPs are needed
- Whether they need management IP, service IP, or both
- Whether a static IP is required
- Whether the current IP should be retained

然后由系统或管理员在审批 / 执行阶段完成：

Then the system or admin completes the actual assignment during approval/execution:

- 推荐可用网段
- 分配可用 IP
- 回填最终管理 IP / 业务 IP
- 必要时释放旧 IP

- Recommend an available subnet
- Allocate available IPs
- Fill back the final management/service IPs
- Release old IPs when needed

### 3. 和 DCIM / IPAM 真联动 / Real DCIM and IPAM Integration

这个模块的核心价值不该只是电子表单，而是联动现有资产系统：

The core value of the module should not be just digitizing a form, but integrating with existing asset systems:

- 从 DCIM 选择现有设备
- 从机柜位置发起变更申请
- 审批通过后更新设备状态
- 根据机房、机柜、用途去触发 IP 分配

- Pick existing devices from DCIM
- Initiate a request from a rack position
- Update device state after approval
- Trigger IP assignment based on location, rack, and purpose

## 建议的数据结构 / Suggested Data Model

建议拆成三层：

Recommended three-layer model:

### 1. 申请主表 / Request Header

建议模型：
`DatacenterChangeRequest`

Suggested model:
`DatacenterChangeRequest`

建议字段：

Suggested fields:

- `request_code`
- `request_type`
- `approval_code`
- `status`
  - `draft`
  - `pending`
  - `approved`
  - `rejected`
  - `in_progress`
  - `completed`
- `applicant_name`
- `applicant_phone`
- `applicant_email`
- `applicant_department`
- `applicant_company`
- `planned_execute_at`
- `reason`
- `impact_scope`
- `requires_power_down`
- `department_comment`
- `it_comment`
- `facility_manager_name`
- `signed_at`
- `approved_at`
- `public_token`
- `link_expires_at`
- `created_by`
- `reviewed_by`
- `created_at`
- `updated_at`

### 2. 设备变更明细表 / Device Change Item

建议模型：
`DatacenterChangeItem`

Suggested model:
`DatacenterChangeItem`

建议字段：

Suggested fields:

- `request`
- `sequence_no`
- `device_type`
- `device_name`
- `device_model`
- `serial_number`
- `quantity`
- `is_rack_mounted`
- `existing_rack_device`
- `source_datacenter`
- `source_rack`
- `source_u_position`
- `target_datacenter`
- `target_rack`
- `target_u_position`
- `rated_power_watts`
- `power_circuit`
- `remarks`

### 3. 网络需求与分配表 / Network Requirement and Assignment

建议模型：
`DatacenterChangeNetworkRequirement`

Suggested model:
`DatacenterChangeNetworkRequirement`

每台设备最好都能单独挂网络需求，而不是整张申请只挂一个 IP。

Each device should ideally have its own network requirement, instead of one IP section for the whole request.

建议字段：

Suggested fields:

- `change_item`
- `network_role`
  - `management`
  - `service`
  - `both`
- `ip_quantity`
- `requires_static_ip`
- `keep_existing_ip`
- `assigned_management_ip`
- `assigned_service_ip`
- `assigned_subnet`
- `assignment_status`
  - `pending`
  - `allocated`
  - `skipped`
  - `released`
- `network_notes`

### 4. 下电影响项表 / Power-Down Impact Item

建议模型：
`DatacenterChangePowerImpact`

Suggested model:
`DatacenterChangePowerImpact`

建议字段：

Suggested fields:

- `request`
- `sequence_no`
- `device_model`
- `serial_number`
- `power_watts`
- `power_circuit`
- `remarks`

## 页面设计建议 / UI Design Proposal

建议拆成 3 个页面，但共用一套视觉语言和工作流。

Use 3 pages, but keep them under one consistent visual and workflow system.

### 1. 专属申请入口页 / Dedicated Intake Page

建议路径：

Suggested route:

- `/datacenter-change-intake/:requestCode`

页面特点：

Page characteristics:

- 打开时通过 `requestCode + token` 校验访问权限
- 页面自动带出已预填的信息
- 申请人补充设备明细、网络需求、补充说明
- 提交后直接下载 PDF 或打印版

- Use `requestCode + token` to validate access
- Prefill existing context automatically
- Let the applicant complete device details and network requirements
- Allow direct PDF download or print after submission

### 2. 设备变更管理工作台 / Change Request Workbench

建议路径：

Suggested route:

- `/datacenter-change-requests`

页面结构建议：

Suggested layout:

- 顶部概览卡片
  - 总申请数
  - 待审批
  - 今日执行
  - 涉及下电
- 顶部筛选栏
  - 申请类型
  - 申请人
  - 单位
  - SN / 设备名
  - 审批状态
  - IP 分配状态
- 行内展开详情
  - 设备列表
  - 位置变化
  - IP 需求与分配结果
  - 下电影响项
  - 审批意见

- Summary cards
  - Total requests
  - Pending
  - Scheduled today
  - Requests with power-down impacts
- Filter bar
  - Request type
  - Applicant
  - Organization
  - SN / device name
  - Approval status
  - IP assignment status
- Expandable row details
  - Device list
  - Location change
  - Network requirement and assignment results
  - Power-down impacts
  - Approval notes

### 3. PDF 与打印版 / PDF and Print Version

建议保持和驻场申请一致：

Keep the PDF/print workflow aligned with the resident request module:

- 提交后立即导出
- 管理台可重新导出
- 审批后可导出“含审批意见”的版本

- Export right after submission
- Re-export from the management page
- Export an “approved with comments” version

## 不同类型下的字段显示规则 / Field Rules By Request Type

### 上架 / 搬入 / Rack-In and Move-In

重点输入：

Main inputs:

- 目标机房
- 目标机柜
- 目标 U 位
- 设备用途
- 网络需求

IP 处理规则：

IP handling:

- 默认由系统 / 管理员后续分配
- 申请人不直接手填最终 IP

- IPs are assigned later by the system/admin by default
- Applicants do not type final IPs directly

### 下架 / 搬出 / Rack-Out and Move-Out

重点输入：

Main inputs:

- 当前机房
- 当前机柜
- 当前 U 位
- 搬出原因
- 是否需要释放原 IP

### 迁移 / Relocation

重点输入：

Main inputs:

- 源机柜位置
- 目标机柜位置
- 是否保留原 IP
- 是否重新分配 IP

## 审批流建议 / Approval Workflow

建议最小版先做单级审批，但结构预留扩展空间。

The MVP can start with one approval step, but the data structure should be extensible.

建议状态流：

Suggested status flow:

1. `draft`
2. `pending`
3. `approved`
4. `rejected`
5. `in_progress`
6. `completed`

建议动作：

Suggested actions:

- 提交申请
- 审批通过
- 审批驳回
- 分配 IP
- 标记执行中
- 标记完成

- Submit request
- Approve
- Reject
- Assign IPs
- Mark in progress
- Mark completed

## 和现有系统的联动建议 / Integration With Existing Modules

### 1. 和 DCIM 联动 / DCIM Integration

- 从现有 `RackDevice` 搜索和回填设备信息
- 从机柜详情页一键发起上架 / 下架 / 搬出 / 迁移申请
- 审批通过后更新设备状态

- Search and prefill from existing `RackDevice`
- Launch change requests from rack detail pages
- Update device state after approval

### 2. 和 IPAM 联动 / IPAM Integration

- 按网络需求推荐可用网段
- 为设备分配管理 IP / 业务 IP
- 在下架 / 搬出 / 退役时释放旧 IP

- Recommend available subnets based on network requirements
- Allocate management/service IPs
- Release old IPs during rack-out, move-out, or decommission

### 3. 和审计联动 / Audit Integration

建议记录：

Recommended audit events:

- 创建申请
- 生成专属链接
- 编辑申请
- 审批通过 / 驳回
- 分配 IP
- 导出 PDF
- 标记完成

- Request creation
- Dedicated link generation
- Request edit
- Approval / rejection
- IP assignment
- PDF export
- Completion

## 推荐的第一版范围 / Recommended MVP Scope

### MVP 必做 / MVP Must-Haves

- 统一主模型：设备变更申请
- 支持 `rack_in / rack_out / move_in / move_out`
- 一单一链接
- 设备明细
- 网络需求区块
- 审批状态流转
- PDF 导出
- 管理工作台
- 审计记录

- Unified change-request header
- Support `rack_in / rack_out / move_in / move_out`
- One-request-one-link
- Device detail rows
- Network requirement section
- Approval state transitions
- PDF export
- Management workbench
- Audit logging

### 第二阶段再做 / Phase 2

- 设备从 DCIM 自动回填
- 执行阶段自动分配 / 释放 IP
- 机柜页一键发起变更申请
- 更细的审批角色配置
- 迁移、退役、加电变更流程

- Auto-prefill from DCIM
- Automatic IP assignment/release during execution
- One-click request initiation from rack pages
- More granular approval-role configuration
- Relocation, decommission, and power-change flows

## 建议结论 / Recommended Conclusion

这个模块最合理的方向不是“再加一张搬出申请表”，而是：

The right direction is not “add another removal form”, but:

**机房设备变更申请中心**

**Datacenter Change Request Center**

它应该具备这三个核心特征：

It should have these three core characteristics:

1. 上架 / 下架 / 搬入 / 搬出统一建模  
   Unified modeling for rack-in, rack-out, move-in, and move-out

2. IP 作为需求和分配结果，而不是申请人自由填写  
   IP handled as a requirement plus assigned result, not as free text typed by the applicant

3. 每张申请单都有独立链接，不使用共用公开入口  
   Each request has its own dedicated link instead of sharing one public intake entry

## 下一步建议 / Next Step

如果你认可这个方向，下一步最值得做的是二选一：

If you agree with this direction, the best next step is one of these:

1. 继续细化成数据库模型与 API 设计  
   Expand this into database model and API design

2. 直接开始搭第一版前后端骨架  
   Start scaffolding the first frontend and backend implementation

