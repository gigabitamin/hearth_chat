import os
from django.apps import AppConfig
from django.db.backends.signals import connection_created
from django.dispatch import receiver


class HearthChatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'hearth_chat'

    def ready(self):
        # Import signals here to ensure they are registered
        # from . import signals # if you have a signals.py

        # Fly.io 환경에서 데이터베이스 연결 후 타임아웃 옵션 설정
        if os.getenv('IS_FLY_DEPLOY', 'false').lower() == 'true':
            try:
                @receiver(connection_created)
                def set_fly_io_timeout_options(sender, connection, **kwargs):
                    """Fly.io 환경에서 PostgreSQL 타임아웃 옵션 설정"""
                    if connection.vendor == 'postgresql':
                        try:
                            with connection.cursor() as cursor:
                                # Set statement timeout (5 minutes)
                                cursor.execute("SET statement_timeout = '300000'")
                                
                                # Set lock timeout (1 minute)
                                cursor.execute("SET lock_timeout = '60000'")
                                
                                # Set idle in transaction timeout (5 minutes)
                                cursor.execute("SET idle_in_transaction_session_timeout = '300000'")
                                
                                # Set application name for monitoring
                                cursor.execute("SET application_name = 'hearth-chat-fly'")
                                
                                print("✅ Fly.io PostgreSQL 타임아웃 옵션 자동 설정 완료")
                                
                        except Exception as e:
                            print(f"⚠️ Fly.io PostgreSQL 타임아웃 옵션 자동 설정 실패: {e}")
                
                @receiver(connection_created)
                def fix_fly_io_connection_params(sender, connection, **kwargs):
                    """Fly.io 환경에서 연결 매개변수 수정"""
                    if connection.vendor == 'postgresql':
                        try:
                            # 연결 매개변수에서 특수 문자나 인코딩 문제가 있는 값들을 정리
                            if hasattr(connection, 'connection') and connection.connection:
                                # psycopg2 연결 객체의 매개변수 확인
                                conn_info = connection.connection.get_dsn_parameters()
                                print(f"🔍 연결 매개변수 확인: {conn_info}")
                                
                                # 문제가 있는 매개변수 제거
                                if 'options' in conn_info:
                                    del conn_info['options']
                                
                                print("✅ Fly.io 연결 매개변수 정리 완료")
                                
                        except Exception as e:
                            print(f"⚠️ Fly.io 연결 매개변수 정리 실패: {e}")
                
                print("✅ Fly.io 데이터베이스 시그널 등록 완료")
                
            except Exception as e:
                print(f"⚠️ Fly.io 데이터베이스 시그널 등록 실패: {e}")

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