
from pathlib import Path
import os
from dotenv import load_dotenv
import sys
from django.core.exceptions import ObjectDoesNotExist
try:
    import dj_database_url
except ImportError:
    print("Warning: dj_database_url not found. Using default database configuration.")
    dj_database_url = None

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# 환경변수 로드 (BASE_DIR 정의 후)
load_dotenv(BASE_DIR / '.env')

# 환경 감지 (환경변수 로드 후)
IS_FLY_DEPLOY = os.getenv('IS_FLY_DEPLOY', 'false').lower() == 'true'
IS_RAILWAY_DEPLOY = 'RAILWAY_ENVIRONMENT' in os.environ
IS_RENDER_DEPLOY = os.environ.get('RENDER') == 'true'
IS_PRODUCTION = IS_RAILWAY_DEPLOY or IS_RENDER_DEPLOY or IS_FLY_DEPLOY

print(f"🔍 환경 감지 결과:")
print(f"  - IS_FLY_DEPLOY: {IS_FLY_DEPLOY}")
print(f"  - IS_RAILWAY_DEPLOY: {IS_RAILWAY_DEPLOY}")
print(f"  - IS_RENDER_DEPLOY: {IS_RENDER_DEPLOY}")
print(f"  - IS_PRODUCTION: {IS_PRODUCTION}")

# MySQL 커스텀 백엔드를 위한 sys.path 추가
sys.path.append(os.path.join(BASE_DIR, 'chat'))

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "your-default-secret-key")

# ================================================================
# ⚙️ 환경 설정 (로컬 / Railway / Render / Fly.io 자동 감지)
# ==============================================================================

# --- 1. 환경 변수 및 플랫폼 감지 ---
# 환경 감지 (이미 위에서 정의됨)

# Fly.io 환경에서 추가 정보 출력
if IS_FLY_DEPLOY:
    print(f"🔍 Fly.io 환경 감지됨:")
    print(f"  - IS_FLY_DEPLOY: {IS_FLY_DEPLOY}")
    print(f"  - 직접 설정된 데이터베이스: PostgreSQL")
    print(f"  - ALLOWED_HOSTS: {os.getenv('ALLOWED_HOSTS', '설정되지 않음')}")

# --- 2. 환경별 주요 설정 분기 ---
if IS_PRODUCTION:
    # --- 🏢 운영 환경 (Production) 설정 ---
    # print("✅ 운영 환경(Production) 설정을 시작합니다.")
    DEBUG = False
    ALLOWED_HOSTS = []

    if IS_FLY_DEPLOY:
        # Fly.io 환경변수에서 ALLOWED_HOSTS 가져오기
        fly_allowed_hosts = os.getenv('ALLOWED_HOSTS', '')
        if fly_allowed_hosts and fly_allowed_hosts.strip():
            # 환경변수가 비어있지 않을 때만 파싱
            try:
                # 쉼표로 구분된 문자열을 리스트로 변환
                hosts_list = [host.strip() for host in fly_allowed_hosts.split(',') if host.strip()]
                if hosts_list:
                    ALLOWED_HOSTS.extend(hosts_list)
                    print(f"✅ Fly.io 환경 - ALLOWED_HOSTS 환경변수에서 파싱: {hosts_list}")
                else:
                    raise ValueError("환경변수에 유효한 호스트가 없음")
            except Exception as e:
                print(f"⚠️ Fly.io ALLOWED_HOSTS 파싱 실패: {e}")
                # 파싱 실패 시 기본값 사용
                ALLOWED_HOSTS.extend([
                    'hearth-chat.fly.dev',
                    '*.fly.dev',
                    '*.flycast',
                    '*.internal'
                ])
                print(f"✅ Fly.io 환경 - 기본 ALLOWED_HOSTS 사용: {ALLOWED_HOSTS}")
        else:
            # 기본 Fly.io 호스트 추가
            ALLOWED_HOSTS.extend([
                'hearth-chat.fly.dev',
                '*.fly.dev',
                '*.flycast',
                '*.internal'
            ])
            print(f"✅ Fly.io 환경 - 기본 ALLOWED_HOSTS 사용: {ALLOWED_HOSTS}")
        
    if IS_RENDER_DEPLOY:
        # ALLOWED_HOSTS.append('hearth-chat.onrender.com')
        ALLOWED_HOSTS.append('hearth-chat-latest.onrender.com')
    
    if IS_RAILWAY_DEPLOY:
        ALLOWED_HOSTS.append("hearthchat-production.up.railway.app")

    BASE_URL = f"https://{ALLOWED_HOSTS[0]}"
    LILY_API_URL = "https://gbrabbit-lily-fast-api.hf.space"

    # CORS & CSRF 설정
    CORS_ALLOWED_ORIGINS = [f"https://{host}" for host in ALLOWED_HOSTS]
    CSRF_TRUSTED_ORIGINS = [f"https://{host}" for host in ALLOWED_HOSTS]
    CORS_ALLOWED_ORIGINS.append(LILY_API_URL)
    CSRF_TRUSTED_ORIGINS.append(LILY_API_URL)
    
    # 보안 쿠키 설정
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = "None"
    CSRF_COOKIE_SAMESITE = "None"

