"""
本地 Embedding 服务
使用 FastAPI + Transformers 提供 REST API

模型：bge-large-zh
本地路径：D:\\hf_models\\bge-large-zh
向量维度：1024

启动方式：
    python server.py
    或
    uvicorn server:app --host 0.0.0.0 --port 8080

依赖安装：
    pip install fastapi uvicorn sentence-transformers torch
"""

import os
import time
from typing import Optional

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import uvicorn

# ========== 配置 ==========
# 模型路径（本地）
MODEL_PATH = os.environ.get("EMBEDDING_MODEL_PATH", r"D:\hf_models\text2vec-base-chinese")
MODEL_NAME = "text2vec-base-chinese"
# 设备选择
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
# 服务端口
PORT = int(os.environ.get("EMBEDDING_SERVICE_PORT", 8080))
# 最大序列长度
MAX_SEQ_LENGTH = 512

# ========== FastAPI 应用 ==========
app = FastAPI(
    title="河洛 Embedding 服务",
    description="基于 bge-large-zh 的文本向量化服务",
    version="1.0.0",
)

# ========== 全局模型 ==========
model: Optional[SentenceTransformer] = None
model_load_time: Optional[float] = None


# ========== 请求/响应模型 ==========
class EmbedRequest(BaseModel):
    """嵌入请求"""

    texts: list[str]
    model: str = MODEL_NAME
    normalize: bool = True
    max_length: Optional[int] = None


class EmbedResponse(BaseModel):
    """嵌入响应"""

    embeddings: list[list[float]]
    dimension: int
    model: str
    count: int
    processing_time_ms: float


class HealthResponse(BaseModel):
    """健康检查响应"""

    status: str
    model: str
    device: str
    dimension: int
    model_loaded: bool
    model_load_time_s: Optional[float] = None


# ========== 启动事件 ==========
@app.on_event("startup")
async def load_model():
    """启动时加载模型"""
    global model, model_load_time

    start_time = time.time()
    print(f"[Startup] 正在加载模型: {MODEL_PATH}")
    print(f"[Startup] 设备: {DEVICE}")

    try:
        # 检查模型路径是否存在
        if os.path.exists(MODEL_PATH):
            print(f"[Startup] 从本地路径加载: {MODEL_PATH}")
            model = SentenceTransformer(MODEL_PATH, device=DEVICE)
        else:
            # 如果本地路径不存在，尝试从 HuggingFace 下载
            print(f"[Startup] 本地路径不存在，从 HuggingFace 下载: shibing624/{MODEL_NAME}")
            model = SentenceTransformer(f"shibing624/{MODEL_NAME}", device=DEVICE)

        # 设置最大序列长度
        model.max_seq_length = MAX_SEQ_LENGTH

        model_load_time = time.time() - start_time
        print(f"[Startup] 模型加载完成，耗时: {model_load_time:.2f}s")
        print(f"[Startup] 向量维度: {model.get_sentence_embedding_dimension()}")

    except Exception as e:
        print(f"[Startup] 模型加载失败: {e}")
        model = None


# ========== API 端点 ==========
@app.get("/", response_class=dict)
async def root():
    """根路径"""
    return {
        "service": "河洛 Embedding 服务",
        "model": MODEL_NAME,
        "dimension": model.get_sentence_embedding_dimension() if model else None,
        "endpoints": {
            "embed": "POST /embed - 获取文本嵌入向量",
            "health": "GET /health - 健康检查",
            "similarity": "POST /similarity - 计算文本相似度",
        },
    }


@app.get("/health", response_model=HealthResponse)
async def health():
    """健康检查"""
    return HealthResponse(
        status="ok" if model is not None else "model_not_loaded",
        model=MODEL_NAME,
        device=DEVICE,
        dimension=model.get_sentence_embedding_dimension() if model else 0,
        model_loaded=model is not None,
        model_load_time_s=model_load_time,
    )


@app.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest):
    """
    获取文本嵌入向量

    - **texts**: 文本列表
    - **normalize**: 是否归一化向量（默认 True）
    - **max_length**: 最大序列长度（可选）
    """
    if model is None:
        raise HTTPException(status_code=503, detail="模型未加载")

    if not request.texts:
        raise HTTPException(status_code=400, detail="texts 不能为空")

    # 验证文本
    valid_texts = []
    for i, text in enumerate(request.texts):
        if not text or not isinstance(text, str):
            raise HTTPException(status_code=400, detail=f"texts[{i}] 无效")
        valid_texts.append(text.strip())

    start_time = time.time()

    try:
        # 生成嵌入向量
        embeddings = model.encode(
            valid_texts,
            normalize_embeddings=request.normalize,
            convert_to_numpy=True,
            show_progress_bar=False,
        )

        processing_time = (time.time() - start_time) * 1000  # 毫秒

        return EmbedResponse(
            embeddings=embeddings.tolist(),
            dimension=embeddings.shape[1],
            model=MODEL_NAME,
            count=len(valid_texts),
            processing_time_ms=round(processing_time, 2),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"嵌入生成失败: {str(e)}")


class SimilarityRequest(BaseModel):
    """相似度计算请求"""

    text1: str
    text2: str
    normalize: bool = True


class SimilarityResponse(BaseModel):
    """相似度计算响应"""

    similarity: float
    text1: str
    text2: str
    processing_time_ms: float


@app.post("/similarity", response_model=SimilarityResponse)
async def similarity(request: SimilarityRequest):
    """
    计算两个文本的相似度

    - **text1**: 第一个文本
    - **text2**: 第二个文本
    - **normalize**: 是否归一化向量（默认 True）
    """
    if model is None:
        raise HTTPException(status_code=503, detail="模型未加载")

    if not request.text1 or not request.text2:
        raise HTTPException(status_code=400, detail="text1 和 text2 不能为空")

    start_time = time.time()

    try:
        # 生成嵌入向量
        embeddings = model.encode(
            [request.text1.strip(), request.text2.strip()],
            normalize_embeddings=request.normalize,
            convert_to_numpy=True,
            show_progress_bar=False,
        )

        # 计算余弦相似度
        vec1, vec2 = embeddings[0], embeddings[1]
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = sum(a * a for a in vec1) ** 0.5
        norm2 = sum(b * b for b in vec2) ** 0.5

        if norm1 == 0 or norm2 == 0:
            similarity_score = 0.0
        else:
            similarity_score = dot_product / (norm1 * norm2)

        processing_time = (time.time() - start_time) * 1000

        return SimilarityResponse(
            similarity=round(similarity_score, 6),
            text1=request.text1,
            text2=request.text2,
            processing_time_ms=round(processing_time, 2),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"相似度计算失败: {str(e)}")


# ========== 主入口 ==========
if __name__ == "__main__":
    print(f"=" * 50)
    print(f"河洛 Embedding 服务")
    print(f"模型: {MODEL_NAME}")
    print(f"路径: {MODEL_PATH}")
    print(f"设备: {DEVICE}")
    print(f"端口: {PORT}")
    print(f"=" * 50)

    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=PORT,
        reload=False,
        log_level="info",
    )
