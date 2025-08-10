from django.core.management.base import BaseCommand
from django.test import Client
from django.contrib.auth import get_user_model
from django.urls import reverse
import os

class Command(BaseCommand):
    help = 'Django admin 페이지 접근을 테스트합니다'

    def handle(self, *args, **options):
        self.stdout.write('🔍 Django admin 페이지 접근 테스트 시작...\n')
        
        # 환경 정보
        self.stdout.write('📋 환경 정보:')
        self.stdout.write(f'  - RENDER: {os.environ.get("RENDER", "false")}')
        self.stdout.write(f'  - RAILWAY_ENVIRONMENT: {os.environ.get("RAILWAY_ENVIRONMENT", "false")}')
        
        # 클라이언트 생성
        client = Client()
        
        # 1. admin 페이지 접근 테스트 (인증 없이)
        self.stdout.write('\n🌐 Admin 페이지 접근 테스트 (인증 없이):')
        try:
            response = client.get('/admin/')
            self.stdout.write(f'  - Status Code: {response.status_code}')
            self.stdout.write(f'  - Content Type: {response.get("Content-Type", "N/A")}')
            
            if response.status_code == 200:
                if 'admin' in response.content.decode().lower():
                    self.stdout.write('  ✅ Django admin 페이지가 정상적으로 표시됩니다')
                else:
                    self.stdout.write('  ⚠️ 응답은 200이지만 Django admin 페이지가 아닙니다')
            elif response.status_code == 302:
                self.stdout.write('  ✅ Django admin 페이지로 리다이렉트됩니다 (로그인 필요)')
            else:
                self.stdout.write(f'  ❌ 예상치 못한 상태 코드: {response.status_code}')
                
        except Exception as e:
            self.stdout.write(f'  ❌ 오류 발생: {e}')
        
        # 2. 슈퍼유저로 로그인 테스트
        self.stdout.write('\n👤 슈퍼유저 로그인 테스트:')
        User = get_user_model()
        try:
            # gigabitamin 사용자 찾기
            user = User.objects.get(username='gigabitamin')
            self.stdout.write(f'  - 사용자 발견: {user.username}')
            self.stdout.write(f'  - Is Superuser: {user.is_superuser}')
            self.stdout.write(f'  - Is Staff: {user.is_staff}')
            self.stdout.write(f'  - Is Active: {user.is_active}')
            
            if user.is_superuser and user.is_staff and user.is_active:
                # 로그인
                login_success = client.login(username='gigabitamin', password='windmill4u@')
                if login_success:
                    self.stdout.write('  ✅ 로그인 성공')
                    
                    # 로그인 후 admin 페이지 접근
                    response = client.get('/admin/')
                    self.stdout.write(f'  - Admin 페이지 Status: {response.status_code}')
                    
                    if response.status_code == 200:
                        if 'admin' in response.content.decode().lower():
                            self.stdout.write('  ✅ 로그인 후 Django admin 페이지 정상 접근')
                        else:
                            self.stdout.write('  ⚠️ 로그인 후에도 Django admin 페이지가 아닙니다')
                    else:
                        self.stdout.write(f'  ❌ 로그인 후 admin 페이지 접근 실패: {response.status_code}')
                else:
                    self.stdout.write('  ❌ 로그인 실패')
            else:
                self.stdout.write('  ❌ 사용자 권한이 부족합니다')
                
        except User.DoesNotExist:
            self.stdout.write('  ❌ gigabitamin 사용자를 찾을 수 없습니다')
        except Exception as e:
            self.stdout.write(f'  ❌ 오류 발생: {e}')
        
        # 3. URL 패턴 확인
        self.stdout.write('\n🔗 URL 패턴 확인:')
        try:
            from django.urls import get_resolver
            resolver = get_resolver()
            admin_urls = [pattern for pattern in resolver.url_patterns if 'admin' in str(pattern)]
            
            if admin_urls:
                self.stdout.write('  ✅ Admin URL 패턴이 등록되어 있습니다')
                for pattern in admin_urls:
                    self.stdout.write(f'    - {pattern}')
            else:
                self.stdout.write('  ❌ Admin URL 패턴이 등록되지 않았습니다')
                
        except Exception as e:
            self.stdout.write(f'  ❌ URL 패턴 확인 중 오류: {e}')
        
        self.stdout.write('\n✅ Django admin 페이지 접근 테스트 완료!') 