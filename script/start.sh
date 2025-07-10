#!/bin/bash
set -e

echo "=== React build files check ==="
ls -la /app/hearth_chat_react/build/ || echo "React build directory not found"
echo "=== React static directory ==="
ls -la /app/hearth_chat_react/build/static/ || echo "React static directory not found"
echo "=== React static/js directory ==="
ls -la /app/hearth_chat_react/build/static/js/ || echo "React static/js directory not found"
echo "=== React static/css directory ==="
ls -la /app/hearth_chat_react/build/static/css/ || echo "React static/css directory not found"

echo "=== Collecting static files ==="
python manage.py collectstatic --noinput

echo "=== Staticfiles check ==="
ls -la /app/hearth_chat_django/staticfiles/ || echo "staticfiles directory not found"
ls -la /app/hearth_chat_django/staticfiles/static/ || echo "staticfiles/static directory not found"
ls -la /app/hearth_chat_django/staticfiles/static/js/ || echo "staticfiles/static/js directory not found"
ls -la /app/hearth_chat_django/staticfiles/avatar_vrm/ || echo "avatar_vrm directory not found"
python manage.py migrate --noinput
exec daphne -b 0.0.0.0 -p ${PORT:-8000} hearth_chat.asgi:application 