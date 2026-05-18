from pydantic import BaseModel
from typing import Optional


class IFCParseRequest(BaseModel):
    file_url: str  # S3 URL


class BOQItem(BaseModel):
    item_type: str
    description: str
    quantity: float
    unit: str
    elements: list[str]


class IFCParseResult(BaseModel):
    job_id: str
    schema: str
    project: dict
    elements: list[dict]
    spatial_structure: list[dict]
    boq: list[BOQItem]


class DocumentIngestRequest(BaseModel):
    file_url: str
    domain: str  # RAG 知识领域
    title: Optional[str] = None
    source_type: str = "upload"


# ─── PDF 解析 ──────────────────────────────────────────────────

class ParsedPageResponse(BaseModel):
    page_num: int
    text: str
    image_base64: str   # PNG, base64 encoded
    width: float
    height: float


class ParsePdfResponse(BaseModel):
    pages: list[ParsedPageResponse]
    page_count: int

