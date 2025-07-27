@login_required
def kakao_connect_callback(request):
    """Kakao OAuth 계정 연결 콜백 처리"""
    code = request.GET.get('code')
    if not code:
        return JsonResponse({'error': '인증 코드가 없습니다.'}, status=400)
    
    try:
        app = SocialApp.objects.get(provider='kakao', sites=settings.SITE_ID)
        
        # 액세스 토큰 교환
        token_url = 'https://kauth.kakao.com/oauth/token'
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': app.client_id,
            'client_secret': app.secret,
            'code': code,
            'redirect_uri': f'{settings.BASE_URL}/oauth/kakao/connect/callback/',
        }
        
        token_response = requests.post(token_url, data=token_data)
        token_response.raise_for_status()
        token_info = token_response.json()
        access_token = token_info['access_token']
        
        # 사용자 정보 가져오기
        user_info_url = 'https://kapi.kakao.com/v2/user/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        user_response = requests.get(user_info_url, headers=headers)
        user_response.raise_for_status()
        user_info = user_response.json()
        kakao_uid = str(user_info['id'])

        # ⚠️ 먼저 이미 다른 유저와 연결되어 있는지 확인
        existing_account = SocialAccount.objects.filter(provider='kakao', uid=kakao_uid).first()
        if existing_account and existing_account.user != request.user:
            return JsonResponse({'error': '이 Kakao 계정은 이미 다른 사용자에게 연결되어 있습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})

        # 소셜 계정 연결 (없으면 생성)
        social_account, created = SocialAccount.objects.get_or_create(
            provider='kakao',
            uid=kakao_uid,
            defaults={'user': request.user}
        )

        # 토큰 저장 또는 갱신
        expires_in = int(token_info.get('expires_in', 21600))
        if created:
            SocialToken.objects.create(
                account=social_account,
                token=access_token,
                expires_at=timezone.now() + timezone.timedelta(seconds=expires_in)
            )
        else:
            # 이미 존재할 경우 토큰 갱신
            token_obj = SocialToken.objects.filter(account=social_account).first()
            if token_obj:
                token_obj.token = access_token
                token_obj.expires_at = timezone.now() + timezone.timedelta(seconds=expires_in)
                token_obj.save()

        return redirect('/accounts/popup-close/?action=connect')

    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'Kakao OAuth 앱이 설정되지 않았습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})
    except requests.RequestException as e:
        print('[ERROR][KAKAO_CONNECT] API 요청 오류:', str(e))
        return JsonResponse({'error': 'OAuth API 요청 중 오류가 발생했습니다.'}, status=500 ,json_dumps_params={'ensure_ascii': False})
    except Exception as e:
        print('[ERROR][KAKAO_CONNECT] 콜백 처리 오류:', str(e))
        return JsonResponse({'error': 'OAuth 콜백 처리 중 오류가 발생했습니다.'}, status=500 ,json_dumps_params={'ensure_ascii': False})
