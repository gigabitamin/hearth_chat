from django.core.management.base import BaseCommand
from django.contrib.sites.models import Site
import os

class Command(BaseCommand):
    help = 'Create initial site for Railway/Render/Fly.io/Cloudtype deploy'

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
        # --- [수정] 모든 환경 감지 및 도메인 설정 로직을 handle 메소드 안으로 이동 ---
        IS_RAILWAY_DEPLOY = 'RAILWAY_ENVIRONMENT' in os.environ
        IS_RENDER_DEPLOY = os.environ.get('RENDER') == 'true'
        IS_FLY_DEPLOY = os.getenv('IS_FLY_DEPLOY', 'false').lower() == 'true'
        IS_CLOUDTYPE_DEPLOY = os.getenv('IS_CLOUDTYPE_DEPLOY', 'false').lower() == 'true'
        IS_PRODUCTION = IS_RAILWAY_DEPLOY or IS_RENDER_DEPLOY or IS_FLY_DEPLOY or IS_CLOUDTYPE_DEPLOY

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
                fly_domain = os.getenv('FLY_APP_HOSTNAME', 'hearth-chat.fly.dev')
                fly_allowed_hosts = os.getenv('ALLOWED_HOSTS', '')
                
                if fly_allowed_hosts:
                    domain = fly_allowed_hosts.split(',')[0].strip()
                else:
                    domain = fly_domain
                    
                site_id = 4
                site_name = "HearthChat Fly.io Production"
            elif IS_CLOUDTYPE_DEPLOY:
                cloudtype_domain = os.getenv('CLOUDTYPE_APP_HOSTNAME', 'port-0-hearth-chat-meq4jsqba77b2805.sel5.cloudtype.app')
                cloudtype_allowed_hosts = os.getenv('ALLOWED_HOSTS', '')
                if cloudtype_allowed_hosts:
                    domain = cloudtype_allowed_hosts.split(',')[0].strip()
                else:
                    domain = cloudtype_domain
                site_id = 5
                site_name = "HearthChat Cloudtype Production"
            else:
                # 기본 프로덕션 도메인 (필요 시 수정)
                domain = 'hearth-chat.fly.dev'
                site_id = 4 
                site_name = "HearthChat Production"
        else:
            domain = 'localhost:8000'
            site_id = 2
            site_name = "HearthChat Local Development"
        # --- [수정] 로직 이동 끝 ---

        self.stdout.write('🚀 Site 초기화 시작...')
        self.stdout.write(f'🔧 환경 감지: Railway={IS_RAILWAY_DEPLOY}, Render={IS_RENDER_DEPLOY}, Fly.io={IS_FLY_DEPLOY}, Cloudtype={IS_CLOUDTYPE_DEPLOY}')
        
        # 커맨드 라인에서 도메인 오버라이드
        if options['domain']:
            domain = options['domain']
            self.stdout.write(f'🔄 커맨드 라인에서 도메인 오버라이드: {domain}')
        
        self.stdout.write(f'🌐 도메인: {domain}')
        self.stdout.write(f'🆔 SITE_ID: {site_id}')
        self.stdout.write(f'📝 사이트명: {site_name}')
        
        try:
            site, created = Site.objects.get_or_create(
                id=site_id,
                defaults={'domain': domain, 'name': site_name}
            )
            
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'✅ Site {site.domain} (ID: {site.id}) 생성됨')
                )
            else:
                old_domain = site.domain
                old_name = site.name
                
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
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Site 생성/업데이트 실패: {e}')
            )
            return

        self.stdout.write(
            self.style.SUCCESS(f'🎉 Site 초기화 완료!')
        )