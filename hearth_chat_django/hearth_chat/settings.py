
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

load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# MySQL 커스텀 백엔드를 위한 sys.path 추가
sys.path.append(os.path.join(BASE_DIR, 'chat'))

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "your-default-secret-key")

# ================================================================
# ⚙️ 환경 설정 (로컬 / Railway / Render 자동 감지)
# ==============================================================================

# --- 1. 환경 변수 및 플랫폼 감지 ---
IS_RAILWAY_DEPLOY = 'RAILWAY_ENVIRONMENT' in os.environ
IS_RENDER_DEPLOY = os.environ.get('RENDER') == 'true'
IS_PRODUCTION = IS_RAILWAY_DEPLOY or IS_RENDER_DEPLOY

# --- 2. 환경별 주요 설정 분기 ---
if IS_PRODUCTION:
    # --- 🏢 운영 환경 (Production) 설정 ---
    print("✅ 운영 환경(Production) 설정을 시작합니다.")
    DEBUG = False
    ALLOWED_HOSTS = ['hearth-chat.onrender.com']
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
    print("✅ 로컬 개발 환경(Local) 설정을 시작합니다.")
    DEBUG = True
    ALLOWED_HOSTS = ["localhost", "127.0.0.1"]
    BASE_URL = "http://localhost:8000"
    LILY_API_URL = "http://localhost:8001"

    # CORS & CSRF 설정 (React 개발 서버 허용)
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    CSRF_TRUSTED_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    
    # 보안 쿠키 설정 (HTTP 환경)
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"

print(f"  - BASE_URL: {BASE_URL}")
print(f"  - ALLOWED_HOSTS: {ALLOWED_HOSTS}")
print(f"  - CORS_ALLOWED_ORIGINS: {CORS_ALLOWED_ORIGINS}")

# --- 3. 공통 설정 (환경과 무관) ---
CSRF_COOKIE_NAME = "csrftoken"
CSRF_COOKIE_HTTPONLY = False
CSRF_HEADER_NAME = "HTTP_X_CSRFTOKEN"
CORS_ALLOW_CREDENTIALS = True

# ==============================================================================

# DATABASES 설정을 안전하게 구성
if dj_database_url:
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
print("DATABASE ENGINE:", DATABASES["default"].get("ENGINE", "<None>"))

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

SITE_ID = 2 # 소셜 로그인 설정을 위한 필수 설정 (1: railway, 2: 로컬)

# 로컬 환경에서 Site 객체가 없을 때를 대비한 동적 SITE_ID 설정
if not os.environ.get("RAILWAY_ENVIRONMENT"):
    SITE_ID = 2
    print(f"로컬 환경 - SITE_ID 설정: {SITE_ID}")
    
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
    print(f"Render 환경 - SITE_ID 강제 설정: {SITE_ID}")
    
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
                    defaults={'domain': 'hearth-chat.onrender.com', 'name': 'HearthChat Production'}
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
                    defaults={'domain': 'hearth-chat.onrender.com', 'name': 'HearthChat Production'}
                )
                return site
        
        from django.contrib.sites.models import SiteManager
        SiteManager.get_current = patched_get_current_render
        
        print("Render 환경 - Site 객체 자동 생성 패치 완전 적용됨")
    except Exception as e:
        print(f"Site 패치 적용 중 오류 (무시됨): {e}")
    
    ACCOUNT_DEFAULT_HTTP_PROTOCOL = 'https'
    SOCIALACCOUNT_PROVIDERS = {
        'google': {
            'SCOPE': ['openid', 'profile', 'email'],
            'AUTH_PARAMS': {'access_type': 'online'}
        },
    }

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
]

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
        print('⚠️ WhiteNoise가 비활성화되었습니다. Django 기본 정적 파일 서빙을 사용합니다.')
        STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
        # WhiteNoise 미들웨어 제거
        MIDDLEWARE = [mw for mw in MIDDLEWARE if 'whitenoise' not in mw.lower()]
else:
    # 로컬 개발 환경에서는 기본 Django 정적 파일 처리
    STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
    
    # 로컬 환경 정적 파일 디렉토리
    STATICFILES_DIRS = [os.path.join(BASE_DIR, '..', 'hearth_chat_react', 'build', 'static')]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# 미디어 파일 설정
if IS_PRODUCTION:
    # 프로덕션 환경: 환경변수로 설정하거나 기본값 사용
    MEDIA_ROOT = os.environ.get('MEDIA_ROOT', os.path.join(BASE_DIR, 'media'))
    MEDIA_URL = '/media/'
    
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

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},
    'loggers': {
        'django': {'handlers': ['console'], 'level': 'DEBUG', 'propagate': False},
        'allauth': {'handlers': ['console'], 'level': 'DEBUG', 'propagate': False},
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
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [REDIS_URL],
        },
    },
}
