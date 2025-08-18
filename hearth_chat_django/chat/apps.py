from django.apps import AppConfig


class ChatConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "chat"
    
    def ready(self):
        """앱이 준비되었을 때 시그널 등록"""
        import chat.signals