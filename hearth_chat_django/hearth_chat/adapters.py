from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.shortcuts import resolve_url
import uuid

class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    def get_login_redirect_url(self, request):
        print('[DEBUG][ADAPTER] get_login_redirect_url called')
        return resolve_url('/accounts/popup-close/')
    
    def get_connect_redirect_url(self, request, socialaccount):
        print('[DEBUG][ADAPTER] get_connect_redirect_url called')
        return resolve_url('/accounts/popup-close/')
    
    def pre_social_login(self, request, sociallogin):
        print('[DEBUG][ADAPTER] pre_social_login called')
        print('[DEBUG][ADAPTER] provider:', sociallogin.account.provider)
        print('[DEBUG][ADAPTER] user:', sociallogin.user)
        return super().pre_social_login(request, sociallogin)
    
    def save_user(self, request, sociallogin, form=None):
        print('[DEBUG][ADAPTER] save_user called')
        user = super().save_user(request, sociallogin, form)
        print('[DEBUG][ADAPTER] saved user:', user)
        return user
    

    
    def populate_user(self, request, sociallogin, data):
        """
        소셜 로그인 시 사용자 정보를 채우는 메서드
        username이 비어있을 때 고유한 값을 생성
        """
        print('[DEBUG][ADAPTER] populate_user called')
        print('[DEBUG][ADAPTER] data:', data)
        
        user = super().populate_user(request, sociallogin, data)
        
        # username이 비어있거나 None인 경우 고유한 값 생성
        if not user.username or user.username == '':
            # 이메일에서 @ 앞부분을 사용하거나, 고유 ID 생성
            if sociallogin.account.provider == 'google':
                email = data.get('email', '')
                if email:
                    # 이메일에서 @ 앞부분을 username으로 사용
                    username = email.split('@')[0]
                    # 중복 방지를 위해 고유 ID 추가
                    username = f"{username}_{uuid.uuid4().hex[:8]}"
                else:
                    # 이메일이 없는 경우 고유 ID 생성
                    username = f"user_{uuid.uuid4().hex[:12]}"
            else:
                # 다른 provider의 경우 고유 ID 생성
                username = f"user_{uuid.uuid4().hex[:12]}"
            
            user.username = username
            print('[DEBUG][ADAPTER] generated username:', username)
        
        return user 