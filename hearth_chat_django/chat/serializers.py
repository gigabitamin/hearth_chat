from rest_framework import serializers
from .models import ChatRoom, Chat, ChatRoomParticipant, UserSettings, VoiceCall
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

class ChatRoomParticipantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = ChatRoomParticipant
        fields = ['id', 'user', 'is_owner', 'joined_at']

class ChatRoomSerializer(serializers.ModelSerializer):
    participants = ChatRoomParticipantSerializer(many=True, source='chatroomparticipant_set', read_only=True)
    class Meta:
        model = ChatRoom
        fields = ['id', 'name', 'room_type', 'ai_provider', 'is_public', 'is_active', 'is_voice_call', 'participants', 'created_at', 'updated_at']

class ChatSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    class Meta:
        model = Chat
        fields = ['id', 'room', 'sender', 'message_type', 'content', 'timestamp', 'emotion', 'attach_image', 'created_at', 'updated_at']

class UserSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSettings
        exclude = ['id', 'created_at', 'updated_at']
    ai_response_enabled = serializers.BooleanField(required=False)

class VoiceCallSerializer(serializers.ModelSerializer):
    caller = UserSerializer(read_only=True)
    receiver = UserSerializer(read_only=True)
    class Meta:
        model = VoiceCall
        fields = ['id', 'room', 'caller', 'receiver', 'status', 'start_time', 'end_time', 'duration'] 