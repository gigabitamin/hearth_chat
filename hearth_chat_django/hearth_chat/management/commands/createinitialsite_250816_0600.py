from django.core.management.base import BaseCommand
from django.contrib.sites.models import Site
import os

# --- 1. 환경 변수 및 플랫폼 감지 ---
IS_RAILWAY_DEPLOY = 'RAILWAY_ENVIRONMENT' in os.environ
IS_RENDER_DEPLOY = os.environ.get('RENDER') == 'true'
IS_FLY_DEPLOY = os.getenv('IS_FLY_DEPLOY', 'false').lower() == 'true'
IS_PRODUCTION = IS_RAILWAY_DEPLOY or IS_RENDER_DEPLOY or IS_FLY_DEPLOY

# --- 2. 환경별 주요 설정 분기 ---
if IS_PRODUCTION:    
    if IS_RAILWAY_DEPLOY:
        domain = "hearthchat-production.up.railway.app"
        site_id = 1
        site_name = "HearthChat Railway Production"
    elif IS_RENDER_DEPLOY:
        domain = 'hearth-chat-latest.onrender.com'
        site_id = 2
        site_name = "HearthChat Render Production"
    elif IS_FLY_DEPLOY:
        # Fly.io 환경변수에서 도메인 가져오기
        fly_domain = os.getenv('FLY_APP_HOSTNAME', 'hearth-chat.fly.dev')
        fly_allowed_hosts = os.getenv('ALLOWED_HOSTS', '')
        
        if fly_allowed_hosts:
            # ALLOWED_HOSTS에서 첫 번째 도메인 사용
            domain = fly_allowed_hosts.split(',')[0].strip()
        else:
            domain = fly_domain
            
        site_id = 4
        site_name = "HearthChat Fly.io Production"
        
        # Fly.io 환경 정보 출력
        print(f"🔍 Fly.io 환경 감지:")
        print(f"  - FLY_APP_HOSTNAME: {fly_domain}")
        print(f"  - ALLOWED_HOSTS: {fly_allowed_hosts}")
        print(f"  - 선택된 도메인: {domain}")
    else:
        domain = 'hearth-chat.onrender.com'
        site_id = 2
        site_name = "HearthChat Production"
else:
    domain = 'localhost:8000'
    site_id = 2
    site_name = "HearthChat Local Development"

class Command(BaseCommand):
    help = 'Create initial site for Railway/Render/Fly.io deploy'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force update existing site even if domain is the same',
        )
        parser.add_argument(
            '--domain',
            type=str,
            help='Override domain for site creation',
        )

    def handle(self, *args, **options):
        self.stdout.write('🚀 Site 초기화 시작...')
        self.stdout.write(f'🔧 환경 감지: Railway={IS_RAILWAY_DEPLOY}, Render={IS_RENDER_DEPLOY}, Fly.io={IS_FLY_DEPLOY}')
        
        # 커맨드 라인에서 도메인 오버라이드
        if options['domain']:
            domain = options['domain']
            self.stdout.write(f'🔄 커맨드 라인에서 도메인 오버라이드: {domain}')
        
        self.stdout.write(f'🌐 도메인: {domain}')
        self.stdout.write(f'🆔 SITE_ID: {site_id}')
        self.stdout.write(f'📝 사이트명: {site_name}')
        
        try:
            # 기존 Site 객체가 있으면 업데이트, 없으면 생성
            site, created = Site.objects.get_or_create(
                id=site_id,
                defaults={
                    'domain': domain,
                    'name': site_name
                }
            )
            
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'✅ Site {site.domain} (ID: {site.id}) 생성됨')
                )
            else:
                # 기존 사이트 정보 업데이트
                old_domain = site.domain
                old_name = site.name
                
                # 도메인이나 이름이 다르거나 --force 옵션이 있으면 업데이트
                if (old_domain != domain or old_name != site_name or options['force']):
                    site.domain = domain
                    site.name = site_name
                    site.save()
                    self.stdout.write(
                        self.style.SUCCESS(f'✅ Site {old_domain} → {site.domain} (ID: {site.id}) 업데이트됨')
                    )
                    self.stdout.write(f'   이름: {old_name} → {site_name}')
                else:
                    self.stdout.write(
                        self.style.WARNING(f'⚠️  Site {site.domain} (ID: {site.id}) 이미 최신 상태입니다')
                    )
            
            # Fly.io 환경에서 추가 정보 출력
            if IS_FLY_DEPLOY:
                self.stdout.write('🔍 Fly.io 환경 추가 정보:')
                self.stdout.write(f'  - 데이터베이스: {os.getenv("DATABASE_URL", "설정되지 않음")[:50]}...')
                self.stdout.write(f'  - Redis: {os.getenv("REDIS_URL", "설정되지 않음")[:50]}...')
                self.stdout.write(f'  - 앱 이름: {os.getenv("FLY_APP_NAME", "알 수 없음")}')
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Site 생성/업데이트 실패: {e}')
            )
            # 에러 상세 정보 출력
            import traceback
            self.stdout.write(f'📋 에러 상세: {traceback.format_exc()}')
            return
        
        # 모든 Site 객체 목록 출력
        self.stdout.write('📋 현재 등록된 모든 Site 객체:')
        try:
            for s in Site.objects.all().order_by('id'):
                status = "✅" if s.id == site_id else "  "
                self.stdout.write(f'{status} ID: {s.id}, Domain: {s.domain}, Name: {s.name}')
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Site 목록 조회 실패: {e}')
            )
        
        self.stdout.write(
            self.style.SUCCESS(f'🎉 Site 초기화 완료!')
        )
        
        # Fly.io 환경에서 추가 안내
        if IS_FLY_DEPLOY:
            self.stdout.write("""
🚀 Fly.io 환경 설정 완료!

다음 단계:
1. 마이그레이션 실행: python manage.py migrate --verbosity=2
2. 슈퍼유저 생성: python manage.py createsuperuser
3. 정적 파일 수집: python manage.py collectstatic --noinput
4. 서버 시작: python manage.py runserver 0.0.0.0:8080

문제 발생 시:
- 마이그레이션 타임아웃: python manage.py migrate --fake
- 연결 테스트: python -c "import psycopg2; print(psycopg2.connect(os.getenv('DATABASE_URL')))"
            """) 