else:
    # --- 💻 로컬 개발 환경 (Local) 설정 ---
    # print("✅ 로컬 개발 환경(Local) 설정을 시작합니다.")
    DEBUG = True
    ALLOWED_HOSTS = ["localhost", "127.0.0.1", '192.168.44.9']
    BASE_URL = "http://localhost:8000"
    LILY_API_URL = "http://localhost:8001"

    # CORS & CSRF 설정 (React 개발 서버 허용)
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.44.9:3000",
    ]
    CSRF_TRUSTED_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.44.9:3000",
    ]
    
    # 보안 쿠키 설정 (HTTP 환경)
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"

# print(f"  - BASE_URL: {BASE_URL}")
# print(f"  - ALLOWED_HOSTS: {ALLOWED_HOSTS}")
# print(f"  - CORS_ALLOWED_ORIGINS: {CORS_ALLOWED_ORIGINS}")

# --- 3. 공통 설정 (환경과 무관) ---
CSRF_COOKIE_NAME = "csrftoken"
CSRF_COOKIE_HTTPONLY = False
CSRF_HEADER_NAME = "HTTP_X_CSRFTOKEN"
CORS_ALLOW_CREDENTIALS = True

# ==============================================================================

# DATABASES 설정을 안전하게 구성
if IS_FLY_DEPLOY:
    # Fly.io 환경: PostgreSQL 사용
    print("🔧 Fly.io 환경 - PostgreSQL 데이터베이스 설정")
    
    # 환경변수에서 데이터베이스 정보 가져오기
    db_host = os.getenv('DB_HOST', 'hearth-postgres.flycast')
    db_port = int(os.getenv('DB_PORT', '5432'))
    db_name = os.getenv('DB_NAME', 'hearth_chat')
    db_user = os.getenv('DB_USER', 'hearth_chat')
    db_password = os.getenv('DB_PASSWORD', 'seGGPftNA0v5OEu')
    
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": db_name,
            "USER": db_user,
            "PASSWORD": db_password,
            "HOST": db_host,
            "PORT": db_port,
            "OPTIONS": {
                'sslmode': 'disable',
            },
            "CONN_MAX_AGE": 600,
        }
    }
    print("✅ Fly.io PostgreSQL 설정 완료")
    
elif dj_database_url:
    # 다른 환경에서 dj_database_url 사용
    DATABASES = {
        "default": dj_database_url.config(
            conn_max_age=600, 
            ssl_require=False
        )
    }
