from django.core.management.base import BaseCommand
from django.contrib.sites.models import Site

class Command(BaseCommand):
    help = 'Create initial site for Railway deploy'

    def handle(self, *args, **options):
        # 기존 Site 객체가 있으면 업데이트, 없으면 생성
        site, created = Site.objects.get_or_create(
            id=1,
            defaults={
                'domain': 'hearthchat-production.up.railway.app',
                'name': 'HearthChat Production'
            }
        )
        
        if created:
            self.stdout.write(f'Site {site.domain} created.')
        else:
            # 기존 사이트 정보 업데이트
            site.domain = 'hearthchat-production.up.railway.app'
            site.name = 'HearthChat Production'
            site.save()
            self.stdout.write(f'Site {site.domain} updated.') 