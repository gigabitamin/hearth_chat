from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.shortcuts import resolve_url

class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    def get_login_redirect_url(self, request):
        return resolve_url('/social-redirect/')
    def get_connect_redirect_url(self, request, socialaccount):
        return resolve_url('/social-redirect/') 