else:
    # dj_database_url이 없을 때 기본 설정
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# Railway 환경에서 PostgreSQL SSL 설정 추가
if os.environ.get("RAILWAY_ENVIRONMENT") and DATABASES["default"].get("ENGINE", "").endswith("postgresql"):
    DATABASES["default"]["OPTIONS"] = {
        'sslmode': 'require'
    }
    print("Railway PostgreSQL SSL 설정 적용됨")
elif DATABASES["default"].get("ENGINE", "").endswith("postgresql"):
    # PostgreSQL이지만 Railway가 아닌 경우
    print("PostgreSQL 감지됨 (Railway 아님)")

# 로컬 MySQL 환경에서만 utf8mb4 옵션 적용 (PostgreSQL 등에서는 절대 실행되지 않도록 보장)
# print("DATABASE ENGINE:", DATABASES["default"].get("ENGINE", "<None>"))

# PostgreSQL 환경에서는 MySQL 설정을 절대 적용하지 않음
if (
    DATABASES["default"].get("ENGINE", "") == "django.db.backends.mysql"
    and not os.environ.get("RAILWAY_ENVIRONMENT")
    and "postgresql" not in DATABASES["default"].get("ENGINE", "").lower()
    and DATABASES["default"].get("ENGINE", "") != "django.db.backends.postgresql"
):
    try:
        DATABASES["default"]["OPTIONS"] = {
            "charset": os.environ.get("LOCAL_MYSQL_CHARSET", "utf8mb4"),
            "init_command": os.environ.get(
                "LOCAL_MYSQL_INIT_COMMAND",
                # "SET character_set_connection=utf8mb4; SET collation_connection=utf8mb4_unicode_ci;"
            ),
        }        
    except Exception as e:
        print(f"MySQL 설정 오류 (무시됨): {e}")
else:
    print("MySQL 전용 옵션은 적용되지 않음 (PostgreSQL 또는 Railway 환경)")

if not DATABASES["default"].get("ENGINE"):
    raise Exception("DATABASE_URL 환경변수 또는 ENGINE 설정이 잘못되었습니다. Railway Variables에서 DATABASE_URL을 확인하세요.")

# Gemini API 키
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Application definition
INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    'chat',
    'channels',
    'corsheaders',
    'django.contrib.sites',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
    'allauth.socialaccount.providers.kakao',
    'allauth.socialaccount.providers.naver',
    'allauth.socialaccount.providers.github',
    'hearth_chat.apps.HearthChatConfig',
    'rest_framework',
]
SESSION_ENGINE = 'django.contrib.sessions.backends.db'

# 세션 설정 (백업본에서 복구 - 단순화)
SESSION_COOKIE_AGE = 1209600  # 14일
SESSION_EXPIRE_AT_BROWSER_CLOSE = False

# 세션 디버그 로그는 MIDDLEWARE 정의 이후에 추가됨

SITE_ID = 2 # 소셜 로그인 설정을 위한 필수 설정 (1: railway, 2: 로컬)

# 로컬 환경에서 Site 객체가 없을 때를 대비한 동적 SITE_ID 설정
if not os.environ.get("RAILWAY_ENVIRONMENT"):
    SITE_ID = 2
    # print(f"로컬 환경 - SITE_ID 설정: {SITE_ID}")
    
    try:
        from django.contrib.sites.models import Site
        site = Site.objects.first()
        if site:
            print(f"로컬 환경 - 기존 Site 발견: {site.domain}")
        else:
            print("로컬 환경 - Site 객체가 없음, SITE_ID=2 사용")
    except Exception as e:
        print(f"Site 객체 확인 중 오류 (무시됨): {e}")
    
    try:
        from django.contrib.sites.models import Site
        from django.contrib.sites.shortcuts import get_current_site
        
        def patched_get_current_site_local(request):
            try:
                return Site.objects.get_current(request)
            except ObjectDoesNotExist:
                site, created = Site.objects.get_or_create(
                    id=2,
                    defaults={'domain': 'localhost:8000', 'name': 'localhost'}
                )
                return site
        
        import django.contrib.sites.shortcuts
        django.contrib.sites.shortcuts.get_current_site = patched_get_current_site_local
        
        def patched_get_current_local(self, request=None):
            try:
                return self.get(pk=SITE_ID)
            except ObjectDoesNotExist:
                site, created = Site.objects.get_or_create(
                    id=SITE_ID,
                    defaults={'domain': 'localhost:8000', 'name': 'localhost'}
                )
                return site
        
        from django.contrib.sites.models import SiteManager
        SiteManager.get_current = patched_get_current_local
        
        print("로컬 환경 - Site 객체 자동 생성 패치 완전 적용됨")
    except Exception as e:
        print(f"로컬 Site 패치 적용 중 오류 (무시됨): {e}")

