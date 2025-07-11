# ======================
# 🔵 1. FRONTEND 빌드 단계
# ======================
FROM node:18 AS frontend

WORKDIR /app
# package.json과 package-lock.json을 모두 복사
# COPY package.json package-lock.json ./
COPY hearth_chat_react/package.json hearth_chat_react/package-lock.json ./
RUN npm install

COPY hearth_chat_react/ ./
# 메모리 제한 설정으로 빌드 안정성 향상
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# 소스맵 파일 삭제 (Docker 이미지 크기 최적화)
RUN find /app/build -type f -name "*.map" -delete

RUN ls -la /app/build/ || echo "build directory not found"
RUN ls -la /app/build/static/ || echo "static directory not found"
RUN ls -la /app/build/static/js/ || echo "static/js directory not found"
RUN ls -la /app/build/avatar_vrm/ || echo "avatar_vrm directory not found"

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
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 🔁 프론트 빌드 결과물 복사
COPY --from=frontend /app/build/ /app/hearth_chat_react/build/
RUN ls -la /app/hearth_chat_react/build/ || echo "build directory not found"
RUN ls -la /app/hearth_chat_react/build/static/ || echo "static directory not found"
RUN ls -la /app/hearth_chat_react/build/static/js/ || echo "static/js directory not found"

# 장고 앱 복사
COPY hearth_chat_django/ ./hearth_chat_django/

# React 빌드 결과물 복사 (이미 있음)
COPY --from=frontend /app/build/ /app/hearth_chat_react/build/

# 빌드 타임에 collectstatic 실행
ENV DATABASE_URL=sqlite:///tmp/db.sqlite3
WORKDIR /app/hearth_chat_django
RUN python manage.py collectstatic --noinput

# 작업 디렉토리를 Django 앱으로 변경
# WORKDIR /app/hearth_chat_django

# 실행 스크립트 복사
COPY script/dh.sh /usr/local/bin/dh
COPY script/rh.sh /usr/local/bin/rh
COPY script/cs.sh /usr/local/bin/cs
RUN chmod +x /usr/local/bin/dh /usr/local/bin/rh /usr/local/bin/cs

# start.sh 복사 및 실행 권한 부여
COPY script/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

EXPOSE 8000

CMD ["/usr/local/bin/start.sh"]