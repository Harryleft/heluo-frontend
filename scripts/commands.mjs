#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const command = args[0]
const cwd = process.cwd()

function printHelp() {
  console.log(`可用命令:
  check                        运行 lint + typescript 检查
  build                        执行项目构建
  docs-check                   检查高风险文档漂移
  single-file-commit-check     检查当前改动是否满足单文件提交流程
  docs-init [name] [--force]   生成 docs 分析模板
  server-health [url]          检查后端健康接口
`)
}

function npmBin() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function runNpmScript(scriptName) {
  execFileSync(npmBin(), ['run', scriptName], { stdio: 'inherit', cwd })
}

function readGitStatusLines() {
  const output = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf-8' })
  return output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
}

function runSingleFileCommitCheck() {
  const lines = readGitStatusLines()

  const trackedChanged = new Set()
  const stagedChanged = new Set()

  for (const line of lines) {
    const status = line.slice(0, 2)
    const filePath = line.slice(3).trim()

    if (status.includes('M') || status.includes('D') || status.includes('R') || status.includes('C') || status.includes('A')) {
      trackedChanged.add(filePath)
    }

    if (status[0] !== ' ' && status[0] !== '?') {
      stagedChanged.add(filePath)
    }
  }

  if (trackedChanged.size > 1) {
    console.error(`[single-file-commit-check] 失败: 检测到 ${trackedChanged.size} 个已跟踪文件变更。`)
    console.error('请确保一次提交仅包含一个文件改动。')
    process.exit(1)
  }

  if (stagedChanged.size > 1) {
    console.error(`[single-file-commit-check] 失败: 暂存区包含 ${stagedChanged.size} 个文件。`)
    console.error('请只暂存一个文件后再提交。')
    process.exit(1)
  }

  console.log('[single-file-commit-check] 通过: 当前状态满足单文件提交流程要求。')
}

function runDocsInit() {
  const force = args.includes('--force')
  const nameArg = args.find((item, index) => index > 0 && !item.startsWith('--')) || 'command-analysis-template'
  const safeName = nameArg.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase()
  const target = path.join(cwd, 'docs', 'analysis', `${safeName}.md`)

  if (fs.existsSync(target) && !force) {
    console.error(`[docs-init] 失败: 文件已存在 ${target}`)
    console.error('如需覆盖，请追加 --force 参数。')
    process.exit(1)
  }

  fs.mkdirSync(path.dirname(target), { recursive: true })

  const now = new Date().toISOString()
  const template = `# 分析文档模板\n\n- 创建时间: ${now}\n- 命令主题: ${safeName}\n\n## 目标\n\n请描述本次变更的业务目标与技术目标。\n\n## 现状与问题\n\n请描述当前实现、已知限制、风险来源。\n\n## 方案设计\n\n\`\`\`mermaid\nflowchart TD\n    A[输入] --> B[处理]\n    B --> C[输出]\n\`\`\`\n\n## TODO LIST\n\n- [ ] 编写测试用例\n- [ ] 运行失败测试验证有效性\n- [ ] 实现代码\n- [ ] 运行通过测试\n- [ ] 代码审查与文档更新\n\n## 边界情况\n\n- 边界情况 1\n- 边界情况 2\n\n## 验收标准\n\n- [ ] 功能正确\n- [ ] 可维护性达标\n- [ ] 文档完整\n`

  fs.writeFileSync(target, template, 'utf-8')
  console.log(`[docs-init] 已生成: ${target}`)
}

function runDocsCheck() {
  const scriptPath = path.join(cwd, 'scripts', 'docs-check.mjs')
  execFileSync(process.execPath, [scriptPath], { stdio: 'inherit', cwd })
}

async function runServerHealth() {
  const urlArg = args[1]
  const targetUrl = urlArg || 'http://127.0.0.1:9011/health'

  try {
    const response = await fetch(targetUrl)
    if (!response.ok) {
      console.error(`[server-health] 失败: HTTP ${response.status} ${response.statusText}`)
      process.exit(1)
    }

    const json = await response.json()
    console.log('[server-health] 通过:', JSON.stringify(json))
  } catch (error) {
    console.error(`[server-health] 失败: ${String(error)}`)
    process.exit(1)
  }
}

async function main() {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  if (command === 'check') {
    runNpmScript('lint')
    runNpmScript('typescript')
    return
  }

  if (command === 'build') {
    runNpmScript('build')
    return
  }

  if (command === 'docs-check') {
    runDocsCheck()
    return
  }

  if (command === 'single-file-commit-check') {
    runSingleFileCommitCheck()
    return
  }

  if (command === 'docs-init') {
    runDocsInit()
    return
  }

  if (command === 'server-health') {
    await runServerHealth()
    return
  }

  console.error(`未知命令: ${command}`)
  printHelp()
  process.exit(1)
}

await main()