if os.environ.get("RAILWAY_ENVIRONMENT"):
    SITE_ID = 1
    print(f"Railway 환경 - SITE_ID 강제 설정: {SITE_ID}")
    
    try:
        from django.contrib.sites.models import Site
        site = Site.objects.first()
        if site:
            print(f"Railway 환경 - 기존 Site 발견: {site.domain}")
        else:
            print("Railway 환경 - Site 객체가 없음, SITE_ID=1 사용")
    except Exception as e:
        print(f"Site 객체 확인 중 오류 (무시됨): {e}")
    
    try:
        from django.contrib.sites.models import Site
        from django.contrib.sites.shortcuts import get_current_site
        
        def patched_get_current_site(request):
            try:
                return Site.objects.get_current(request)
            except ObjectDoesNotExist:
                site, created = Site.objects.get_or_create(
                    id=1,
                    defaults={'domain': os.environ.get('RAILWAY_PUBLIC_DOMAIN', 'default.railway.app'), 'name': 'HearthChat Production'}
                )
                return site
        
        import django.contrib.sites.shortcuts
        django.contrib.sites.shortcuts.get_current_site = patched_get_current_site
        
        def patched_get_current(self, request=None):
            try:
                return self.get(pk=SITE_ID)
            except ObjectDoesNotExist:
                site, created = Site.objects.get_or_create(
                    id=SITE_ID,
                    defaults={'domain': os.environ.get('RAILWAY_PUBLIC_DOMAIN', 'default.railway.app'), 'name': 'HearthChat Production'}
                )
                return site
        
        from django.contrib.sites.models import SiteManager
        SiteManager.get_current = patched_get_current
        
        print("Railway 환경 - Site 객체 자동 생성 패치 완전 적용됨")
    except Exception as e:
        print(f"Site 패치 적용 중 오류 (무시됨): {e}")
    
    ACCOUNT_DEFAULT_HTTP_PROTOCOL = 'https'
    SOCIALACCOUNT_PROVIDERS = {
        'google': {
            'SCOPE': ['openid', 'profile', 'email'],
            'AUTH_PARAMS': {'access_type': 'online'}
        },
    }

elif os.environ.get("RENDER") == 'true':
    SITE_ID = 2
    # print(f"Render 환경 - SITE_ID 강제 설정: {SITE_ID}")
    
    try:
        from django.contrib.sites.models import Site
        site = Site.objects.first()
        if site:
            print(f"Render 환경 - 기존 Site 발견: {site.domain}")
        else:
            print("Render 환경 - Site 객체가 없음, SITE_ID=3 사용")
    except Exception as e:
        print(f"Site 객체 확인 중 오류 (무시됨): {e}")
    
    try:
        from django.contrib.sites.models import Site
        from django.contrib.sites.shortcuts import get_current_site
        
        def patched_get_current_site_render(request):
            try:
                return Site.objects.get_current(request)
            except ObjectDoesNotExist:
                site, created = Site.objects.get_or_create(
                    id=2,
                    defaults={'domain': 'hearth-chat-latest.onrender.com', 'name': 'HearthChat Production'}
                )
                return site
        
        import django.contrib.sites.shortcuts
        django.contrib.sites.shortcuts.get_current_site = patched_get_current_site_render
        
        def patched_get_current_render(self, request=None):
            try:
                return self.get(pk=SITE_ID)
            except ObjectDoesNotExist:
                site, created = Site.objects.get_or_create(
                    id=SITE_ID,
                    defaults={'domain': 'hearth-chat-latest.onrender.com', 'name': 'HearthChat Production'}
                )
                return site
        
        from django.contrib.sites.models import SiteManager
        SiteManager.get_current = patched_get_current_render
        
        # print("Render 환경 - Site 객체 자동 생성 패치 완전 적용됨")
    except Exception as e:
        print(f"Site 패치 적용 중 오류 (무시됨): {e}")
    
    ACCOUNT_DEFAULT_HTTP_PROTOCOL = 'https'
    SOCIALACCOUNT_PROVIDERS = {
        'google': {
            'SCOPE': ['openid', 'profile', 'email'],
            'AUTH_PARAMS': {'access_type': 'online'}
        },
    }

