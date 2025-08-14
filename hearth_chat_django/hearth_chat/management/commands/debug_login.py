from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.contrib.sites.models import Site
from django.conf import settings
import os

class Command(BaseCommand):
    help = '로그인 문제를 디버깅하기 위한 정보를 출력합니다'

    def handle(self, *args, **options):
        self.stdout.write('🔍 로그인 문제 디버깅 정보 수집 중...\n')
        
        # 1. 환경 정보
        self.stdout.write('📋 환경 정보:')
        self.stdout.write(f'  - DEBUG: {settings.DEBUG}')
        self.stdout.write(f'  - IS_RAILWAY_DEPLOY: {"RAILWAY_ENVIRONMENT" in os.environ}')
        self.stdout.write(f'  - IS_RENDER_DEPLOY: {os.environ.get("RENDER") == "true"}')
        self.stdout.write(f'  - IS_FLY_DEPLOY: {os.getenv("IS_FLY_DEPLOY", "false").lower() == "true"}')
        self.stdout.write(f'  - SITE_ID: {getattr(settings, "SITE_ID", "Not Set")}')
        self.stdout.write(f'  - ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}')
        self.stdout.write(f'  - CORS_ALLOWED_ORIGINS: {getattr(settings, "CORS_ALLOWED_ORIGINS", [])}')
        self.stdout.write(f'  - CSRF_TRUSTED_ORIGINS: {getattr(settings, "CSRF_TRUSTED_ORIGINS", [])}')
        
        # 2. Site 객체 정보
        self.stdout.write('\n🌐 Site 객체 정보:')
        try:
            sites = Site.objects.all()
            if sites.exists():
                for site in sites:
                    self.stdout.write(f'  - ID: {site.id}, Domain: {site.domain}, Name: {site.name}')
            else:
                self.stdout.write('  ❌ Site 객체가 없습니다!')
        except Exception as e:
            self.stdout.write(f'  ❌ Site 객체 조회 중 오류: {e}')
        
        # 3. 사용자 정보
        self.stdout.write('\n👤 사용자 정보:')
        User = get_user_model()
        try:
            users = User.objects.all()
            if users.exists():
                self.stdout.write(f'  - 총 사용자 수: {users.count()}')
                superusers = users.filter(is_superuser=True)
                if superusers.exists():
                    self.stdout.write(f'  - 슈퍼유저 수: {superusers.count()}')
                    for user in superusers:
                        self.stdout.write(f'    * {user.username} (ID: {user.id}, Email: {user.email}, Active: {user.is_active})')
                else:
                    self.stdout.write('  ❌ 슈퍼유저가 없습니다!')
                
                # gigabitamin 사용자 확인
                try:
                    gigabitamin = User.objects.get(username='gigabitamin')
                    self.stdout.write(f'  - gigabitamin 사용자:')
                    self.stdout.write(f'    * ID: {gigabitamin.id}')
                    self.stdout.write(f'    * Email: {gigabitamin.email}')
                    self.stdout.write(f'    * Is Superuser: {gigabitamin.is_superuser}')
                    self.stdout.write(f'    * Is Staff: {gigabitamin.is_staff}')
                    self.stdout.write(f'    * Is Active: {gigabitamin.is_active}')
                    self.stdout.write(f'    * Date Joined: {gigabitamin.date_joined}')
                    self.stdout.write(f'    * Last Login: {gigabitamin.last_login}')
                except User.DoesNotExist:
                    self.stdout.write('  ❌ gigabitamin 사용자를 찾을 수 없습니다!')
            else:
                self.stdout.write('  ❌ 사용자가 없습니다!')
        except Exception as e:
            self.stdout.write(f'  ❌ 사용자 조회 중 오류: {e}')
        
        # 4. 인증 백엔드
        self.stdout.write('\n🔐 인증 백엔드:')
        self.stdout.write(f'  - AUTHENTICATION_BACKENDS: {getattr(settings, "AUTHENTICATION_BACKENDS", [])}')
        
        # 5. 세션 설정
        self.stdout.write('\n🍪 세션 설정:')
        self.stdout.write(f'  - SESSION_ENGINE: {getattr(settings, "SESSION_ENGINE", "Not Set")}')
        self.stdout.write(f'  - SESSION_COOKIE_SECURE: {getattr(settings, "SESSION_COOKIE_SECURE", "Not Set")}')
        self.stdout.write(f'  - SESSION_COOKIE_SAMESITE: {getattr(settings, "SESSION_COOKIE_SAMESITE", "Not Set")}')
        
        # 6. CSRF 설정
        self.stdout.write('\n🛡️ CSRF 설정:')
        self.stdout.write(f'  - CSRF_COOKIE_SECURE: {getattr(settings, "CSRF_COOKIE_SECURE", "Not Set")}')
        self.stdout.write(f'  - CSRF_COOKIE_SAMESITE: {getattr(settings, "CSRF_COOKIE_SAMESITE", "Not Set")}')
        
        self.stdout.write('\n✅ 디버깅 정보 수집 완료!') 