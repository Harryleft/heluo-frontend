# WSL 网络配置脚本
# 需要以管理员身份运行

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  河洛知识图谱 - WSL 网络配置" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[错误] 请以管理员身份运行此脚本！" -ForegroundColor Red
    Write-Host "右键点击此脚本 -> 以管理员身份运行" -ForegroundColor Yellow
    pause
    exit 1
}

# 获取 WSL 网络信息
Write-Host ""
Write-Host "[1/5] 获取 WSL 网络信息..." -ForegroundColor Yellow

$wslAdapter = Get-NetIPAddress -InterfaceAlias "*WSL*" -AddressFamily IPv4 | Select-Object -First 1
$wslHostIp = $wslAdapter.IPAddress

if (-not $wslHostIp) {
    Write-Host "[错误] 未找到 WSL 网络适配器，请确保 WSL 已安装并运行过" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "  Windows 宿主机 IP: $wslHostIp" -ForegroundColor Green

# 选择模式
Write-Host ""
Write-Host "请选择网络模式：" -ForegroundColor Yellow
Write-Host "  [1] 使用 localhost (WSL2 自动转发，推荐)" -ForegroundColor White
Write-Host "  [2] 使用宿主机 IP ($wslHostIp)" -ForegroundColor White
Write-Host ""
Write-Host "请输入选项 (1/2): " -NoNewline -ForegroundColor Yellow
$choice = Read-Host

$useLocalhost = ($choice -eq "1")

# 配置防火墙规则
Write-Host ""
Write-Host "[2/5] 配置防火墙规则..." -ForegroundColor Yellow

$ruleName = "WSL-Heluo-Backend-9011"
$existingRule = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "  防火墙规则已存在，跳过创建" -ForegroundColor Yellow
} else {
    $null = New-NetFirewallRule -Name $ruleName -DisplayName "WSL - Heluo Backend (9011)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 9011 -Profile Any -Description "允许 WSL 访问河洛知识图谱后端服务"
    Write-Host "  防火墙规则创建成功" -ForegroundColor Green
}

# 配置 .wslconfig (localhost 模式)
if ($useLocalhost) {
    Write-Host ""
    Write-Host "[3/5] 配置 WSL localhost 转发..." -ForegroundColor Yellow

    $wslConfigPath = "$env:USERPROFILE\.wslconfig"
    $configLines = "[wsl2]", "localhostForwarding=true"

    if (Test-Path $wslConfigPath) {
        $existingContent = Get-Content $wslConfigPath -Raw
        if ($existingContent -match "localhostForwarding") {
            Write-Host "  .wslconfig 已配置 localhostForwarding" -ForegroundColor Green
        } else {
            Add-Content -Path $wslConfigPath -Value ""
            Add-Content -Path $wslConfigPath -Value $configLines
            Write-Host "  已添加 localhostForwarding 配置" -ForegroundColor Green
            Write-Host "  需要重启 WSL 生效: wsl --shutdown" -ForegroundColor Yellow
        }
    } else {
        Set-Content -Path $wslConfigPath -Value $configLines
        Write-Host "  已创建 .wslconfig 并配置 localhostForwarding" -ForegroundColor Green
        Write-Host "  需要重启 WSL 生效: wsl --shutdown" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "[3/5] 跳过 localhost 转发配置 (使用宿主机 IP 模式)" -ForegroundColor Yellow
}

# 验证端口监听
Write-Host ""
Write-Host "[4/5] 检查后端服务..." -ForegroundColor Yellow

$port9011 = Get-NetTCPConnection -LocalPort 9011 -ErrorAction SilentlyContinue
if ($port9011) {
    Write-Host "  端口 9011 已有服务监听" -ForegroundColor Green
} else {
    Write-Host "  端口 9011 未监听，请确保后端服务已启动" -ForegroundColor Yellow
    Write-Host "  启动命令: node server/src/index.js" -ForegroundColor Gray
}

# 确定最终访问地址
if ($useLocalhost) {
    $accessUrl = "http://localhost:9011"
} else {
    $accessUrl = "http://" + $wslHostIp + ":9011"
}

# 网络配置摘要
Write-Host ""
Write-Host "[5/5] 网络配置摘要" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "  Windows 宿主机 IP: $wslHostIp" -ForegroundColor White
Write-Host "  后端服务端口: 9011" -ForegroundColor White
Write-Host "  WSL 访问地址: $accessUrl" -ForegroundColor Cyan
if ($useLocalhost) {
    Write-Host "  模式: localhost 转发" -ForegroundColor White
} else {
    Write-Host "  模式: 宿主机 IP 直连" -ForegroundColor White
}
Write-Host "----------------------------------------" -ForegroundColor Gray

# 更新 SKILL.md 中的地址
Write-Host ""
Write-Host "是否更新 SKILL.md 中的 API 地址为 $accessUrl ? (Y/N): " -NoNewline -ForegroundColor Yellow
$response = Read-Host

if ($response -eq "Y" -or $response -eq "y") {
    $skillFile = Join-Path $PSScriptRoot "heluo-knowledge\SKILL.md"
    $skillJson = Join-Path $PSScriptRoot "heluo-knowledge\skill.json"

    if (Test-Path $skillFile) {
        $content = Get-Content $skillFile -Raw
        $content = $content -replace "http://[\w\d.-]+:9011", $accessUrl
        Set-Content $skillFile $content -NoNewline
        Write-Host "  SKILL.md 已更新" -ForegroundColor Green
    }

    if (Test-Path $skillJson) {
        $content = Get-Content $skillJson -Raw
        $pattern = [regex]::Escape('"baseUrl": "') + "http://[\w\d.-]+:9011" + [regex]::Escape('"')
        $replacement = '"baseUrl": "' + $accessUrl + '"'
        $content = $content -replace $pattern, $replacement
        Set-Content $skillJson $content -NoNewline
        Write-Host "  skill.json 已更新" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  配置完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "下一步操作：" -ForegroundColor Yellow
Write-Host "1. 启动后端服务: node server/src/index.js" -ForegroundColor White
if ($useLocalhost) {
    Write-Host "2. 重启 WSL 使配置生效: wsl --shutdown (然后重新打开 WSL)" -ForegroundColor White
    Write-Host "3. 复制 Skill 到 OpenClaw:" -ForegroundColor White
} else {
    Write-Host "2. 复制 Skill 到 OpenClaw:" -ForegroundColor White
}
Write-Host "   cp -r /mnt/s/vibe_coding/heluo-frontend/docs/openclaw/heluo-knowledge ~/.claw/skills/" -ForegroundColor Gray
Write-Host "4. 重启 OpenClaw" -ForegroundColor White

pause
