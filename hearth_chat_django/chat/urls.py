from rest_framework.routers import DefaultRouter
from .views import ChatRoomViewSet, ChatViewSet, UserSettingsView, user_info
from django.urls import path

router = DefaultRouter()
router.register(r'rooms', ChatRoomViewSet, basename='room')
router.register(r'messages', ChatViewSet, basename='message')

urlpatterns = [
    path('user/settings/', UserSettingsView.as_view(), name='user-settings'),
    path('user/', user_info, name='user_info'),
]

urlpatterns += router.urls