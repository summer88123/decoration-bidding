from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.routes import router


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
