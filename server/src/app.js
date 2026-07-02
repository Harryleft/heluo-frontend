/**
 * Express API Server for Heluo Frontend
 *
 * Main entry point for the backend API server. Responsibilities:
 * - Environment configuration and initialization
 * - Express middleware setup
 * - Dependency injection container initialization
 * - Route registration
 *
 * @module server/src/app
 */

// ============================================================================
// Environment Configuration (must be the first import!)
// ============================================================================

// 此导入必须在所有其他导入之前，以确保 .env 文件被正确加载
// ES Module 的 import 语句会被提升，因此需要单独的模块来加载 dotenv
import './bootstrap/env.js'

// ============================================================================
// Imports
// ============================================================================

// Node.js / External dependencies
import express from 'express'
import DigestClient from 'digest-fetch'

// Configuration
import {
  serverConfig,
  marklogicConfig,
} from './bootstrap/config.js'

// Services
import {
  buildFusionAnswer,
  ensurePoemListCoverage,
  generateLlmAnswerStream,
  generateLlmTextByPrompt,
  isLlmEnabled,
  normalizePlainText,
  extractPersonReferredContents,
  buildPersonAiIntroFallback,
  normalizePoemAnalysisInput,
  buildPoemAiAnalysisFallback,
  buildPoemAiAnalysisPrompt,
} from './services/llmService.js'
import { getEmbedding } from './services/embeddingService.js'
import {
  mlVectorSearch,
  isVectorSearchEnabled,
  VECTOR_CONFIG,
} from './services/vectorSearchService.js'

// Domain
import { getPersonPoemTrack } from './domain/track/poemTrackService.js'
import { parseSearchTypes, rerankSearchCandidates } from './search/hybridSearchUtils.js'

// Infrastructure Gateways
import {
  setMarklogicFetchForTest,
  resetMarklogicFetch,
  mlGetJson,
  mlGetDoc,
  mlSearchByDirectory,
  mlSearchByCollection,
} from './infra/gateways/marklogicGateway.js'

// Bootstrap
import { registerAppMiddleware, assembleAppRoutes } from './bootstrap/appAssembly.js'

// ============================================================================
// Constants
// ============================================================================

/** Server port (exported for external use) */
export const PORT = serverConfig.port

/** Feature flag to disable host URL rewriting in responses */
const HELUO_DISABLE_HOST_REWRITE =
  String(process.env.HELUO_DISABLE_HOST_REWRITE || '').trim() === '1'

/** MarkLogic digest client instance */
const _mlClient = new DigestClient(
  marklogicConfig.user,
  marklogicConfig.password,
  { algorithm: marklogicConfig.algorithm }
)

/** Default fetch function bound to MarkLogic client */
const _defaultMarklogicFetch = (...args) => _mlClient.fetch(...args)

// ============================================================================
// Public API - Express Application
// ============================================================================

/** Express application instance */
export const app = express()

// --- Middleware Setup ---

registerAppMiddleware(app, {
  port: PORT,
  disableHostRewrite: HELUO_DISABLE_HOST_REWRITE,
})

// --- Route Registration ---

assembleAppRoutes(app, _defaultMarklogicFetch)

// ============================================================================
// Public Exports
// ============================================================================

// Test utilities (from marklogicGateway)
export { setMarklogicFetchForTest, resetMarklogicFetch }

// Gateway utilities
export { mlGetJson, mlGetDoc, mlSearchByDirectory, mlSearchByCollection }

// Service functions
export {
  buildFusionAnswer,
  ensurePoemListCoverage,
  generateLlmAnswerStream,
  generateLlmTextByPrompt,
  isLlmEnabled,
  getEmbedding,
  mlVectorSearch,
  isVectorSearchEnabled,
  VECTOR_CONFIG,
  getPersonPoemTrack,
  parseSearchTypes,
  rerankSearchCandidates,
}
