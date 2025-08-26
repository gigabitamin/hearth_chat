
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

# 환경변수 로드 (Fly.io 환경에서는 제한)
if os.getenv('IS_FLY_DEPLOY', 'false').lower() == 'true':
    # Fly.io 환경에서는 .env 파일 로드하지 않음 (환경변수 충돌 방지)
    print("🔧 Fly.io 환경 - .env 파일 로드 건너뜀 (환경변수 충돌 방지)")
else:
    # 로컬/개발 환경에서만 .env 파일 로드
    load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# MySQL 커스텀 백엔드를 위한 sys.path 추가
sys.path.append(os.path.join(BASE_DIR, 'chat'))

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "your-default-secret-key")

# ================================================================
# ⚙️ 환경 설정 (로컬 / Railway / Render / Fly.io 자동 감지)
# ==============================================================================

# --- 1. 환경 변수 및 플랫폼 감지 ---
# Fly.io 환경 감지 개선
IS_FLY_DEPLOY = os.getenv('IS_FLY_DEPLOY', 'false').lower() == 'true'
IS_RAILWAY_DEPLOY = 'RAILWAY_ENVIRONMENT' in os.environ
IS_RENDER_DEPLOY = os.environ.get('RENDER') == 'true'
IS_CLOUDTYPE_DEPLOY = os.getenv('IS_CLOUDTYPE_DEPLOY', 'false').lower() == 'true'
IS_PRODUCTION = IS_RAILWAY_DEPLOY or IS_RENDER_DEPLOY or IS_FLY_DEPLOY or IS_CLOUDTYPE_DEPLOY

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

   # [추가] Fly.io 프록시를 신뢰하도록 설정
    # Fly.io의 프록시가 보내주는 X-Forwarded-Proto 헤더를 보고
    # 현재 연결이 안전한 HTTPS 연결임을 Django에게 알려줌
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')    

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
            
        CORS_ALLOWED_ORIGINS = [
            "https://hearth-chat.fly.dev",
            "https://gbrabbit-lily-fast-api.hf.space",   
        ]            
        
    if IS_RENDER_DEPLOY:
        # ALLOWED_HOSTS.append('hearth-chat.onrender.com')
        ALLOWED_HOSTS.append('hearth-chat-latest.onrender.com')
    
    # Cloudtype 배포 설정
    if IS_CLOUDTYPE_DEPLOY:
        cloudtype_allowed_hosts = os.getenv('ALLOWED_HOSTS', '')
        if cloudtype_allowed_hosts and cloudtype_allowed_hosts.strip():
            try:
                hosts_list = [host.strip() for host in cloudtype_allowed_hosts.split(',') if host.strip()]
                if hosts_list:
                    ALLOWED_HOSTS.extend(hosts_list)
                    print(f"✅ Cloudtype 환경 - ALLOWED_HOSTS 환경변수에서 파싱: {hosts_list}")
            except Exception as e:
                print(f"⚠️ Cloudtype ALLOWED_HOSTS 파싱 실패: {e}")
        else:
            ALLOWED_HOSTS.append('port-0-hearth-chat-meq4jsqba77b2805.sel5.cloudtype.app')
            print(f"✅ Cloudtype 환경 - 기본 ALLOWED_HOSTS 사용: {ALLOWED_HOSTS}")

    if IS_RAILWAY_DEPLOY:
        ALLOWED_HOSTS.append("hearthchat-production.up.railway.app")

    # 추가: 사용자 리다이렉트/서브도메인 허용
    for _extra_host in ["hearthchat.kozow.com", "courageous-dragon-f7b6c0.netlify.app", "animal-sticks-detected-pro.trycloudflare.com"]:
        if _extra_host not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(_extra_host)

    BASE_URL = f"https://{ALLOWED_HOSTS[0]}"
    LILY_API_URL = "https://gbrabbit-lily-fast-api.hf.space"

    # CORS & CSRF 설정
    # CORS_ALLOWED_ORIGINS = [f"https://{host}" for host in ALLOWED_HOSTS]
    # CSRF_TRUSTED_ORIGINS = [f"https://{host}" for host in ALLOWED_HOSTS]
    # CORS_ALLOWED_ORIGINS.append(LILY_API_URL)
    # CSRF_TRUSTED_ORIGINS.append(LILY_API_URL)

    # CORS & CSRF 설정
    # 와일드카드를 지원하는 정규표현식(Regex) 방식으로 변경
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r"^https://hearth-chat\.fly\.dev$",
        r"^https://.+\.fly\.dev$", # *.fly.dev 와일드카드에 해당
        # 모바일(WebView/Capacitor/Android WebView)
        r"^capacitor://localhost$",
        r"^http://localhost$",
    ]
    # CSRF_TRUSTED_ORIGINS는 와일드카드 패턴을 그대로 사용해도 괜찮습니다.
    CSRF_TRUSTED_ORIGINS = [f"https://{host}" for host in ALLOWED_HOSTS]
    # 모바일(WebView/Capacitor/Android WebView) 허용
    CSRF_TRUSTED_ORIGINS.append("capacitor://localhost")
    CSRF_TRUSTED_ORIGINS.append("http://localhost")
    
    # Lily API URL을 CORS와 CSRF에 각각 추가
    CORS_ALLOWED_ORIGIN_REGEXES.append(r"^https://gbrabbit-lily-fast-api\.hf\.space$")
    CSRF_TRUSTED_ORIGINS.append(LILY_API_URL)    

    # 추가: Netlify/FreeDNS 서브도메인 원본 허용
    CORS_ALLOWED_ORIGIN_REGEXES.append(r"^https://hearthchat\.kozow\.com$")
    CORS_ALLOWED_ORIGIN_REGEXES.append(r"^https://courageous-dragon-f7b6c0\.netlify\.app$")
    CORS_ALLOWED_ORIGIN_REGEXES.append(r"^https://animal-sticks-detected-pro\.trycloudflare\.com$")
    
    # CLOUDFLARE TUNNEL 설정, 아래 두 줄을 추가하여 웹소켓 연결을 허용
    CSRF_TRUSTED_ORIGINS.append("https://hearthchat.kozow.com")
    CSRF_TRUSTED_ORIGINS.append("https://courageous-dragon-f7b6c0.netlify.app")
    CSRF_TRUSTED_ORIGINS.append("https://animal-sticks-detected-pro.trycloudflare.com")

    # Cloudtype 도메인 CORS 허용
    if IS_CLOUDTYPE_DEPLOY:
        CORS_ALLOWED_ORIGIN_REGEXES.append(r"^https://port-0-hearth-chat-meq4jsqba77b2805\.sel5\.cloudtype\.app$")
    
    
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
try:
    # 모바일 WebView 등 Origin:null 요청 허용
    CORS_ALLOW_NULL_ORIGIN = True
    # 명시적 헤더 허용 (기본에 포함되지만 안전하게 명시)
    CORS_ALLOW_HEADERS = list(set([
        'accept', 'accept-encoding', 'authorization', 'content-type', 'dnt', 'origin', 'user-agent', 'x-csrftoken', 'x-requested-with'
    ]))
