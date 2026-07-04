"""
本地 LLM OpenAI 兼容服务

用途：
1. 加载本地荀子模型（默认 ~/.cache/heluo/models/Xunzi-Qwen1.5-4B）
2. 提供 /v1/chat/completions（支持 stream=true/false）
3. 兼容前端与后端当前的 OpenAI Chat Completions 调用方式
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List

import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from transformers import AutoModelForCausalLM, AutoTokenizer


DEFAULT_MODELS_DIR = Path(os.getenv("HELUO_MODELS_DIR", Path.home() / ".cache" / "heluo" / "models"))
MODEL_PATH = os.getenv("LLM_MODEL_PATH", str(DEFAULT_MODELS_DIR / "Xunzi-Qwen1.5-4B"))
MODEL_NAME = os.getenv("LLM_MODEL_NAME", "Xunzi-Qwen1.5-4B")
HOST = os.getenv("LLM_HOST", "127.0.0.1")
PORT = int(os.getenv("LLM_PORT", "18000"))
PREFERRED_DEVICE = os.getenv("LLM_DEVICE", "auto").strip().lower()
FORCE_CPU = os.getenv("LLM_FORCE_CPU", "false").strip().lower() == "true"
ATTN_IMPLEMENTATION = os.getenv("LLM_ATTN_IMPLEMENTATION", "eager").strip().lower()

app = FastAPI(title="Heluo Local LLM Service", version="1.0.0")

tokenizer = None
model = None
runtime_device = "unknown"
runtime_dtype = "unknown"


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str = Field(default=MODEL_NAME)
    messages: List[ChatMessage]
    max_tokens: int = Field(default=512, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    stream: bool = Field(default=False)


def _load_model() -> None:
    global tokenizer, model, runtime_device, runtime_dtype
    if tokenizer is not None and model is not None:
        return

    if not os.path.isdir(MODEL_PATH):
        raise RuntimeError(f"模型路径不存在：{MODEL_PATH}")

    if FORCE_CPU:
        candidate_devices = ["cpu"]
    elif PREFERRED_DEVICE in {"cpu", "cuda"}:
        candidate_devices = [PREFERRED_DEVICE]
    else:
        candidate_devices = ["cuda", "cpu"] if torch.cuda.is_available() else ["cpu"]

    print(f"[LLM] 加载模型：{MODEL_PATH}")
    print(f"[LLM] 设备候选：{candidate_devices}")

    load_errors: List[str] = []
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, trust_remote_code=True)

    for device in candidate_devices:
        try:
            dtype = torch.float16 if device == "cuda" else torch.float32
            model_kwargs: Dict[str, Any] = {
                "torch_dtype": dtype,
                "trust_remote_code": True,
                "low_cpu_mem_usage": True,
                "attn_implementation": ATTN_IMPLEMENTATION,
            }
            if device == "cuda":
                model_kwargs["device_map"] = "auto"

            print(f"[LLM] 尝试设备：{device}，dtype：{dtype}")
            model = AutoModelForCausalLM.from_pretrained(MODEL_PATH, **model_kwargs)
            if device != "cuda":
                model = model.to("cpu")
            model.eval()

            runtime_device = device
            runtime_dtype = str(dtype)
            print(f"[LLM] 模型加载完成，运行设备：{runtime_device}，dtype：{runtime_dtype}")
            return
        except Exception as exc:
            error_text = f"{device}: {exc}"
            load_errors.append(error_text)
            print(f"[LLM] 设备 {device} 加载失败：{exc}")

    raise RuntimeError(f"模型加载失败，尝试结果：{' | '.join(load_errors)}")


def _messages_to_prompt(messages: List[ChatMessage]) -> torch.Tensor:
    message_dicts = [{"role": item.role, "content": item.content} for item in messages]

    if hasattr(tokenizer, "apply_chat_template"):
        input_ids = tokenizer.apply_chat_template(
            message_dicts,
            tokenize=True,
            add_generation_prompt=True,
            return_tensors="pt",
        )
    else:
        lines: List[str] = []
        for item in message_dicts:
            lines.append(f"{item['role']}: {item['content']}")
        lines.append("assistant:")
        prompt = "\n".join(lines)
        input_ids = tokenizer(prompt, return_tensors="pt").input_ids

    return input_ids.to(model.device)


def _generate_text(req: ChatCompletionRequest) -> str:
    if not req.messages:
        raise ValueError("messages 不能为空")

    input_ids = _messages_to_prompt(req.messages)
    generate_kwargs: Dict[str, Any] = {
        "max_new_tokens": int(req.max_tokens),
        "do_sample": req.temperature > 0,
        "temperature": max(float(req.temperature), 1e-5),
        "pad_token_id": tokenizer.eos_token_id,
        "eos_token_id": tokenizer.eos_token_id,
    }

    with torch.no_grad():
        output_ids = model.generate(input_ids, **generate_kwargs)

    new_tokens = output_ids[0][input_ids.shape[-1] :]
    text = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
    return text


def _build_completion_response(
    content: str,
    request_model: str,
    completion_id: str,
    created_at: int,
) -> Dict[str, Any]:
    return {
        "id": completion_id,
        "object": "chat.completion",
        "created": created_at,
        "model": request_model or MODEL_NAME,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        },
    }


def _split_stream_chunks(text: str, chunk_size: int = 20) -> List[str]:
    if not text:
        return []
    return [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]


@app.on_event("startup")
def on_startup() -> None:
    _load_model()


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "model": MODEL_NAME,
        "modelPath": MODEL_PATH,
        "device": runtime_device,
        "dtype": runtime_dtype,
    }


@app.get("/v1/models")
def list_models() -> Dict[str, Any]:
    return {
        "object": "list",
        "data": [
            {
                "id": MODEL_NAME,
                "object": "model",
                "created": int(time.time()),
                "owned_by": "local",
            }
        ],
    }


@app.post("/v1/chat/completions")
async def create_chat_completion(req: ChatCompletionRequest):
    try:
        content = _generate_text(req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"生成失败：{exc}") from exc

    completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    created_at = int(time.time())

    if not req.stream:
        payload = _build_completion_response(content, req.model, completion_id, created_at)
        return JSONResponse(payload)

    async def event_generator():
        for chunk in _split_stream_chunks(content):
            payload = {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created_at,
                "model": req.model or MODEL_NAME,
                "choices": [
                    {
                        "index": 0,
                        "delta": {"content": chunk},
                        "finish_reason": None,
                    }
                ],
            }
            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.01)

        done_payload = {
            "id": completion_id,
            "object": "chat.completion.chunk",
            "created": created_at,
            "model": req.model or MODEL_NAME,
            "choices": [
                {
                    "index": 0,
                    "delta": {},
                    "finish_reason": "stop",
                }
            ],
        }
        yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
