from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Chat
import json
import os
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
from django.http import HttpResponseBadRequest
from django.http import HttpResponse
from django.contrib.auth import logout as django_logout
from django.contrib.auth.decorators import login_required
from allauth.socialaccount.models import SocialAccount

# Create your views here.

def chat_home(request):
    return HttpResponse("Chat 메인 페이지입니다.")

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

ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
MAX_FILE_SIZE_MB = 4

@csrf_exempt
@require_http_methods(["POST"])
def upload_chat_image(request):
    """채팅 이미지 업로드 API (확장자, 용량, MIME 타입 검사)"""
    file = request.FILES.get('file')
    session_id = request.POST.get('session_id', None)
    content = request.POST.get('content', '')  # 메시지 내용도 받음
    if not file:
        return JsonResponse({'status': 'error', 'message': '파일이 첨부되지 않았습니다.'}, status=400)

    # 확장자 검사
    ext = file.name.split('.')[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return JsonResponse({'status': 'error', 'message': f'허용되지 않는 확장자입니다: {ext}'}, status=400)

    # 용량 검사
    if file.size > MAX_FILE_SIZE_MB * 1024 * 1024:
        return JsonResponse({'status': 'error', 'message': f'파일 용량은 {MAX_FILE_SIZE_MB}MB 이하만 허용됩니다.'}, status=400)

    # MIME 타입 검사
    if file.content_type not in ALLOWED_MIME_TYPES:
        return JsonResponse({'status': 'error', 'message': f'허용되지 않는 MIME 타입입니다: {file.content_type}'}, status=400)

    # 파일 저장
    chat_obj = Chat.objects.create(
        message_type='user',
        content=content if content else '[이미지 첨부]',  # 메시지 내용이 있으면 저장, 없으면 [이미지 첨부]
        session_id=session_id,
        attach_image=file
    )

    return JsonResponse({
        'status': 'success',
        'file_url': chat_obj.attach_image.url if chat_obj.attach_image else None,
        'chat_id': chat_obj.id
    })

@csrf_exempt
@require_http_methods(["GET"])
def user_info(request):
    """현재 로그인된 사용자 정보 + 로그인 방법 반환 API"""
    if request.user.is_authenticated:
        # 소셜 계정 연결 여부 확인
        social_accounts = list(SocialAccount.objects.filter(user=request.user).values_list('provider', flat=True))
        has_password = request.user.has_usable_password()
        is_social_only = bool(social_accounts) and not has_password
        return JsonResponse({
            'status': 'success',
            'user': {
                'username': request.user.username,
                'email': request.user.email,
                'is_superuser': request.user.is_superuser,
                'is_staff': request.user.is_staff,
                'social_accounts': social_accounts,
                'has_password': has_password,
                'is_social_only': is_social_only,
            }
        })
    else:
        return JsonResponse({'status': 'error', 'message': 'Not authenticated'}, status=401)

@csrf_exempt
@require_http_methods(["POST"])
def logout_api(request):
    """로그아웃 API"""
    try:
        # Django 로그아웃 실행
        django_logout(request)
        
        # 세션 완전 삭제
        if hasattr(request, 'session'):
            request.session.flush()
            request.session.delete()
        
        # 응답에서 세션 쿠키 삭제
        response = JsonResponse({'status': 'success', 'message': 'Logged out'})
        response.delete_cookie('sessionid')
        response.delete_cookie('csrftoken')
        
        return response
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
