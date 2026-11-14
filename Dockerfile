# Multi-stage production build for TraceFlow

# Stage 1: Build Frontend Assets
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python Backend + Static Asset Server
FROM python:3.11-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Install system dependencies (build-essential, libgomp1 for LightGBM)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code and configurations
COPY traceflow/ traceflow/
COPY src/ src/
COPY api/ api/
COPY data/ data/
COPY models/ models/
COPY scripts/ scripts/
COPY config.yaml .
COPY CONTRACTS.md .
COPY README.md .

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 8000

# Run FastAPI uvicorn daemon supporting dynamic cloud PORT
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