except Exception:
    pass

# --- 4. 공통 세션 설정 ---
ACCOUNT_SESSION_REMEMBER = True
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_AGE = 1209600  # 14일
SESSION_EXPIRE_AT_BROWSER_CLOSE = False
SESSION_SAVE_EVERY_REQUEST = True # 세션 문제 해결을 위해 추가해볼 만한 설정

# ==============================================================================
# settings.py의 DATABASES 설정 부분을 아래 내용으로 전부 교체하세요.

# ==============================================================================
# DATABASE 설정
# ==============================================================================
if IS_FLY_DEPLOY:
    # Fly.io 환경에서는 attach로 생성된 DATABASE_URL을 사용
    print("✅ Fly.io 환경 - DATABASE_URL Secret을 사용하여 DB 설정 시도")
    
    # [수정] dj_database_url.config에 ssl_require=False 옵션을 추가
    # 이것이 SSL SYSCALL 오류를 해결하는 핵심
    DATABASES = {'default': dj_database_url.config(conn_max_age=600, ssl_require=False)}
    
    print("✅ Fly.io DB 설정 완료 (SSL 비활성화)")

elif dj_database_url and dj_database_url.config():
    # 로컬/개발 환경에서 .env 파일에 DATABASE_URL이 있는 경우
    print("✅ .env 파일의 DATABASE_URL을 사용하여 DB 설정 (dj-database-url)")
    DATABASES = {'default': dj_database_url.config(conn_max_age=600)}

