from django.core.management.base import BaseCommand
from django.contrib.sites.models import Site

class Command(BaseCommand):
    help = 'Ensure production Site object exists'

    def handle(self, *args, **options):
        site, created = Site.objects.get_or_create(
            id=1,
            defaults={
                'domain': 'hearthchat-production.up.railway.app',
                'name': 'HearthChat Production'
            }
        )
        if not created:
            site.domain = 'hearthchat-production.up.railway.app'
            site.name = 'HearthChat Production'
            site.save()
        self.stdout.write(self.style.SUCCESS(f'Site object ensured: {site.domain}')) 