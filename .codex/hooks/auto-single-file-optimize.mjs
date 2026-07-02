#!/usr/bin/env node
/**
 * PostToolUse Hook: 记录待优化的代码文件
 * 触发时机: Edit 或 Write 工具完成后
 *
 * 功能:
 * - 检测被编辑的文件是否为代码文件
 * - 将待优化的文件路径记录到临时文件
 * - 由 Stop 钩子在任务结束时统一触发优化
 *
 * 配合 Stop 钩子 (completion-summary.mjs) 实现强制优化流程
 */

import { extname, basename, join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';

// 需要优化的代码文件扩展名
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx',
  '.py', '.pyw',
  '.java', '.kt', '.kts',
  '.go', '.rs', '.rb',
  '.c', '.cpp', '.h', '.hpp',
  '.cs', '.swift', '.m', '.mm'
]);

// 不需要优化的文件模式
const SKIP_PATTERNS = [
  /\.test\./,        // 测试文件
  /\.spec\./,        // 规格文件
  /\.d\.ts$/,        // TypeScript 声明文件
  /node_modules/,    // node_modules 中的文件
  /\.min\./,         // 压缩文件
  /dist\//,          // 构建输出
  /build\//,         // 构建输出
  /\.config\./,      // 配置文件
  /vite\.config\./,  // Vite 配置
  /tsconfig\.json/,  // TS 配置
];

// 待优化文件列表存储路径
const PENDING_DIR = join(tmpdir(), 'claude-code-hooks');
const PENDING_FILE = join(PENDING_DIR, 'pending-optimization.json');

// 确保存储目录存在
function ensureStorageDir() {
  if (!existsSync(PENDING_DIR)) {
    mkdirSync(PENDING_DIR, { recursive: true });
  }
}

// 读取待优化文件列表
function readPendingFiles() {
  try {
    if (existsSync(PENDING_FILE)) {
      const content = readFileSync(PENDING_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    // 忽略读取错误
  }
  return [];
}

// 写入待优化文件列表
function writePendingFiles(files) {
  try {
    ensureStorageDir();
    writeFileSync(PENDING_FILE, JSON.stringify(files, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Failed to write pending files: ${e.message}`);
  }
}

// 添加待优化文件
function addPendingFile(filePath) {
  const files = readPendingFiles();
  // 去重：避免重复添加
  if (!files.includes(filePath)) {
    files.push(filePath);
    writePendingFiles(files);
  }
}

// 读取 stdin 输入
async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

// 检查文件是否应该被优化
function shouldOptimize(filePath) {
  if (!filePath) return false;

  const ext = extname(filePath).toLowerCase();
  const fileName = basename(filePath);

  // 检查是否为代码文件
  if (!CODE_EXTENSIONS.has(ext)) {
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

    if (!shouldOptimize(filePath)) {
      process.exit(0);
    }

    // 检查工具是否执行成功
    if (tool_result?.error) {
      process.exit(0);
    }

    // 记录待优化文件
    addPendingFile(filePath);

    // 静默退出，不输出任何内容
    // Stop 钩子会统一处理优化请求
    process.exit(0);

  } catch (error) {
    // 错误时静默退出，不干扰正常流程
    console.error(`auto-single-file-optimize hook error: ${error.message}`);
    process.exit(0);
  }
}

main();
