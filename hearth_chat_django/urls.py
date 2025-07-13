from django.views.generic import TemplateView

urlpatterns = [
    path('accounts/popup-close/', TemplateView.as_view(template_name='social_login_redirect.html'), name='popup-close'),
] 