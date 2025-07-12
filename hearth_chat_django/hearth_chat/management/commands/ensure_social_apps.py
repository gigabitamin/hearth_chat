from django.core.management.base import BaseCommand
# from django.contrib.sites.models import Site
# from allauth.socialaccount.models import SocialApp
# from allauth.socialaccount.providers.google.provider import GoogleProvider
# import os


class Command(BaseCommand):
    help = 'Ensure social apps exist for OAuth providers (DISABLED - Manual management only)'

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.WARNING(
                '⚠️ SocialApp 자동 생성이 비활성화되었습니다. Django Admin에서 수동으로 관리하세요.'
            )
        )
        # try:
        #     # Get the current site
        #     site = Site.objects.get_current()
        #     self.stdout.write(f"현재 Site: {site.domain}")
        #     
        #     # Check and create Google SocialApp
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
        #                     f'✅ Google SocialApp 생성 완료: {google_app.name} for {site.domain}'
        #                     )
        #                 )
        #         else:
        #             # Update existing app with environment variables
        #             old_client_id = google_app.client_id
        #             old_secret = google_app.secret
        #             
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
        #                     f'✅ Google SocialApp 업데이트 완료: {google_app.name} for {site.domain}'
        #                     )
        #                 )
        #                 
        #             if old_client_id != google_app.client_id or old_secret != google_app.secret:
        #                 self.stdout.write(
        #                     self.style.WARNING(
        #                         f'⚠️ SocialApp 자격증명이 업데이트되었습니다.'
        #                         )
        #                     )
        #         
        #         # Display current SocialApp info
        #         self.stdout.write(f"현재 Google SocialApp:")
        #         self.stdout.write(f"  - Client ID: {google_app.client_id[:10]}..." if google_app.client_id else "  - Client ID: (비어있음)")
        #         self.stdout.write(f"  - Secret: {google_app.secret[:10]}..." if google_app.secret else "  - Secret: (비어있음)")
        #         self.stdout.write(f"  - Sites: {', '.join([s.domain for s in google_app.sites.all()])}")
        #             
        # except Exception as e:
        #     self.stdout.write(
        #         self.style.ERROR(f'❌ SocialApp 확인/생성 중 오류: {str(e)}')
        #     ) 