elif IS_FLY_DEPLOY:
    # Fly.io 환경 전용 설정
    SITE_ID = 4  # Fly.io 전용 SITE_ID
    print(f"✅ Fly.io 환경 - SITE_ID 설정: {SITE_ID}")
    
    try:
        from django.contrib.sites.models import Site
        site = Site.objects.first()
        if site:
            print(f"Fly.io 환경 - 기존 Site 발견: {site.domain}")
        else:
            print("Fly.io 환경 - Site 객체가 없음, SITE_ID=4 사용")
    except Exception as e:
        print(f"Site 객체 확인 중 오류 (무시됨): {e}")
    
    try:
        from django.contrib.sites.models import Site
        from django.contrib.sites.shortcuts import get_current_site
        
        def patched_get_current_site_fly(request):
            try:
                return Site.objects.get_current(request)
            except ObjectDoesNotExist:
                # Fly.io 환경변수에서 도메인 가져오기
                fly_domain = os.getenv('FLY_APP_HOSTNAME', 'hearth-chat.fly.dev')
                site, created = Site.objects.get_or_create(
                    id=4,
                    defaults={'domain': fly_domain, 'name': 'HearthChat Fly.io'}
                )
                return site
        
        import django.contrib.sites.shortcuts
        django.contrib.sites.shortcuts.get_current_site = patched_get_current_site_fly
        
        def patched_get_current_fly(self, request=None):
            try:
                return self.get(pk=SITE_ID)
            except ObjectDoesNotExist:
                fly_domain = os.getenv('FLY_APP_HOSTNAME', 'hearth-chat.fly.dev')
                site, created = Site.objects.get_or_create(
                    id=SITE_ID,
                    defaults={'domain': fly_domain, 'name': 'HearthChat Fly.io'}
                )
                return site
        
        from django.contrib.sites.models import SiteManager
        SiteManager.get_current = patched_get_current_fly
        
        print("✅ Fly.io 환경 - Site 객체 자동 생성 패치 완전 적용됨")
    except Exception as e:
        print(f"Fly.io Site 패치 적용 중 오류 (무시됨): {e}")
    
    ACCOUNT_DEFAULT_HTTP_PROTOCOL = 'https'
    SOCIALACCOUNT_PROVIDERS = {
        'google': {
            'SCOPE': ['openid', 'profile', 'email'],
            'AUTH_PARAMS': {'access_type': 'online'}
        },
    }
    
    # Fly.io 환경에서 데이터베이스 연결 테스트는 백엔드 패치로 처리됨

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]

# 로그인 관련 설정 개선
ACCOUNT_LOGIN_METHODS = {'username', 'email'}  # username과 email 모두 허용
ACCOUNT_SIGNUP_FIELDS = ['username*', 'email*', 'password1*', 'password2*']
ACCOUNT_EMAIL_VERIFICATION = 'none'  # 이메일 인증 비활성화
SOCIALACCOUNT_EMAIL_VERIFICATION = 'none'
SOCIALACCOUNT_QUERY_EMAIL = True
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_EMAIL_CONFIRMATION_EXPIRE_DAYS = 3
ACCOUNT_RATE_LIMITS = {'confirm_email': '1/m'}

