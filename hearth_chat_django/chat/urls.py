from rest_framework.routers import DefaultRouter
from .views import ChatRoomViewSet, ChatViewSet, UserSettingsView, user_info, chat_home, get_chat_history, get_all_sessions, upload_chat_image, logout_api
from django.urls import path

# from hearth_chat_package.hearth_chat_django.chat import views  # 삭제
from . import views  # 상대경로로 변경

router = DefaultRouter()
router.register(r'rooms', ChatRoomViewSet, basename='room')
router.register(r'messages', ChatViewSet, basename='message')

urlpatterns = [
    path('user/settings/', UserSettingsView.as_view(), name='user-settings'),
    path('user/', user_info, name='user_info'),
    path('', views.chat_home, name='chat_home'),  # /chat/ 메인 페이지
    path('api/chat/history/', views.get_chat_history, name='chat_history'),
    path('api/chat/sessions/', views.get_all_sessions, name='all_sessions'),
    path('api/chat/upload_image/', views.upload_chat_image, name='upload_chat_image'),
    path('api/user/', views.user_info, name='user_info'),
    path('api/logout/', views.logout_api, name='logout_api'),
    path('api/chat/logout/', views.logout_api, name='logout_api_chat'),
]

urlpatterns += router.urls