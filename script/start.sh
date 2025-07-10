#!/bin/bash
set -e

python manage.py collectstatic --noinput
python manage.py migrate --noinput
exec daphne -b 0.0.0.0 -p ${PORT:-8000} hearth_chat.asgi:application 