from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Chat
import json

# Create your views here.

@csrf_exempt
@require_http_methods(["GET"])
def get_chat_history(request):
    """대화 내역 조회 API"""
    try:
        session_id = request.GET.get('session_id')
        limit = int(request.GET.get('limit', 50))
        
        messages = Chat.get_recent_messages(session_id, limit)
        
        chat_history = []
        for message in messages:
            chat_history.append({
                'id': message.id,
                'message_type': message.message_type,
                'content': message.content,
                'timestamp': message.timestamp.isoformat(),
                'session_id': message.session_id
            })
        
        return JsonResponse({
            'status': 'success',
            'data': chat_history,
            'count': len(chat_history)
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def get_all_sessions(request):
    """모든 세션 목록 조회"""
    try:
        sessions = Chat.objects.values('session_id').distinct()
        session_list = [session['session_id'] for session in sessions if session['session_id']]
        
        return JsonResponse({
            'status': 'success',
            'sessions': session_list,
            'count': len(session_list)
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)
