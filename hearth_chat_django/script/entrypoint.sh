#!/bin/bash

echo "🚀 Railway Django 앱 시작 중..."

# 환경변수 설정 (기본값)
export DJANGO_SUPERUSER_USERNAME=${DJANGO_SUPERUSER_USERNAME:-"gigabitamin"}
export DJANGO_SUPERUSER_EMAIL=${DJANGO_SUPERUSER_EMAIL:-"gigabitamin@gmail.com"}
export DJANGO_SUPERUSER_PASSWORD=${DJANGO_SUPERUSER_PASSWORD:-"windmill4u@"}

# 1. 마이그레이션 실행
echo "📊 데이터베이스 마이그레이션 실행..."
python manage.py migrate --noinput

# 2. 초기 Site 객체 생성 (Django Admin 접속을 위해 필수)
echo "🌐 초기 Site 객체 생성..."
python manage.py createinitialsite

# Django shell로 Site 객체 강제 생성 (백업 방법)
echo "🔧 Django shell로 Site 객체 강제 생성..."
python manage.py shell -c "
from django.contrib.sites.models import Site
try:
    site = Site.objects.get(id=1)
    site.domain = 'hearthchat-production.up.railway.app'
    site.name = 'HearthChat Production'
    site.save()
    print(f'Site 업데이트 완료: {site.domain}')
except Site.DoesNotExist:
    site = Site.objects.create(
        id=1,
        domain='hearthchat-production.up.railway.app',
        name='HearthChat Production'
    )
    print(f'Site 생성 완료: {site.domain}')
"

# Site 객체 확인 및 업데이트 (삭제하지 않고 기존 유지)
echo "🔄 Site 객체 확인 및 업데이트..."
python manage.py shell -c "
from django.contrib.sites.models import Site
try:
    site = Site.objects.get(id=1)
    # 기존 Site가 있으면 업데이트만
    if site.domain != 'hearthchat-production.up.railway.app':
        site.domain = 'hearthchat-production.up.railway.app'
        site.name = 'HearthChat Production'
        site.save()
        print(f'Site 업데이트 완료: {site.domain}')
    else:
        print(f'Site 이미 올바르게 설정됨: {site.domain}')
except Site.DoesNotExist:
    # Site가 없을 때만 새로 생성
    site = Site.objects.create(
        id=1,
        domain='hearthchat-production.up.railway.app',
        name='HearthChat Production'
    )
    print(f'Site 새로 생성 완료: {site.domain}')
"

# SocialApp 강제 생성 비활성화 (관리자가 수동으로 관리)
echo "🔐 SocialApp 강제 생성 비활성화됨 (Django Admin에서 수동 관리)"
# python manage.py shell -c "
# from django.contrib.sites.models import Site
# from allauth.socialaccount.models import SocialApp
# from allauth.socialaccount.providers.google.provider import GoogleProvider
# import os

# try:
#     site = Site.objects.get_current()
#     print(f'현재 Site: {site.domain}')
#     
#     # 기존 SocialApp 삭제 후 새로 생성
#     SocialApp.objects.filter(provider=GoogleProvider.id).delete()
#     
#     google_app = SocialApp.objects.create(
#         provider=GoogleProvider.id,
#         name='Google',
#         client_id=os.getenv('GOOGLE_CLIENT_ID', ''),
#         secret=os.getenv('GOOGLE_CLIENT_SECRET', '')
#     )
#     google_app.sites.add(site)
#     print(f'SocialApp 강제 생성 완료: {google_app.name} for {site.domain}')
# except Exception as e:
#     print(f'SocialApp 강제 생성 중 오류: {e}')
# "

# 3. SocialApp 자동 생성 비활성화 (관리자가 수동으로 관리)
echo "🔐 SocialApp 자동 생성 비활성화됨 (Django Admin에서 수동 관리)"
# python manage.py create_social_apps
# python manage.py ensure_social_apps

# 4. 슈퍼유저 자동 생성 (이미 있으면 비밀번호만 업데이트)
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

# 5. 정적 파일 수집 (필요시)
echo "📁 정적 파일 수집..."
python manage.py collectstatic --noinput

# 6. Daphne 서버 시작
PORT=${PORT:-8080}
echo "🌐 Daphne 서버 시작 (포트: $PORT)..."
exec daphne -b 0.0.0.0 -p $PORT hearth_chat.asgi:application 