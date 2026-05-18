FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖（IfcOpenShell 需要）
RUN apt-get update && apt-get install -y \
    libgomp1 \
    tesseract-ocr \
    tesseract-ocr-chi-tra \
    tesseract-ocr-chi-sim \
    && rm -rf /var/lib/apt/lists/*

COPY apps/bim-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/bim-service/ .

EXPOSE 3008
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3008"]
