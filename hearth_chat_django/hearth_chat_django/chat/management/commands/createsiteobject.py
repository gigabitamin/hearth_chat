from django.core.management.base import BaseCommand
from django.contrib.sites.models import Site
import os

# --- 1. 환경 변수 및 플랫폼 감지 ---
IS_RAILWAY_DEPLOY = 'RAILWAY_ENVIRONMENT' in os.environ
IS_RENDER_DEPLOY = os.environ.get('RENDER') == 'true'
IS_PRODUCTION = IS_RAILWAY_DEPLOY or IS_RENDER_DEPLOY

# --- 2. 환경별 주요 설정 분기 ---
if IS_PRODUCTION:    
    domain = 'hearth-chat-latest.onrender.com'
    if IS_RAILWAY_DEPLOY:
        domain = "hearthchat-production.up.railway.app"

class Command(BaseCommand):
    help = 'Ensure production Site object exists'

    def handle(self, *args, **options):
        site, created = Site.objects.get_or_create(
            id=1,
            defaults={                
                'domain': domain,
                'name': 'HearthChat Production'
            }
        )
        if not created:            
            site.domain = domain,
            site.name = 'HearthChat Production'
            site.save()
        self.stdout.write(self.style.SUCCESS(f'Site object ensured: {site.domain}')) 