# apps/bim-service/src/services/pdf_parser.py
"""
用 PyMuPDF (fitz) 解析 PDF 图纸：
- 提取每页文字
- 将每页渲染为 base64 图片（144 DPI，供 Vision LLM 分析）
"""
import base64
import logging
import os
import tempfile
from dataclasses import dataclass

logger = logging.getLogger(__name__)

try:
    import fitz  # PyMuPDF
    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False


@dataclass
class ParsedPage:
    page_num: int       # 1-indexed
    text: str
    image_base64: str   # PNG, base64 encoded
    width: float        # points
    height: float       # points


class PdfParser:
    """解析 PDF 文件，返回每页的文字和 base64 图片。"""

    DPI = 144  # 144 DPI，增强施工图纸文字可读性

    def parse(self, file_bytes: bytes) -> list[ParsedPage]:
        if not HAS_FITZ:
            raise RuntimeError(
                "PyMuPDF (fitz) is not installed. Run: pip install pymupdf"
            )

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        pages: list[ParsedPage] = []

        for i, page in enumerate(doc):
            page_num = i + 1

            # 提取文字
            text = page.get_text("text").strip()

            # 渲染为图片
            matrix = fitz.Matrix(self.DPI / 72, self.DPI / 72)
            pixmap = page.get_pixmap(matrix=matrix, colorspace=fitz.csRGB)
            png_bytes = pixmap.tobytes("png")
            image_b64 = base64.b64encode(png_bytes).decode("utf-8")

            rect = page.rect
            pages.append(
                ParsedPage(
                    page_num=page_num,
                    text=text,
                    image_base64=image_b64,
                    width=rect.width,
                    height=rect.height,
                )
            )

            size_kb = len(png_bytes) // 1024
            logger.info(
                f"[pdf_parser] 第 {page_num} 页: "
                f"尺寸={rect.width:.0f}×{rect.height:.0f}pt, "
                f"文字={len(text)} 字符, "
                f"图片={size_kb}KB (base64={len(image_b64)//1024}KB)"
            )
            if text:
                preview = text[:120].replace("\n", " ")
                logger.info(f"[pdf_parser] 第 {page_num} 页文字预览: {preview}")

        doc.close()
        return pages
