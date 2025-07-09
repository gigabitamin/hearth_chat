## Warm & Cozy Connection - Hearth Chat
- "I want to create a warm and cozy space around the fireplace, a place where people can gather and share stories in front of the warm flames."  
- 벽난로 주변의 따뜻하고 아늑한 공간. 우연히 모여든 사람들이 따뜻한 불꽃 앞에서 이야기 나누는 공간을 만들고 싶습니다  

==========================================

## 250710  
- 이미지+텍스트 멀티모달 응답 기능 추가, 수신 정상 확인 
- 기존 gemini 공식 문서참조 시 에러-> OpenAI 라이브러리의 멀티모달 메시지 구조를 적용
1. 실패 요인 요약
- 이미지 첨부 시, REST API 방식(직접 HTTP POST)으로만 시도 → 계속 실패(404, 구조 불일치, 권한 등)
- OpenAI 라이브러리 방식도 시도했으나, 메시지 구조가 잘못되어 타입 에러 발생
2. 성공 요인
- OpenAI 라이브러리(chat.completions.create)에서 멀티모달 메시지 구조를 공식 문서대로 정확히 맞춤
- content 에 리스트 형태로 { "type": "text", ... } { "type": "image_url", "image_url": { "url": ... } } 이 구조가 맞아야 Gemini가 이미지를 인식하고 멀티모달 답변을 반환함
3. 부가적 요인
- 이미지 경로의 한글/특수문자 문제를 unquote로 해결
- 파일 존재 여부 체크 및 예외처리 강화
- REST API 방식은 백업으로만 남김

## 250709  
- 미디어쿼리 삭제, 768px 스타일로 전부 통합, CSS 리팩토링  
- TTS 기능 보강  
- 1. 음소 기반 립싱크 : 한글 자음/모음 분석으로 실제 발음에 맞는 입모양  
- 2. 영어 알파벳 립싱크 : 6가지 입모양 (closed, slightly_open, open, wide_open, rounded, neutral)  
- 3. 립싱크 타이밍 수정 : 모음은 더 길게, 자음은 더 짧게 지속, TTS 재생 시간과 동기화, 50ms 간격으로 업데이트  
- 4. 이모티콘/특수문자 필터링 : TTS에서 이모티콘과 특수문자 제거, 한글, 영어, 숫자, 기본 문장부호만 리딩  
- 5. 페이지 언로드 시 TTS 중지 : 페이지 새로고침/이탈 시 TTS 자동 중지, 메모리 누수 방지  
- Hearth_Chat_v0.3 업로드  
- 채팅 로그에 날짜 시간 표시, 스크롤바 반투명화
- 이미지 첨부 버튼 추가, 이미지 첨부 후 전송 시 채팅로그에 출력, 이미지 파일은 django 서버 media 경로에 저장, sql 에는 파일 주소만 저장

## 250708
- 음성인식 -> 묵음 2초 뒤 자동전송 문제 해결 (onAutoSend로 finalText가 들어오면 무조건 handleVoiceResult를 호출)
- 사용자 아바타 페이스 트래킹 구현 -> 카메라에 비친 모습에 따라 립싱크, 사용자 움직임에 따라 아바타 움직임 (머리와 상체만 구현현), 눈 깜박임 트래킹
- Hearth Chat CSS 수정 작업, @@media 쿼리 CSS width 768px / 1000px / 1200 px 세부 수정

## 250707  
- vrm 모델 세팅 - vroid, vmagicmirror, warudo 작동법 숙지 -> hearth chat 에 모델 컨버팅  
- tts 글자 수 별 립싱크, 음성 선택 드롭다운 메뉴
- 음성인식 기능 추가, 여러 음절 인식 후 1초 이상 묵음 시에 채탱창에서 AI에게 자동전송  
- 음성인식 고급설정 : 신뢰도 임계값 조절(바 조절), 노이즈 감소, 적응형 인식,  자동 재시작 옵션 체크 추가  

## 250706 
- glb 모델 아바타 적용 -> 표정 인식 확인  
- 감정 포착 코드 삭제 -> LLM 에게 감정 피드백을 넘겨 반응을 이끌어내는건 정확도에서 무리가 있고, 의미가 크지 않을 것 같다 생각해서 해당 기능 삭제
- 단, 멀티모달 기능이 순조롭게 작동 된다면(음성, 이미지, 텍스트), 추가 이미지를 보내어 FACE API 로 추측해낸 감정을 새로운 변수로 만들어 볼 것  
- gemini 에 TTS 적용

## 250705  
- open ai api -> google gemini api 로 변경  
- gemini api 채팅 응답 확인  
- LLM AI 채팅 베이스 완성
- 실시간 대화 내역 DB에 저장 추가
- Ready Play Me API, 3D 아바타 생성, User 와 Ai 에 연동
- AI, Cam 화상채팅 연동, 유저의 표정 상태에 따른 감정 포착 -> 적절한 피드백
- 정확도가 너무 떨어지는 관계로 해당 기능은 이 정도로 마무리

## 250704  
- django 보일러 세팅  
- open ai api 사용  
"# Force redeploy" 
