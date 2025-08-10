from django.core.management.base import BaseCommand
from django.contrib.sites.models import Site
from django.conf import settings
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
        site_id = 2
    else:
        domain = 'hearth-chat.onrender.com'
        site_id = 2
else:
    domain = 'localhost:8000'
    site_id = 2

class Command(BaseCommand):
    help = 'Create initial site for the application'

    def handle(self, *args, **options):
        # Determine environment and set appropriate domain and site_id
        if hasattr(settings, 'IS_RAILWAY_DEPLOY') and settings.IS_RAILWAY_DEPLOY:
            domain = 'hearthchat-production.up.railway.app'
            site_id = 1
            self.stdout.write(f"Railway deployment detected, using domain: {domain}, site_id: {site_id}")
        elif hasattr(settings, 'IS_RENDER_DEPLOY') and settings.IS_RENDER_DEPLOY:
            domain = 'hearth-chat.onrender.com'
            site_id = 2
            self.stdout.write(f"Render deployment detected, using domain: {domain}, site_id: {site_id}")
        elif os.environ.get('DJANGO_SETTINGS_MODULE') == 'hearth_chat.settings':
            # Local development
            domain = 'localhost:8000'
            site_id = 2
            self.stdout.write(f"Local development detected, using domain: {domain}, site_id: {site_id}")
        else:
            # Fallback for other production environments
            domain = 'hearth-chat.onrender.com'
            site_id = 2
            self.stdout.write(f"Other production environment detected, using domain: {domain}, site_id: {site_id}")

        # Create or update the site
        site, created = Site.objects.get_or_create(
            id=site_id,
            defaults={
                'domain': domain,
                'name': 'Hearth Chat'
            }
        )
        
        if not created:
            # Update existing site
            site.domain = domain
            site.name = 'Hearth Chat'
            site.save()
            self.stdout.write(
                self.style.SUCCESS(f'Site updated - ID: {site.id}, Domain: {site.domain}, Name: {site.name}')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f'Site created - ID: {site.id}, Domain: {site.domain}, Name: {site.name}')
            )

        # Verify the site is set as default
        try:
            current_site = Site.objects.get_current()
            self.stdout.write(
                self.style.SUCCESS(f'Current site verified - ID: {current_site.id}, Domain: {current_site.domain}')
            )
        except Exception as e:
            self.stdout.write(
                self.style.WARNING(f'Could not verify current site: {e}')
            )
        
        # 모든 Site 객체 목록 출력
        self.stdout.write('📋 현재 등록된 모든 Site 객체:')
        for s in Site.objects.all():
            self.stdout.write(f'  - ID: {s.id}, Domain: {s.domain}, Name: {s.name}') 