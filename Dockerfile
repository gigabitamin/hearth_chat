# ======================
# 🔵 1. FRONTEND 빌드 단계
# ======================
FROM node:18 AS frontend

WORKDIR /app
COPY hearth_chat_react/package*.json ./
RUN npm ci --only=production

COPY hearth_chat_react/ ./
# 메모리 제한 설정으로 빌드 안정성 향상
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# ======================
# 🟡 2. BACKEND (Django)
# ======================
FROM python:3.11.5-slim

# 시스템 필수 패키지 설치 (pkg-config 추가)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    pkg-config \
    default-libmysqlclient-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 🔁 프론트 빌드 결과물 복사
COPY --from=frontend /app/build/ /app/hearth_chat_react/build/

# 장고 앱 복사
COPY hearth_chat_django/ ./hearth_chat_django/

# 작업 디렉토리를 Django 앱으로 변경
WORKDIR /app/hearth_chat_django

# 실행 스크립트 복사
COPY script/dh.sh /usr/local/bin/dh
COPY script/rh.sh /usr/local/bin/rh
COPY script/cs.sh /usr/local/bin/cs
RUN chmod +x /usr/local/bin/dh /usr/local/bin/rh /usr/local/bin/cs

# 정적 파일 수집 및 마이그레이션을 위한 스크립트 생성
RUN echo '#!/bin/bash\nset -e\necho "Starting Django setup..."\necho "Current directory: $(pwd)"\necho "Listing files:"\nls -la\necho "Collecting static files..."\npython manage.py collectstatic --noinput --verbosity=2\necho "Running migrations..."\npython manage.py migrate --verbosity=2\necho "Starting Daphne server..."\necho "Server will be available at http://0.0.0.0:8000"\necho "Health check endpoint: http://0.0.0.0:8000/health/"\necho "Root endpoint: http://0.0.0.0:8000/"\necho "Admin endpoint: http://0.0.0.0:8000/admin/"\necho "Waiting for server to start..."\nsleep 10\necho "Server is ready!"\necho "Testing health check..."\ncurl -f http://localhost:8000/ || echo "Health check failed but continuing..."\necho "Starting Daphne..."\nexec daphne -b 0.0.0.0 -p 8000 hearth_chat.asgi:application' > /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

EXPOSE 8000

CMD ["/usr/local/bin/start.sh"]