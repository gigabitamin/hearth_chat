from django.apps import AppConfig
# from django.db.models.signals import post_migrate


class HearthChatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'hearth_chat'

    def ready(self):
        # SocialApp 자동 생성 비활성화 (관리자가 수동으로 관리)
        # post_migrate.connect(self.create_social_apps, sender=self)
        
        # Django Admin 사이트 커스터마이징 (앱이 완전히 로드된 후)
        try:
            from django.contrib import admin
            from django.conf import settings
            
            # Admin 사이트 설정
            admin.site.site_header = getattr(settings, 'ADMIN_SITE_HEADER', 'HearthChat 관리자')
            admin.site.site_title = getattr(settings, 'ADMIN_SITE_TITLE', 'HearthChat 관리자 페이지')
            admin.site.index_title = getattr(settings, 'ADMIN_INDEX_TITLE', 'HearthChat 관리자 대시보드')
            
        except Exception as e:
            # 앱이 아직 완전히 로드되지 않은 경우 무시
            pass
        
        # Site 객체 안전한 처리 (앱이 완전히 로드된 후)
        try:
            from django.contrib.sites.models import Site
            from django.contrib.sites.shortcuts import get_current_site
            from django.core.exceptions import ObjectDoesNotExist
            import os
            
            # 환경별 Site 객체 생성
            if os.environ.get("RAILWAY_ENVIRONMENT"):
                site_id = 1
                domain = os.environ.get('RAILWAY_PUBLIC_DOMAIN', 'default.railway.app')
                name = 'HearthChat Production'
            elif os.environ.get("RENDER") == 'true':
                site_id = 3
                domain = 'hearth-chat.onrender.com'
                name = 'HearthChat Production'
            else:
                site_id = 2
                domain = 'localhost:8000'
                name = 'localhost'
            
            # Site 객체가 없으면 생성
            try:
                site = Site.objects.get(id=site_id)
                print(f"✅ Site 객체 발견: {site.domain}")
            except Site.DoesNotExist:
                site, created = Site.objects.get_or_create(
                    id=site_id,
                    defaults={'domain': domain, 'name': name}
                )
                if created:
                    print(f"✅ Site 객체 생성됨: {site.domain}")
                else:
                    print(f"✅ Site 객체 업데이트됨: {site.domain}")
            
            # get_current_site 함수 패치
            def patched_get_current_site(request):
                try:
                    return Site.objects.get_current(request)
                except ObjectDoesNotExist:
                    return site
            
            # SiteManager.get_current 메서드 패치
            def patched_get_current(self, request=None):
                try:
                    return self.get(pk=site_id)
                except ObjectDoesNotExist:
                    return site
            
            # 패치 적용
            import django.contrib.sites.shortcuts
            django.contrib.sites.shortcuts.get_current_site = patched_get_current_site
            
            from django.contrib.sites.models import SiteManager
            SiteManager.get_current = patched_get_current
            
            print(f"✅ Site 패치 완료: {domain}")
            
        except Exception as e:
            # Site 패치 중 오류가 발생해도 앱은 계속 실행
            print(f"⚠️ Site 패치 중 오류 (무시됨): {e}")

    # def create_social_apps(self, sender, **kwargs):
    #     """마이그레이션 후 SocialApp 자동 생성"""
    #     try:
    #         from django.contrib.sites.models import Site
    #         from allauth.socialaccount.models import SocialApp
    #         from allauth.socialaccount.providers.google.provider import GoogleProvider
    #         import os
    #         
    #         # Railway 환경에서만 실행
    #         if os.environ.get("RAILWAY_ENVIRONMENT"):
    #             try:
    #                 # Site 확인
    #                 site = Site.objects.get_current()
    #                 
    #                 # Google SocialApp 생성 또는 업데이트
    #                 google_app, created = SocialApp.objects.get_or_create(
    #                     provider=GoogleProvider.id,
    #                     name='Google',
    #                     defaults={
    #                         'client_id': os.getenv('GOOGLE_CLIENT_ID', ''),
    #                         'secret': os.getenv('GOOGLE_CLIENT_SECRET', ''),
    #                         }
    #                     )
    #                     
    #                     if created:
    #                         google_app.sites.add(site)
    #                         print(f"✅ SocialApp 자동 생성: {google_app.name} for {site.domain}")
    #                     else:
    #                         # 기존 앱 업데이트
    #                         google_app.client_id = os.getenv('GOOGLE_CLIENT_ID', google_app.client_id)
    #                         google_app.secret = os.getenv('GOOGLE_CLIENT_SECRET', google_app.secret)
    #                         google_app.save()
    #                         
    #                         if site not in google_app.sites.all():
    #                             google_app.sites.add(site)
    #                         
    #                         print(f"✅ SocialApp 업데이트: {google_app.name} for {site.domain}")
    #                         
    #                 except Exception as e:
    #                     print(f"⚠️ SocialApp 생성 중 오류: {e}")
    #     except Exception as e:
    #         print(f"⚠️ SocialApp 설정 중 오류: {e}") 