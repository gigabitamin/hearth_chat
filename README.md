## Warm & Cozy Connection - Hearth Chat
- "I want to create a warm and cozy space around the fireplace, a place where people can gather and share stories in front of the warm flames."  
- 벽난로 주변의 따뜻하고 아늑한 공간. 우연히 모여든 사람들이 따뜻한 불꽃 앞에서 이야기 나누는 공간을 만들고 싶습니다  

==========================================

## 250709  
- Hearth Chat CSS 수정 작업, @@media 쿼리 CSS width 768px / 1000px / 1200 px 세부 수정
- 현 프로젝트 페이지에서는 굳이 미디어쿼리가 필요없다고 판단되서 모바일 환경을 고려하여 768px 스타일로 전부 통합 -> css 전체 리팩토링 
- css 리팩토링 완료, 전체 기능 점검 완료
- v0.3

## 250708
- 음성인식 -> 묵음 2초 뒤 자동전송 문제 해결 (onAutoSend로 finalText가 들어오면 무조건 handleVoiceResult를 호출)
- 사용자 아바타 페이스 트래킹 구현 -> 카메라에 비친 모습에 따라 립싱크, 사용자 움직임에 따라 아바타 움직임 (머리와 상체만 구현현), 눈 깜박임 트래킹

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
