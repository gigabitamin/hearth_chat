from django.urls import path
from . import consumers, views

urlpatterns = [
    path('', views.chat_home, name='chat_home'),  # /chat/ 메인 페이지
    path('api/chat/history/', views.get_chat_history, name='chat_history'),
    path('api/chat/sessions/', views.get_all_sessions, name='all_sessions'),
    path('api/chat/upload_image/', views.upload_chat_image, name='upload_chat_image'),
]