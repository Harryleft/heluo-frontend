# OpenClaw Skill 部署指南

本目录包含河洛知识图谱的 OpenClaw Skill 文件，用于将项目接入 OpenClaw AI 助手。

## 文件结构

```
heluo-knowledge/
├── SKILL.md        # 核心技能描述文件（必需）
└── skill.json      # 元数据文件（可选）
```

## 安装步骤

### 1. 确保后端服务运行

```bash
# 在项目根目录下启动后端服务
node server/src/index.js

# 确认服务运行在 http://localhost:9011
```

### 2. 复制 Skill 到 OpenClaw

```bash
# WSL 环境中 OpenClaw 的 Skills 目录通常在
# ~/.claw/skills/

# 复制整个文件夹
cp -r docs/openclaw/heluo-knowledge ~/.claw/skills/
```

### 3. 重启 OpenClaw

重启 OpenClaw 以加载新技能：

```bash
# 根据你的 OpenClaw 启动方式
# 例如：
cd ~/OpenClaw
npm run dev
# 或
pm2 restart openclaw
```

### 4. 验证安装

在 OpenClaw 中尝试以下对话：

```
用户: 搜索河洛中的李白
用户: 帮我查一下杜甫的详细信息
用户: 查询《诗经》相关的古籍
```

## WSL 网络配置

如果 OpenClaw 运行在 WSL2 中，需要确保能访问 Windows 宿主机的后端服务：

### 推荐：使用 localhost 转发

WSL2 支持 localhost 自动转发功能，只需配置 `.wslconfig`：

```powershell
# 运行配置脚本（以管理员身份）
.\setup-wsl-network.ps1

# 选择选项 1 (localhost 转发)
```

手动配置方法：

1. 创建或编辑 `%USERPROFILE%\.wslconfig`：
   ```ini
   [wsl2]
   localhostForwarding=true
   ```

2. 重启 WSL：
   ```powershell
   wsl --shutdown
   ```

3. 重新打开 WSL，localhost:9011 将自动转发到 Windows 宿主机

### 备选：使用宿主机 IP

如果 localhost 转发不工作，可以使用宿主机 IP：

```bash
# 在 WSL 中获取宿主机 IP
cat /etc/resolv.conf | grep nameserver | awk '{print $2}'

# 更新 SKILL.md 中的 baseUrl
# http://localhost:9011 -> http://172.x.x.x:9011
```

## API 端点说明

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/search` | GET | 统一搜索 |
| `/api/v1/persons/:id` | GET | 人物详情 |
| `/api/v1/poems/:id` | GET | 诗文详情 |
| `/api/v1/books/:id` | GET | 图书详情 |
| `/api/v1/places/:id` | GET | 地点详情 |
| `/api/v1/concepts/:id` | GET | 概念详情 |
| `/api/v1/ancient-books/:id` | GET | 古籍详情 |
| `/api/v1/fusion/query` | POST | 融合问答 |
| `/api/v1/fusion/stream` | POST | 融合问答（流式） |
| `/api/v1/persons/ai-intro` | POST | 人物 AI 介绍 |
| `/api/v1/health` | GET | 健康检查 |

## 自定义修改

### 修改 API 地址

编辑 `SKILL.md` 中的基础地址，将：
```
http://localhost:9011
```
修改为：
```
http://你的服务器地址:端口
```

### 添加新的触发词

在 `SKILL.md` 的 `## 触发词` 部分添加新的关键词。

### 扩展 API

如果有新的 API 端点，在 `SKILL.md` 和 `skill.json` 中添加相应描述。

## 故障排除

### 问题：OpenClaw 无法连接后端

1. 确认后端服务正在运行
2. 检查端口是否被占用
3. 验证网络连通性（WSL2 需要特殊配置）

### 问题：搜索无结果

1. 确认数据库/MarkLogic 服务正常运行
2. 检查 API 返回的错误信息

### 问题：融合问答不工作

1. 确认 LLM 服务已配置
2. 检查 `.env` 中的 LLM 配置
