from allauth.socialaccount.adapter import DefaultSocialAccountAdapter

class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    def get_login_redirect_url(self, request):
        return '/accounts/popup-close/'
    def get_connect_redirect_url(self, request, socialaccount):
        return '/accounts/popup-close/' 