elif os.getenv('POSTGRES_DB') or os.getenv('PGDATABASE'):
    # POSTGRES_* / PG* 개별 변수로 로컬 Postgres 구성
    print("✅ 환경 변수 POSTGRES_* 를 사용하여 DB 설정")
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('POSTGRES_DB') or os.getenv('PGDATABASE'),
            'USER': os.getenv('POSTGRES_USER') or os.getenv('PGUSER', 'postgres'),
            'PASSWORD': os.getenv('POSTGRES_PASSWORD') or os.getenv('PGPASSWORD', ''),
            'HOST': os.getenv('POSTGRES_HOST') or os.getenv('PGHOST', 'localhost'),
            'PORT': os.getenv('POSTGRES_PORT') or os.getenv('PGPORT', '5432'),
        }
    }

else:
    # 위 두가지 경우가 모두 실패했을 때의 최후 비상 수단 (로컬 개발용)
    print("⚠️ DATABASE_URL 없음. 로컬 기본 SQLite로 설정합니다.")
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
    
# ---- 공통 DB 연결 최적화 (특히 Cloudtype↔Supabase 타임아웃 완화) ----
try:
    default_db = DATABASES.get('default', {})
    engine = default_db.get('ENGINE', '')
    if engine.endswith('postgresql'):
        # 연결 재사용으로 핸드셰이크 비용 감소 (기본 60초, 환경변수로 조절)
        conn_max_age = int(os.getenv('DB_CONN_MAX_AGE', '60'))
        DATABASES['default']['CONN_MAX_AGE'] = conn_max_age

        # 연결 옵션: 빠른 실패와 죽은 커넥션 감지
        opts = default_db.get('OPTIONS', {}) or {}
        connect_timeout = int(os.getenv('DB_CONNECT_TIMEOUT', '10'))  # 초
        opts.setdefault('connect_timeout', connect_timeout)

        if os.getenv('DB_KEEPALIVES', '1') in ['1', 'true', 'True']:
            opts.setdefault('keepalives', 1)
            opts.setdefault('keepalives_idle', int(os.getenv('DB_KEEPALIVES_IDLE', '30')))
            opts.setdefault('keepalives_interval', int(os.getenv('DB_KEEPALIVES_INTERVAL', '10')))
            opts.setdefault('keepalives_count', int(os.getenv('DB_KEEPALIVES_COUNT', '5')))

        # 긴 쿼리/락으로 인한 대기 방지 (ms)
        stmt_ms = os.getenv('DB_STATEMENT_TIMEOUT_MS', '60000')
        lock_ms = os.getenv('DB_LOCK_TIMEOUT_MS', '5000')
        opts.setdefault('options', f"-c statement_timeout={stmt_ms} -c lock_timeout={lock_ms}")

        DATABASES['default']['OPTIONS'] = opts

        # Supabase Transaction Pooler(6543) 사용 시 권장: 연결 재사용 비활성화
        try:
            port = str(default_db.get('PORT', ''))
            if port == '6543' or os.getenv('SUPABASE_POOL_MODE', '').lower() == 'transaction':
                DATABASES['default']['CONN_MAX_AGE'] = 0
                print("✅ Transaction pooler 감지 → CONN_MAX_AGE=0 강제")
        except Exception:
            pass

        print(f"✅ DB 연결 최적화 적용: CONN_MAX_AGE={DATABASES['default']['CONN_MAX_AGE']}, connect_timeout={connect_timeout}")
except Exception as _db_opt_e:
    print(f"⚠️ DB 연결 최적화 설정 실패: {_db_opt_e}")

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

