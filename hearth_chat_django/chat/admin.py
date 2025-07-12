from django.contrib import admin
from .models import Chat
from django.contrib.sessions.models import Session

@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    list_display = ['message_type', 'content_short', 'timestamp', 'session_id']
    list_filter = ['message_type', 'timestamp', 'session_id']
    search_fields = ['content', 'session_id']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-timestamp']
    
    def content_short(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_short.short_description = '메시지 내용'
    
    fieldsets = (
        ('기본 정보', {
            'fields': ('message_type', 'content', 'timestamp', 'session_id', 'attach_image')
        }),
        ('메타 정보', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ['session_key', 'expire_date']
    search_fields = ['session_key']
    ordering = ['-expire_date']
