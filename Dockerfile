# Single-service image: builds the React app, then serves it from FastAPI (same origin, no CORS needed).
# Used by Render (render.yaml) and docker-compose.yml.

# ---------- 1. frontend build
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_SITE_URL=http://localhost:8000
ENV VITE_SITE_URL=$VITE_SITE_URL VITE_API_URL=""
RUN npm run build

# ---------- 2. API + static site
FROM python:3.11-slim
ARG INSTALL_AI=false
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /srv/backend
COPY backend/requirements.txt backend/requirements-ai.txt ./
RUN pip install -r requirements.txt
# Real AI needs a GPU host: build with --build-arg INSTALL_AI=true
RUN if [ "$INSTALL_AI" = "true" ]; then \
      apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/* && \
      pip install torch torchvision && pip install -r requirements-ai.txt; \
    fi
COPY backend/alembic.ini ./
COPY backend/migrations ./migrations
COPY backend/app ./app
COPY --from=web /web/dist /srv/frontend/dist
RUN useradd --create-home app && mkdir -p /srv/data && chown -R app /srv/data
USER app
ENV FRONTEND_DIST=/srv/frontend/dist STORAGE_DIR=/srv/data/storage
EXPOSE 8000
# Render injects $PORT; locally it defaults to 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
