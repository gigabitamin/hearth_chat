from allauth.account.forms import SignupForm
from django import forms

class CustomSignupForm(SignupForm):
    """커스텀 회원가입 폼"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # username 필드를 필수로 설정
        self.fields['username'].required = True
        self.fields['username'].widget.attrs.update({
            'placeholder': '아이디',
            'class': 'form-control'
        })
        
        # email 필드를 필수로 설정
        self.fields['email'].required = True
        self.fields['email'].widget.attrs.update({
            'placeholder': '이메일 주소',
            'class': 'form-control'
        })
    
    def save(self, request):
        """사용자 저장 및 UserSettings 생성"""
        user = super().save(request)
        
        # UserSettings 생성
        try:
            from chat.models import UserSettings
            UserSettings.objects.get_or_create(user=user)
            print(f'[CUSTOM_FORM] UserSettings created for user: {user.username}')
        except Exception as e:
            print(f'[CUSTOM_FORM] UserSettings creation failed: {e}')
        
        return user 