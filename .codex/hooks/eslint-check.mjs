#!/usr/bin/env node
/**
 * PostToolUse Hook: ESLint 检查
 * 触发时机: Edit 或 Write 工具完成后
 *
 * 功能:
 * - 检测被编辑的文件是否为 JS/TS 文件
 * - 自动运行 eslint 检查
 * - 输出检查结果
 */

import { extname, basename } from 'path';
import { spawn } from 'child_process';

// 需要 ESLint 检查的文件扩展名
const ESLINT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'
]);

// 跳过检查的文件模式
const SKIP_PATTERNS = [
  /node_modules/,    // node_modules 中的文件
  /dist\//,          // 构建输出
  /build\//,         // 构建输出
  /\.d\.ts$/,        // TypeScript 声明文件
  /\.min\./,         // 压缩文件
];

// 颜色定义（ANSI 转义码）
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
async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

// 检查文件是否应该被检查
function shouldCheck(filePath) {
  if (!filePath) return false;

  const ext = extname(filePath).toLowerCase();

  // 检查是否为 JS/TS 文件
  if (!ESLINT_EXTENSIONS.has(ext)) {
    return false;
  }

  // 检查是否匹配跳过模式
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(filePath)) {
      return false;
    }
  }

  return true;
}

// 运行 eslint
function runEslint(filePath) {
  return new Promise((resolve) => {
    const eslint = spawn('npx', ['eslint', filePath, '--format', 'stylish'], {
      shell: true,
      cwd: process.cwd()
    });

    let stdout = '';
    let stderr = '';

    eslint.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    eslint.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    eslint.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    // 设置超时
    setTimeout(() => {
      eslint.kill();
      resolve({ code: -1, stdout: '', stderr: 'ESLint 检查超时' });
    }, 30000);
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

    // 检查工具是否执行成功
    if (tool_result?.error) {
      process.exit(0);
    }

    // 运行 eslint
    const { code, stdout, stderr } = await runEslint(filePath);

    // 如果有错误或警告，输出结果
    if (code !== 0 || stdout.trim()) {
      const output = stdout || stderr;

      if (code === 0) {
        // 有警告但无错误
        console.error(`\n${colorize('⚠️  ESLint 警告', 'yellow')}`);
        console.error(`${colorize('────────────────────────────────────────────────────────────', 'yellow')}`);
        console.error(output);
      } else {
        // 有错误
        console.error(`\n${colorize('🔴 ESLint 错误', 'red')}`);
        console.error(`${colorize('────────────────────────────────────────────────────────────', 'red')}`);
        console.error(output);
      }
    } else {
      // 无问题
      console.error(`\n${colorize('✅ ESLint 检查通过', 'green')} ${filePath}`);
    }

    // 无论结果如何，都继续执行（不阻止操作）
    process.exit(0);

  } catch (error) {
    // 错误时静默退出，不干扰正常流程
    console.error(`eslint-check hook error: ${error.message}`);
    process.exit(0);
  }
}

main();
