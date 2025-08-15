from django.core.management.base import BaseCommand
# from django.contrib.sites.models import Site
# from allauth.socialaccount.models import SocialApp
# from allauth.socialaccount.providers.google.provider import GoogleProvider
# import os


class Command(BaseCommand):
    help = 'Create initial social apps for Google OAuth (DISABLED - Manual management only)'

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.WARNING(
                '⚠️ SocialApp 자동 생성이 비활성화되었습니다. Django Admin에서 수동으로 관리하세요.'
            )
        )
        # try:
        #     # Get the current site
        #     site = Site.objects.get_current()
        #     
        #     # Check if Google SocialApp already exists
        #     google_app, created = SocialApp.objects.get_or_create(
        #         provider=GoogleProvider.id,
        #         name='Google',
        #         defaults={
        #             'client_id': os.getenv('GOOGLE_CLIENT_ID', ''),
        #             'secret': os.getenv('GOOGLE_CLIENT_SECRET', ''),
        #             }
        #         )
        #         
        #         if created:
        #             # Add the site to the social app
        #             google_app.sites.add(site)
        #             self.stdout.write(
        #                 self.style.SUCCESS(
        #                     f'Successfully created Google SocialApp for site: {site.domain}'
        #                     )
        #                 )
        #         else:
        #             # Update existing app with environment variables
        #             google_app.client_id = os.getenv('GOOGLE_CLIENT_ID', google_app.client_id)
        #             google_app.secret = os.getenv('GOOGLE_CLIENT_SECRET', google_app.secret)
        #             google_app.save()
        #             
        #             # Ensure the site is associated
        #             if site not in google_app.sites.all():
        #                 google_app.sites.add(site)
        #             
        #             self.stdout.write(
        #                 self.style.SUCCESS(
        #                     f'Updated existing Google SocialApp for site: {site.domain}'
        #                     )
        #                 )
        #                 
        # except Exception as e:
        #     self.stdout.write(
        #         self.style.ERROR(f'Error creating social apps: {str(e)}')
        #     ) 