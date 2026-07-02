# Embedding 服务

基于 bge-large-zh 的文本向量化服务，用于河洛古典文学问答系统的语义搜索。

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

**Windows:**
```bash
start.bat
```

**或手动启动:**
```bash
set EMBEDDING_MODEL_PATH=D:\hf_models\bge-large-zh
python server.py
```

### 3. 验证服务

```bash
# 健康检查
curl http://localhost:8080/health

# 测试嵌入
curl -X POST http://localhost:8080/embed \
  -H "Content-Type: application/json" \
  -d '{"texts": ["杜甫的诗", "李白的诗"]}'
```

## API 端点

### GET /

服务信息

### GET /health

健康检查

**响应示例:**
```json
{
  "status": "ok",
  "model": "bge-large-zh",
  "device": "cuda",
  "dimension": 1024,
  "model_loaded": true,
  "model_load_time_s": 5.2
}
```

### POST /embed

获取文本嵌入向量

**请求:**
```json
{
  "texts": ["杜甫的诗", "李白的诗"],
  "normalize": true
}
```

**响应:**
```json
{
  "embeddings": [[0.123, 0.456, ...], [0.789, 0.012, ...]],
  "dimension": 1024,
  "model": "bge-large-zh",
  "count": 2,
  "processing_time_ms": 15.3
}
```

### POST /similarity

计算两个文本的相似度

**请求:**
```json
{
  "text1": "杜甫的诗",
  "text2": "杜工部的诗歌作品"
}
```

**响应:**
```json
{
  "similarity": 0.89,
  "text1": "杜甫的诗",
  "text2": "杜工部的诗歌作品",
  "processing_time_ms": 8.5
}
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `EMBEDDING_MODEL_PATH` | `D:\hf_models\bge-large-zh` | 本地模型路径 |
| `EMBEDDING_SERVICE_PORT` | `8080` | 服务端口 |

## 模型信息

- **模型名称**: bge-large-zh
- **向量维度**: 1024
- **最大序列长度**: 512
- **语言**: 中文
- **来源**: [BAAI/bge-large-zh](https://huggingface.co/BAAI/bge-large-zh)

## 与后端集成

在 `.env` 文件中配置:

```bash
EMBEDDING_SERVICE_URL=http://localhost:8080
HELUO_SEARCH_MODE=hybrid
VECTOR_SEARCH_ENABLED=true
```

## 故障排除

### 模型加载失败

1. 确认模型路径正确
2. 检查磁盘空间
3. 如果本地模型不存在，服务会自动从 HuggingFace 下载

### GPU 不可用

服务会自动降级到 CPU 模式，但速度会较慢。

### 端口被占用

修改 `EMBEDDING_SERVICE_PORT` 环境变量或关闭占用 8080 端口的程序。
