#!/bin/bash
# set -e: 스크립트 실행 중 오류가 발생하면 즉시 중단합니다.
set -e

# Django 앱 디렉토리로 이동
cd /app/hearth_chat_django

echo "--- [디버그] collectstatic 실행 전 파일 위치 확인 ---"
echo ">>> /app/hearth_chat_react/build 폴더 내용:"
# React 빌드 파일이 존재하는지 확인
ls -laR /app/hearth_chat_react/build || echo "빌드 폴더를 찾을 수 없습니다."

echo "--- 데이터베이스 마이그레이션 실행... ---"
python manage.py migrate --noinput

echo "--- 초기 Site 객체 생성... ---"
# python manage.py createinitialsite 2>&1 | tee /tmp/createinitialsite.log || {
#     echo "[WARNING] Site creation failed. See /tmp/createinitialsite.log below:"
#     cat /tmp/createinitialsite.log
# }

echo "--- 정적 파일 수집 실행... ---"
# 커스텀 명령을 사용하여 안전하게 정적 파일 수집
# 오류 발생 시에도 서버가 시작될 수 있도록 || echo로 처리
python manage.py safe_collectstatic --noinput --clear || echo "정적 파일 수집 중 오류가 발생했지만 계속 진행합니다."

echo "--- [디버그] collectstatic 실행 후 파일 위치 확인 ---"
echo ">>> /app/staticfiles_collected 폴더 내용:"
# 수집된 파일들이 최종 목적지에 잘 들어왔는지 확인
ls -laR /app/staticfiles_collected || echo "staticfiles_collected 폴더를 찾을 수 없습니다."

# echo "Ensuring superuser exists..."
# python manage.py createinitialsuperuser 2>&1 | tee /tmp/createinitialsuperuser.log || {
#     echo "[ERROR] Superuser creation failed. See /tmp/createinitialsuperuser.log below:"
#     cat /tmp/createinitialsuperuser.log
# }

echo "--- 로그인 문제 디버깅 정보 수집... ---"
python manage.py debug_login 2>&1 | tee /tmp/debug_login.log || {
    echo "[WARNING] Debug login failed. See /tmp/debug_login.log below:"
    cat /tmp/debug_login.log
}

echo "--- 서버 시작... ---"
exec daphne -b 0.0.0.0 -p 8080 hearth_chat.asgi:application