# 로그인 시도 제한 설정
ACCOUNT_LOGIN_ATTEMPTS_LIMIT = 5
ACCOUNT_LOGIN_ATTEMPTS_TIMEOUT = 300

# 세션 설정
SESSION_COOKIE_AGE = 1209600  # 14일
SESSION_EXPIRE_AT_BROWSER_CLOSE = False

# 로그인 관련 추가 설정
ACCOUNT_AUTHENTICATION_METHOD = 'username_email'  # username 또는 email로 로그인 가능
ACCOUNT_USERNAME_REQUIRED = True
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_MIN_LENGTH = 3
ACCOUNT_PASSWORD_MIN_LENGTH = 6

# 로그인/로그아웃 URL 설정
LOGIN_URL = '/accounts/login/'
LOGIN_REDIRECT_URL = '/accounts/popup-close/'
LOGOUT_REDIRECT_URL = '/'
ACCOUNT_LOGOUT_REDIRECT_URL = '/'

# 소셜 로그인 설정
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_EMAIL_REQUIRED = False
SOCIALACCOUNT_QUERY_EMAIL = True

SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'SCOPE': ['openid', 'profile', 'email'],
        'AUTH_PARAMS': {'access_type': 'online'}
    },
    'github': {
        'SCOPE': ['user:email'],
    },
    'kakao': {
        'SCOPE': ['profile_nickname', 'account_email'],
    },
    'naver': {
        'SCOPE': ['email', 'name'],
    },
}

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "hearth_chat.views.SessionDebugMiddleware",  # 세션 디버그 미들웨어 추가
]

# 세션 설정 완료

ROOT_URLCONF = "hearth_chat.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [os.path.join(BASE_DIR, '..', 'hearth_chat_react', 'build')],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "hearth_chat.wsgi.application"
ASGI_APPLICATION = 'hearth_chat.asgi.application'

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [os.path.join(BASE_DIR, '..', 'hearth_chat_react', 'build', 'static')]

# ❗️❗️❗️ 서버 오류 해결을 위한 유일한 변경점 ❗️❗️❗️
# collectstatic의 최종 목적지를 Django 프로젝트 폴더 바깥(프로젝트 최상위)으로 변경하여
# CSS 파일 내의 상대 경로('../media/')로 인한 경로 충돌(SuspiciousFileOperation)을 방지합니다.
STATIC_ROOT = os.path.join(BASE_DIR.parent, 'staticfiles_collected')

# WhiteNoise 설정을 단순화하여 경로 충돌 문제 해결
if IS_PRODUCTION:
    # 운영 환경에서는 단순한 WhiteNoise 스토리지 사용 (압축만, 해싱 없음)
    STATICFILES_STORAGE = "whitenoise.storage.CompressedStaticFilesStorage"
    
    # WhiteNoise 추가 설정
    WHITENOISE_USE_FINDERS = True
    WHITENOISE_AUTOREFRESH = False
    WHITENOISE_MAX_AGE = 31536000  # 1년
    
    # 정적 파일 압축 설정
    WHITENOISE_COMPRESS = True
    WHITENOISE_COMPRESS_LEVEL = 6
    
    # 경로 안전성을 위한 추가 설정
    WHITENOISE_ROOT = STATIC_ROOT
    WHITENOISE_INDEX_FILE = True
    
    # 정적 파일 디렉토리 설정을 더 명확하게
    STATICFILES_DIRS = [
        os.path.join(BASE_DIR, '..', 'hearth_chat_react', 'build', 'static'),
    ]
    
    # WhiteNoise 문제 발생 시 Django 기본 정적 파일 서빙으로 전환
    # 환경변수 WHITENOISE_DISABLE=true로 설정하면 Django 기본 방식 사용
    if os.environ.get('WHITENOISE_DISABLE') == 'true':
        # print('⚠️ WhiteNoise가 비활성화되었습니다. Django 기본 정적 파일 서빙을 사용합니다.')
        STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
        # WhiteNoise 미들웨어 제거 (프로덕션 환경에서만)
        if IS_PRODUCTION:
            MIDDLEWARE = [mw for mw in MIDDLEWARE if 'whitenoise' not in mw.lower()]
