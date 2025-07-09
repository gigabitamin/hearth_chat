# ======================
# 🔵 1. FRONTEND 빌드 단계
# ======================
FROM node:18 AS frontend

WORKDIR /app
COPY hearth_chat_react/package*.json ./
RUN npm ci --only=production

COPY hearth_chat_react/ ./
RUN npm run build

# ======================
# 🟡 2. BACKEND (Django)
# ======================
FROM python:3.11.5-slim

# 시스템 필수 패키지 설치
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
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

# 실행 스크립트 복사
COPY script/dh.sh /usr/local/bin/dh
COPY script/rh.sh /usr/local/bin/rh
COPY script/cs.sh /usr/local/bin/cs
RUN chmod +x /usr/local/bin/dh /usr/local/bin/rh /usr/local/bin/cs

EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "hearth_chat_django.asgi:application"]