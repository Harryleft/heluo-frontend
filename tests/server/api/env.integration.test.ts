/**
 * /env 集成测试
 * @vitest-environment node
 */

import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../../../server/src/index.js'

describe('GET /env 集成测试', () => {
  let server
  let baseUrl = ''

  beforeAll(async () => {
    server = app.listen(0)
    const address = server.address()
    const port = (address as AddressInfo).port
    baseUrl = `http://127.0.0.1:${port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  })

  it('应返回运行时后端地址', async () => {
    const response = await fetch(`${baseUrl}/env`)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(typeof payload.backendBaseUrl).toBe('string')
    expect(payload.backendBaseUrl).toBe('/')
    expect(String(response.headers.get('cache-control') || '').includes('no-store')).toBe(true)
  })

  it('应优先使用显式配置的运行时后端地址', async () => {
    const previous = process.env.HELUO_RUNTIME_BACKEND_BASE_URL
    process.env.HELUO_RUNTIME_BACKEND_BASE_URL = 'https://api.example.com/runtime'

    try {
      const response = await fetch(`${baseUrl}/env`)
      const payload = await response.json()
      expect(response.status).toBe(200)
      expect(payload.backendBaseUrl).toBe('https://api.example.com/runtime/')
    } finally {
      if (previous === undefined) {
        delete process.env.HELUO_RUNTIME_BACKEND_BASE_URL
      } else {
        process.env.HELUO_RUNTIME_BACKEND_BASE_URL = previous
      }
    }
  })

  it('不应信任 x-forwarded 头动态拼接后端地址', async () => {
    const previous = process.env.HELUO_RUNTIME_BACKEND_BASE_URL
    delete process.env.HELUO_RUNTIME_BACKEND_BASE_URL

    try {
      const response = await fetch(`${baseUrl}/env`, {
        headers: {
          'x-forwarded-host': 'evil.example.com',
          'x-forwarded-proto': 'https',
        },
      })
      const payload = await response.json()
      expect(response.status).toBe(200)
      expect(payload.backendBaseUrl).toBe('/')
    } finally {
      if (previous === undefined) {
        delete process.env.HELUO_RUNTIME_BACKEND_BASE_URL
      } else {
        process.env.HELUO_RUNTIME_BACKEND_BASE_URL = previous
      }
    }
  })
})
