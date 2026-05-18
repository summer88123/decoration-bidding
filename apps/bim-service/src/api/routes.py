import logging
import time

from fastapi import APIRouter, UploadFile, File, HTTPException
from ..models.schemas import ParsePdfResponse, ParsedPageResponse
from ..services.pdf_parser import PdfParser

logger = logging.getLogger(__name__)
router = APIRouter()
_pdf_parser = PdfParser()


@router.get("/")
async def index():
    return {"message": "BIM/IFC 服务运行中"}


@router.post("/parse-pdf", response_model=ParsePdfResponse)
async def parse_pdf(file: UploadFile = File(...)):
    """接收 PDF 文件，返回每页文字 + base64 图片，供 AI Agent Vision 分析。"""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="仅支持 PDF 文件")

    file_bytes = await file.read()
    file_size_kb = len(file_bytes) / 1024
    logger.info(f"[parse-pdf] 开始解析: {file.filename} ({file_size_kb:.1f} KB)")
    t0 = time.time()

    try:
        pages = _pdf_parser.parse(file_bytes)
    except RuntimeError as exc:
        logger.error(f"[parse-pdf] 解析失败: {exc}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    elapsed = time.time() - t0
    total_chars = sum(len(p.text) for p in pages)
    logger.info(
        f"[parse-pdf] 解析完成: {len(pages)} 页, "
        f"共 {total_chars} 字符, 耗时 {elapsed:.1f}s"
    )

    return ParsePdfResponse(
        pages=[
            ParsedPageResponse(
                page_num=p.page_num,
                text=p.text,
                image_base64=p.image_base64,
                width=p.width,
                height=p.height,
            )
            for p in pages
        ],
        page_count=len(pages),
    )


# IFC 解析路由占位
# POST /bim/ifc/parse         - 上传并解析 IFC 文件
# GET  /bim/ifc/{job_id}      - 获取解析结果
# POST /bim/ifc/{job_id}/boq  - 提取 BOQ 工程量清单
# POST /bim/ifc/write         - 生成/修改 IFC 交付文件

# 文档预处理路由（RAG 摄入）
# POST /bim/documents/ingest  - 摄入 PDF/Word/Excel 文档
