#!/bin/bash
set -e

# Django 앱 디렉토리로 이동
cd /app/hearth_chat_django

# DB 마이그레이션
python manage.py migrate --noinput

# 정적 파일 수집 (실패해도 계속 진행)
python manage.py collectstatic --noinput || echo "collectstatic failed, continuing..."

# 서버 실행
exec daphne -b 0.0.0.0 -p 8080 hearth_chat.asgi:application 