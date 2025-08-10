from django.core.management.base import BaseCommand
from django.contrib.sites.models import Site
import os

# --- 1. 환경 변수 및 플랫폼 감지 ---
IS_RAILWAY_DEPLOY = 'RAILWAY_ENVIRONMENT' in os.environ
IS_RENDER_DEPLOY = os.environ.get('RENDER') == 'true'
IS_PRODUCTION = IS_RAILWAY_DEPLOY or IS_RENDER_DEPLOY

# --- 2. 환경별 주요 설정 분기 ---
if IS_PRODUCTION:    
    if IS_RAILWAY_DEPLOY:
        domain = "hearthchat-production.up.railway.app"
        site_id = 1
    elif IS_RENDER_DEPLOY:
        domain = 'hearth-chat.onrender.com'
        site_id = 1
    else:
        domain = 'hearth-chat.onrender.com'
        site_id = 2
else:
    domain = 'localhost:8000'
    site_id = 2

class Command(BaseCommand):
    help = 'Create initial site for Railway/Render deploy'

    def handle(self, *args, **options):
        self.stdout.write(f'🔧 환경 감지: Railway={IS_RAILWAY_DEPLOY}, Render={IS_RENDER_DEPLOY}')
        self.stdout.write(f'🌐 도메인: {domain}')
        self.stdout.write(f'🆔 SITE_ID: {site_id}')
        
        # 기존 Site 객체가 있으면 업데이트, 없으면 생성
        site, created = Site.objects.get_or_create(
            id=site_id,
            defaults={
                'domain': domain,
                'name': f'HearthChat {"Production" if IS_PRODUCTION else "Local"}'
            }
        )
        
        if created:
            self.stdout.write(
                self.style.SUCCESS(f'✅ Site {site.domain} (ID: {site.id}) 생성됨')
            )
        else:
            # 기존 사이트 정보 업데이트
            old_domain = site.domain
            site.domain = domain
            site.name = f'HearthChat {"Production" if IS_PRODUCTION else "Local"}'
            site.save()
            self.stdout.write(
                self.style.SUCCESS(f'✅ Site {old_domain} → {site.domain} (ID: {site.id}) 업데이트됨')
            )
        
        # 모든 Site 객체 목록 출력
        self.stdout.write('📋 현재 등록된 모든 Site 객체:')
        for s in Site.objects.all():
            self.stdout.write(f'  - ID: {s.id}, Domain: {s.domain}, Name: {s.name}') 