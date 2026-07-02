#!/usr/bin/env node
/**
 * PostToolUse Hook: 自动优化代码文件
 * 触发时机: Edit 或 Write 工具完成后
 *
 * 功能:
 * - 检测被编辑的文件是否为代码文件
 * - 如果是代码文件，建议调用 single-file-optimizer 技能
 * - 通过 systemMessage 向 Claude 发送优化建议
 */

import { extname, basename } from 'path';

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
];

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

    // 输出 JSON 响应，建议调用 single-file-optimizer 技能
    const response = {
      continue: true,
      suppressOutput: false,
      systemMessage: `📝 代码文件已修改: ${filePath}

建议：使用 single-file-optimizer 技能优化此文件的结构和逻辑。
执行命令: /single-file-optimizer ${filePath}

此技能会按照以下 6 部分布局优化代码：
1. 模块文档字符串
2. 绝对导入
3. 常量定义
4. 核心类和公共方法
5. 私有实现
6. 入口点（如适用）`
    };

    console.log(JSON.stringify(response));
    process.exit(0);

  } catch (error) {
    // 错误时静默退出，不干扰正常流程
    console.error(`auto-optimize hook error: ${error.message}`);
    process.exit(0);
  }
}

main();
