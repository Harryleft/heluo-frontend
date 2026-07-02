/**
 * 依赖图守卫测试
 *
 * 验证 features/details/ 域不直接依赖基础设施层。
 * 如果此测试失败，说明有新的跨层直连被引入。
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const FEATURE_DIRS = ['src/features/details']

const RESTRICTED_IMPORTS = [
  '@/lib/api/http',
  'axios',
]

const SOURCE_EXTENSIONS = ['.ts', '.tsx']

function collectSourceFiles(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath))
    } else if (SOURCE_EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath)
    }
  }
  return results
}

function extractImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const importPattern = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g
  const imports: string[] = []
  let match
  while ((match = importPattern.exec(content)) !== null) {
    imports.push(match[1])
  }
  return imports
}

describe('依赖图守卫', () => {
  const violations: Array<{ file: string; importPath: string }> = []

  for (const featureDir of FEATURE_DIRS) {
    const files = collectSourceFiles(featureDir)
    for (const file of files) {
      const imports = extractImports(file)
      for (const imp of imports) {
        if (RESTRICTED_IMPORTS.includes(imp)) {
          violations.push({ file, importPath: imp })
        }
      }
    }
  }

  it('details 域不应直接依赖 lib/api/http 或 axios', () => {
    expect(violations).toEqual([])
  })
})
