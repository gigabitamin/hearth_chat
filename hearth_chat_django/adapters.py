from allauth.socialaccount.adapter import DefaultSocialAccountAdapter

class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    def get_login_redirect_url(self, request):
        print("=== get_login_redirect_url 호출됨 ===")
        return '/accounts/popup-close/'
    def get_connect_redirect_url(self, request, socialaccount):
        print("=== get_connect_redirect_url 호출됨 ===")
        return '/accounts/popup-close/' 