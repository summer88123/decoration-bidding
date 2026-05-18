import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes import router

_LOG_FMT = "%(asctime)s %(levelname)s [%(name)s] %(message)s"
_DATE_FMT = "%Y-%m-%d %H:%M:%S"

# 强制为所有 logger（包含 uvicorn.*）设置含日期时间的 formatter
def _setup_logging() -> None:
    formatter = logging.Formatter(_LOG_FMT, datefmt=_DATE_FMT)
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    for handler in root.handlers:
        handler.setFormatter(formatter)
    # 若 root 还没有 handler（首次调用），先添加一个 StreamHandler
    if not root.handlers:
        h = logging.StreamHandler()
        h.setFormatter(formatter)
        root.addHandler(h)
    # 同步覆盖 uvicorn 自己的 logger
    for name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        lg = logging.getLogger(name)
        lg.handlers = []
        lg.propagate = True

_setup_logging()


def create_app() -> FastAPI:
    app = FastAPI(
        title="BIM/IFC Service",
        description="IFC 文件解析、BOQ 数量提取、3D 模型处理、文档预处理",
        version="0.0.1",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router, prefix="/bim")

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "bim-service"}

    return app

app = create_app()
