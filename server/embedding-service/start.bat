@echo off
chcp 65001 >nul
echo ========================================
echo 河洛 Embedding 服务启动脚本
echo ========================================
echo.

REM 设置环境变量
set EMBEDDING_MODEL_PATH=D:\hf_models\text2vec-base-chinese
set EMBEDDING_SERVICE_PORT=8080

echo 模型路径: %EMBEDDING_MODEL_PATH%
echo 服务端口: %EMBEDDING_SERVICE_PORT%
echo.

REM 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.10+
    pause
    exit /b 1
)

REM 检查依赖
echo 检查依赖...
pip show fastapi >nul 2>&1
if errorlevel 1 (
    echo [警告] 依赖未安装，正在安装...
    pip install -r requirements.txt
)

echo.
echo 启动服务...
echo.

REM 启动服务
python server.py

pause
