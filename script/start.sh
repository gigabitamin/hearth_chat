#!/bin/bash
set -e

python manage.py collectstatic --noinput
ls -l /app/hearth_chat_django/staticfiles/avatar_vrm || echo "avatar_vrm not found in staticfiles"
python manage.py migrate --noinput
exec daphne -b 0.0.0.0 -p ${PORT:-8000} hearth_chat.asgi:application 