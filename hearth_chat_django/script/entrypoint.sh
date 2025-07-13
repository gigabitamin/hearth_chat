#!/bin/bash
set -e

# Django 앱 디렉토리로 이동
cd /app/hearth_chat_django

echo "Starting Django application..."

# DB 마이그레이션 (더 강력한 재시도)
echo "Running database migrations..."
python manage.py migrate --noinput || {
    echo "Migration failed, trying to create tables..."
    python manage.py makemigrations --noinput || echo "makemigrations failed"
    python manage.py migrate --noinput || echo "Migration failed again, continuing..."
}

# 정적 파일 수집 (실패해도 계속 진행)
echo "Collecting static files..."
python manage.py collectstatic --noinput || echo "collectstatic failed, continuing..."

echo "Starting server..."
# 서버 실행
exec daphne -b 0.0.0.0 -p 8080 hearth_chat.asgi:application 