#!/bin/bash
set -e

# Django 앱 디렉토리로 이동
cd /app/hearth_chat_django

echo "Starting Django application..."

# DB 마이그레이션 (실패 로그 저장 및 출력)
echo "Running database migrations..."
python manage.py migrate --noinput 2>&1 | tee /tmp/migrate.log || {
    echo "Migration failed, trying to create tables..."
    python manage.py makemigrations --noinput 2>&1 | tee /tmp/makemigrations.log || echo "makemigrations failed"
    python manage.py migrate --noinput 2>&1 | tee /tmp/migrate_retry.log || {
        echo "Migration failed again, see logs below:"
        cat /tmp/migrate.log
        cat /tmp/makemigrations.log
        cat /tmp/migrate_retry.log
    }
}

echo "Ensuring Site object exists for production..."
python manage.py shell -c "from django.contrib.sites.models import Site; Site.objects.get_or_create(id=1, defaults={'domain': 'hearthchat-production.up.railway.app', 'name': 'HearthChat Production'})"

echo "Ensuring superuser exists..."
python manage.py createinitialsuperuser || echo "Superuser creation skipped at runtime"

# 정적 파일 수집 (실패해도 계속 진행)
echo "Collecting static files..."
python manage.py collectstatic --noinput || echo "collectstatic failed, continuing..."

echo "Starting server..."
# 서버 실행
exec daphne -b 0.0.0.0 -p 8080 hearth_chat.asgi:application 