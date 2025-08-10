from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.shortcuts import resolve_url
import uuid

class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    def get_login_redirect_url(self, request):
        # print('[DEBUG][ADAPTER] get_login_redirect_url called')
        return resolve_url('/accounts/popup-close/')
    
    def get_connect_redirect_url(self, request, socialaccount):
        # print('[DEBUG][ADAPTER] get_connect_redirect_url called')
        return resolve_url('/accounts/popup-close/')
    
    def pre_social_login(self, request, sociallogin):
        # print('[DEBUG][ADAPTER] pre_social_login called')
        # print('[DEBUG][ADAPTER] provider:', sociallogin.account.provider)
        # print('[DEBUG][ADAPTER] user:', sociallogin.user)
        # print('[DEBUG][ADAPTER] sociallogin.is_existing:', sociallogin.is_existing)
        # print('[DEBUG][ADAPTER] sociallogin.account.uid:', sociallogin.account.uid)
        # print('[DEBUG][ADAPTER] sociallogin.account.extra_data:', sociallogin.account.extra_data)
        # print('[DEBUG][ADAPTER] request.session:', dict(request.session))
        # print('[DEBUG][ADAPTER] request.GET:', dict(request.GET))
        # print('[DEBUG][ADAPTER] request.POST:', dict(request.POST))
        return super().pre_social_login(request, sociallogin)
    
    def save_user(self, request, sociallogin, form=None):
        # print('[DEBUG][ADAPTER] save_user called')
        # print('[DEBUG][ADAPTER] sociallogin.is_existing:', sociallogin.is_existing)
        # print('[DEBUG][ADAPTER] sociallogin.user:', sociallogin.user)
        user = super().save_user(request, sociallogin, form)
        # print('[DEBUG][ADAPTER] saved user:', user)
        return user
    

    
    def populate_user(self, request, sociallogin, data):
        """
        소셜 로그인 시 사용자 정보를 채우는 메서드
        username이 비어있을 때 고유한 값을 생성
        """
        # print('[DEBUG][ADAPTER] populate_user called')
        # print('[DEBUG][ADAPTER] data:', data)
        # print('[DEBUG][ADAPTER] sociallogin.account.provider:', sociallogin.account.provider)
        # print('[DEBUG][ADAPTER] sociallogin.account.uid:', sociallogin.account.uid)
        
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
            # print('[DEBUG][ADAPTER] generated username:', username)
        
        return user
    
    def is_auto_signup_allowed(self, request, sociallogin):
        """
        소셜 로그인 시 자동 가입 허용 여부
        """
        # print('[DEBUG][ADAPTER] is_auto_signup_allowed called')
        return True
    
    def is_open_for_signup(self, request, sociallogin):
        """
        소셜 로그인을 통한 가입 허용 여부
        """
        # print('[DEBUG][ADAPTER] is_open_for_signup called')
        return True
    
    def save_user(self, request, sociallogin, form=None):
        """
        소셜 로그인 사용자 저장 시 이메일 검증 상태 설정
        """
        # print('[DEBUG][ADAPTER] save_user called')
        # print('[DEBUG][ADAPTER] sociallogin.is_existing:', sociallogin.is_existing)
        # print('[DEBUG][ADAPTER] sociallogin.user:', sociallogin.user)
        
        user = super().save_user(request, sociallogin, form)
        
        # 소셜 로그인의 경우 이메일을 자동으로 검증된 상태로 설정
        if sociallogin.account.provider in ['google', 'kakao', 'naver', 'github']:
            # 이메일이 있는 경우 검증된 상태로 설정
            if user.email:
                from allauth.account.models import EmailAddress
                email_address, created = EmailAddress.objects.get_or_create(
                    user=user,
                    email=user.email,
                    defaults={'verified': True, 'primary': True}
                )
                if not created:
                    # 기존 이메일 주소가 있다면 검증 상태로 업데이트
                    email_address.verified = True
                    email_address.primary = True
                    email_address.save()
                # print(f'[DEBUG][ADAPTER] 이메일 검증 완료: {user.email}')
        
        # print('[DEBUG][ADAPTER] saved user:', user)
        return user 