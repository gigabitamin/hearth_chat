from django.db import models
from django.utils import timezone

# Create your models here.

class Chat(models.Model):
    MESSAGE_TYPE_CHOICES = [
        ('user', '사용자'),
        ('ai', 'AI'),
    ]
    
    # 기본 정보
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPE_CHOICES, verbose_name='메시지 타입')
    content = models.TextField(verbose_name='메시지 내용', db_collation='utf8mb4_unicode_ci')
    timestamp = models.DateTimeField(default=timezone.now, verbose_name='전송 시간')
    
    # 세션 관리 (나중에 사용자별 구분을 위해)
    session_id = models.CharField(max_length=100, blank=True, null=True, verbose_name='세션 ID')
    
    # 메타 정보
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성 시간')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정 시간')
    
    class Meta:
        ordering = ['timestamp']
        verbose_name = '채팅 메시지'
        verbose_name_plural = '채팅 메시지들'
        db_table = 'chat_chat'
    
    def __str__(self):
        return f"{self.get_message_type_display()} - {self.content[:50]}..."
    
    @classmethod
    def save_user_message(cls, content, session_id=None):
        """사용자 메시지 저장"""
        return cls.objects.create(
            message_type='user',
            content=content,
            session_id=session_id
        )
    
    @classmethod
    def save_ai_message(cls, content, session_id=None):
        """AI 메시지 저장"""
        return cls.objects.create(
            message_type='ai',
            content=content,
            session_id=session_id
        )
    
    @classmethod
    def get_recent_messages(cls, session_id=None, limit=50):
        """최근 메시지 조회"""
        queryset = cls.objects.all()
        if session_id:
            queryset = queryset.filter(session_id=session_id)
        return queryset.order_by('-timestamp')[:limit]
