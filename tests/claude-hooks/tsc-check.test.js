import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const HOOK_PATH = path.resolve(__dirname, '../../.claude/hooks/tsc-check.mjs');

// 模拟 stdin JSON 输入，调用 hook 脚本并验证行为
function runHook(toolName, filePath, toolResult = {}) {
  const input = JSON.stringify({
    tool_name: toolName,
    tool_input: tool_input(toolName, filePath),
    tool_result: toolResult
  });

  const result = spawnSync('node', [HOOK_PATH], {
    input,
    encoding: 'utf-8',
    cwd: path.resolve(__dirname, '../..'),
    timeout: 120000,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  return {
    exitCode: result.status || 0,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function tool_input(toolName, filePath) {
  if (toolName === 'Edit') {
    return { file_path: filePath, old_string: 'a', new_string: 'b' };
  }
  if (toolName === 'Write') {
    return { file_path: filePath, content: 'test' };
  }
  return { file_path: filePath };
}

describe('tsc-check hook', () => {
  beforeEach(() => {
    // 确保缓存目录不存在，强制全量检查
    const cacheDir = path.resolve(__dirname, '../../.claude/cache');
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true });
    }
  });

  it('跳过非 Edit/Write 工具调用', () => {
    const result = runHook('Read', 'src/app/App.tsx');
    // 脚本应静默退出，无输出
    expect(result.stdout).toBe('');
  });

  it('跳过 server/ 目录下的文件', () => {
    const result = runHook('Edit', 'server/src/index.js');
    expect(result.stdout).toBe('');
  });

  it('跳过 .d.ts 声明文件', () => {
    const result = runHook('Edit', 'src/types/global.d.ts');
    expect(result.stdout).toBe('');
  });

  it('跳过非 TS/TSX 文件', () => {
    const result = runHook('Edit', 'src/styles/app.css');
    expect(result.stdout).toBe('');
  });

  it('对 src/ 下的 .tsx 文件触发 tsc 检查', { timeout: 120000 }, () => {
    const result = runHook('Edit', 'src/app/App.tsx');
    // 不管 tsc 结果如何，脚本应正常退出
    expect(result.exitCode).toBe(0);
    // hook 输出走 stderr（console.error），不是 stdout
    const output = result.stdout + result.stderr;
    expect(output.length).toBeGreaterThan(0);
    // 输出应包含 [tsc] 标记
    expect(output).toContain('[tsc]');
  });

  it('对 src/ 下的 .ts 文件触发 tsc 检查', { timeout: 120000 }, () => {
    const result = runHook('Write', 'src/lib/api/v1Api.ts');
    expect(result.exitCode).toBe(0);
  });

  it('空文件路径时不崩溃', () => {
    const result = runHook('Edit', '');
    expect(result.exitCode).toBe(0);
  });

  it('工具执行失败时跳过检查', () => {
    const result = runHook('Edit', 'src/app/App.tsx', {
      error: 'Permission denied'
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });
});
