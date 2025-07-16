from django.contrib import admin
from .models import Chat, ChatRoom, ChatRoomParticipant, UserSettings, VoiceCall, MessageReaction, MessageReply, PinnedMessage
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

@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ['name', 'room_type', 'is_public', 'is_active', 'created_at']
    list_filter = ['room_type', 'is_public', 'is_active', 'created_at']
    search_fields = ['name']
    ordering = ['-created_at']

@admin.register(ChatRoomParticipant)
class ChatRoomParticipantAdmin(admin.ModelAdmin):
    list_display = ['room', 'user', 'is_owner', 'joined_at']
    list_filter = ['is_owner', 'joined_at']
    search_fields = ['room__name', 'user__username']

@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    list_display = ['user', 'tts_enabled', 'voice_recognition_enabled', 'created_at']
    list_filter = ['tts_enabled', 'voice_recognition_enabled', 'created_at']
    search_fields = ['user__username']

@admin.register(VoiceCall)
class VoiceCallAdmin(admin.ModelAdmin):
    list_display = ['caller', 'receiver', 'status', 'start_time', 'duration']
    list_filter = ['status', 'start_time']
    search_fields = ['caller__username', 'receiver__username']

@admin.register(MessageReaction)
class MessageReactionAdmin(admin.ModelAdmin):
    list_display = ['message', 'user', 'emoji', 'created_at']
    list_filter = ['emoji', 'created_at']
    search_fields = ['message__content', 'user__username']

@admin.register(MessageReply)
class MessageReplyAdmin(admin.ModelAdmin):
    list_display = ['original_message', 'reply_message', 'created_at']
    list_filter = ['created_at']
    search_fields = ['original_message__content', 'reply_message__content']

@admin.register(PinnedMessage)
class PinnedMessageAdmin(admin.ModelAdmin):
    list_display = ['room', 'message', 'pinned_by', 'pinned_at']
    list_filter = ['pinned_at']
    search_fields = ['room__name', 'message__content', 'pinned_by__username']

@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ['session_key', 'expire_date']
    search_fields = ['session_key']
    ordering = ['-expire_date']
