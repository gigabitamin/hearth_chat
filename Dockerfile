# 1. Python 베이스 이미지
FROM python:3.11-slim

# 2. 작업 디렉토리 생성
WORKDIR /app

# 3. 시스템 패키지 설치 (node, npm, 빌드툴 등)
RUN apt-get update && apt-get install -y build-essential libpq-dev ffmpeg nodejs npm

# 4. 파이썬 패키지 설치
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# 5. 소스 전체 복사 (여기서 .dockerignore가 적용됨)
COPY . .

# 6. React 빌드
WORKDIR /app/hearth_chat_react
RUN npm install && npm run build

# 7. Django static 파일 수집
WORKDIR /app/hearth_chat_django
RUN python manage.py collectstatic --noinput

# 8. 포트 지정 (Railway는 8000, 8080 등 사용 가능)
EXPOSE 8000

# 9. Daphne로 ASGI 서버 실행
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "hearth_chat_django.asgi:application"]