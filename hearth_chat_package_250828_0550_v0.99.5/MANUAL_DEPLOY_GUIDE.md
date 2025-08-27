# 🚀 수동 배포 가이드 (Render 무료 분량 절약)

렌더의 무료 분량을 다 써서 GitHub Actions 자동 배포를 우회하는 방법입니다.

## 📋 배포 방법

### **방법 1: GitHub Actions 수동 트리거 + Render API 자동 배포 (권장)**

1. **GitHub 저장소로 이동**
   - `Actions` 탭 클릭
   - `Manual Deploy to Render` 워크플로우 선택

2. **수동 실행**
   - `Run workflow` 버튼 클릭
   - `Environment` 선택 (production/staging)
   - `Force rebuild` 체크 여부 선택
   - `Run workflow` 클릭

3. **자동 배포 실행**
   - 워크플로우가 실행되면 자동으로 Render API 호출
   - `RENDER_DEPLOY_HOOK`을 통해 Render 서비스에 배포 요청
   - 배포 진행 상황은 Render 대시보드에서 실시간 확인

#### **RENDER_DEPLOY_HOOK 설정**
```bash
# GitHub Repository > Settings > Secrets and variables > Actions
# Repository secrets에 추가:
RENDER_DEPLOY_HOOK = "https://api.render.com/deploy/srv-[SERVICE_ID]?key=[DEPLOY_KEY]"
```

### **방법 2: Render 대시보드 직접 배포**

1. **Render 대시보드 접속**
   - https://dashboard.render.com
   - 해당 서비스 선택

2. **수동 배포 실행**
   - `Manual Deploy` 버튼 클릭
   - `Deploy latest commit` 선택
   - 배포 진행 상황 모니터링

## ⚠️ 주의사항

### **자동 배포 비활성화됨**
- `push` 이벤트로 인한 자동 배포 비활성화
- `workflow_dispatch` (수동 트리거)만 활성화
- 렌더 무료 분량 절약

### **RENDER_DEPLOY_HOOK 설정 필수**
- GitHub Actions에서 Render로 직접 배포하려면 필수
- Render 서비스 설정에서 Deploy Hook URL 확인
- GitHub Repository Secrets에 등록

### **배포 전 체크리스트**
- [ ] 코드 테스트 완료
- [ ] 환경 변수 설정 확인
- [ ] 데이터베이스 마이그레이션 준비
- [ ] 백업 완료
- [ ] RENDER_DEPLOY_HOOK 설정 확인

## 🔧 환경별 설정

### **Production 환경**
```bash
# 환경 변수
DEBUG=False
ALLOWED_HOSTS=your-domain.com
CSRF_TRUSTED_ORIGINS=https://your-domain.com

# GitHub Secrets
RENDER_DEPLOY_HOOK=https://api.render.com/deploy/srv-[PROD_SERVICE_ID]?key=[PROD_DEPLOY_KEY]
```

### **Staging 환경**
```bash
# 환경 변수
DEBUG=True
ALLOWED_HOSTS=staging.your-domain.com
CSRF_TRUSTED_ORIGINS=https://staging.your-domain.com

# GitHub Secrets
RENDER_DEPLOY_HOOK=https://api.render.com/deploy/srv-[STAGING_SERVICE_ID]?key=[STAGING_DEPLOY_KEY]
```

## 📊 모니터링

### **배포 상태 확인**
- **Render 대시보드**: 실시간 로그 및 상태
- **GitHub Actions**: 빌드 및 테스트 결과, 배포 요청 상태
- **애플리케이션**: 헬스체크 엔드포인트

### **로그 확인**
```bash
# Render 로그
# 대시보드 > 서비스 > Logs 탭

# GitHub Actions 로그
# Actions 탭 > 워크플로우 실행 > 로그 확인

# 애플리케이션 로그
# Django: settings.py의 LOGGING 설정
# React: 브라우저 개발자 도구
```

## 🚨 문제 해결

### **배포 실패 시**
1. **GitHub Actions 로그 확인**: Render API 호출 상태 확인
2. **Render 대시보드 확인**: 서비스 상태 및 로그 확인
3. **RENDER_DEPLOY_HOOK 확인**: URL 및 키가 올바른지 확인
4. **환경 변수**: 필수 환경 변수 설정 여부 확인
5. **의존성**: requirements.txt 및 package.json 확인
6. **권한**: 데이터베이스 및 파일 시스템 권한 확인

### **RENDER_DEPLOY_HOOK 문제**
```bash
# 일반적인 문제들:
# 1. 잘못된 서비스 ID
# 2. 만료된 Deploy Key
# 3. 잘못된 URL 형식
# 4. GitHub Secrets에 등록되지 않음

# 해결 방법:
# 1. Render 대시보드에서 Deploy Hook URL 재생성
# 2. GitHub Secrets에 새로운 값으로 업데이트
# 3. 워크플로우 재실행
```

### **롤백 방법**
1. **Render 대시보드**: 이전 배포로 롤백
2. **GitHub**: 이전 커밋으로 되돌리기
3. **데이터베이스**: 백업에서 복원

## 💡 최적화 팁

### **빌드 시간 단축**
- `.dockerignore` 최적화
- 불필요한 파일 제외
- 멀티스테이지 빌드 활용

### **비용 절약**
- 무료 분량 모니터링
- 불필요한 자동 배포 방지
- 효율적인 리소스 사용
- 수동 트리거로 배포 시점 제어

### **배포 효율성**
- GitHub Actions에서 테스트 및 빌드 완료 후 Render 배포
- Force rebuild 옵션으로 필요시에만 전체 재빌드
- 환경별 배포 설정 분리

## 📞 지원

문제가 발생하면:
1. GitHub Issues 생성
2. Render 지원팀 문의
3. 프로젝트 문서 확인
4. GitHub Actions 로그 분석

---

**💡 이 가이드를 통해 렌더 무료 분량을 절약하면서 안전하게 배포할 수 있습니다!** 