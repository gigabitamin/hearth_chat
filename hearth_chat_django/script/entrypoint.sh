#!/bin/bash
set -e

# DB 마이그레이션
python manage.py migrate --noinput

# 서버 실행
exec daphne -b 0.0.0.0 -p 8080 hearth_chat.asgi:application 