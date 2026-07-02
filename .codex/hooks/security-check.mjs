#!/usr/bin/env node
/**
 * PreToolUse Hook: 安全防护层
 * 触发时机: AI 执行 Bash 命令或写入文件之前
 *
 * 功能:
 * - 拦截危险命令（rm -rf /、drop database、format）
 * - 警告敏感操作（删除文件、修改系统配置）
 * - 阻止运行未经授权的脚本
 */

import readline from 'readline';

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

// 致命命令模式 - 直接阻止
const FATAL_PATTERNS = [
  // 系统毁灭性命令
  'rm -rf /',
  'rm -rf /',
  'rm -rf ~',
  'rm -rf ./',
  'dd if=/dev/zero',
  'mkfs\\.',           // 格式化文件系统
  ':\\(\\)[:|:&\\}:',   // fork 炸弹
  'shred /',           // 彻底删除
  'wipefs',            // 擦除文件系统
  // 数据库危险操作
  'drop database',
  'truncate table',
  'drop table',
  'delete from.*where.*1=1',
  // 系统配置破坏
  'rm /etc/passwd',
  'rm /etc/shadow',
  '>/dev/sda',
  '>/dev/nvme',
  // 强制清理
  'npm cache clean --force',
  'yarn cache clean',
  'pnpm store prune'
];

// 警告命令模式 - 需要确认
const WARNING_PATTERNS = [
  // 删除操作
  'rm -rf',
  'rm -r',
  'del /s',
  'rmdir /s',
  // 系统命令
  'sudo ',
  'su ',
  'chmod 777',
  'chown root',
  // 配置修改
  '/etc/',
  'C:\\\\Windows\\',
  'registry',
  // 脚本执行
  'bash.*\\.sh',
  'sh.*\\.sh',
  'source.*\\.sh',
  '\\.sh.*&&',
  // 包管理全局操作
  'npm install -g',
  'yarn global',
  'pnpm install -g'
];

// 敏感路径 - 额外警告
const SENSITIVE_PATHS = [
  '/etc/',
  '/usr/bin/',
  '/usr/sbin/',
  '/boot/',
  '/root/',
  'C:\\Windows',
  'C:\\Program Files'
];

// 检查致命模式
function checkFatalPattern(content, toolName) {
  for (const pattern of FATAL_PATTERNS) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(content)) {
      const errorMsg = `
${colorize('═══════════════════════════════════════════════════════════════', 'red')}
${colorize('🚫 安全拦截: 危险命令被阻止', 'red')}
${colorize('═══════════════════════════════════════════════════════════════', 'red')}

${colorize('工具:', 'yellow')} ${toolName}
${colorize('危险模式:', 'yellow')} ${pattern}
${colorize('检测内容:', 'yellow')}

${content.split('\n').slice(0, 5).join('\n')}

${colorize('该操作可能导致数据丢失或系统损坏，已被自动阻止。', 'red')}
${colorize('═══════════════════════════════════════════════════════════════', 'red')}
`;
      console.error(errorMsg);
      return true;  // 检测到致命模式
    }
  }
  return false;
}

// 检查警告模式
function checkWarningPattern(content, toolName) {
  for (const pattern of WARNING_PATTERNS) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(content)) {
      const warningMsg = `

${colorize('⚠️  安全警告: 敏感操作检测', 'yellow')}
${colorize('────────────────────────────────────────────────────────────', 'yellow')}
${colorize('工具:', 'yellow')} ${toolName}
${colorize('匹配模式:', 'yellow')} ${pattern}

${colorize('请确认此操作的必要性和安全性。', 'yellow')}
${colorize('────────────────────────────────────────────────────────────', 'yellow')}

`;
      console.error(warningMsg);
      return true;
    }
  }
  return false;
}

// 检查敏感路径
function checkSensitivePath(content) {
  for (const path of SENSITIVE_PATHS) {
    if (content.includes(path)) {
      const warningMsg = `

${colorize('⚠️  路径警告: 涉及系统敏感目录', 'yellow')}
${colorize('────────────────────────────────────────────────────────────', 'yellow')}
${colorize('检测路径:', 'yellow')} ${path}

${colorize('修改系统文件可能导致环境不稳定，请谨慎操作。', 'yellow')}
${colorize('────────────────────────────────────────────────────────────', 'yellow')}

`;
      console.error(warningMsg);
      return true;
    }
  }
  return false;
}

// 读取 stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

let inputData = '';

rl.on('line', (line) => {
  inputData += line;
});

rl.on('close', () => {
  try {
    const input = JSON.parse(inputData || '{}');
    const toolName = input.tool_name || '';

    // 仅检查 Bash 和 Write/Edit 工具
    if (!/^Bash|Write|Edit$/i.test(toolName)) {
      process.exit(0);
    }

    // 处理不同工具
    switch (toolName) {
      case 'Bash':
        const command = input.tool_input?.command || '';

        // 检查致命命令
        if (checkFatalPattern(command, toolName)) {
          // 返回拒绝决策
          console.log(JSON.stringify({
            continue: false,
            suppressOutput: false,
            systemMessage: '危险命令已被安全防护层阻止'
          }));
          process.exit(2);
        }

        // 检查警告模式
        checkWarningPattern(command, toolName);

        // 检查敏感路径
        checkSensitivePath(command);
        break;

      case 'Write':
      case 'Edit':
        const filePath = input.tool_input?.file_path || '';

        // 检查是否写入敏感路径
        if (filePath) {
          for (const sensitive of SENSITIVE_PATHS) {
            if (filePath.startsWith(sensitive)) {
              const warningMsg = `

${colorize('⚠️  文件写入警告: 涉及系统敏感目录', 'yellow')}
${colorize('────────────────────────────────────────────────────────────', 'yellow')}
${colorize('目标路径:', 'yellow')} ${filePath}

${colorize('写入系统文件可能导致环境不稳定，请确认操作。', 'yellow')}
${colorize('────────────────────────────────────────────────────────────', 'yellow')}

`;
              console.error(warningMsg);
              break;
            }
          }
        }
        break;
    }

    // 默认放行
    process.exit(0);

  } catch (error) {
    // 出错时放行，不阻塞
    process.exit(0);
  }
});
