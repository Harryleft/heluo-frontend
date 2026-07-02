#!/usr/bin/env node
/**
 * Stop Hook: 总结反馈 + 下一步建议
 * 触发时机: AI 完成回答后
 *
 * 功能:
 * - 播放完成音效（提醒用户）
 * - 分析本次代码变更类型
 * - 智能推荐下一步操作
 * - 清理临时文件（如 Windows 下误创建的 nul 文件）
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

// 颜色定义
const colors = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[0;34m',
  cyan: '\x1b[0;36m',
  magenta: '\x1b[0;35m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// 执行 git 命令
function execGit(cmd) {
  try {
    return execSync(cmd, {
      cwd: PROJECT_DIR,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch (e) {
    return null;
  }
}

// 播放完成提示音
function playCompletionSound() {
  try {
    // Windows: 使用 PowerShell 播放提示音
    execSync('powershell -Command "[console]::beep(800,100)"', {
      stdio: ['ignore', 'ignore', 'ignore']
    });
  } catch (e) {
    // 忽略失败
  }
}

// 分析 Git 变更
function analyzeChanges() {
  const gitDir = execGit('git rev-parse --git-dir');
  if (!gitDir) {
    return colorize('非 Git 仓库', 'yellow');
  }

  const modifiedFiles = execGit('git diff --name-only') || '';
  const stagedFiles = execGit('git diff --cached --name-only') || '';
  const modified = modifiedFiles.split('\n').filter(l => l).length;
  const staged = stagedFiles.split('\n').filter(l => l).length;

  if (modified === 0 && staged === 0) {
    return colorize('无代码变更', 'green');
  }

  let result = colorize(`有代码变更`, 'green') + ` (已修改: ${colorize(modified, 'cyan')}, 已暂存: ${colorize(staged, 'cyan')})`;

  // 分析变更类型
  const typesChanged = [];
  const allChanges = [...modifiedFiles.split('\n'), ...stagedFiles.split('\n')].filter(l => l);

  if (allChanges.some(f => /\.(ts|tsx|js|jsx)$/.test(f))) {
    typesChanged.push('TypeScript/JavaScript');
  }
  if (allChanges.some(f => /\.css$|\.scss$|\.ts$/.test(f))) {
    typesChanged.push('样式文件');
  }
  if (allChanges.some(f => /\.md$/.test(f))) {
    typesChanged.push('文档');
  }
  if (allChanges.some(f => /\.(json|yaml|yml)$/.test(f))) {
    typesChanged.push('配置文件');
  }
  if (allChanges.some(f => /\.sh$/.test(f))) {
    typesChanged.push('脚本');
  }

  if (typesChanged.length > 0) {
    result += `\n${colorize('变更类型:', 'yellow')} ${typesChanged.join(' ')}`;
  }

  return result;
}

// 智能推荐下一步操作
function recommendNextActions() {
  const recommendations = [];

  // 获取 Git 状态
  const gitDir = execGit('git rev-parse --git-dir');
  if (gitDir) {
    const modifiedFiles = execGit('git diff --name-only') || '';
    const stagedFiles = execGit('git diff --cached --name-only') || '';
    const modified = modifiedFiles.split('\n').filter(l => l).length;
    const staged = stagedFiles.split('\n').filter(l => l).length;

    // 有未提交的变更
    if (modified > 0 || staged > 0) {
      recommendations.push('📝 提交代码: git add <file> && git commit -m \'message\'');
    }

    // 检查是否有测试文件
    const hasSrcChanges = modifiedFiles.split('\n').some(f => /^src\//.test(f));
    if (hasSrcChanges) {
      recommendations.push('🧪 运行测试: npm test');
    }

    // 检查是否有 package.json 变更
    if (modifiedFiles.includes('package.json')) {
      recommendations.push('📦 更新依赖: npm install');
    }
  }

  // 检查是否有错误日志
  const logsDir = join(PROJECT_DIR, 'logs');
  if (existsSync(logsDir)) {
    try {
      const errorFiles = readdirSync(logsDir).filter(f => f.includes('error'));
      if (errorFiles.length > 0) {
        recommendations.push('🔍 检查日志: logs/ 目录下有错误记录');
      }
    } catch (e) {
      // 忽略
    }
  }

  // 检查是否有 TODO 注释
  const srcDir = join(PROJECT_DIR, 'src');
  if (existsSync(srcDir)) {
    try {
      let todoCount = 0;
      function countTodos(dir) {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            countTodos(fullPath);
          } else if (entry.isFile() && /\.(ts|tsx|js|jsx|md)$/.test(entry.name)) {
            try {
              const content = readFileSync(fullPath, 'utf-8');
              todoCount += (content.match(/TODO|FIXME|XXX/g) || []).length;
            } catch (e) {
              // 忽略无法读取的文件
            }
          }
        }
      }
      countTodos(srcDir);
      if (todoCount > 0) {
        recommendations.push(`📋 查看待办: src/ 目录下有 ${todoCount} 处 TODO 标记`);
      }
    } catch (e) {
      // 忽略
    }
  }

  // 默认建议
  if (recommendations.length === 0) {
    recommendations.push('✅ 当前状态良好，可以继续下一项任务');
  }

  // 输出推荐
  recommendations.forEach(rec => console.log(`  ${rec}`));
}

// 清理临时文件
function cleanupTempFiles() {
  let cleaned = false;
  const cleanupInfos = [];

  // Windows 临时文件
  const nulPath = join(PROJECT_DIR, 'nul');
  if (existsSync(nulPath)) {
    try {
      unlinkSync(nulPath);
      cleaned = true;
      cleanupInfos.push(`${colorize('✓', 'green')} 删除 nul 文件\n`);
    } catch (e) {
      // 忽略删除失败
    }
  }

  // 查找并清理项目根目录下的其他临时文件
  const tempPatterns = ['.DS_Store', 'Thumbs.db', '*.swp', '*.swo', '*~'];

  // 简化处理：只检查根目录下的固定名称文件
  const tempFiles = ['.DS_Store', 'Thumbs.db'];

  for (const file of tempFiles) {
    const filePath = join(PROJECT_DIR, file);
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
        cleaned = true;
        cleanupInfos.push(`${colorize('✓', 'green')} 删除 ${file}\n`);
      } catch (e) {
        // 忽略删除失败
      }
    }
  }

  if (cleaned) {
    console.log('');
    console.log(colorize('🧹 临时文件清理:', 'yellow'));
    cleanupInfos.forEach(info => process.stdout.write(info));
  }
}

// 检查是否有语法错误
function checkSyntaxErrors() {
  const gitDir = execGit('git rev-parse --git-dir');
  if (!gitDir) return;

  const changedJs = execGit('git diff --name-only') || '';
  if (!changedJs) return;

  const jsFiles = changedJs.split('\n').filter(f => /\.(ts|tsx|js|jsx)$/.test(f));

  jsFiles.forEach(file => {
    const filePath = join(PROJECT_DIR, file);
    if (existsSync(filePath)) {
      try {
        const stats = statSync(filePath);
        if (stats.size === 0) {
          console.log(`  ${colorize('⚠️', 'red')} ${file} 文件为空`);
        }
      } catch (e) {
        // 忽略
      }
    }
  });
}

// 主流程
function main() {
  // 播放提示音
  playCompletionSound();

  // 显示分隔线
  console.log('');
  console.log(colorize('═══════════════════════════════════════════════════════', 'cyan'));
  console.log(colorize('              🎉 任务完成总结', 'cyan'));
  console.log(colorize('═══════════════════════════════════════════════════════', 'cyan'));
  console.log('');

  // 1. 代码变更分析
  console.log(colorize('📊 本次变更分析', 'blue'));
  console.log('─────────────────────────────────────────────────────────────');
  const changes = analyzeChanges();
  console.log(changes);
  console.log('');

  // 2. 清理临时文件
  cleanupTempFiles();

  // 3. 语法检查
  console.log(colorize('🔍 快速检查', 'blue'));
  console.log('─────────────────────────────────────────────────────────────');
  checkSyntaxErrors();
  console.log('');

  // 4. 下一步建议
  console.log(colorize('💡 建议的下一步操作', 'blue'));
  console.log('─────────────────────────────────────────────────────────────');
  recommendNextActions();
  console.log('');

  // 5. 快捷命令提示
  console.log(colorize('⌨️  常用命令', 'magenta'));
  console.log('─────────────────────────────────────────────────────────────');
  console.log('  git status          查看变更状态');
  console.log('  git diff            查看具体改动');
  console.log('  npm run dev         启动开发服务器');
  console.log('  npm test            运行测试');
  console.log('');

  console.log(colorize('✨ 祝你编码愉快！', 'green'));
  console.log(colorize('═══════════════════════════════════════════════════════', 'cyan'));
  console.log('');

  process.exit(0);
}

main();
