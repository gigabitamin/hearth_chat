## Warm & Cozy Connection - Hearth Chat
- "I want to create a warm and cozy space around the fireplace, a place where people can gather and share stories in front of the warm flames."  
- 벽난로 주변의 따뜻하고 아늑한 공간. 우연히 모여든 사람들이 따뜻한 불꽃 앞에서 이야기 나누는 공간을 만들고 싶습니다  

==========================================

## 250812 v0.99
- camera 목록 출력, 기존 webcam 외에 가상카메라나 아바타 화면 등 출력 가능, globalinput 입력창 카메라 촬영 후 자르기 선택 박스 수정(react-easy-crop -> react-image-crop)

### Hearth Chat 패키지 구조 개요

이 문서는 `C:\Project\hearth_chat_project\hearth_chat_package`의 디렉터리 구조와 주요 컴포넌트, 실행/배포, Lily LLM 연동 포인트를 정리합니다.

---

### 최상위 구성
- `app.js`, `build.sh`, `Dockerfile`: 빌드/배포 스크립트 및 진입점(프로젝트 관리용)
- `script/`: 배포/실행 편의 스크립트
- `hearth_chat_django/`: 백엔드 (Django + Channels)
- `hearth_chat_react/`: 프론트엔드 (React)
- `hearth_chat_media/`: 정적/업로드 미디어 경로(환경에 따라 다름)

---

### Backend: `hearth_chat_django/`
- `manage.py`: Django 관리 진입점
- `settings.py`: 프로젝트 설정
- `urls.py`: URL 라우팅
- `chat/`:
  - `consumers.py`: WebSocket(Channels) 소비자. 클라이언트 메시지를 수신하고 AI 응답을 생성하여 브로드캐스트
  - `admin_urls.py`, `admin_views.py`: 어드민 관련 라우팅/뷰
  - `migrations/`: DB 마이그레이션
  - `templates/`, `management/`, `mysql_backend/`: 템플릿, 관리 커맨드, DB 백엔드 등
- `hearth_chat/`:
  - `apps.py`, `adapters.py` 등: 앱 설정 및 어댑터 로직
- `staticfiles/`, `templates/`: 정적/템플릿 자원
- `test/`: Django 측 테스트 코드
- `hearth_chat_django_250805_0616/`: 날짜가 포함된 스냅샷/백업 프로젝트(참고용)

핵심 연동 포인트
- `chat/consumers.py`
  - Lily FastAPI로의 호출을 담당
  - 프론트에서 전달한 `client_ai_settings`를 우선 적용
  - Private HF Space 대응: `HF_TOKEN`/`HUGGING_FACE_TOKEN` 환경변수를 읽어 `Authorization: Bearer ...` 헤더를 추가하여 `Lily /generate`, `/rag/generate` 호출
  - 성능 최적화: 프롬프트 단순화 및 `max_length` 동적 적용, 상세 로깅
- `hearth_chat/settings.py`
  - `LILY_API_URL` 환경별 분기(로컬/서버)
  - CORS/CSRF에 HF Spaces URL 포함

실행(로컬)
```bash
python manage.py runserver 0.0.0.0:8000
```

환경변수(서버/로컬 공통 권장)
- `LILY_API_URL`: Lily FastAPI 기본 URL
- `HF_TOKEN` 또는 `HUGGING_FACE_TOKEN`: Private HF Space 접근 토큰(서버에서 Lily 호출 시 사용)

---

### Frontend: `hearth_chat_react/`
- `package.json`, `package-lock.json`
- `public/`, `src/`
  - `src/utils/apiConfig.js`: `getLilyApiUrl()`, `LILY_API_URL` 정의(로컬/프로덕션 자동 분기)
  - `src/components/SettingsModal.jsx`, `AISettingsModal.js`: 사용자 설정에 `LILY_API_URL` 반영
  - `src/components/GlobalChatInput.jsx`: 파일 업로드 시 Lily API에 직접 업로드, WebSocket 전송 시 AI 설정 포함
  - `src/components/chat_box.jsx`: 초기 설정/표시 로직

