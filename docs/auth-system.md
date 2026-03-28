# 认证系统设计与配置

Curation App 使用 [Authing](https://console.authing.cn) 作为 OIDC 身份提供者，配合自建邀请码机制控制注册入口。

---

## 整体架构

```
用户浏览器 / Tauri 窗口
     │
     │  ① 未登录 → 显示 LoginScreen
     │  ② 点击"注册"→ 输入邀请码 → 后端验证
     │  ③ 通过验证 → 跳转 Authing 注册页
     │  ④ Authing 注册完成 → 回调到 App
     │  ⑤ App 用 id_token 换取本地用户记录
     ▼
FastAPI 后端（8889端口）
     │
     ├─ /auth/*        无需 token（登录/注册入口）
     ├─ /invites/*     需要 admin token
     ├─ /users/*       需要 admin token
     └─ 其他所有路由   需要有效 Bearer token（AuthMiddleware 拦截）
```

**关键设计原则：**
- Authing 只负责"这个人是谁"（身份验证），App 自己管理"这个人有没有注册过"（访问控制）
- JWT 在后端通过 Authing 的 JWKS 端点验证签名，不依赖 Authing SDK，无需网络往返即可本地验证
- 邀请码通过 HMAC 短期 token 绑定到 Authing 注册流程，防止绕过

---

## 一、在 Authing 控制台创建应用

1. 登录 [Authing 控制台](https://console.authing.cn)
2. 进入「应用」→「自建应用」→「创建应用」
3. 应用类型选 **单页 Web 应用（SPA）**
4. 记录以下信息（后面要填入 `.env`）：
   - **App ID**（在「应用配置」页最上方）
   - **认证域名**（格式为 `your-app.authing.cn`，不带 `https://`）

### 1.1 配置回调 URL

在「应用配置」→「登录回调 URL」填入：

```
tauri://localhost/auth/callback
http://localhost:1420/auth/callback
```

两个都要填，前者用于打包后的 Tauri 桌面端，后者用于本地开发调试。

「登出回调 URL」填入：

```
tauri://localhost
http://localhost:1420
```

### 1.2 关闭自助注册

**这一步很重要。** 在「应用配置」→「登录控制」中：
- 关闭「允许用户自助注册」

这样只有通过邀请码流程的用户才能完成注册。在 Authing 侧已注册的账号，如果没有在本 App 中完成邀请码绑定，后端同样会拒绝（`/auth/login` 会返回 401）。

### 1.3 Token 设置

在「应用配置」→「其他配置」中确认：
- **ID Token 有效期**：建议 3600 秒（1 小时）
- **签名算法**：RS256（默认即可，不要改成 HS256）

---

## 二、配置环境变量

### 后端（`server/.env`）

```bash
# 现有变量（保留）
CURATION_DATA_DIR=/path/to/curation-data
CURATION_AGENT_REPO=/path/to/curation-agent
DAJIALA_API_KEY=your_api_key

# Authing
AUTHING_APP_ID=你的AppID
AUTHING_ISSUER=https://your-app.authing.cn/oidc
AUTHING_JWKS_URI=https://your-app.authing.cn/oidc/.well-known/jwks.json

# 管理员初始化注入（数据库初始化时自动写入）
ADMIN_AUTHING_SUB=69c6267c2e8369d9bd4d037d
ADMIN_EMAIL=admin@example.com
ADMIN_USERNAME=Admin

# 安全密钥（生成命令见下）
INVITE_SECRET=至少32位随机字符串
```

生成随机密钥：

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**INVITE_SECRET** 用于签名邀请码校验 token（防止用户篡改或重放），一旦设置不要更改，否则已发出的邀请链接会失效。
`ADMIN_AUTHING_SUB` 用于在数据库初始化时注入管理员账号；重复启动会幂等修正该账号为 `admin` 且 `is_active=1`。

### 前端（`curation-app/.env`）

在项目根目录（和 `package.json` 同级）创建 `.env` 文件：

```bash
VITE_AUTHING_APP_ID=你的AppID
VITE_AUTHING_DOMAIN=your-app.authing.cn
VITE_AUTHING_REDIRECT_URI=tauri://localhost/auth/callback
```

本地开发时创建 `.env.development.local`（会覆盖 `.env` 中同名变量）：

```bash
VITE_AUTHING_REDIRECT_URI=http://localhost:1420/auth/callback
```

> **注意**：`VITE_AUTHING_DOMAIN` 只填域名部分，不带 `https://`。
> 例如 Authing 给你的地址是 `https://myapp.authing.cn`，这里只填 `myapp.authing.cn`。

---

## 三、首次部署：引导第一个管理员

系统初始没有任何用户，管理员通过数据库初始化自动注入创建。

**步骤：**

1. 先在 Authing 注册一个账号，获取其用户 ID（`sub`）
2. 在 `server/.env` 设置：
   ```bash
   ADMIN_AUTHING_SUB=69c6267c2e8369d9bd4d037d
   # 可选：
   # ADMIN_EMAIL=admin@example.com
   # ADMIN_USERNAME=Admin
   ```
3. 启动后端，数据库初始化阶段会自动创建/修复管理员账号
4. 管理员完成登录后进入管理面板，生成邀请码分发给其他用户

---

## 四、邀请码使用流程

管理员登录后，进入「管理员模式 → 邀请码」面板：

1. 点击「生成邀请码」，选择数量（最多一次 20 个）
2. 可设置过期天数（不填则永不过期）
3. 将生成的码（格式如 `A1B2-C3D4-E5F6`）分发给受邀用户

受邀用户的注册流程：

```
打开 App → 点「注册」→ 输入邀请码 → 点「验证邀请码」
  → 验证通过 → 点「前往注册」→ 跳转 Authing 注册页面
  → 填写邮箱密码完成注册 → 自动回到 App
  → 邀请码标记为已使用，用户记录创建完毕
```

每个邀请码只能使用一次。管理员可以在面板中查看所有码的使用状态，并撤销尚未使用的码。

---

## 五、后端认证机制详解

### JWT 验证流程

每个受保护的 API 请求都会经过 `AuthMiddleware`：

```
请求到达 → 读取 Authorization: Bearer <token>
  → 解码 token header，取 kid
  → 从 AUTHING_JWKS_URI 拉取公钥（内存缓存1小时）
  → 用 RS256 公钥验证签名
  → 验证 exp（过期时间）
  → 从 sub claim 查 app_users 表
  → 注入 request.state.user，交给路由处理
```

**排除不需要验证的路由：**

| 路径 | 原因 |
|------|------|
| `/auth/*` | 登录/注册端点本身 |
| `/health` | 监控探针 |
| WebSocket 升级请求 | 通过 query param `?token=` 单独验证 |
| OPTIONS 请求 | CORS preflight |

### HMAC 邀请验证 Token

邀请码验证分两步，中间用一个短期 HMAC token 串联，防止绕过：

```
步骤1: POST /auth/validate-invite { code: "A1B2-C3D4-E5F6" }
  → 后端检查邀请码是否存在且可用
  → 生成: HMAC-SHA256(code:exp_timestamp, INVITE_SECRET)
  → 返回 validation_token（10分钟有效）

步骤2: 前端把 validation_token 存在内存中，发起 Authing 注册
  → 注册完成后用 id_token + validation_token 调用 /auth/register
  → 后端同时验证 JWT 签名 + HMAC token
  → 两者都通过才创建用户，标记邀请码已使用
```

这样做的好处：
- 不在 Authing 的 state 参数里明文传邀请码（防止日志泄露）
- 即使 validation_token 被截获，也无法在10分钟后复用
- 后端双重验证，任意一步失败都拒绝注册

---

## 六、数据库表说明

### `app_users`

存储在本 App 注册的用户。与 Authing 账号通过 `authing_sub`（OIDC sub claim，全局唯一稳定标识符）关联。

| 字段 | 说明 |
|------|------|
| `authing_sub` | Authing 分配的用户唯一 ID，格式如 `63f...` |
| `role` | `user`（普通用户）或 `admin`（管理员） |
| `is_active` | 管理员可以禁用某用户（禁用后该用户 token 验证失败）|
| `last_login` | 每次登录时更新 |

### `invite_codes`

| 字段 | 说明 |
|------|------|
| `code` | 格式 `XXXX-XXXX-XXXX`，使用 `secrets.token_hex` 生成 |
| `is_active` | `1` = 可用；`0` = 已使用或被管理员撤销 |
| `used_by` | 关联 `app_users.id`，记录是谁用了这个码 |
| `expires_at` | 可选过期时间，NULL 表示永不过期 |

### `app_config`

全局开关 key-value 表（预留给系统配置项）。

---

## 七、API 速查

### 无需认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/validate-invite` | 验证邀请码，返回 validation_token |
| POST | `/auth/register` | 注册（需 id_token + validation_token） |
| POST | `/auth/login` | 登录（需 id_token） |
| GET  | `/health` | 健康检查 |

### 需要 Bearer token

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/auth/me` | 获取当前用户信息 |

### 需要 admin token

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/invites` | 列出所有邀请码 |
| POST | `/invites` | 生成邀请码，body: `{ count, expires_in_days? }` |
| DELETE | `/invites/{code}` | 撤销邀请码 |
| GET | `/users` | 列出所有用户 |
| PATCH | `/users/{user_id}` | 修改角色或启用/禁用，body: `{ role?, is_active? }` |

---

## 八、常见问题

**Q: 用户 token 过期后会怎样？**
前端的 `apiFetch` 检测到 401 响应后，会派发 `auth:expired` 事件，`authStore` 监听后清除 session 并切换回登录界面。id_token 默认有效期 1 小时。

**Q: 可以同时有多个管理员吗？**
可以。通过「用户管理」面板把普通用户的 role 改为 `admin` 即可。

**Q: 怎么知道 JWKS 缓存是否正常？**
JWKS 在第一次请求时拉取，之后缓存 1 小时。如果 Authing 轮换了密钥（罕见），服务重启会强制刷新。可以在后端日志中看到 JWKS 请求记录。

**Q: 本地开发不想每次都走 Authing 怎么办？**
可以临时在 `auth.py` 的 `verify_authing_token` 里加一个 mock 分支（检查特殊前缀的 token 直接返回假 claims），但不要提交到 git。

**Q: INVITE_SECRET 丢失了怎么办？**
修改 INVITE_SECRET 后，所有已发出但尚未使用的 validation_token（10分钟有效）会立即失效，但已生成的邀请码本身（存在 DB 里的）不受影响，用户重新走验证流程即可。
