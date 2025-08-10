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

echo "--- 정적 파일 수집 실행... ---"
# --clear 옵션으로 실행 전 기존 파일을 깨끗이 지웁니다.
python manage.py collectstatic --noinput --clear

echo "--- [디버그] collectstatic 실행 후 파일 위치 확인 ---"
echo ">>> /app/staticfiles 폴더 내용:"
# 수집된 파일들이 최종 목적지에 잘 들어왔는지 확인
ls -laR /app/staticfiles || echo "staticfiles 폴더를 찾을 수 없습니다."

echo "--- 서버 시작... ---"
exec daphne -b 0.0.0.0 -p 8080 hearth_chat.asgi:application