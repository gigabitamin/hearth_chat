# 🚀 Render 서버 배포 가이드

## 📋 개요
이 가이드는 Hearth Chat 프로젝트를 Render 서버에 배포할 때 발생할 수 있는 정적 파일 문제를 해결하기 위한 것입니다.

## 🔧 주요 변경사항

### 1. WhiteNoise 설정 최적화
- `CompressedManifestStaticFilesStorage` → `CompressedStaticFilesStorage`로 변경
- 파일 해싱 제거하여 경로 충돌 문제 해결
- 압축만 적용하여 성능 향상

### 2. 커스텀 정적 파일 수집 명령
- `safe_collectstatic` 커스텀 명령 생성
- React 빌드 파일을 직접 복사하여 안전성 확보
- 오류 발생 시에도 서버 시작 가능

### 3. 백업 정적 파일 서빙 옵션
- WhiteNoise 문제 발생 시 Django 기본 방식으로 전환 가능
- 환경변수 `WHITENOISE_DISABLE=true`로 설정

## 🚀 배포 단계

### 1. 코드 푸시
```bash
git add .
git commit -m "Fix static files for Render deployment"
git push origin main
```

### 2. Render 서버 설정
- **Build Command**: `./build.sh` 또는 `npm run build && pip install -r requirements.txt`
- **Start Command**: `cd hearth_chat_django && python manage.py migrate && python manage.py safe_collectstatic --noinput --clear && daphne -b 0.0.0.0 -p $PORT hearth_chat.asgi:application`

### 3. 환경변수 설정
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
DJANGO_SECRET_KEY=your-secret-key
RENDER=true
```

## 🛠️ 문제 해결

### 문제 1: 정적 파일을 찾을 수 없음
**증상**: `SuspiciousFileOperation` 오류
**해결책**: 
1. `safe_collectstatic` 명령 사용 확인
2. React 빌드 폴더 경로 확인
3. `STATIC_ROOT` 설정 확인

### 문제 2: WhiteNoise 오류 지속
**증상**: WhiteNoise 관련 오류 계속 발생
**해결책**:
1. 환경변수 `WHITENOISE_DISABLE=true` 설정
2. Django 기본 정적 파일 서빙 사용

### 문제 3: 정적 파일 경로 문제
**증상**: CSS/JS 파일 로드 실패
**해결책**:
1. `STATICFILES_DIRS` 설정 확인
2. React 빌드 결과물 경로 확인
3. `asset-manifest.json` 파일 존재 확인

## 📁 파일 구조
```
hearth_chat_package/
├── hearth_chat_django/
│   ├── chat/management/commands/safe_collectstatic.py  # 커스텀 명령
│   ├── hearth_chat/settings.py                        # 수정된 설정
│   └── script/entrypoint.sh                           # 수정된 엔트리포인트
├── requirements.txt                                    # whitenoise 포함
└── RENDER_DEPLOYMENT_GUIDE.md                         # 이 가이드
```

## 🔍 디버깅

### 로그 확인
```bash
# Render 대시보드에서 로그 확인
# 또는 터미널에서
heroku logs --tail  # Heroku 사용 시
```

### 로컬 테스트
```bash
# 가상환경 활성화
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 정적 파일 수집 테스트
cd hearth_chat_django
python manage.py safe_collectstatic --noinput --clear
```

## 📞 지원
문제가 지속되면 다음을 확인하세요:
1. React 빌드가 성공적으로 완료되었는지
2. `hearth_chat_react/build/` 폴더가 존재하는지
3. 환경변수가 올바르게 설정되었는지
4. Render 서버의 빌드 로그에서 오류 메시지 확인

## 🎯 성공 지표
- ✅ 정적 파일 수집 성공
- ✅ 서버 시작 성공
- ✅ 웹페이지 로드 성공
- ✅ CSS/JS 파일 정상 로드
- ✅ 이미지/폰트 파일 정상 로드 