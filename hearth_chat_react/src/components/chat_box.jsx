import React, { useState, useEffect, useRef } from 'react';
import RealisticAvatar3D from './RealisticAvatar3D';
import EmotionCamera from './EmotionCamera';
import ttsService from '../services/ttsService';
import readyPlayerMeService from '../services/readyPlayerMe';
import './chat_box.css';

const ChatBox = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [userAvatar, setUserAvatar] = useState(null);
  const [aiAvatar, setAiAvatar] = useState(null);
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isAiTalking, setIsAiTalking] = useState(false);
  const [userEmotion, setUserEmotion] = useState('neutral');
  const [aiEmotion, setAiEmotion] = useState('neutral');
  const [cameraEmotion, setCameraEmotion] = useState('neutral');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRealTimeMode, setIsRealTimeMode] = useState(false);

  // TTS 관련 상태
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [ttsVoice, setTtsVoice] = useState(null);
  const [ttsRate, setTtsRate] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(1.0);

  const ws = useRef(null);
  const chatLogRef = useRef(null);
  const mobileChatLogRef = useRef(null);
  const [displayedAiText, setDisplayedAiText] = useState('');
  const [mouthTrigger, setMouthTrigger] = useState(0);
  const [currentAiMessage, setCurrentAiMessage] = useState('');
  const [emotionDisplay, setEmotionDisplay] = useState({ user: 'neutral', ai: 'neutral' });
  const [emotionCaptureStatus, setEmotionCaptureStatus] = useState({ user: false, ai: false });

  useEffect(() => {
    console.log('ChatBox 컴포넌트 마운트됨');

    // 아바타 초기화
    initializeAvatars();

    // TTS 서비스 초기화
    initializeTTSService();

    // 웹소켓 연결
    ws.current = new WebSocket('ws://localhost:8000/ws/chat/');

    ws.current.onopen = () => {
      console.log('WebSocket 연결 성공');
    };

    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setMessages((prev) => [...prev, { type: 'recv', text: data.message }]);
      setCurrentAiMessage(data.message);

      // AI가 응답할 때 애니메이션
      setIsAiTalking(true);

      // TTS로 AI 메시지 재생
      if (isTTSEnabled) {
        speakAIMessage(data.message);
      }

      // AI 감정 반응 시스템 적용
      const aiEmotionResponse = getAIEmotionResponse(userEmotion, data.message);
      console.log('AI 감정 반응:', aiEmotionResponse.description);

      // AI 아바타 감정 설정
      setAiEmotion(aiEmotionResponse.primary);
      setEmotionDisplay(prev => ({ ...prev, ai: aiEmotionResponse.primary }));
      setEmotionCaptureStatus(prev => ({ ...prev, ai: true }));

      // 감정 지속 시간 후 neutral로 복귀
      setTimeout(() => {
        setAiEmotion('neutral');
        setEmotionDisplay(prev => ({ ...prev, ai: 'neutral' }));
        setEmotionCaptureStatus(prev => ({ ...prev, ai: false }));
      }, aiEmotionResponse.duration);
    };

    ws.current.onclose = () => {
      console.log('WebSocket 연결 종료');
    };

    return () => {
      ws.current.close();
      // TTS 중지
      ttsService.stop();
    };
  }, [isTTSEnabled]);

  // 감정 포착 상태 자동 리셋 (3초 후)
  useEffect(() => {
    const resetUserEmotionCapture = setTimeout(() => {
      setEmotionCaptureStatus(prev => ({ ...prev, user: false }));
    }, 3000);

    return () => clearTimeout(resetUserEmotionCapture);
  }, [emotionCaptureStatus.user]);

  useEffect(() => {
    const resetAiEmotionCapture = setTimeout(() => {
      setEmotionCaptureStatus(prev => ({ ...prev, ai: false }));
    }, 3000);

    return () => clearTimeout(resetAiEmotionCapture);
  }, [emotionCaptureStatus.ai]);

  // 새로운 메시지가 추가될 때마다 자동으로 스크롤을 맨 아래로 이동
  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
    if (mobileChatLogRef.current) {
      mobileChatLogRef.current.scrollTop = mobileChatLogRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!isAiTalking || !currentAiMessage) {
      // 타이핑이 끝나면 mouthTrigger를 0으로 리셋
      setMouthTrigger(0);
      return;
    }

    let i = 0;
    setDisplayedAiText('');
    const interval = setInterval(() => {
      setDisplayedAiText(currentAiMessage.slice(0, i + 1));
      setMouthTrigger(prev => {
        const newValue = prev + 1;
        console.log('mouthTrigger 증가:', newValue);
        return newValue;
      }); // 트리거 값 증가
      i++;
      if (i >= currentAiMessage.length) {
        clearInterval(interval);
        // 타이핑이 완전히 끝나면 mouthTrigger를 0으로 리셋하고 isAiTalking을 false로 설정
        setTimeout(() => {
          setMouthTrigger(0);
          setIsAiTalking(false); // 타이핑이 끝나면 말하는 상태를 false로
        }, 200);
      }
    }, 30); // 30ms마다 한 글자씩 (빠른 타이핑)
    return () => clearInterval(interval);
  }, [isAiTalking, currentAiMessage]);

  // TTS 서비스 초기화
  const initializeTTSService = () => {
    try {
      console.log('TTS 서비스 초기화 시작...');

      // TTS 이벤트 리스너 설정
      ttsService.on('start', (text) => {
        console.log('TTS 시작:', text.substring(0, 50) + '...');
        setIsAiTalking(true);
      });

      ttsService.on('end', () => {
        console.log('TTS 종료');
        setIsAiTalking(false);
        setMouthTrigger(0);
      });

      ttsService.on('error', (error) => {
        console.error('TTS 오류:', error);
        setIsAiTalking(false);
      });

      // 기본 음성 설정
      const voices = ttsService.getVoices();
      if (voices.length > 0) {
        setTtsVoice(voices[0]);
      }

      console.log('TTS 서비스 초기화 완료');
    } catch (error) {
      console.error('TTS 서비스 초기화 실패:', error);
    }
  };

  // AI 메시지 TTS 재생
  const speakAIMessage = async (message) => {
    try {
      if (!isTTSEnabled || !message) return;

      await ttsService.speak(message, {
        voice: ttsVoice,
        rate: ttsRate,
        pitch: ttsPitch
      });
    } catch (error) {
      console.error('TTS 재생 실패:', error);
    }
  };

  // 아바타 초기화
  const initializeAvatars = async () => {
    try {
      console.log('아바타 초기화 시작');

      // Ready Player Me 아바타 파일 경로 설정
      // RealisticAvatar3D -> 162, 아바타 모델 크기 조절 라인인
      // const userAvatarUrl = '/avatar_glb/rpm_m_half_6868236a3a108058018aa554.glb'; // 여성 아바타 half
      // const aiAvatarUrl = '/avatar_glb/rpm_f_half_6868261ba6e60aed0c1d79ad.glb';   // 남성 아바타 half
      const userAvatarUrl = '/avatar_glb/rpm_m_full_6868236a3a108058018aa554.glb'; // 여성 아바타 full
      const aiAvatarUrl = '/avatar_glb/rpm_f_full_6868261ba6e60aed0c1d79ad.glb';   // 남성 아바타 full
      
      console.log('사용자 아바타 URL:', userAvatarUrl);
      console.log('AI 아바타 URL:', aiAvatarUrl);

      setUserAvatar(userAvatarUrl);
      setAiAvatar(aiAvatarUrl);
    } catch (error) {
      console.error('아바타 초기화 실패:', error);
    }
  };

  // 감정 분석 (더 정교한 키워드 기반)
  const analyzeEmotion = (text) => {
    const lowerText = text.toLowerCase();

    // 기쁨 관련 키워드
    const happyKeywords = [
      '😊', '😄', '😃', '😁', '😆', '😅', '😂', '🤣', '😉', '😋', '😎', '🤩', '🥳',
      '좋아', '행복', '기쁘', '즐거', '신나', '재미있', '완벽', '최고', '대박', '멋있',
      '사랑', '감사', '고마워', '축하', '성공', '승리', '만족', '기대', '희망'
    ];

    // 슬픔 관련 키워드
    const sadKeywords = [
      '😢', '😭', '😔', '😞', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺',
      '슬퍼', '안타까워', '우울', '힘들', '지치', '실망', '아쉽', '미안', '죄송', '후회',
      '그리워', '외로워', '불안', '걱정', '두려워', '상처', '아파', '힘들어'
    ];

    // 화남 관련 키워드
    const angryKeywords = [
      '😠', '😡', '🤬', '😤', '😾', '💢', '👿', '😈', '🤯', '😵', '🤬',
      '화나', '짜증', '열받', '분노', '화가', '빡쳐', '열받', '짜증나', '화나',
      '싫어', '미워', '혐오', '지겨워', '답답', '스트레스', '짜증나', '열받아'
    ];

    // 놀람 관련 키워드
    const surpriseKeywords = [
      '😲', '😯', '😳', '😱', '🤯', '😨', '😰', '😥', '😓', '😶', '😐', '😑',
      '놀라', '깜짝', '어?', '뭐?', '진짜?', '정말?', '대박', '와우', '오마이갓',
      '믿을 수 없', '상상도 못', '예상 밖', '갑자기', '갑작스럽', '충격'
    ];

    // 각 감정별 점수 계산
    let scores = {
      happy: 0,
      sad: 0,
      angry: 0,
      surprise: 0
    };

    // 키워드 매칭으로 점수 계산
    happyKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) scores.happy += 1;
    });

    sadKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) scores.sad += 1;
    });

    angryKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) scores.angry += 1;
    });

    surpriseKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) scores.surprise += 1;
    });

    // 가장 높은 점수의 감정 반환
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) return 'neutral';

    if (scores.happy === maxScore) return 'happy';
    if (scores.sad === maxScore) return 'sad';
    if (scores.angry === maxScore) return 'angry';
    if (scores.surprise === maxScore) return 'surprise';

    return 'neutral';
  };

  // AI 아바타 감정 반응 시스템
  const getAIEmotionResponse = (userEmotion, aiMessage) => {
    // 사용자 감정에 따른 AI 아바타 반응
    const emotionResponses = {
      "happy": {
        "primary": "happy",
        "intensity": 0.8,
        "duration": 3000,
        "description": "사용자가 기뻐하니 AI도 함께 기뻐합니다"
      },
      "sad": {
        "primary": "sad",
        "intensity": 0.6,
        "secondary": "caring",
        "duration": 4000,
        "description": "사용자가 슬퍼하니 AI도 공감하며 위로합니다"
      },
      "angry": {
        "primary": "calm",
        "intensity": 0.7,
        "secondary": "understanding",
        "duration": 3000,
        "description": "사용자가 화가 나니 AI는 차분하게 이해합니다"
      },
      "fearful": {
        "primary": "caring",
        "intensity": 0.8,
        "secondary": "reassuring",
        "duration": 4000,
        "description": "사용자가 두려워하니 AI는 안심시킵니다"
      },
      "surprised": {
        "primary": "surprised",
        "intensity": 0.6,
        "secondary": "curious",
        "duration": 2500,
        "description": "사용자가 놀라니 AI도 함께 놀라며 호기심을 보입니다"
      },
      "disgusted": {
        "primary": "neutral",
        "intensity": 0.5,
        "secondary": "understanding",
        "duration": 2000,
        "description": "사용자가 불쾌해하니 AI는 이해하며 다른 주제로 전환합니다"
      },
      "neutral": {
        "primary": "neutral",
        "intensity": 0.3,
        "duration": 2000,
        "description": "사용자가 평온하니 AI도 편안한 상태를 유지합니다"
      }
    };

    const response = emotionResponses[userEmotion] || emotionResponses["neutral"];

    // AI 메시지 내용도 고려하여 감정 조정
    const messageEmotion = analyzeEmotion(aiMessage);
    if (messageEmotion !== 'neutral') {
      // 메시지 감정과 사용자 감정을 조합
      if (userEmotion === 'sad' && messageEmotion === 'happy') {
        response.primary = 'caring'; // 위로하는 기쁨
        response.intensity = 0.7;
      } else if (userEmotion === 'angry' && messageEmotion === 'happy') {
        response.primary = 'calm'; // 차분한 이해
        response.intensity = 0.6;
      }
    }

    return response;
  };

  // 얼굴 추적 콜백 함수들
  // 감정 기반 대화 시작 함수
  const startEmotionBasedConversation = (emotion) => {
    const emotionStarters = {
      "happy": "기뻐 보이시네요! 😊 어떤 일이 그렇게 기쁘게 만든 거예요?",
      "sad": "지금 많이 힘드시겠어요. 😔 무슨 일이 있으셨나요?",
      "angry": "화가 나신 것 같아 보여요. 😤 어떤 일이 그렇게 화나게 만든 거예요?",
      "fearful": "무서우신가요? 😰 걱정되는 일이 있으시면 말씀해주세요.",
      "surprised": "놀라신 것 같아요! 😲 어떤 일이 그렇게 놀라게 만든 거예요?",
      "disgusted": "불쾌하신 일이 있으셨나요? 😕 다른 이야기로 기분 전환해볼까요?"
    };

    const starter = emotionStarters[emotion];
    if (starter && messages.length === 0) { // 첫 대화일 때만
      // AI가 먼저 말하기 시작
      ws.current.send(JSON.stringify({
        message: starter,
        emotion: emotion
      }));
      setMessages((prev) => [...prev, { type: 'recv', text: starter }]);
      setCurrentAiMessage(starter);
      setIsAiTalking(true);
    }
  };

  // 카메라 토글 핸들러
  const toggleCamera = () => {
    const newCameraState = !isCameraActive;
    setIsCameraActive(newCameraState);

    // 카메라가 켜질 때 자동으로 카메라 시작
    if (newCameraState) {
      console.log('카메라 활성화됨');
    } else {
      console.log('카메라 비활성화됨');
    }
  };

  // 실시간 모드 토글 핸들러
  const toggleRealTimeMode = () => {
    setIsRealTimeMode(!isRealTimeMode);
    console.log(`모드 변경: ${!isRealTimeMode ? '실시간' : '안정화'} 모드`);
  };

  const sendMessage = () => {
    if (input.trim() === '') return;

    // 사용자가 말할 때 애니메이션
    setIsUserTalking(true);
    setTimeout(() => setIsUserTalking(false), 2000);

    // 카메라가 활성화되어 있으면 카메라 감정을 우선 사용, 아니면 텍스트 분석 감정 사용
    const emotion = isCameraActive ? cameraEmotion : analyzeEmotion(input);
    setUserEmotion(emotion);
    setEmotionDisplay(prev => ({ ...prev, user: emotion })); // 감정 표시 업데이트

    // 감정 정보와 함께 메시지 전송
    ws.current.send(JSON.stringify({
      message: input,
      emotion: emotion
    }));
    setMessages((prev) => [...prev, { type: 'send', text: input }]);
    setInput('');
  };



  return (
    <>
      <div className="chat-container-with-avatars">
        {/* 데스크톱 레이아웃 */}
        <div className="desktop-layout">
          {/* 아바타들을 위쪽에 배치 */}
          <div className="avatar-container-desktop">
            {/* 사용자 아바타/카메라 (왼쪽) */}
            <div className="avatar-section left">
              {/* 카메라 토글 버튼 - 사용자 아바타창 안쪽 오른쪽 위 */}
              <div className="avatar-controls">
                <button
                  onClick={toggleCamera}
                  className={`camera-toggle-btn ${isCameraActive ? 'active' : ''}`}
                >
                  {isCameraActive ? '👤 아바타' : '📷 카메라'}
                </button>

                {/* 실시간 모드 토글 버튼 (카메라가 활성화되어 있을 때만 표시) */}
                {isCameraActive && (
                  <button
                    onClick={toggleRealTimeMode}
                    className={`mode-toggle-btn ${isRealTimeMode ? 'realtime' : 'stable'}`}
                  >
                    {isRealTimeMode ? '⚡ 실시간' : '🛡️ 안정'}
                  </button>
                )}
              </div>
              {/* 카메라가 켜져있을 때 카메라 표시 */}
              {isCameraActive && (
                <div className="camera-replacement" style={{ position: 'relative' }}>
                  <EmotionCamera
                    isActive={isCameraActive}
                    hideControls={true}
                  />

                  {/* 카메라 내부에 아바타 오버레이 배치 - PC */}
                  <div className="avatar-overlay" style={{
                    position: 'absolute',
                    top: '5px',
                    left: '5px',
                    width: '100px',
                    height: '100px',
                    zIndex: 1,
                    pointerEvents: 'none',
                    opacity: 0.3
                  }}>
                    <RealisticAvatar3D
                      avatarUrl={userAvatar}
                      isTalking={isUserTalking}
                      emotion={userEmotion}
                      position="left"
                      size={100}
                      showEmotionIndicator={true}
                      emotionCaptureStatus={emotionCaptureStatus.user}
                    />
                  </div>
                </div>
              )}

              {/* 카메라가 꺼져있을 때 아바타 표시 */}
              {!isCameraActive && (
                <div className="avatar-overlay" style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 0,
                  pointerEvents: 'auto',
                  opacity: 1
                }}>
                  <RealisticAvatar3D
                    avatarUrl={userAvatar}
                    isTalking={isUserTalking}
                    emotion={userEmotion}
                    position="left"
                    size={235}
                    showEmotionIndicator={true}
                    emotionCaptureStatus={emotionCaptureStatus.user}
                  />
                </div>
              )}
            </div>

            {/* AI 아바타 (오른쪽) */}
            <div className="avatar-section right">
              <RealisticAvatar3D
                avatarUrl={aiAvatar}
                isTalking={isAiTalking}
                emotion={aiEmotion}
                mouthTrigger={mouthTrigger}
                position="right"
                size={235}
                showEmotionIndicator={true}
                emotionCaptureStatus={emotionCaptureStatus.ai}
              />
            </div>
          </div>

          {/* 채팅창 (아래쪽) */}
          <div className="chat-section">
            <div className="chat-container">
              <div className="chat-log" ref={chatLogRef}>
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`chat-bubble ${msg.type === 'send' ? 'sent' : 'received'}`}
                  >
                    {msg.type === 'recv' && idx === messages.length - 1 && isAiTalking
                      ? displayedAiText
                      : msg.text}
                  </div>
                ))}
              </div>
              <div className="chat-input-area">
                <div className="input-controls">
                  <input
                    type="text"
                    placeholder="메시지를 입력하세요"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <div className="control-buttons">
                    <button
                      onClick={() => setIsTTSEnabled(!isTTSEnabled)}
                      className={`tts-toggle ${isTTSEnabled ? 'active' : ''}`}
                      title={isTTSEnabled ? 'TTS 끄기' : 'TTS 켜기'}
                    >
                      {isTTSEnabled ? '🔊' : '🔇'}
                    </button>
                    <button onClick={sendMessage}>전송</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 모바일 레이아웃 */}
        <div className="mobile-layout">
          {/* 아바타들을 위쪽에 좌우로 배치 */}
          <div className="avatar-container">
            <div className="avatar-section left">
              {/* 카메라 토글 버튼 - 사용자 아바타창 안쪽 오른쪽 위 */}
              <div className="avatar-controls">
                <button
                  onClick={toggleCamera}
                  className={`camera-toggle-btn ${isCameraActive ? 'active' : ''}`}
                >
                  {isCameraActive ? '👤 아바타' : '📷 카메라'}
                </button>

                {/* 실시간 모드 토글 버튼 (카메라가 활성화되어 있을 때만 표시) */}
                {isCameraActive && (
                  <button
                    onClick={toggleRealTimeMode}
                    className={`mode-toggle-btn ${isRealTimeMode ? 'realtime' : 'stable'}`}
                  >
                    {isRealTimeMode ? '⚡ 실시간' : '🛡️ 안정'}
                  </button>
                )}
              </div>
              {/* 카메라가 켜져있을 때 카메라 표시 */}
              {isCameraActive && (
                <div className="camera-replacement mobile" style={{ position: 'relative' }}>
                  <EmotionCamera
                    isActive={isCameraActive}
                    hideControls={true}
                  />

                  {/* 카메라 내부에 아바타 오버레이 배치 - PC */}
                  <div className="avatar-overlay" style={{
                    position: 'absolute',
                    top: '5px',
                    left: '5px',
                    width: '100px',
                    height: '100px',
                    zIndex: 1,
                    pointerEvents: 'none',
                    opacity: 0.3
                  }}>
                    <RealisticAvatar3D
                      avatarUrl={userAvatar}
                      isTalking={isUserTalking}
                      emotion={userEmotion}
                      position="left"
                      size={100}
                      showEmotionIndicator={true}
                      emotionCaptureStatus={emotionCaptureStatus.user}
                    />
                  </div>
                </div>
              )}

              {/* 카메라가 꺼져있을 때 아바타 표시 */}
              {!isCameraActive && (
                <div className="avatar-overlay" style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 0,
                  pointerEvents: 'auto',
                  opacity: 1
                }}>
                  <RealisticAvatar3D
                    avatarUrl={userAvatar}
                    isTalking={isUserTalking}
                    emotion={userEmotion}
                    position="left"
                    size={235}
                    showEmotionIndicator={true}
                    emotionCaptureStatus={emotionCaptureStatus.user}
                  />
                </div>
              )}
            </div>
            <div className="avatar-section right">
              <RealisticAvatar3D
                avatarUrl={aiAvatar}
                isTalking={isAiTalking}
                emotion={aiEmotion}
                mouthTrigger={mouthTrigger}
                position="right"
                size={235}
                showEmotionIndicator={true}
                emotionCaptureStatus={emotionCaptureStatus.ai}
              />
            </div>
          </div>

          {/* 채팅창 (아래쪽) */}
          <div className="chat-section">
            <div className="chat-container">
              <div className="chat-log" ref={mobileChatLogRef}>
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`chat-bubble ${msg.type === 'send' ? 'sent' : 'received'}`}
                  >
                    {msg.type === 'recv' && idx === messages.length - 1 && isAiTalking
                      ? displayedAiText
                      : msg.text}
                  </div>
                ))}
              </div>
              <div className="chat-input-area">
                <div className="input-controls">
                  <input
                    type="text"
                    placeholder="메시지를 입력하세요"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <div className="control-buttons">
                    <button
                      onClick={() => setIsTTSEnabled(!isTTSEnabled)}
                      className={`tts-toggle ${isTTSEnabled ? 'active' : ''}`}
                      title={isTTSEnabled ? 'TTS 끄기' : 'TTS 켜기'}
                    >
                      {isTTSEnabled ? '🔊' : '🔇'}
                    </button>
                    <button onClick={sendMessage}>전송</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatBox;
