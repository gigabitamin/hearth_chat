#!/bin/bash

# DB 마이그레이션 먼저 실행
python manage.py migrate --noinput

# 컨테이너 시작 시 최초 1회 슈퍼유저 자동 생성 (이미 있으면 비밀번호도 강제로 재설정)
# echo "Creating initial superuser..."
# python manage.py createinitialsuperuser
# if [ $? -eq 0 ]; then
#     echo "Superuser creation completed successfully."
# else
#     echo "Superuser creation failed, but continuing..."
# fi

# 기존 서버 실행 명령 (예시)
daphne -b 0.0.0.0 -p 8000 hearth_chat.asgi:application 