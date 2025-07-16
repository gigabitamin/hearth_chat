#!/bin/bash
# set -e  # 임시로 주석 처리하여 에러 발생 시 컨테이너가 바로 종료되지 않게 함

# Django 앱 디렉토리로 이동
cd /app/hearth_chat_django

echo "Starting Django application..."

# DB 마이그레이션 (실패 로그 저장 및 출력)
echo "Running database migrations..."
python manage.py migrate --noinput 2>&1 | tee /tmp/migrate.log || {
    echo "[ERROR] Migration failed. See /tmp/migrate.log below:"
    cat /tmp/migrate.log
}

echo "Ensuring Site object exists for production..."
python manage.py createsiteobject 2>&1 | tee /tmp/createsiteobject.log || {
    echo "[ERROR] Site object creation failed. See /tmp/createsiteobject.log below:"
    cat /tmp/createsiteobject.log
}

echo "Ensuring superuser exists..."
python manage.py createinitialsuperuser 2>&1 | tee /tmp/createinitialsuperuser.log || {
    echo "[ERROR] Superuser creation failed. See /tmp/createinitialsuperuser.log below:"
    cat /tmp/createinitialsuperuser.log
}

# 정적 파일 수집 (실패해도 계속 진행)
echo "Collecting static files..."
python manage.py collectstatic --noinput 2>&1 | tee /tmp/collectstatic.log || {
    echo "[ERROR] collectstatic failed. See /tmp/collectstatic.log below:"
    cat /tmp/collectstatic.log
}

echo "Starting server..."
# 서버 실행
exec daphne -b 0.0.0.0 -p 8080 hearth_chat.asgi:application 