else:
    # 로컬 개발 환경에서는 기본 Django 정적 파일 처리
    STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
    
    # 로컬 환경에서는 WhiteNoise 미들웨어 제거 (세션 문제 해결)
    MIDDLEWARE = [mw for mw in MIDDLEWARE if 'whitenoise' not in mw.lower()]
    
    # 로컬 환경 정적 파일 디렉토리
    STATICFILES_DIRS = [os.path.join(BASE_DIR, '..', 'hearth_chat_react', 'build', 'static')]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# 미디어 파일 설정
if IS_PRODUCTION:
    # 프로덕션 환경: 환경변수로 설정하거나 기본값 사용
    # Render 서버에서는 프로젝트 내 media 폴더 사용
    MEDIA_ROOT = os.environ.get('MEDIA_ROOT', os.path.join(BASE_DIR, 'media'))
    MEDIA_URL = '/media/'
    
    # Render 서버에서 미디어 파일 경로 로깅
    print(f"🔍 프로덕션 환경 - MEDIA_ROOT: {MEDIA_ROOT}")
    print(f"🔍 프로덕션 환경 - MEDIA_URL: {MEDIA_URL}")
    print(f"🔍 프로덕션 환경 - BASE_DIR: {BASE_DIR}")
    
    # 미디어 디렉토리 존재 여부 확인 및 생성
    if not os.path.exists(MEDIA_ROOT):
        print(f"⚠️ 미디어 디렉토리가 존재하지 않습니다: {MEDIA_ROOT}")
        try:
            os.makedirs(MEDIA_ROOT, exist_ok=True)
            print(f"✅ 미디어 디렉토리를 생성했습니다: {MEDIA_ROOT}")
        except Exception as e:
            print(f"❌ 미디어 디렉토리 생성 실패: {e}")
    else:
        print(f"✅ 미디어 디렉토리가 존재합니다: {MEDIA_ROOT}")
        # 디렉토리 내용 확인
        try:
            media_files = []
            for root, dirs, files in os.walk(MEDIA_ROOT):
                for file in files:
                    rel_path = os.path.relpath(os.path.join(root, file), MEDIA_ROOT)
                    media_files.append(rel_path)
            print(f"📁 미디어 디렉토리 내 파일 수: {len(media_files)}")
            if media_files:
                print(f"📁 첫 5개 파일: {media_files[:5]}")
        except Exception as e:
            print(f"❌ 미디어 디렉토리 읽기 오류: {e}")
    
    # 프로덕션에서 미디어 파일을 S3나 다른 클라우드 스토리지로 설정할 수 있음
    # DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    # AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
    # AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
    # AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME')
    # AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'ap-northeast-2')
    # AWS_DEFAULT_ACL = None
    # AWS_S3_OBJECT_PARAMETERS = {'CacheControl': 'max-age=86400'}
else:
    # 로컬 개발 환경
    MEDIA_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..', 'hearth_chat_media'))
    MEDIA_URL = '/media/'
    print(f"🔍 로컬 환경 - MEDIA_ROOT: {MEDIA_ROOT}")
    print(f"🔍 로컬 환경 - MEDIA_URL: {MEDIA_URL}")

# ❗️❗️❗️ 서버 오류 해결을 위한 유일한 변경점 ❗️❗️❗️

# 로깅 설정 추가
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': 'django.log',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': True,
        },
        'allauth': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': True,
        },
        'hearth_chat.adapters': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': True,
        },
    },
}

