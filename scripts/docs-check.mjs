#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const findings = []

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf-8')
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath))
}

function addFinding(level, filePath, rule, message) {
  findings.push({ level, filePath, rule, message })
}

function checkForbiddenPattern(filePath, pattern, rule, message) {
  const content = readFile(filePath)
  if (pattern.test(content)) {
    addFinding('error', filePath, rule, message)
  }
}

function checkRequiredPath(filePath, rule, requiredPath, message) {
  const content = readFile(filePath)
  if (!content.includes(requiredPath)) {
    addFinding('warn', filePath, rule, message)
  }
}

function checkDocsReadmeDirectories() {
  const filePath = 'docs/README.md'
  const content = readFile(filePath)
  const matches = content
    .split(/\r?\n/)
    .map((line) => line.match(/^\|\s*`([^`]+)`\s*\|/))
    .filter(Boolean)

  for (const match of matches) {
    const dirName = match[1].replace(/\/$/, '')
    const relativeDir = path.join('docs', dirName)
    if (!exists(relativeDir)) {
      addFinding(
        'error',
        filePath,
        'docs-directory-missing',
        `文档中声明了目录 \`${relativeDir}\`，但仓库中不存在`,
      )
    }
  }
}

function checkDocsInitTargetsRoot() {
  const targets = [
    'scripts/commands.ps1',
    'scripts/commands.mjs',
  ]

  for (const filePath of targets) {
    const content = readFile(filePath)
    const writesDocsRootInPs = content.includes('Join-Path (Join-Path (Get-Location) "docs") ("{0}.md" -f $safeName)')
    const writesDocsRootInNode = content.includes("path.join(cwd, 'docs', `${safeName}.md`)")
    if (writesDocsRootInPs || writesDocsRootInNode) {
      addFinding(
        'error',
        filePath,
        'docs-init-root-output',
        'docs-init 仍默认写入 docs 顶层，容易持续制造散落文档',
      )
    }
  }
}

function checkTaskPaths() {
  if (!exists('docs/tasks/todo.md')) {
    addFinding('error', 'docs/tasks/todo.md', 'task-board-missing', '任务板不存在')
  }

  if (!exists('docs/tasks/lessons.md')) {
    addFinding('warn', 'docs/tasks/lessons.md', 'lessons-missing', '经验教训文件不存在，无法承接 AGENTS 中的改进循环')
  }

  checkForbiddenPattern(
    'AGENTS.md',
    /`tasks\/todo\.md`/g,
    'legacy-task-path',
    'AGENTS.md 仍引用旧路径 tasks/todo.md，应统一到 docs/tasks/todo.md',
  )

  checkForbiddenPattern(
    'AGENTS.md',
    /`tasks\/lessons\.md`/g,
    'legacy-lessons-path',
    'AGENTS.md 仍引用旧路径 tasks/lessons.md，应统一到 docs/tasks/lessons.md',
  )
}

function checkApiNamespace() {
  checkForbiddenPattern(
    'README.md',
    /\/api\/mvp\//g,
    'legacy-api-namespace',
    'README.md 仍包含旧的 /api/mvp/ 接口命名',
  )
}

function checkCriticalEntryHints() {
  checkRequiredPath(
    'README.md',
    'missing-v1-hint',
    '/api/v1/search',
    'README.md 尚未显式说明当前 /api/v1/search 接口',
  )
}

function printFindings() {
  if (findings.length === 0) {
    console.log('[docs-check] 通过：未发现已编码的文档结构问题。')
    return
  }

  console.log(`[docs-check] 发现 ${findings.length} 个问题:`)
  for (const finding of findings) {
    console.log(`- [${finding.level}] ${finding.filePath} <${finding.rule}> ${finding.message}`)
  }
}

function main() {
  checkTaskPaths()
  checkDocsReadmeDirectories()
  checkDocsInitTargetsRoot()
  checkApiNamespace()
  checkCriticalEntryHints()
  printFindings()

  if (findings.some((item) => item.level === 'error')) {
    process.exit(1)
  }
}

main()