실행(로컬)
```bash
npm install
npm start
```

---

### 데이터 흐름(요약)
1) React가 WebSocket으로 Django에 메시지 전송(+현재 AI 설정)
2) Django `consumers.py`가 설정을 합성하고 Lily FastAPI에 요청
   - 텍스트/이미지/RAG 별로 `/generate`, `/rag/generate`, `/document/upload` 등 호출
   - Private Space: `Authorization: Bearer <HF_TOKEN>` 헤더 필수
3) 응답을 WebSocket으로 프론트에 브로드캐스트

---

### 배포/운영 팁
- Railway(Django): `LILY_API_URL`, `HF_TOKEN` 설정 권장
- HF Spaces(Lily): Private 시 토큰 필수, CORS 허용, 스케일에 따른 응답시간 주의
- 장애 대응: `consumers.py` 상세 로깅 확인, 4xx/5xx 응답 본문 출력으로 원인 파악




### Hearth Chat × Lily LLM 통합 구조

Hearth Chat(Railway 배포)과 Lily LLM(Hugging Face Spaces, Docker) 간 연동 구조와 데이터 흐름, 환경변수, 주요 연동 포인트를 정리합니다.

---

### 아키텍처 개요
- 클라이언트(React) ↔ 서버(Django/Channels) ↔ LLM 서버(FastAPI on HF Spaces)
- 실시간 메시징은 WebSocket(클라이언트 ↔ Django), LLM 호출은 Django → Lily(FastAPI) HTTP로 처리

데이터 흐름(요약)
1) 사용자가 React에서 텍스트/파일 전송 → WebSocket으로 Django 전달(프론트 현재 AI 설정 동봉)
2) Django `chat/consumers.py`가 AI 설정을 합성하여 Lily FastAPI 호출
   - 텍스트·이미지: `POST /generate`
   - 문서 업로드: `POST /document/upload` 후 `POST /rag/generate`
3) Lily가 응답 생성 → Django가 WebSocket으로 클라이언트에게 브로드캐스트

---

### 환경별 URL 및 인증
- 프론트엔드
  - `src/utils/apiConfig.js`의 `getLilyApiUrl()`이 로컬/프로덕션 자동 분기
  - UI 설정 모달에서 사용자별 `aiProvider`, `lilyApiUrl`, `lilyModel`, `geminiModel`, `maxTokens` 관리

- Django(서버)
  - `settings.py`의 `LILY_API_URL`(Railway/로컬 분기), CORS/CSRF에 HF URL 포함
  - Private Space 인증: `HF_TOKEN` 또는 `HUGGING_FACE_TOKEN` 환경변수를 읽어 Lily 호출 시 아래 헤더 자동 첨부

```http
Authorization: Bearer <HF_TOKEN>
```

- Lily(FastAPI, HF Spaces)
  - Private Space에서는 토큰 필수
  - 모델/토크나이저 로딩에도 `HF_TOKEN` 사용, 캐시 디렉토리 권한 설정 필요

---

### 주요 연동 포인트(코드)
- 프런트엔드
  - `src/utils/apiConfig.js`: `LILY_API_URL` 기본값 제공
  - `GlobalChatInput.jsx`: 파일 업로드 시 Lily URL 직접 사용, WebSocket 메시지에 AI 설정 포함
  - `SettingsModal.jsx`, `AISettingsModal.js`: 사용자 설정 저장/적용

- Django
  - `chat/consumers.py`: Lily API 호출부 단일화, `Authorization` 헤더 자동 첨부, 프롬프트 단순화 및 `max_length` 동적 적용

- Lily
  - `lily_llm_api/app_v2.py`: `/generate`, `/rag/generate`, `/document/upload` 등 엔드포인트 제공, CPU 스레드 최적화, 멀티모달 경량 처리

---

### 요청/응답 규약(대표)
- 텍스트/이미지 생성
  - URL: `<LILY_API_URL>/generate`
  - 헤더: `Authorization: Bearer <HF_TOKEN>`(Private 시)
  - Body: `multipart/form-data`
    - `prompt`, optional `image1..image4`, `max_length`, `temperature`, `top_p`, `do_sample`

