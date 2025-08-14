@echo off
echo 🚀 Fly.io 로컬 시뮬레이션 환경 설정
echo ======================================

REM 기존 환경변수 완전 정리 (충돌 방지)
echo 🔧 기존 환경변수 정리 중...
set DATABASE_URL=
set ALLOWED_HOSTS=
set IS_FLY_DEPLOY=
set DB_HOST=
set DB_PORT=
set DB_NAME=
set DB_USER=
set DB_PASSWORD=

REM 환경변수가 정리되었는지 확인
echo 📋 정리된 환경변수:
echo   - DATABASE_URL: "%DATABASE_URL%"
echo   - ALLOWED_HOSTS: "%ALLOWED_HOSTS%"
echo   - IS_FLY_DEPLOY: "%IS_FLY_DEPLOY%"
echo   - DB_HOST: "%DB_HOST%"
echo   - DB_PORT: "%DB_PORT%"
echo   - DB_NAME: "%DB_NAME%"
echo   - DB_USER: "%DB_USER%"
echo   - DB_PASSWORD: "%DB_PASSWORD%"
echo.

REM Fly.io 환경변수 설정
echo ✅ Fly.io 환경변수 설정 중...
set IS_FLY_DEPLOY=true
set ALLOWED_HOSTS=hearth-chat.fly.dev,localhost,127.0.0.1

REM 개별 데이터베이스 환경변수 설정 (DATABASE_URL 대신)
set DB_HOST=hearth-postgres.flycast
set DB_PORT=5432
set DB_NAME=hearth_chat
set DB_USER=hearth_chat
set DB_PASSWORD=seGGPftNA0v5OEu

REM 환경변수가 제대로 설정되었는지 확인
echo 🔍 환경변수 설정 확인 중...
if "%DB_HOST%"=="" (
    echo ❌ DB_HOST가 설정되지 않았습니다!
    pause
    exit /b 1
)
if "%DB_PORT%"=="" (
    echo ❌ DB_PORT가 설정되지 않았습니다!
    pause
    exit /b 1
)
if "%DB_NAME%"=="" (
    echo ❌ DB_NAME이 설정되지 않았습니다!
    pause
    exit /b 1
)
if "%DB_USER%"=="" (
    echo ❌ DB_USER가 설정되지 않았습니다!
    pause
    exit /b 1
)
if "%DB_PASSWORD%"=="" (
    echo ❌ DB_PASSWORD가 설정되지 않았습니다!
    pause
    exit /b 1
)
echo ✅ 모든 환경변수가 올바르게 설정되었습니다!

REM 환경변수 값 디버깅
echo 🔍 환경변수 값 디버깅:
echo   - DB_HOST: "%DB_HOST%"
echo   - DB_PORT: "%DB_PORT%"
echo   - DB_NAME: "%DB_NAME%"
echo   - DB_USER: "%DB_USER%"
echo   - DB_PASSWORD: "%DB_PASSWORD%"
echo   - IS_FLY_DEPLOY: "%IS_FLY_DEPLOY%"
echo   - ALLOWED_HOSTS: "%ALLOWED_HOSTS%"
echo.

REM Django 디렉토리로 이동
cd hearth_chat_django

echo ✅ 환경변수 설정 완료:
echo   - IS_FLY_DEPLOY: %IS_FLY_DEPLOY%
echo   - ALLOWED_HOSTS: %ALLOWED_HOSTS%
echo   - DB_HOST: %DB_HOST%
echo   - DB_PORT: %DB_PORT%
echo   - DB_NAME: %DB_NAME%
echo   - DB_USER: %DB_USER%
echo   - DB_PASSWORD: %DB_PASSWORD%
echo.

echo 🔍 Django 설정 검증 시작...
python manage.py check --deploy

echo.
echo 🚀 마이그레이션 테스트 시작...
echo   1. 마이그레이션 계획 확인
echo   2. 마이그레이션 실행 (--fake)
echo   3. 연결 테스트
echo.

echo 📋 1. 마이그레이션 계획 확인...
python manage.py migrate --plan

echo.
echo 🔄 2. 마이그레이션 실행 (--fake)...
python manage.py migrate --fake

echo.
echo 🔌 3. 데이터베이스 연결 테스트...
python -c "import os; import psycopg2; print('연결 시도 중...'); print(psycopg2.connect(host=os.getenv('DB_HOST'), port=os.getenv('DB_PORT'), database=os.getenv('DB_NAME'), user=os.getenv('DB_USER'), password=os.getenv('DB_PASSWORD')))"

echo.
echo ✅ Fly.io 로컬 시뮬레이션 완료!
pause 