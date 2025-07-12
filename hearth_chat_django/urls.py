from django.views.generic import TemplateView

urlpatterns = [
    path('accounts/popup-close/', TemplateView.as_view(template_name='socialaccount/popup_close.html'), name='popup-close'),
] 