param(
  [Parameter(Position = 0)]
  [string]$Action = "help",

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Rest
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

function Show-Help {
  Write-Output "可用命令:"
  Write-Output "  check                        运行 lint + typescript 检查"
  Write-Output "  build                        执行项目构建"
  Write-Output "  docs-check                   检查高风险文档漂移"
  Write-Output "  single-file-commit-check     检查当前改动是否满足单文件提交流程"
  Write-Output "  docs-init [name] [--force]   生成 docs 分析模板"
  Write-Output "  server-health [url]          检查后端健康接口"
}

function Invoke-NpmScript {
  param([Parameter(Mandatory = $true)][string]$ScriptName)

  npm run $ScriptName
  if ($LASTEXITCODE -ne 0) {
    throw ("npm run {0} 执行失败" -f $ScriptName)
  }
}

function Invoke-SingleFileCommitCheck {
  $lines = git status --porcelain
  if ($LASTEXITCODE -ne 0) {
    throw "git status 执行失败"
  }

  $tracked = [System.Collections.Generic.HashSet[string]]::new()
  $staged = [System.Collections.Generic.HashSet[string]]::new()

  foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line.Length -lt 4) { continue }

    $status = $line.Substring(0, 2)
    $filePath = $line.Substring(3).Trim()

    if ($status.Contains("M") -or $status.Contains("D") -or $status.Contains("R") -or $status.Contains("C") -or $status.Contains("A")) {
      [void]$tracked.Add($filePath)
    }

    if ($status[0] -ne ' ' -and $status[0] -ne '?') {
      [void]$staged.Add($filePath)
    }
  }

  if ($tracked.Count -gt 1) {
    Write-Error ("[single-file-commit-check] 失败: 检测到 {0} 个已跟踪文件变更。" -f $tracked.Count)
    exit 1
  }

  if ($staged.Count -gt 1) {
    Write-Error ("[single-file-commit-check] 失败: 暂存区包含 {0} 个文件。" -f $staged.Count)
    exit 1
  }

  Write-Host "[single-file-commit-check] 通过: 当前状态满足单文件提交流程要求。"
}

function Invoke-DocsInit {
  $force = $false
  $name = "command-analysis-template"

  foreach ($arg in $Rest) {
    if ($arg -eq "--force") {
      $force = $true
      continue
    }

    if (-not $arg.StartsWith("--")) {
      $name = $arg
      break
    }
  }

  $safeName = ($name -replace "[^a-zA-Z0-9-_]", "-").ToLowerInvariant()
  $target = Join-Path (Join-Path (Join-Path $RepoRoot "docs") "analysis") ("{0}.md" -f $safeName)

  if ((Test-Path $target) -and -not $force) {
    Write-Error ("[docs-init] 失败: 文件已存在 {0}。可使用 --force 覆盖。" -f $target)
    exit 1
  }

  $dir = Split-Path -Parent $target
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }

  $now = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssK")
  $contentLines = @(
    "# 分析文档模板",
    "",
    ("- 创建时间: {0}" -f $now),
    ("- 命令主题: {0}" -f $safeName),
    "",
    "## 目标",
    "",
    "请描述本次变更的业务目标与技术目标。",
    "",
    "## 现状与问题",
    "",
    "请描述当前实现、已知限制、风险来源。",
    "",
    "## 方案设计",
    "",
    "```mermaid",
    "flowchart TD",
    "    A[输入] --> B[处理]",
    "    B --> C[输出]",
    "```",
    "",
    "## TODO LIST",
    "",
    "- [ ] 编写测试用例",
    "- [ ] 运行失败测试验证有效性",
    "- [ ] 实现代码",
    "- [ ] 运行通过测试",
    "- [ ] 代码审查与文档更新",
    "",
    "## 边界情况",
    "",
    "- 边界情况 1",
    "- 边界情况 2",
    "",
    "## 验收标准",
    "",
    "- [ ] 功能正确",
    "- [ ] 可维护性达标",
    "- [ ] 文档完整"
  )

  Set-Content -Path $target -Value $contentLines -Encoding UTF8
  Write-Host ("[docs-init] 已生成: {0}" -f $target)
}

function Invoke-DocsCheck {
  $scriptPath = Join-Path (Join-Path $RepoRoot "scripts") "docs-check.mjs"
  node $scriptPath
  if ($LASTEXITCODE -ne 0) {
    throw "docs-check 执行失败"
  }
}

function Invoke-ServerHealth {
  $url = if ($Rest.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($Rest[0])) { $Rest[0] } else { "http://127.0.0.1:9011/health" }

  try {
    $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
    if ($resp.StatusCode -lt 200 -or $resp.StatusCode -ge 300) {
      Write-Error ("[server-health] 失败: HTTP {0}" -f $resp.StatusCode)
      exit 1
    }

    Write-Host ("[server-health] 通过: {0}" -f $resp.Content)
  }
  catch {
    Write-Error ("[server-health] 失败: {0}" -f $_.Exception.Message)
    exit 1
  }
}

switch ($Action.ToLowerInvariant()) {
  "help" { Show-Help }
  "--help" { Show-Help }
  "-h" { Show-Help }
  "check" {
    Invoke-NpmScript -ScriptName "lint"
    Invoke-NpmScript -ScriptName "typescript"
  }
  "build" {
    Invoke-NpmScript -ScriptName "build"
  }
  "docs-check" {
    Invoke-DocsCheck
  }
  "single-file-commit-check" {
    Invoke-SingleFileCommitCheck
  }
  "docs-init" {
    Invoke-DocsInit
  }
  "server-health" {
    Invoke-ServerHealth
  }
  default {
    Write-Error ("未知命令: {0}" -f $Action)
    Show-Help
    exit 1
  }
}
