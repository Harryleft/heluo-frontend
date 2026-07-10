export function createSearchWithFallback(gateways) {
  const { mlSearchByDirectory, mlSearchByCollection } = gateways

  return async function searchWithFallback({ query, pageLength, directories = [], collections = [] }) {
    // 按目录搜索
    for (const directory of directories) {
      try {
        const result = await mlSearchByDirectory(directory, query, pageLength)
        if (result && result.results && result.results.length > 0) {
          return result
        }
      } catch (error) {
        console.error(`searchWithFallback: 搜索目录 ${directory} 失败:`, error.message)
      }
    }

    // 按集合搜索
    for (const collection of collections) {
      try {
        const result = await mlSearchByCollection(collection, query, pageLength)
        if (result && result.results && result.results.length > 0) {
          return result
        }
      } catch (error) {
        console.error(`searchWithFallback: 搜索集合 ${collection} 失败:`, error.message)
      }
    }

    return { results: [], total: 0 }
  }
}
