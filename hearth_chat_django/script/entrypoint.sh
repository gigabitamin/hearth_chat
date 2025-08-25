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
    # Supabase 풀러 타임아웃 대비: 최대 10회 재시도, 실패 시 ALT_DATABASE_URL로 1회 스위치 후 다시 10회
    # Supabase 세션 풀러(5432) 실패 시 트랜잭션 풀러(6543)로 자동 스위치
    if [ -z "$ALT_DATABASE_URL" ] && echo "$DATABASE_URL" | grep -qi "supabase.com"; then
        ALT_DATABASE_URL=$(echo "$DATABASE_URL" | sed 's/:5432\//:6543\//')
        export ALT_DATABASE_URL
        echo "[INFO] Supabase 감지 → ALT_DATABASE_URL(6543) 자동 설정"
    fi

    try_migrate() {
        local max_tries=$1
        local tries=0
        until python manage.py migrate --noinput; do
            status=$?
            tries=$((tries+1))
            if [ $tries -ge $max_tries ]; then
                return $status
            fi
            echo "[WARN] migrate 실패(code=$status). 10초 후 재시도 ($tries/$max_tries)" >&2
            sleep 10
        done
        return 0
    }

    if try_migrate 10; then
        echo "migrate 성공"
    else
        if [ -n "$ALT_DATABASE_URL" ]; then
            echo "[INFO] ALT_DATABASE_URL로 스위치 후 재시도"
            export DATABASE_URL="$ALT_DATABASE_URL"
            if ! try_migrate 10; then
                echo "[FATAL] ALT_DATABASE_URL로도 migrate 실패" >&2
                exit 1
            fi
        else
            echo "[FATAL] migrate 실패(재시도 10회 초과)" >&2
            exit 1
        fi
    fi

    echo "--- 정적 파일 수집 실행... ---"
    export STATIC_ROOT=/tmp/staticfiles_collected
    mkdir -p "$STATIC_ROOT" || true
    echo "STATIC_ROOT: $STATIC_ROOT"
    python manage.py safe_collectstatic --noinput --clear || echo "정적 파일 수집 중 오류가 발생했지만 계속 진행합니다."

else
    echo "--- Fly.io 환경이므로, entrypoint에서 migrate와 collectstatic을 건너뜁니다. (release_command가 처리) ---"
fi
# --- [수정] 분기 처리 끝 ---


# 초기 Site 객체 생성 (도메인 자동 감지)
# echo "--- 초기 Site 객체 생성... ---"
# DOMAIN_ENV=${CLOUDTYPE_APP_HOSTNAME:-$ALLOWED_HOSTS}
# if [ -n "$DOMAIN_ENV" ]; then
#     DOMAIN=$(echo "$DOMAIN_ENV" | cut -d',' -f1)
# else
#     DOMAIN="port-0-hearth-chat-meq4jsqba77b2805.sel5.cloudtype.app"
# fi

# 미디어 디렉토리 보장 (쓰기 가능 경로)
export MEDIA_ROOT=${MEDIA_ROOT:-/tmp/media}
mkdir -p "$MEDIA_ROOT" || true
echo "MEDIA_ROOT: $MEDIA_ROOT"
# NLTK 데이터 캐시 경로 보장 (docx 처리 시 권한 오류 방지)
export NLTK_DATA=${NLTK_DATA:-/app/cache/nltk_data}
mkdir -p "$NLTK_DATA" || true
echo "NLTK_DATA: $NLTK_DATA"
python manage.py createinitialsite --force --domain "$DOMAIN" || echo "createinitialsite 경고: 계속 진행합니다."

# 슈퍼유저 생성 (이미 있으면 통과)
# echo "--- 슈퍼유저 생성... ---"
# python manage.py createinitialsuperuser || echo "createinitialsuperuser 경고: 계속 진행합니다."

# 소셜앱 보장 (있으면 통과)
# if python manage.py help ensure_social_apps > /dev/null 2>&1; then
#     echo "--- 소셜앱 보장... ---"
#     python manage.py ensure_social_apps || echo "ensure_social_apps 경고: 계속 진행합니다."
# fi


# echo "--- 로그인 문제 디버깅 정보 수집... ---"
# python manage.py debug_login 2>&1 | tee /tmp/debug_login.log || {
#     echo "[WARNING] Debug login failed. See /tmp/debug_login.log below:"
#     cat /tmp/debug_login.log
# }


# cloudflared를 백그라운드에서 실행 (토큰 사용)
echo "--- cloudflared 실행 ---"
cloudflared tunnel --no-autoupdate run --token CLOUDFLARED_TUNNEL_TOKEN &

echo "--- 서버 시작... ---"
exec daphne -b 0.0.0.0 -p 8080 hearth_chat.asgi:application