elif IS_CLOUDTYPE_DEPLOY:
    SITE_ID = 5  # Cloudtype 전용 SITE_ID
    print(f"✅ Cloudtype 환경 - SITE_ID 설정: {SITE_ID}")
    try:
        from django.contrib.sites.models import Site
        site = Site.objects.first()
        if site:
            print(f"Cloudtype 환경 - 기존 Site 발견: {site.domain}")
        else:
            print("Cloudtype 환경 - Site 객체가 없음, SITE_ID=5 사용")
    except Exception as e:
        print(f"Site 객체 확인 중 오류 (무시됨): {e}")
    try:
        from django.contrib.sites.models import Site
        from django.contrib.sites.shortcuts import get_current_site
        def patched_get_current_site_cloudtype(request):
            try:
                return Site.objects.get_current(request)
            except ObjectDoesNotExist:
                cloudtype_domain = os.getenv('CLOUDTYPE_APP_HOSTNAME', 'port-0-hearth-chat-meq4jsqba77b2805.sel5.cloudtype.app')
                site, created = Site.objects.get_or_create(
                    id=5,
                    defaults={'domain': cloudtype_domain, 'name': 'HearthChat Cloudtype'}
                )
                return site
        import django.contrib.sites.shortcuts
        django.contrib.sites.shortcuts.get_current_site = patched_get_current_site_cloudtype
        def patched_get_current_cloudtype(self, request=None):
            try:
                return self.get(pk=SITE_ID)
            except ObjectDoesNotExist:
                cloudtype_domain = os.getenv('CLOUDTYPE_APP_HOSTNAME', 'port-0-hearth-chat-meq4jsqba77b2805.sel5.cloudtype.app')
                site, created = Site.objects.get_or_create(
                    id=SITE_ID,
                    defaults={'domain': cloudtype_domain, 'name': 'HearthChat Cloudtype'}
                )
                return site
        from django.contrib.sites.models import SiteManager
        SiteManager.get_current = patched_get_current_cloudtype
        print("✅ Cloudtype 환경 - Site 객체 자동 생성 패치 완전 적용됨")
    except Exception as e:
        print(f"Cloudtype Site 패치 적용 중 오류 (무시됨): {e}")

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

# 로그인 관련 추가 설정
ACCOUNT_AUTHENTICATION_METHOD = 'username_email'  # username 또는 email로 로그인 가능
ACCOUNT_USERNAME_REQUIRED = True
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_MIN_LENGTH = 3
ACCOUNT_PASSWORD_MIN_LENGTH = 6

# 커스텀 어댑터 및 폼 설정
ACCOUNT_ADAPTER = 'hearth_chat.adapters.CustomAccountAdapter'
SOCIALACCOUNT_ADAPTER = 'hearth_chat.adapters.CustomSocialAccountAdapter'
ACCOUNT_FORMS = {
    'signup': 'hearth_chat.forms.CustomSignupForm',
}

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
    "hearth_chat.middleware.MobileCookieRelaxMiddleware",
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
# Cloudtype에서는 무조건 /tmp 를 사용해 권한 문제 제거
if IS_CLOUDTYPE_DEPLOY:
    STATIC_ROOT = '/tmp/staticfiles_collected'
    print(f"🔧 Cloudtype STATIC_ROOT 강제 적용: {STATIC_ROOT}")

# WhiteNoise 설정을 단순화하여 경로 충돌 문제 해결
if IS_PRODUCTION:
    # 운영 환경에서는 단순한 WhiteNoise 스토리지 사용 (압축만, 해싱 없음)
    STATICFILES_STORAGE = "whitenoise.storage.CompressedStaticFilesStorage"
    
    # WhiteNoise 추가 설정 (간소화)
    WHITENOISE_USE_FINDERS = True
    WHITENOISE_AUTOREFRESH = False
    WHITENOISE_MAX_AGE = 0  # 캐시로 인한 오래된 파일 참조 방지
    WHITENOISE_COMPRESS = False
    WHITENOISE_COMPRESS_LEVEL = 6
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
    # Render 서버에서는 프로젝트 내 media 폴더 사용
    MEDIA_ROOT = os.environ.get('MEDIA_ROOT', os.path.join(BASE_DIR, 'media'))
    # Cloudtype에서는 기본적으로 읽기/쓰기 가능한 /tmp 사용 권장
    if IS_CLOUDTYPE_DEPLOY and not os.environ.get('MEDIA_ROOT'):
        MEDIA_ROOT = '/tmp/media'
        print(f"🔧 Cloudtype 기본 MEDIA_ROOT 사용: {MEDIA_ROOT}")
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
# 컨테이너 환경 호환을 위해 기본 로그 파일을 /tmp로 이동
DJANGO_LOG_FILE = os.environ.get('DJANGO_LOG_FILE', '/tmp/django.log')

