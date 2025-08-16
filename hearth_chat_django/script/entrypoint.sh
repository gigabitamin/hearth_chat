#!/bin/bash
# set -e: 스크립트 실행 중 오류가 발생하면 즉시 중단합니다.
set -e

# Django 앱 디렉토리로 이동
cd /app/hearth_chat_django
ls -laR /app/hearth_chat_react/build || echo "빌드 폴더를 찾을 수 없습니다."


# --- [수정] Fly.io 환경이 아닐 때만 아래 스크립트를 실행 ---
if [ "$IS_FLY_DEPLOY" != "true" ]; then
    echo "--- Fly.io 환경이 아니므로, entrypoint에서 migrate와 collectstatic을 실행합니다. ---"

    echo "--- 데이터베이스 마이그레이션 실행... ---"
    python manage.py migrate --noinput

    echo "--- 정적 파일 수집 실행... ---"
    python manage.py safe_collectstatic --noinput --clear || echo "정적 파일 수집 중 오류가 발생했지만 계속 진행합니다."

else
    echo "--- Fly.io 환경이므로, entrypoint에서 migrate와 collectstatic을 건너뜁니다. (release_command가 처리) ---"
fi
# --- [수정] 분기 처리 끝 ---


# echo "--- 초기 Site 객체 생성... ---"
# python manage.py createinitialsite ...
# echo "--- 슈퍼유저 생성... ---"
# python manage.py createinitialsuperuser ...


# echo "--- 로그인 문제 디버깅 정보 수집... ---"
# python manage.py debug_login 2>&1 | tee /tmp/debug_login.log || {
#     echo "[WARNING] Debug login failed. See /tmp/debug_login.log below:"
#     cat /tmp/debug_login.log
# }

echo "--- 서버 시작... ---"
exec daphne -b 0.0.0.0 -p 8080 hearth_chat.asgi:application