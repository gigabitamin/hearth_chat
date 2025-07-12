#!/bin/bash

echo "🚀 Railway Django 앱 시작 중..."

# 환경변수 설정 (기본값)
export DJANGO_SUPERUSER_USERNAME=${DJANGO_SUPERUSER_USERNAME:-"gigabitamin"}
export DJANGO_SUPERUSER_EMAIL=${DJANGO_SUPERUSER_EMAIL:-"gigabitamin@gmail.com"}
export DJANGO_SUPERUSER_PASSWORD=${DJANGO_SUPERUSER_PASSWORD:-"windmill4u@"}

# 1. 마이그레이션 실행
echo "📊 데이터베이스 마이그레이션 실행..."
python manage.py migrate --noinput

# 2. 슈퍼유저 자동 생성 (이미 있으면 비밀번호만 업데이트)
echo "👑 슈퍼유저 자동 생성/업데이트..."
echo "사용자명: $DJANGO_SUPERUSER_USERNAME"
echo "이메일: $DJANGO_SUPERUSER_EMAIL"

# 먼저 커스텀 커맨드 시도
python manage.py createinitialsuperuser
if [ $? -eq 0 ]; then
    echo "✅ 커스텀 슈퍼유저 생성/업데이트 완료"
else
    echo "⚠️ 커스텀 슈퍼유저 생성 실패, 기본 createsuperuser 시도..."
    # 기본 createsuperuser 시도
    python manage.py createsuperuser \
        --noinput \
        --username "$DJANGO_SUPERUSER_USERNAME" \
        --email "$DJANGO_SUPERUSER_EMAIL" || echo "기본 슈퍼유저 생성도 실패"
fi

# 3. 정적 파일 수집 (필요시)
echo "📁 정적 파일 수집..."
python manage.py collectstatic --noinput

# 4. Daphne 서버 시작
echo "🌐 Daphne 서버 시작 (포트: 8000)..."
exec daphne -b 0.0.0.0 -p 8000 hearth_chat.asgi:application 