# UI Redesign Proposal

## Goal / 目标

This redesign upgrades the product from a generic IP ledger tool into a recognizable infrastructure operations platform.

本次重设计的目标，是把当前系统从“通用 IP 台账工具”升级成“有明确品牌识别的基础设施运营平台”。

## Product Positioning / 产品定位

- Chinese name: `星图基础设施运营平台`
- English name: `AtlasOps`
- Short name: `星图运维`
- Tagline: `IPAM · DCIM · Security · Resident Ops`

The product should feel like a control plane for daily infrastructure work, not a static record-keeping application.

系统整体气质应当更接近“基础设施控制台 / 运维驾驶舱”，而不是单纯的静态台账页面。

## Brand Direction / 品牌方向

- Core metaphor: a star map that brings addresses, assets, rooms, and operations onto one navigable surface.
- Tone: professional, resilient, calm, and operationally trustworthy.
- Visual character: deep ocean blue base, cyan signal highlights, amber for attention, emerald for healthy status.
- Interface mood: light-mode control center with layered glass panels and high-clarity status hierarchy.

## Naming System / 命名系统

### Platform

- `星图基础设施运营平台 / AtlasOps`

### Navigation

- `总览态势`
- `网络地址`
- `机房设备`
- `驻场运营`
- `安全审计`
- `备份恢复`
- `平台管理`

These names are shorter, more productized, and better aligned with actual operational tasks.

这些名称比“IP 资产台账 / 机房基础设施 / 系统用户管理”更产品化，也更符合真实运维工作流。

## Information Architecture / 信息架构

### Global layout

- Left sidebar: product identity, navigation, operator context, quick-entry cards
- Top header: current workspace, page title, environment/status chips, personal actions
- Main content: one primary workspace per module, with summaries first and destructive actions visually delayed

### Core page model

- Overview pages should answer: what needs attention now?
- List pages should answer: what exists, what changed, what is risky?
- Detail pages should answer: what is related, who owns it, what happened recently?

## Visual System / 视觉系统

### Color tokens

- `Midnight Navy`: platform identity and sidebar base
- `Signal Cyan`: active state, key CTA, live system emphasis
- `Atlas Emerald`: normal / healthy / verified state
- `Control Amber`: pending / needs review / warning
- `Fault Red`: destructive action / failure / critical risk
- `Cloud Slate`: data surfaces, borders, quiet content

### Typography

- Brand and headings: condensed/high-contrast display feeling
- Data and UI text: neutral sans for readability
- Monospace only for IPs, timestamps, IDs, file names, and machine output

### Surface language

- Use layered panels instead of flat white rectangles
- Keep shadows soft but directional
- Use status chips with stronger semantic contrast
- Keep forms bright and readable; keep navigation darker and more structural

## Component Direction / 组件方向

### Login page

- Split into hero + auth panel on desktop
- Hero communicates platform scope, capability, and trust
- Auth panel remains compact and easy to scan

### Sidebar

- Brand-led layout, stronger identity than generic nav list
- Active navigation should feel like mode switching, not simple highlighting
- Include operator context and one operational callout card

### Header

- Show workspace and current module clearly
- Show platform chips such as security posture / audit availability
- Personal actions should be secondary, not competing with page title

### Dashboard

- Lead with “what needs attention now”
- Keep operational KPIs, but pair them with urgency and actionability
- Recent activity should read as operational timeline, not just logs

## Interaction Principles / 交互原则

- Important actions should be visually separated from browsing actions
- Risk operations should always be delayed by confirmation and audit context
- Filters should feel fast and local, but large searches should be server-side
- Empty states should explain what users can do next

## What Still Needs Redesign / 仍建议继续重设计的部分

- `DashboardView`
  Current metrics are useful, but the page still lacks a strong “today's priorities” layer.

- `IpamView`
  It should evolve toward a three-pane model: subnet tree, asset list, detail drawer.

- `DcimView`
  It already has strong domain value, but information density and hierarchy can be improved further.

- `SecurityCenterView`
  It should move closer to a timeline + risk board model, not mostly tables.

- `BackupView`
  It should emphasize health state, retention, and recovery confidence before file operations.

- Unified copy system
  Terminology, button language, and status wording still need full-project normalization.

- Global search and command entry
  Long-term, the platform should expose one search box for IPs, devices, racks, users, and audit records.

## System Optimization Beyond UI / 除了 UI 之外仍建议优化的系统部分

- Global search
- Alert center
- Scheduled jobs
- Change history and rollback
- Better restore workflow
- Saved filters and high-volume paging patterns
- More granular permission matrix
- Cross-module relation views

## Rollout Suggestion / 落地顺序建议

1. Rebrand shared shell: login, sidebar, topbar, titles, product copy
2. Refresh overview page structure
3. Redesign IPAM and DCIM workspaces
4. Unify empty states, modals, tables, forms, and notifications
5. Add search, alerts, and action-center patterns
