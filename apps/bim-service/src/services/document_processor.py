"""
Document Processor - 文档预处理（RAG 摄入管道）
处理 PDF / Word / Excel，供 AI 智能体服务使用
"""
from __future__ import annotations
from pathlib import Path


class DocumentProcessor:
    """统一文档预处理入口"""

    def process(self, file_path: str | Path) -> dict:
        path = Path(file_path)
        ext = path.suffix.lower()

        if ext == ".pdf":
            return self._process_pdf(path)
        elif ext in (".docx", ".doc"):
            return self._process_word(path)
        elif ext in (".xlsx", ".xls", ".csv"):
            return self._process_excel(path)
        else:
            raise ValueError(f"Unsupported file type: {ext}")

    def _process_pdf(self, path: Path) -> dict:
        import fitz  # PyMuPDF
        doc = fitz.open(str(path))
        text = "\n".join(page.get_text() for page in doc)
        return {"type": "pdf", "content": text, "pages": len(doc)}

    def _process_word(self, path: Path) -> dict:
        from docx import Document
        doc = Document(str(path))
        text = "\n".join(para.text for para in doc.paragraphs)
        return {"type": "word", "content": text}

    def _process_excel(self, path: Path) -> dict:
        import pandas as pd
        df = pd.read_excel(str(path)) if path.suffix != ".csv" else pd.read_csv(str(path))
        return {"type": "excel", "content": df.to_markdown()}
