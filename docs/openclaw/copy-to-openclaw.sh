#!/bin/bash
# 复制 Skill 到 OpenClaw（在 WSL 中运行）

set -e

echo "========================================"
echo "  复制河洛知识图谱 Skill 到 OpenClaw"
echo "========================================"

# 定义路径
SKILL_SRC="/mnt/s/vibe_coding/heluo-frontend/docs/openclaw/heluo-knowledge"
SKILL_DEST="$HOME/.claw/skills/heluo-knowledge"

# 检查源目录
if [ ! -d "$SKILL_SRC" ]; then
    echo "[错误] 源目录不存在: $SKILL_SRC"
    echo "请确保项目已挂载到 /mnt/s/"
    exit 1
fi

# 创建目标目录
mkdir -p "$HOME/.claw/skills"

# 复制文件
echo "[1/2] 复制 Skill 文件..."
cp -r "$SKILL_SRC" "$HOME/.claw/skills/"
echo "  已复制到: $SKILL_DEST"

# 验证文件
echo ""
echo "[2/2] 验证文件..."
if [ -f "$SKILL_DEST/SKILL.md" ]; then
    echo "  SKILL.md: OK"
else
    echo "  SKILL.md: 缺失"
    exit 1
fi

if [ -f "$SKILL_DEST/skill.json" ]; then
    echo "  skill.json: OK"
else
    echo "  skill.json: 缺失"
fi

# 测试网络连通性
echo ""
echo "========================================"
echo "  测试网络连通性"
echo "========================================"

# 获取 Windows 宿主机 IP
HOST_IP=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}')
echo "Windows 宿主机 IP: $HOST_IP"

echo ""
echo "测试后端 API 连接..."
if curl -s --connect-timeout 3 "http://${HOST_IP}:9011/api/v1/health" > /dev/null 2>&1; then
    echo "  [成功] 后端服务可达"
else
    echo "  [警告] 后端服务不可达，请检查:"
    echo "    1. 后端服务是否已启动 (node server/src/index.js)"
    echo "    2. Windows 防火墙是否允许 9011 端口"
    echo "    3. 运行 setup-wsl-network.ps1 配置网络"
fi

echo ""
echo "========================================"
echo "  安装完成！"
echo "========================================"
echo ""
echo "下一步操作："
echo "1. 重启 OpenClaw 加载新技能"
echo "2. 在 OpenClaw 中测试："
echo "   '搜索河洛中的李白'"
echo "   '帮我查一下杜甫的详细信息'"