# 로컬(Windows 등)에서 기본 '/tmp/django.log' 경로가 없을 수 있으므로 디렉터리 보장
try:
    _log_dir = os.path.dirname(DJANGO_LOG_FILE)
    if _log_dir and not os.path.exists(_log_dir):
        os.makedirs(_log_dir, exist_ok=True)
except Exception:
    pass

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
            'filename': DJANGO_LOG_FILE,
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

# Cloudtype에서는 파일 로깅 비활성화 또는 /tmp로만 기록
if IS_CLOUDTYPE_DEPLOY:
    try:
        # 파일 핸들러가 /tmp가 아닌 경로를 가리키지 않도록 보장
        LOGGING['handlers']['file']['filename'] = DJANGO_LOG_FILE
        # 필요 시 파일 로깅 자체를 제거하려면 아래 주석을 해제하세요.
        # LOGGING['handlers'].pop('file', None)
        # LOGGING['loggers']['django']['handlers'] = ['console']
        # LOGGING['loggers']['allauth']['handlers'] = ['console']
        # LOGGING['loggers']['hearth_chat.adapters']['handlers'] = ['console']
        print('✅ Cloudtype 환경 - 로그 파일을 /tmp 경로로 설정')
    except Exception:
        pass

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

def _is_valid_redis_url(url: str) -> bool:
    if not url:
        return False
    return url.startswith("redis://") or url.startswith("rediss://")

# Redis URL 결정
if IS_FLY_DEPLOY:
    default_redis_url = "redis://hearth-redis.flycast:6379"
    REDIS_URL = os.environ.get("REDIS_URL", default_redis_url)
    print(f"✅ Fly.io Redis URL 설정: {REDIS_URL}")
else:
    REDIS_URL = os.environ.get("REDIS_URL")  # 기본값 없음(없으면 폴백 로직 사용)

DISABLE_REDIS = os.getenv("DISABLE_REDIS", "false").lower() == "true"
use_inmemory = DISABLE_REDIS or (not _is_valid_redis_url(REDIS_URL))

if use_inmemory:
    # 단일 인스턴스/테스트/임시 운영 폴백용 (수평확장 불가)
    from channels.layers import InMemoryChannelLayer  # noqa: F401
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }
    reason = "DISABLE_REDIS=true" if DISABLE_REDIS else f"REDIS_URL 무효({REDIS_URL})"
    print(f"⚠️ Redis 비활성화, InMemoryChannelLayer 사용 ({reason})")
else:
    # 정상 Redis 사용
    base_config = {
        "hosts": [REDIS_URL],
    }
    if IS_FLY_DEPLOY:
        base_config.update({
            "capacity": 1500,
            "expiry": 3600,
            "group_expiry": 86400,
            "symmetric_encryption_keys": [SECRET_KEY[:32]],
        })
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": base_config,
        },
    }

# Cloudtype 세션 저장 전략: Redis 우선, 없으면 signed_cookies로 DB 의존 제거
if IS_CLOUDTYPE_DEPLOY:
    try:
        # django_redis 모듈 존재 여부 확인
        import importlib.util as _ils
        _has_django_redis = _ils.find_spec('django_redis') is not None

        if _is_valid_redis_url(REDIS_URL) and _has_django_redis:
            CACHES = globals().get('CACHES', {})
            CACHES['default'] = {
                'BACKEND': 'django_redis.cache.RedisCache',
                'LOCATION': REDIS_URL,
                'OPTIONS': {
                    'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                },
            }
            SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
            SESSION_CACHE_ALIAS = 'default'
            print('✅ Cloudtype 세션 저장: Redis(cache) 사용')
        else:
            # 모듈 없거나 URL 무효 → DB 의존 제거용 서명쿠키 세션으로 폴백
            if _is_valid_redis_url(REDIS_URL) and not _has_django_redis:
                print('⚠️ django-redis 미설치로 Redis 캐시 비활성화, 서명쿠키 세션으로 폴백')
            SESSION_ENGINE = 'django.contrib.sessions.backends.signed_cookies'
            print('✅ Cloudtype 세션 저장: signed_cookies 사용 (Redis 미사용)')
    except Exception as _e:
        # 어떤 오류가 나도 부팅을 막지 않음
        SESSION_ENGINE = 'django.contrib.sessions.backends.signed_cookies'
        print('⚠️ 세션 설정 중 예외 발생, 서명쿠키 세션으로 폴백')

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
