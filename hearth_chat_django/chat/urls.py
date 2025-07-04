from django.urls import path
from . import consumers, views

urlpatterns = [
    # WebSocket URL (routing.py에서 처리됨)
    # path('ws/chat/', consumers.ChatConsumer.as_asgi()),
    
    # API URLs
    path('api/chat/history/', views.get_chat_history, name='chat_history'),
    path('api/chat/sessions/', views.get_all_sessions, name='all_sessions'),
]