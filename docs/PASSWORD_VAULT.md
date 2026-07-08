# 密码本 / OpenBao 部署说明

IPAM 的密码本采用“台账与密文分离”设计：

- MySQL 只保存名称、关联资产、责任团队、到期时间、审批和审计。
- 密码、密钥等敏感值只写入 OpenBao KV v2。
- 普通列表、导出、审计日志均不返回密文。
- 查看密码需要再次验证当前登录密码；机房运维和 IP 管理员还需要管理员审批。
- 每次查看只在前端内存中保留 30 秒，HTTP 响应带 `no-store`。

## 首次初始化

先复制并填写环境变量：

```bash
cp .env.example .env
docker compose up -d db openbao
docker compose exec openbao bao operator init
```

请把初始化输出的 unseal keys 和初始 root token 存放到系统外的安全位置，不要提交到 Git。

执行至少三次解封（具体次数以初始化输出为准）：

```bash
docker compose exec openbao bao operator unseal
```

使用初始 root token 登录并启用 KV v2：

```bash
docker compose exec openbao bao login
docker compose exec openbao bao secrets enable -path=secret kv-v2
```

创建最小权限策略：

```bash
docker compose exec -T openbao bao policy write ipam-password-vault - <<'EOF'
path "secret/data/ipam/*" {
  capabilities = ["create", "read", "update"]
}
path "secret/metadata/ipam/*" {
  capabilities = ["read", "delete"]
}
EOF
docker compose exec openbao bao token create -policy=ipam-password-vault -period=24h
```

把生成的应用 token 写入 `.env`：

```dotenv
OPENBAO_ENABLED=True
OPENBAO_TOKEN=实际生成的应用令牌
```

然后启动全部服务：

```bash
docker compose up -d --build
docker compose ps
```

## 运行维护

OpenBao 重启后默认处于 sealed 状态，需要按组织的密钥保管流程解封。生产环境建议后续接入自动解封（KMS/HSM），并由运维平台定期续租或轮换应用 token。

不要把 OpenBao 的 8200 端口映射到公网。本项目默认只允许 `backend` 通过内部 Docker 网络访问。
