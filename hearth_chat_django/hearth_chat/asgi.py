print("ASGI 파일이 실행됨")

try:
    import os
    from channels.routing import ProtocolTypeRouter, URLRouter
    from django.core.asgi import get_asgi_application
    from channels.auth import AuthMiddlewareStack
    import chat.routing
except Exception as e:
    print("ASGI import error:", e)
    import traceback
    traceback.print_exc()
    raise

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hearth_chat.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(
            chat.routing.websocket_urlpatterns
        )
    ),
})
