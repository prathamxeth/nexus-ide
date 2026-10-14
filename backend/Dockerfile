# ==========================================
# Multi-Stage Dockerfile for Nexus Backend
# ==========================================

# Stage 1: Build dependencies & Tree-sitter C extensions
FROM python:3.11-slim AS builder

WORKDIR /app

# Install native compilation dependencies for tree-sitter
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    make \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Minimal runtime image
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed python packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

# Copy application source code
COPY . .

EXPOSE 8000

HEALTHCHECK --interval=5s --timeout=3s --retries=5 --start-period=5s \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
