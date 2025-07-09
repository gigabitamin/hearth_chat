# 1. Python 베이스 이미지 (더 가벼운 버전 사용)
FROM python:3.11.5-slim

# 2. 작업 디렉토리 생성
WORKDIR /app

# 3. 시스템 패키지 설치 (필수 패키지만)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    nodejs \
    npm \
    pkg-config \
    default-libmysqlclient-dev \
    && rm -rf /var/lib/apt/lists/*

# 4. 파이썬 패키지 설치 (캐시 최적화)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 5. React 빌드 (캐시 최적화)
WORKDIR /app/hearth_chat_react
COPY hearth_chat_react/package*.json ./
RUN npm ci --only=production

COPY hearth_chat_react/ .
RUN npm run build

# 6. Django 설정
WORKDIR /app/hearth_chat_django
COPY hearth_chat_django/ .

# 7. 스크립트 복사 및 권한 설정
COPY script/dh.sh /usr/local/bin/dh
COPY script/rh.sh /usr/local/bin/rh
COPY script/cs.sh /usr/local/bin/cs
RUN chmod +x /usr/local/bin/dh /usr/local/bin/rh /usr/local/bin/cs

# 8. 포트 지정
EXPOSE 8000

# 9. Daphne로 ASGI 서버 실행
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "hearth_chat_django.asgi:application"]