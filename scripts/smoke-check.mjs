#!/usr/bin/env node

import 'dotenv/config'
import { execFileSync } from 'node:child_process'

const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS) || 5000
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

function getMarklogicSearch() {
  const output = execFileSync('curl', [
    '-sS',
    '--digest',
    '-u',
    `${marklogicUser}:${marklogicPassword}`,
    '--max-time',
    String(Math.ceil(timeoutMs / 1000)),
    `${marklogicUrl}/v1/search?format=json&pageLength=1`,
  ], { encoding: 'utf-8' })
  return JSON.parse(output)
}

const checks = [
  ['MarkLogic 文档数', async () => {
    const data = getMarklogicSearch()
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

let failed = 0
for (const [name, run] of checks) {
  try {
    const detail = await run()
    console.log(`[ok] ${name}: ${detail}`)
  } catch (error) {
    failed += 1
    console.error(`[fail] ${name}: ${error.message}`)
  }
}

if (failed > 0) process.exit(1)
