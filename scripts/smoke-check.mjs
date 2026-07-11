#!/usr/bin/env node

import 'dotenv/config'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS) || 5000
const retries = Math.max(1, Number(process.env.SMOKE_RETRIES) || 1)
const retryDelayMs = Math.max(100, Number(process.env.SMOKE_RETRY_DELAY_MS) || 5000)
const backendUrl = strip(process.env.REACT_BACKEND_URL || 'http://127.0.0.1:9011')
const frontendUrl = strip(process.env.FRONTEND_URL || 'http://127.0.0.1:3000')
const embeddingUrl = strip(process.env.EMBEDDING_SERVICE_URL || 'http://127.0.0.1:8080')
const marklogicUrl = strip(process.env.MARKLOGIC_BASE_URL || 'http://127.0.0.1:8003')
const marklogicUser = process.env.MARKLOGIC_USER || 'admin'
const marklogicPassword = process.env.MARKLOGIC_PASSWORD || 'admin'

function strip(value) {
  return String(value).replace(/\/+$/, '')
}

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function getText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

async function getMarklogicSearch() {
  const { stdout } = await execFileAsync('curl', [
    '-sS',
    '--digest',
    '-u',
    `${marklogicUser}:${marklogicPassword}`,
    '--max-time',
    String(Math.ceil(timeoutMs / 1000)),
    `${marklogicUrl}/v1/search?format=json&pageLength=1`,
  ], { encoding: 'utf-8' })
  return JSON.parse(stdout)
}

const checks = [
  ['MarkLogic 文档数', async () => {
    const data = await getMarklogicSearch()
    if (!Number.isFinite(Number(data.total))) throw new Error('missing total')
    return `${data.total}`
  }],
  ['后端 /health', async () => {
    const data = await getJson(`${backendUrl}/health`)
    if (!data.ok) throw new Error('health not ok')
    return 'ok'
  }],
  ['统计接口', async () => {
    const data = await getJson(`${backendUrl}/stats/entity-counts`)
    const total = Object.values(data || {}).reduce((sum, value) => sum + Number(value || 0), 0)
    if (total <= 0) throw new Error('empty counts')
    return `${total}`
  }],
  ['搜索接口', async () => {
    const data = await getJson(`${backendUrl}/api/v1/search?q=${encodeURIComponent('杜甫')}&type=person&page=1&pageSize=1`)
    const rows = data?.data?.items || data?.items || data?.results || []
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('empty search result')
    return `${rows.length}`
  }],
  ['IIIF manifest', async () => {
    const data = await getJson(`${backendUrl}/iiif/manifests/303/manifest.json`)
    if (!data.id && !data['@id']) throw new Error('missing manifest id')
    return 'ok'
  }],
  ['Embedding /health', async () => {
    const data = await getJson(`${embeddingUrl}/health`)
    if (data.status !== 'ok') throw new Error(data.status || 'not ok')
    return data.model || 'ok'
  }],
  ['前端首页', async () => {
    const html = await getText(frontendUrl)
    if (!html.includes('<html') && !html.includes('<div id="root"')) throw new Error('unexpected html')
    return 'ok'
  }],
]

async function runChecks() {
  const outcomes = await Promise.all(checks.map(async ([name, run]) => {
    try {
      const detail = await run()
      return { passed: [name, detail] }
    } catch (error) {
      return { failed: [name, error.message] }
    }
  }))

  return {
    passed: outcomes.flatMap((outcome) => outcome.passed ? [outcome.passed] : []),
    failed: outcomes.flatMap((outcome) => outcome.failed ? [outcome.failed] : []),
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

for (let attempt = 1; attempt <= retries; attempt += 1) {
  const result = await runChecks()
  if (result.failed.length === 0) {
    result.passed.forEach(([name, detail]) => console.log(`[ok] ${name}: ${detail}`))
    process.exit(0)
  }

  if (attempt < retries) {
    const failedNames = result.failed.map(([name]) => name).join('、')
    console.log(`[wait] 健康检查 ${attempt}/${retries} 未就绪: ${failedNames}`)
    await delay(retryDelayMs)
    continue
  }

  result.failed.forEach(([name, message]) => console.error(`[fail] ${name}: ${message}`))
}

process.exit(1)
