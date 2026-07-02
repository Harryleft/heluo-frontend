#!/usr/bin/env node
/**
 * PostToolUse Hook: TypeScript 增量编译验证
 * 触发时机: Edit 或 Write 工具完成后
 *
 * 功能:
 * - 检测被编辑的文件是否为 src/ 下的 .ts/.tsx 文件
 * - 使用文件时间戳缓存机制，避免重复检查
 * - 运行 tsc --noEmit 进行全项目类型检查
 * - 输出编译结果（通过/错误），但不阻塞流程
 */

import { extname } from 'path';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// 需要检查的文件扩展名
const TS_EXTENSIONS = new Set(['.ts', '.tsx']);

// 跳过检查的文件模式
const SKIP_PATTERNS = [/\.d\.ts$/, /node_modules/, /dist\//, /build\//, /\.min\./];

// 缓存文件路径
const CACHE_DIR = '.claude/cache';
const CACHE_FILE = path.join(CACHE_DIR, 'tsc-check.json');

// 颜色定义
const colors = {
  red: '\x1b[0;31m',
  yellow: '\x1b[1;33m',
  green: '\x1b[0;32m',
  cyan: '\x1b[0;36m',
  reset: '\x1b[0m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// 读取 stdin 输入
function readInput() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch (err) {
        reject(err);
      }
    });
    process.stdin.on('error', reject);
  });
}

// 检查文件是否应该被检查
function shouldCheck(filePath) {
  if (!filePath) return false;

  const ext = extname(filePath).toLowerCase();
  if (!TS_EXTENSIONS.has(ext)) return false;

  // 必须在 src/ 目录下（兼容绝对路径和相对路径）
  const normalized = filePath.replace(/\\/g, '/');
  if (!normalized.includes('/src/') && !normalized.startsWith('src/')) return false;

  // 排除 server/src/
  if (normalized.includes('/server/')) return false;

  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(filePath)) return false;
  }

  return true;
}

// 递归获取 src/ 下所有 .ts/.tsx 文件（排除 .d.ts）
function getSrcTsFiles(srcDir) {
  const files = [];
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(srcDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;
      files.push(...getSrcTsFiles(fullPath));
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (TS_EXTENSIONS.has(ext) && !SKIP_PATTERNS.some(p => p.test(fullPath))) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

// 检查缓存是否有效
function isCacheValid() {
  if (!fs.existsSync(CACHE_FILE)) return false;

  try {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    const lastCheckTime = cache.lastCheckTime;

    // 获取 src/ 目录下所有 .ts/.tsx 文件
    const srcDir = path.join(process.cwd(), 'src');
    if (!fs.existsSync(srcDir)) return false;

    const tsFiles = getSrcTsFiles(srcDir);

    // 检查是否有文件比缓存更新
    for (const file of tsFiles) {
      try {
        const stat = fs.statSync(file);
        if (stat.mtimeMs > lastCheckTime) {
          return false;
        }
      } catch {
        // 文件可能被删除，跳过
      }
    }

    return true;
  } catch {
    return false;
  }
}

// 更新缓存
function updateCache(exitCode) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      lastCheckTime: Date.now(),
      lastExitCode: exitCode
    }));
  } catch {
    // 缓存写入失败不影响主流程
  }
}

// 读取上次缓存结果（用于快速反馈）
function readLastResult() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

// 运行 tsc
function runTsc() {
  return new Promise((resolve) => {
    const tsc = spawn('npx', ['tsc', '--noEmit'], {
      shell: true,
      cwd: process.cwd()
    });

    let stdout = '';
    let stderr = '';

    tsc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    tsc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    tsc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    // 60 秒超时
    setTimeout(() => {
      tsc.kill();
      resolve({ code: -1, stdout: '', stderr: 'TypeScript 检查超时（60s）' });
    }, 60000);
  });
}

// 主流程
async function main() {
  try {
    const input = await readInput();
    const { tool_name, tool_input, tool_result } = input;

    // 只处理 Edit 和 Write 工具
    if (tool_name !== 'Edit' && tool_name !== 'Write') {
      process.exit(0);
    }

    const filePath = tool_input?.file_path || tool_input?.path;

    if (!shouldCheck(filePath)) {
      process.exit(0);
    }

    // 工具执行失败时跳过
    if (tool_result?.error) {
      process.exit(0);
    }

    // 检查缓存
    if (isCacheValid()) {
      const last = readLastResult();
      if (last) {
        const status = last.lastExitCode === 0
          ? colorize('pass', 'green')
          : colorize('errors (' + last.lastExitCode + ')', 'red');
        console.error(`\n${colorize('[tsc]', 'cyan')} cache hit -- last check: ${status} (skipped)`);
      }
      process.exit(0);
    }

    // 运行 tsc
    const { code, stdout, stderr } = await runTsc();
    updateCache(code);

    if (code === 0) {
      console.error(`\n${colorize('[tsc]', 'cyan')} ${colorize('type check passed', 'green')} -- ${filePath}`);
    } else {
      const output = stdout || stderr;
      // 只显示前 30 行错误，避免刷屏
      const lines = output.split('\n').filter(l => l.trim());
      const limited = lines.slice(0, 30).join('\n');
      const truncated = lines.length > 30 ? `\n... (${lines.length - 30} more errors hidden)` : '';

      console.error(`\n${colorize('[tsc]', 'cyan')} ${colorize('type check failed', 'red')} -- ${filePath}`);
      console.error(colorize('─'.repeat(60), 'red'));
      console.error(limited + truncated);
    }

    process.exit(0);

  } catch (error) {
    console.error(`tsc-check hook error: ${error.message}`);
    process.exit(0);
  }
}

main();
