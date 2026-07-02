/**
 * http.ts 单元测试
 * 测试 axios HTTP 客户端配置
 */

import { describe, expect, it } from 'vitest'

import { http } from '@/lib/api/http'

describe('HTTP 客户端配置', () => {
  it('应该创建 axios 实例', () => {
    expect(http).toBeDefined()
    expect(http.get).toBeDefined()
    expect(http.post).toBeDefined()
    expect(http.put).toBeDefined()
    expect(http.delete).toBeDefined()
  })

  it('baseURL 应该设置为根路径', () => {
    expect(http.defaults.baseURL).toBe('/')
  })

  it('timeout 应该设置为 20000ms', () => {
    expect(http.defaults.timeout).toBe(20000)
  })

  it('应该有默认的请求拦截器', () => {
    // axios 默认会有一些拦截器
    expect(http.interceptors.request).toBeDefined()
    expect(http.interceptors.response).toBeDefined()
  })

  it('应该支持 GET 请求', async () => {
    // 验证 http.get 方法存在且为函数
    expect(typeof http.get).toBe('function')
  })

  it('应该支持 POST 请求', async () => {
    expect(typeof http.post).toBe('function')
  })

  it('应该支持 PUT 请求', async () => {
    expect(typeof http.put).toBe('function')
  })

  it('应该支持 DELETE 请求', async () => {
    expect(typeof http.delete).toBe('function')
  })
})