- 문서 업로드 및 RAG
  - 업로드: `<LILY_API_URL>/document/upload` (file, user_id, document_id)
  - RAG: `<LILY_API_URL>/rag/generate` (query, user_id, document_id)

---

### 성능 최적화 핵심
- Django → Lily 프롬프트 최소화(장문 프리픽스 제거), `max_length` 사용자 설정 기반(기본 20, 상한 128)
- Lily 서버 CPU 스레드 환경 최적화(`CPU_THREADS`, `OMP_NUM_THREADS`, `MKL_NUM_THREADS`, `NUMEXPR_NUM_THREADS`)
- 텍스트-only 경로는 탐색 비활성화(`do_sample=False`)로 지연 최소화

---

### 운영 체크리스트
- Railway(Django)
  - `LILY_API_URL`, `HF_TOKEN` 설정
  - CORS/CSRF에 HF Spaces URL 포함
- HF Spaces(Lily)
  - Private 프로젝트: `HF_TOKEN` 필수
  - 캐시 권한 및 디스크 여유 확인, 빌드 로그에서 권한 오류 점검
- 공통
  - 응답시간 증가 시: Django 소비자 로그(전송 프롬프트/파라미터), Lily 로그(토큰화/생성/디코드 시간) 교차 확인



===========================================================


# Hearth Chat 폴더 트리 구조

C:\Project\hearth_chat_project\hearth_chat_package\
├── hearth_chat_django\                 # Django + Channels 백엔드
│   ├── manage.py                        # Django 관리 진입점
│   ├── settings.py                      # 프로젝트 설정(CORS/CSRF, LILY_API_URL 등)
│   ├── urls.py                          # URL 라우팅
│   ├── chat\                            # 채팅 앱
│   │   ├── consumers.py                 # WebSocket 소비자(Lily LLM 연동 핵심)
│   │   ├── admin_urls.py, admin_views.py
│   │   ├── migrations\
│   │   ├── templates\
│   │   └── mysql_backend\
│   ├── hearth_chat\                     # 앱 설정/어댑터
│   ├── staticfiles\, templates\        # 정적/템플릿 자원
│   ├── test\                            # 백엔드 테스트
│   └── hearth_chat_django_YYYYMMDD_...  # 스냅샷/백업 프로젝트
├── hearth_chat_react\                  # React 프론트엔드
│   ├── package.json, package-lock.json
│   ├── public\
│   └── src\
│       ├── utils\apiConfig.js          # LILY_API_URL(로컬/프로덕션 분기)
│       └── components\                 # SettingsModal/AISettingsModal/GlobalChatInput 등
├── hearth_chat_media\                  # 업로드/정적 자원(환경에 따라 경로 상이)
├── app.js, build.sh, Dockerfile        # 빌드/배포 스크립트·설정
└── script\                              # 편의 스크립트(cs.sh 등)

연동 핵심
- 프론트: `apiConfig.js`에서 Lily 기본 URL 결정, 파일 업로드/요청은 Lily로 직접 전송 가능
- 백엔드: `chat/consumers.py`가 WebSocket 메시지 처리 후 Lily FastAPI 호출
  - 텍스트/이미지: `POST <LILY_API_URL>/generate` (multipart/form-data)
  - RAG: 업로드 `POST /document/upload` → 질의 `POST /rag/generate`
  - Private HF Space: `Authorization: Bearer <HF_TOKEN>` 헤더 자동 첨부(환경변수 `HF_TOKEN`/`HUGGING_FACE_TOKEN`)

운영 포인트
- Railway 배포 시 `LILY_API_URL`, `HF_TOKEN` 설정 권장
- 대기시간 최적화: 프롬프트 최소화, `max_length`(기본 20, 상한 128) 적용
- 문제 발생 시 Django 로그(요청 파라미터)와 Lily 로그(토큰화/생성 시간) 동시 확인
