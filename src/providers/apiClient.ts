/**
 * API 客户端 Provider
 *
 * 为 features 层提供受控的 HTTP 客户端访问面。
 * features 层应通过此模块访问 HTTP 能力，禁止直接 import lib/api/http。
 */
import { http } from '@/lib/api/http'
import axios from 'axios'

export { http }
export const isAxiosError = axios.isAxiosError
