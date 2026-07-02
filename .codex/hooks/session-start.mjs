#!/usr/bin/env node
/**
 * SessionStart Hook: 开工先看项目状态（简洁版）
 * 触发时机: 每次启动 Claude Code 会话时
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const C = {
  g: '\x1b[32m',  // green
  y: '\x1b[33m',  // yellow
  c: '\x1b[36m',  // cyan
  d: '\x1b[90m',  // dim
  r: '\x1b[0m'    // reset
};

const DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function git(cmd) {
  try {
    return execSync(cmd, { cwd: DIR, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch { return null; }
}

function main() {
  // 检查 Git 仓库
  if (!git('git rev-parse --git-dir')) {
    console.log(`${C.y}⚠ 非 Git 仓库${C.r}`);
    return;
  }

  // Git 状态（一行）
  const branch = git('git branch --show-current') || 'HEAD';
  const status = git('git status --porcelain') || '';
  const changes = status.split('\n').filter(l => l).length;
  const statusIcon = changes === 0 ? `${C.g}✓${C.r}` : `${C.y}!${C.r}`;
  const statusText = changes === 0 ? '干净' : `${changes} 文件待提交`;

  console.log(`${C.c}┃${C.r} ${statusIcon} ${C.d}${branch}${C.r} ${C.d}│${C.r} ${statusText}`);

  // 端口信息（修复正则以匹配表格格式）
  const mdPath = join(DIR, 'CLAUDE.md');
  if (existsSync(mdPath)) {
    const content = readFileSync(mdPath, 'utf-8');
    // 匹配表格格式: | **前端 (Vite)** | `3000` |
    const fe = content.match(/\|\s*\*\*前端.*?\*\*\s*\|\s*`?(\d+)`?\s*\|/)?.[1];
    const be = content.match(/\|\s*\*\*后端.*?\*\*\s*\|\s*`?(\d+)`?\s*\|/)?.[1];
    if (fe || be) {
      const cmds = [];
      if (fe) cmds.push(`前端:${fe}`);
      if (be) cmds.push(`后端:${be}`);
      console.log(`${C.c}┃${C.r} ${C.d}端口: ${cmds.join(' ')}${C.r}`);
    }
  }

  console.log(`${C.c}┃${C.r} ${C.d}准备就绪${C.r}`);
}

main();
