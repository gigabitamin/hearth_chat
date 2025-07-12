from django.apps import AppConfig
from django.db.models.signals import post_migrate


class HearthChatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'hearth_chat'

    def ready(self):
        # 마이그레이션 후 SocialApp 자동 생성
        post_migrate.connect(self.create_social_apps, sender=self)

    def create_social_apps(self, sender, **kwargs):
        """마이그레이션 후 SocialApp 자동 생성"""
        try:
            from django.contrib.sites.models import Site
            from allauth.socialaccount.models import SocialApp
            from allauth.socialaccount.providers.google.provider import GoogleProvider
            import os
            
            # Railway 환경에서만 실행
            if os.environ.get("RAILWAY_ENVIRONMENT"):
                try:
                    # Site 확인
                    site = Site.objects.get_current()
                    
                    # Google SocialApp 생성 또는 업데이트
                    google_app, created = SocialApp.objects.get_or_create(
                        provider=GoogleProvider.id,
                        name='Google',
                        defaults={
                            'client_id': os.getenv('GOOGLE_CLIENT_ID', ''),
                            'secret': os.getenv('GOOGLE_CLIENT_SECRET', ''),
                        }
                    )
                    
                    if created:
                        google_app.sites.add(site)
                        print(f"✅ SocialApp 자동 생성: {google_app.name} for {site.domain}")
                    else:
                        # 기존 앱 업데이트
                        google_app.client_id = os.getenv('GOOGLE_CLIENT_ID', google_app.client_id)
                        google_app.secret = os.getenv('GOOGLE_CLIENT_SECRET', google_app.secret)
                        google_app.save()
                        
                        if site not in google_app.sites.all():
                            google_app.sites.add(site)
                        
                        print(f"✅ SocialApp 업데이트: {google_app.name} for {site.domain}")
                        
                except Exception as e:
                    print(f"⚠️ SocialApp 생성 중 오류: {e}")
        except Exception as e:
            print(f"⚠️ SocialApp 설정 중 오류: {e}") 