if os.environ.get("RAILWAY_ENVIRONMENT"):
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = 'smtp.gmail.com'
    EMAIL_PORT = 587
    EMAIL_USE_TLS = True
    EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
    DEFAULT_FROM_EMAIL = os.getenv('EMAIL_HOST_USER', 'noreply@hearthchat.com')
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

SOCIALACCOUNT_ADAPTER = 'hearth_chat.adapters.CustomSocialAccountAdapter'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.LimitOffsetPagination',
    'PAGE_SIZE': 20,
}

# redis 설정 (운영/배포/로컬 모두 환경변수 REDIS_URL 기반)
# 실서비스(운영/배포)에서는 반드시 channels_redis.core.RedisChannelLayer만 사용
# (메모리 채널(InMemoryChannelLayer)은 실시간 채팅, 알림 등에서 서버가 여러 대일 때 절대 동작하지 않음)
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")

# Fly.io 환경에서 Redis 연결 최적화
if IS_FLY_DEPLOY:
    # Fly.io Redis 연결 최적화
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [REDIS_URL],
                "capacity": 1500,  # 채널별 최대 메시지 수
                "expiry": 3600,    # 메시지 만료 시간 (1시간)
                "group_expiry": 86400,  # 그룹 만료 시간 (24시간)
                "symmetric_encryption_keys": [SECRET_KEY[:32]],  # 암호화 키
            },
        },
    }
    print("✅ Fly.io Redis 연결 최적화 설정 적용됨")
else:
    # 일반 Redis 설정
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [REDIS_URL],
            },
        },
    }

# Fly.io 환경에서 마이그레이션 최적화
if IS_FLY_DEPLOY:
    # 마이그레이션 타임아웃 설정
    MIGRATION_TIMEOUT = 300  # 5분
    
    # 데이터베이스 연결 풀 최적화 (PostgreSQL에서 지원하는 옵션만)
    DATABASES["default"]["CONN_MAX_AGE"] = 600  # 10분
    
    # PostgreSQL에서 지원하는 기본 옵션만 설정
    if "OPTIONS" not in DATABASES["default"]:
        DATABASES["default"]["OPTIONS"] = {}
    
    # PostgreSQL 연결 문자열에서 지원하는 안전한 옵션만 설정
    # statement_timeout, lock_timeout 등은 연결 후 SQL로 설정
    DATABASES["default"]["OPTIONS"].update({
        # PostgreSQL 연결 문자열에서 지원하는 안전한 옵션만 설정
        # connect_timeout, application_name 등은 연결 후 SQL로 설정
    })
    
    # Fly.io 환경에서 마이그레이션 로깅 강화
    LOGGING['loggers']['django.db.backends'] = {
        'handlers': ['console'],
        'level': 'DEBUG' if DEBUG else 'INFO',
        'propagate': False,
    }
    
    # Fly.io 환경에서 마이그레이션 성능 모니터링
    LOGGING['loggers']['django.db.backends.schema'] = {
        'handlers': ['console'],
        'level': 'INFO',
        'propagate': False,
    }
    
    print("✅ Fly.io 마이그레이션 최적화 설정 적용됨")
    print("⚠️  PostgreSQL 타임아웃 옵션은 연결 후 SQL로 설정됩니다")
    
    # Fly.io 환경에서 마이그레이션 실행 시 주의사항 출력
    print("""
    🚀 Fly.io 마이그레이션 실행 가이드:
    
    1. 타임아웃 방지: python manage.py migrate --verbosity=2
    2. 특정 앱만: python manage.py migrate chat --verbosity=2
    3. 문제 발생 시: python manage.py migrate --fake
    4. 연결 테스트: python -c "import psycopg2; print('Fly.io PostgreSQL 연결 테스트')"
    
    ⚠️  마이그레이션 중 무한로딩 시 Ctrl+C로 중단 후 위 방법들 시도
    """)
