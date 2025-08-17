from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.account.adapter import DefaultAccountAdapter
from django.shortcuts import resolve_url
import uuid
import logging

# 로거 설정
logger = logging.getLogger(__name__)

class CustomAccountAdapter(DefaultAccountAdapter):
    """일반 회원가입 어댑터"""
    
    def save_user(self, request, user, form, commit=True):
        """사용자 저장 후 UserSettings 생성"""
        user = super().save_user(request, user, form, commit)
        
        if commit:
            try:
                # UserSettings가 없는 경우 생성
                from chat.models import UserSettings
                UserSettings.objects.get_or_create(user=user)
                logger.info(f'[ACCOUNT_ADAPTER] UserSettings created for user: {user.username}')
            except Exception as e:
                logger.error(f'[ACCOUNT_ADAPTER] UserSettings creation failed: {e}')
        
        return user

class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    def get_login_redirect_url(self, request):
        logger.info('[ADAPTER] get_login_redirect_url called')
        return resolve_url('/accounts/popup-close/')
    
    def get_connect_redirect_url(self, request, socialaccount):
        logger.info('[ADAPTER] get_connect_redirect_url called')
        return resolve_url('/accounts/popup-close/')
    
    def pre_social_login(self, request, sociallogin):
        logger.info('[ADAPTER] pre_social_login called')
        logger.info(f'[ADAPTER] provider: {sociallogin.account.provider}')
        logger.info(f'[ADAPTER] user: {sociallogin.user}')
        logger.info(f'[ADAPTER] sociallogin.is_existing: {sociallogin.is_existing}')
        logger.info(f'[ADAPTER] sociallogin.account.uid: {sociallogin.account.uid}')
        logger.info(f'[ADAPTER] sociallogin.account.extra_data: {sociallogin.account.extra_data}')
        
        try:
            return super().pre_social_login(request, sociallogin)
        except Exception as e:
            logger.error(f'[ADAPTER] pre_social_login 오류: {e}')
            raise
    
    def save_user(self, request, sociallogin, form=None):
        logger.info('[ADAPTER] save_user called')
        logger.info(f'[ADAPTER] sociallogin.is_existing: {sociallogin.is_existing}')
        logger.info(f'[ADAPTER] sociallogin.user: {sociallogin.user}')
        
        try:
            user = super().save_user(request, sociallogin, form)
            logger.info(f'[ADAPTER] saved user: {user}')
            
            # UserSettings 생성
            try:
                from chat.models import UserSettings
                UserSettings.objects.get_or_create(user=user)
                logger.info(f'[SOCIAL_ADAPTER] UserSettings created for user: {user.username}')
            except Exception as e:
                logger.error(f'[SOCIAL_ADAPTER] UserSettings creation failed: {e}')
            
            return user
        except Exception as e:
            logger.error(f'[ADAPTER] save_user 오류: {e}')
            raise

    def populate_user(self, request, sociallogin, data):
        """
        소셜 로그인 시 사용자 정보를 채우는 메서드
        username이 비어있을 때 고유한 값을 생성
        """
        logger.info('[ADAPTER] populate_user called')
        logger.info(f'[ADAPTER] data: {data}')
        logger.info(f'[ADAPTER] sociallogin.account.provider: {sociallogin.account.provider}')
        logger.info(f'[ADAPTER] sociallogin.account.uid: {sociallogin.account.uid}')
        
        try:
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
                logger.info(f'[ADAPTER] generated username: {username}')
            
            return user
        except Exception as e:
            logger.error(f'[ADAPTER] populate_user 오류: {e}')
            raise
    
    def is_auto_signup_allowed(self, request, sociallogin):
        """
        소셜 로그인 시 자동 가입 허용 여부
        """
        logger.info('[ADAPTER] is_auto_signup_allowed called')
        return True
    
    def is_open_for_signup(self, request, sociallogin):
        """
        소셜 로그인을 통한 가입 허용 여부
        """
        logger.info('[ADAPTER] is_open_for_signup called')
        return True 