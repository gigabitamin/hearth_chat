from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

# DRF 라우터를 사용하여 ViewSet들을 등록
router = DefaultRouter()
router.register(r'rooms', views.ChatRoomViewSet, basename='room')
router.register(r'messages', views.ChatViewSet, basename='message')
router.register(r'reactions', views.MessageReactionViewSet, basename='reaction')
router.register(r'replies', views.MessageReplyViewSet, basename='reply')
router.register(r'pins', views.PinnedMessageViewSet, basename='pin')
router.register(r'notifications', views.NotificationReadViewSet, basename='notificationread')

# API 엔드포인트들을 정의
urlpatterns = [
    # 기존 URL들을 여기에 그대로 둡니다.
    path('user/settings/', views.UserSettingsView.as_view(), name='user-settings'),
    path('user/delete/', views.UserDeleteView.as_view(), name='user-delete'),
    path('user/', views.user_info, name='user_info'),
    path('users/', views.UserListView.as_view(), name='user-list'),
    path('history/', views.get_chat_history, name='chat_history'),
    path('sessions/', views.get_all_sessions, name='all_sessions'),
    path('upload_image/', views.upload_chat_image, name='upload_chat_image'),
    path('upload_multiple_images/', views.upload_multiple_chat_images, name='upload_multiple_chat_images'),
    path('logout/', views.logout_api, name='logout_api'),
    path('rooms/user_chat_alt/', views.UserChatCreateAPIView.as_view(), name='user_chat_api'),
    path('messages/<int:pk>/delete/', views.ChatViewSet.as_view({'delete': 'delete_message'}), name='delete_message'),
    path('file_exists/', views.file_exists, name='file_exists'),
    path('list_media_files/', views.list_media_files, name='list_media_files'),
]

# 라우터에 등록된 URL들을 urlpatterns에 추가
urlpatterns += router.urls
