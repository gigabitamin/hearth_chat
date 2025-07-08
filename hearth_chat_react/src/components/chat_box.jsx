import React, { useState, useEffect, useRef, useMemo } from 'react';
import RealisticAvatar3D from './RealisticAvatar3D';
import EmotionCamera from './EmotionCamera';
import VoiceRecognition from './VoiceRecognition';
import ttsService from '../services/ttsService';
import readyPlayerMeService from '../services/readyPlayerMe';
import faceTrackingService from '../services/faceTrackingService';
import './chat_box.css';

// 모달 컴포넌트 추가
const Modal = ({ open, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="voice-modal-overlay" onClick={onClose}>
      <div className="voice-modal-content" onClick={e => e.stopPropagation()}>
        <button className="voice-modal-close" onClick={onClose}>닫기</button>
        {children}
      </div>
    </div>
  );
};

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
  const [ttsRate, setTtsRate] = useState(1.5);
  const [ttsPitch, setTtsPitch] = useState(1.5);
  const [voiceList, setVoiceList] = useState([]);

  const ws = useRef(null);
  const chatLogRef = useRef(null);
  const mobileChatLogRef = useRef(null);
  const [displayedAiText, setDisplayedAiText] = useState('');
  const [mouthTrigger, setMouthTrigger] = useState(0);
  const [currentAiMessage, setCurrentAiMessage] = useState('');
  const [emotionDisplay, setEmotionDisplay] = useState({ user: 'neutral', ai: 'neutral' });
  const [emotionCaptureStatus, setEmotionCaptureStatus] = useState({ user: false, ai: false });
  const [isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled] = useState(false);
  const [voiceInterimText, setVoiceInterimText] = useState('');
  const [autoSend, setAutoSend] = useState(true); // 자동전송 모드 (기본값: true)
  const [isContinuousRecognition, setIsContinuousRecognition] = useState(false); // 연속 음성인식 모드
  const [accumulatedVoiceText, setAccumulatedVoiceText] = useState(''); // 누적된 음성인식 텍스트
  const [silenceTimer, setSilenceTimer] = useState(null); // 묵음 타이머
  const [blockInterim, setBlockInterim] = useState(false); // 자동전송 직후 interim 반영 방지

  const voiceRecognitionRef = useRef(null);
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('unknown'); // 'unknown', 'granted', 'denied'

  // 트래킹 관련 상태
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState('stopped'); // 'stopped', 'starting', 'running', 'error'
  const [faceDetected, setFaceDetected] = useState(false);

  // MediaPipe 준비 상태
  const [isTrackingReady, setIsTrackingReady] = useState(false);
  const [isTrackingLoading, setIsTrackingLoading] = useState(true);

  // MediaPipe 준비 상태 감시
  useEffect(() => {
    // MediaPipe 초기화 강제 시작
    if (!faceTrackingService.isReady && !faceTrackingService.isInitializing) {
      console.log('MediaPipe 초기화 강제 시작...');
      faceTrackingService.initializeMediaPipe();
    }

    // 주기적 체크 (상태 표시용)
    const interval = setInterval(() => {
      setIsTrackingReady(faceTrackingService.isReady);
      setIsTrackingLoading(faceTrackingService.isInitializing);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // 모바일 브라우저에서 실제 보이는 영역의 높이로 --real-vh CSS 변수 설정
  useEffect(() => {
    function setRealVh() {
      const vh = window.visualViewport
        ? window.visualViewport.height * 0.01
        : window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--real-vh', `${vh}px`);
    }
    window.addEventListener('resize', setRealVh);
    window.addEventListener('orientationchange', setRealVh);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setRealVh);
      window.visualViewport.addEventListener('scroll', setRealVh);
    }
    setRealVh();
    return () => {
      window.removeEventListener('resize', setRealVh);
      window.removeEventListener('orientationchange', setRealVh);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', setRealVh);
        window.visualViewport.removeEventListener('scroll', setRealVh);
      }
    };
  }, []);

  // 컴포넌트 마운트 시 실행
  useEffect(() => {
    console.log('ChatBox 컴포넌트 마운트됨');

    // WebSocket 연결
    connectWebSocket();

    // TTS 서비스 초기화
    initializeTTSService();

    // 아바타 초기화
    initializeAvatars();

    // 마이크 권한 상태 확인
    const checkPermissionStatus = async () => {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permission = await navigator.permissions.query({ name: 'microphone' });
          setPermissionStatus(permission.state);
        } catch (error) {
          console.log('권한 상태 확인 실패:', error);
        }
      }
    };

    checkPermissionStatus();

    // 컴포넌트 언마운트 시 정리
    return () => {
      if (ws.current) {
        ws.current.close();
      }
      ttsService.stop();

      // 트래킹 정리
      if (isTrackingEnabled) {
        faceTrackingService.stopCamera();
      }
    };
  }, []);

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

  // TTS 기반 립싱크를 위한 상태
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const [lipSyncInterval, setLipSyncInterval] = useState(null);

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
      i++;
      if (i >= currentAiMessage.length) {
        clearInterval(interval);
        // 타이핑이 완전히 끝나면 isAiTalking을 false로 설정
        setTimeout(() => {
          setIsAiTalking(false); // 타이핑이 끝나면 말하는 상태를 false로
        }, 200);
      }
    }, 30); // 30ms마다 한 글자씩 (빠른 타이핑)
    return () => clearInterval(interval);
  }, [isAiTalking, currentAiMessage]);

  // TTS 기반 립싱크 제어
  useEffect(() => {
    if (ttsSpeaking) {
      // TTS 속도에 따라 립싱크 속도 조정
      const baseInterval = 200; // 기본 200ms
      const rateMultiplier = ttsRate || 1.0; // TTS 속도 (기본값 1.0)
      const lipSyncInterval = Math.max(100, Math.min(400, baseInterval / rateMultiplier)); // 100ms~400ms 범위로 제한

      console.log('립싱크 간격 설정:', lipSyncInterval, 'ms (TTS 속도:', rateMultiplier, ')');

      const interval = setInterval(() => {
        setMouthTrigger(prev => {
          const newValue = prev + 1;
          return newValue;
        });
      }, lipSyncInterval);

      setLipSyncInterval(interval);

      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    } else {
      // TTS가 끝나면 립싱크 중지
      setMouthTrigger(0);
      if (lipSyncInterval) {
        clearInterval(lipSyncInterval);
        setLipSyncInterval(null);
      }
    }
  }, [ttsSpeaking, ttsRate]);

  // TTS 서비스 초기화
  const initializeTTSService = () => {
    try {
      console.log('TTS 서비스 초기화 시작...');

      // TTS 지원 여부 확인
      if (!ttsService.isSupported()) {
        console.warn('TTS가 지원되지 않는 브라우저입니다.');
        setIsTTSEnabled(false);
        return;
      }

      // TTS 이벤트 리스너 설정
      ttsService.on('start', (text) => {
        console.log('TTS 시작:', text.substring(0, 50) + '...');
        setIsAiTalking(true);
        setTtsSpeaking(true); // TTS 재생 시작 시 립싱크 시작
      });

      ttsService.on('end', () => {
        console.log('TTS 종료');
        setIsAiTalking(false);
        setTtsSpeaking(false); // TTS 재생 종료 시 립싱크 중지
        setMouthTrigger(0);
      });

      ttsService.on('error', (error) => {
        console.error('TTS 오류:', error);
        setIsAiTalking(false);
        setTtsSpeaking(false); // TTS 오류 시 립싱크 중지
        setMouthTrigger(0);
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

  // 음성 설정 상태 확인을 위한 useEffect
  useEffect(() => {
    if (ttsVoice) {
      console.log('TTS 음성 상태 업데이트됨:', ttsVoice.name, '(', ttsVoice.lang, ')');
    }
  }, [ttsVoice]);

  // 음성 목록 불러오기
  useEffect(() => {
    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setVoiceList(voices);
      // 기본값: 첫 번째 한국어 음성, 없으면 첫 번째 음성
      if (!ttsVoice) {
        const koVoice = voices.find(v => v.lang.includes('ko'));
        setTtsVoice(koVoice || voices[0] || null);
      }
    };
    window.speechSynthesis.onvoiceschanged = updateVoices;
    updateVoices();
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);



  // AI 메시지 TTS 재생
  const speakAIMessage = async (message) => {
    try {
      if (!isTTSEnabled || !message) return;

      await ttsService.speak(message, {
        voice: ttsVoice
      });
    } catch (error) {
      console.error('TTS 재생 실패:', error);
    }
  };

  // 아바타 초기화
  const initializeAvatars = async () => {
    try {
      console.log('아바타 초기화 시작');

      // VRM 아바타 파일 경로 설정
      // VRM 파일은 avatar_vrm 폴더에 저장
      const userAvatarUrl = '/avatar_vrm/gb_m_v1.vrm'; // 사용자 VRM 아바타 (남성)
      const aiAvatarUrl = '/avatar_vrm/gb_f_v1.vrm';   // AI VRM 아바타 (여성)

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

  // 음성인식 결과 처리
  const handleVoiceResult = (finalText) => {
    console.log('음성인식 최종 결과:', finalText);

    // 자동전송 직후에는 interim/final 반영을 막음
    if (blockInterim) return;

    // 최종 결과를 누적 텍스트에 추가
    const newAccumulatedText = accumulatedVoiceText + finalText;
    setAccumulatedVoiceText(newAccumulatedText);
    setInput(newAccumulatedText);

    // 묵음 타이머 리셋
    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }

    // 자동 전송이 활성화된 경우에만 자동 전송 타이머 설정
    if (autoSend) {
      // 2초 후 자동 전송 타이머 설정
      const timer = setTimeout(() => {
        if (newAccumulatedText.trim()) {
          console.log('묵음 2초 경과, 자동 전송:', newAccumulatedText);
          setBlockInterim(true); // interim 반영 막기
          setInput(newAccumulatedText);
          sendMessage(newAccumulatedText);
          setAccumulatedVoiceText('');
          // 0.5초 후 interim 반영 재개
          setTimeout(() => setBlockInterim(false), 500);
        }
      }, 2000); // 2초로 변경

      setSilenceTimer(timer);
    }
  };

  // 음성인식 중간 결과 처리
  const handleVoiceInterimResult = (interimText) => {
    // 사용자가 말하기 시작하면 TTS 중단
    ttsService.stop();
    console.log('음성인식 중간 결과:', interimText);

    // 자동전송 직후에는 interim 반영을 막음
    if (blockInterim) return;

    // 중간 결과는 실시간으로만 표시 (누적하지 않음)
    const displayText = accumulatedVoiceText + interimText;
    setInput(displayText);

    // 묵음 타이머 리셋
    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }
  };

  // 음성인식 on/off 토글 및 즉시 start/stop
  const handleVoiceRecognitionToggle = async () => {
    if (isVoiceRecognitionEnabled) {
      setIsVoiceRecognitionEnabled(false);
      setIsContinuousRecognition(false);
      if (voiceRecognitionRef.current) {
        voiceRecognitionRef.current.stop();
      }
      // 음성인식이 꺼질 때 마이크도 OFF로 표시
      setPermissionStatus('off');
    } else {
      try {
        // 모바일 브라우저에서 권한 요청을 위한 사용자 상호작용 확인
        if (navigator.userAgent.match(/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i)) {
          console.log('모바일 브라우저 감지됨 - 권한 요청 준비');

          // 권한이 거부된 상태라면 먼저 권한 요청
          if (permissionStatus === 'denied') {
            const granted = await requestMicrophonePermission();
            if (!granted) {
              alert('음성인식을 사용하려면 마이크 권한이 필요합니다.');
              return;
            }
          }
        }

        setIsVoiceRecognitionEnabled(true);
        setIsContinuousRecognition(true);

        if (voiceRecognitionRef.current) {
          await voiceRecognitionRef.current.start();
        }
      } catch (error) {
        console.error('음성인식 시작 실패:', error);
        // 권한 거부 시 상태 되돌리기
        setIsVoiceRecognitionEnabled(false);
        setIsContinuousRecognition(false);
      }
    }
  };

  // 스페이스바 이벤트 리스너 추가
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && isContinuousRecognition) {
        e.preventDefault(); // 스페이스바 기본 동작 방지
        stopContinuousRecognition();
      }
    };

    if (isContinuousRecognition) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isContinuousRecognition]);

  // 연속 음성인식 시작
  const startContinuousRecognition = async () => {
    if (!isVoiceRecognitionEnabled) return;

    setIsContinuousRecognition(true);
    if (voiceRecognitionRef.current) {
      await voiceRecognitionRef.current.start();
    }
  };

  // 연속 음성인식 중지
  const stopContinuousRecognition = () => {
    setIsContinuousRecognition(false);
    if (voiceRecognitionRef.current) {
      voiceRecognitionRef.current.stop();
    }
  };

  // 트래킹 기능 제어
  const toggleTracking = async () => {
    try {
      if (isTrackingEnabled) {
        // 트래킹 중지
        faceTrackingService.stopCamera();
        setIsTrackingEnabled(false);
        setTrackingStatus('stopped');
        setFaceDetected(false);
        console.log('트래킹 중지됨');
      } else {
        // MediaPipe 준비 상태 확인
        if (!faceTrackingService.isReady) {
          console.log('MediaPipe가 준비되지 않음, 초기화 시도...');
          await faceTrackingService.initializeMediaPipe();

          // 초기화 후 다시 확인
          if (!faceTrackingService.isReady) {
            alert('MediaPipe 초기화 중입니다. 잠시 후 다시 시도해주세요.');
            return;
          }
        }

        // 트래킹 시작
        setTrackingStatus('starting');
        const success = await faceTrackingService.startCamera();

        if (success) {
          setIsTrackingEnabled(true);
          setTrackingStatus('running');

          // 트래킹 이벤트 리스너 설정
          faceTrackingService.on('faceDetected', () => {
            setFaceDetected(true);
          });

          faceTrackingService.on('faceLost', () => {
            setFaceDetected(false);
          });

          console.log('트래킹 시작됨');
        } else {
          setTrackingStatus('error');
          alert('트래킹을 시작할 수 없습니다. 웹캠 권한을 확인해주세요.');
        }
      }
    } catch (error) {
      console.error('트래킹 토글 실패:', error);
      setTrackingStatus('error');
      alert('트래킹 기능을 사용할 수 없습니다: ' + error.message);
    }
  };

  // 마이크 권한 요청 함수
  const requestMicrophonePermission = async () => {
    try {
      console.log('마이크 권한 요청 시작...');

      // 모바일 브라우저 감지
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());
      console.log('모바일 브라우저 감지:', isMobile);

      // navigator.permissions API 지원 확인
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permission = await navigator.permissions.query({ name: 'microphone' });
          setPermissionStatus(permission.state);
          console.log('현재 권한 상태:', permission.state);

          if (permission.state === 'granted') {
            console.log('마이크 권한이 이미 허용되어 있습니다.');
            return true;
          }

          if (permission.state === 'denied') {
            console.log('마이크 권한이 거부되어 있습니다.');
            // 모바일에서는 권한 재설정을 위해 브라우저 설정 안내
            if (isMobile) {
              alert('마이크 권한이 거부되었습니다.\n\n브라우저 설정에서 마이크 권한을 허용해주세요:\n\nChrome: 설정 > 개인정보 보호 및 보안 > 사이트 설정 > 마이크\nSafari: 설정 > Safari > 마이크');
            }
            return false;
          }
        } catch (permError) {
          console.log('permissions API 오류:', permError);
        }
      }

      // getUserMedia를 사용하여 권한 요청 (더 구체적인 옵션)
      console.log('getUserMedia 권한 요청 시도...');
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('getUserMedia 성공, 스트림 획득:', stream);

      // 스트림 즉시 중지
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('오디오 트랙 중지:', track.label);
      });

      console.log('마이크 권한이 허용되었습니다.');
      setPermissionStatus('granted');
      return true;

    } catch (error) {
      console.error('마이크 권한 요청 실패:', error);
      console.error('오류 이름:', error.name);
      console.error('오류 메시지:', error.message);

      setPermissionStatus('denied');

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        console.log('사용자가 마이크 권한을 거부했습니다.');
        alert('마이크 권한이 거부되었습니다.\n\n브라우저 설정에서 마이크 권한을 허용해주세요.');
        return false;
      }

      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        console.log('마이크 장치를 찾을 수 없습니다.');
        alert('마이크 장치를 찾을 수 없습니다.\n\n마이크가 연결되어 있는지 확인해주세요.');
        return false;
      }

      if (error.name === 'NotSupportedError' || error.name === 'ConstraintNotSatisfiedError') {
        console.log('지원되지 않는 오디오 제약 조건입니다.');
        alert('지원되지 않는 오디오 설정입니다.\n\n다른 브라우저를 시도해보세요.');
        return false;
      }

      // 기타 오류
      alert(`마이크 권한 요청 중 오류가 발생했습니다:\n${error.message}\n\n브라우저 설정을 확인해주세요.`);
      return false;
    }
  };

  // 음성인식 버튼 클릭 핸들러
  const handleVoiceRecognitionClick = async () => {
    if (!isVoiceRecognitionEnabled) return;

    if (isContinuousRecognition) {
      stopContinuousRecognition();
    } else {
      await startContinuousRecognition();
    }
  };

  // sendMessage 함수 오버로드 허용 및 항상 인자 우선 전송
  const sendMessage = (text) => {
    const msg = typeof text === 'string' ? text : input;
    console.log('sendMessage 호출, text:', text, 'input:', input, 'msg:', msg);
    if (!msg.trim()) {
      console.log('sendMessage: msg가 비어있어서 전송하지 않음');
      return;
    }

    // 사용자가 말할 때 애니메이션
    setIsUserTalking(true);
    setTimeout(() => setIsUserTalking(false), 2000);

    // 카메라가 활성화되어 있으면 카메라 감정을 우선 사용, 아니면 텍스트 분석 감정 사용
    const emotion = isCameraActive ? cameraEmotion : analyzeEmotion(msg);
    setUserEmotion(emotion);
    setEmotionDisplay(prev => ({ ...prev, user: emotion })); // 감정 표시 업데이트

    // 감정 정보와 함께 메시지 전송
    ws.current.send(JSON.stringify({
      message: msg,
      emotion: emotion
    }));
    setMessages((prev) => [...prev, { type: 'send', text: msg }]);
    setInput('');
  };

  // WebSocket 연결
  const connectWebSocket = () => {
    // 현재 호스트의 IP 주소를 사용하여 WebSocket 연결
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = '8000'; // Django 백엔드 포트
    ws.current = new WebSocket(`${protocol}//${host}:${port}/ws/chat/`);

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
  };

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
    };
  }, [silenceTimer]);

  // 아바타 크기 동적 계산
  const avatarSize = useMemo(() => {
    // 상단 50% 영역의 높이, 가로는 1/2 (좌우 아바타)
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    // 패딩 등 여유분 32px 빼고, 최대 90vw/2 이하로 제한
    const maxAvatarWidth = Math.floor((vw - 32) / 2);
    const maxAvatarHeight = Math.floor((vh * 0.5) - 32);
    return Math.max(80, Math.min(maxAvatarWidth, maxAvatarHeight));
  }, [window.innerWidth, window.innerHeight]);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1200);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1200);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  return (
    <>
      <div className="chat-container-with-avatars">
        {isMobile ? (
          // 모바일 레이아웃
          <div className="mobile-layout">
            {/* 아바타들을 위쪽에 좌우로 배치 */}
            <div className="avatar-container">
              <div className="avatar-section">
                <RealisticAvatar3D
                  avatarUrl={userAvatar}
                  isTalking={isUserTalking}
                  emotion={userEmotion}
                  position="left"
                  size="100%"
                  showEmotionIndicator={true}
                  emotionCaptureStatus={emotionCaptureStatus.user}
                  enableTracking={isTrackingEnabled}
                />
              </div>
              <div className="avatar-section">
                <RealisticAvatar3D
                  avatarUrl={aiAvatar}
                  isTalking={isAiTalking}
                  emotion={aiEmotion}
                  mouthTrigger={mouthTrigger}
                  position="right"
                  size="100%"
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
                    {/* 상단 버튼들 */}
                    <div className="control-buttons" style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setIsVoiceMenuOpen(true)}
                        className="voice-menu-btn unified-btn"
                        title="음성 메뉴 열기"
                      >
                        🎤 음성 메뉴
                      </button>
                      <button
                        onClick={toggleCamera}
                        className={`camera-toggle-btn unified-btn ${isCameraActive ? 'active' : ''}`}
                      >
                        {isCameraActive ? '👤 아바타' : '📷 카메라'}
                      </button>
                      <button
                        onClick={toggleTracking}
                        className={`tracking-toggle-btn unified-btn ${isTrackingEnabled ? 'active' : ''}`}
                      >
                        {isTrackingLoading ? '로딩 중...' : (isTrackingEnabled ? '🎯 트래킹 중지' : '🎯 트래킹 시작')}
                      </button>
                      {isCameraActive && (
                        <button
                          onClick={toggleRealTimeMode}
                          className={`mode-toggle-btn unified-btn ${isRealTimeMode ? 'realtime' : 'stable'}`}
                        >
                          {isRealTimeMode ? '⚡ 실시간' : '🛡️ 안정'}
                        </button>
                      )}
                    </div>
                    {/* 입력창+전송버튼 한 줄 */}
                    <div className="input-row" style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        placeholder="메시지를 입력하세요"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        style={{ flex: 1 }}
                      />
                      <button onClick={sendMessage} className="unified-btn">전송</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // PC 레이아웃
          <div className="desktop-layout">
            {/* 아바타들을 위쪽에 배치 */}
            <div className="avatar-container">
              <div className="avatar-section">
                <RealisticAvatar3D
                  avatarUrl={userAvatar}
                  isTalking={isUserTalking}
                  emotion={userEmotion}
                  position="left"
                  size="100%"
                  showEmotionIndicator={true}
                  emotionCaptureStatus={emotionCaptureStatus.user}
                  enableTracking={isTrackingEnabled}
                />
              </div>
              <div className="avatar-section">
                <RealisticAvatar3D
                  avatarUrl={aiAvatar}
                  isTalking={isAiTalking}
                  emotion={aiEmotion}
                  mouthTrigger={mouthTrigger}
                  position="right"
                  size="100%"
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
                    {/* 상단 버튼들 */}
                    <div className="control-buttons" style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setIsVoiceMenuOpen(true)}
                        className="voice-menu-btn unified-btn"
                        title="음성 메뉴 열기"
                      >
                        🎤 음성 메뉴
                      </button>
                      <button
                        onClick={toggleCamera}
                        className={`camera-toggle-btn unified-btn ${isCameraActive ? 'active' : ''}`}
                      >
                        {isCameraActive ? '👤 아바타' : '📷 카메라'}
                      </button>
                      <button
                        onClick={toggleTracking}
                        className={`tracking-toggle-btn unified-btn ${isTrackingEnabled ? 'active' : ''}`}
                      >
                        {isTrackingLoading ? '로딩 중...' : (isTrackingEnabled ? '🎯 트래킹 중지' : '🎯 트래킹 시작')}
                      </button>
                      {isCameraActive && (
                        <button
                          onClick={toggleRealTimeMode}
                          className={`mode-toggle-btn unified-btn ${isRealTimeMode ? 'realtime' : 'stable'}`}
                        >
                          {isRealTimeMode ? '⚡ 실시간' : '🛡️ 안정'}
                        </button>
                      )}
                    </div>
                    {/* 입력창+전송버튼 한 줄 */}
                    <div className="input-row" style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        placeholder="메시지를 입력하세요"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        style={{ flex: 1 }}
                      />
                      <button onClick={sendMessage} className="unified-btn">전송</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* 음성 메뉴 모달 */}
        <Modal open={isVoiceMenuOpen} onClose={() => setIsVoiceMenuOpen(false)}>
          {/* TTS 관련 기능 박스 */}
          <div className="voice-modal-tts-box">
            <div className="voice-modal-section">
              <button
                onClick={() => setIsTTSEnabled(!isTTSEnabled)}
                className={`tts-toggle ${isTTSEnabled ? 'active' : ''}`}
                title={isTTSEnabled ? 'TTS 끄기' : 'TTS 켜기'}
              >
                {isTTSEnabled ? '🔊 TTS 켜짐' : '🔇 TTS 꺼짐'}
              </button>
            </div>
            <div className="voice-modal-section">
              <div style={{ marginBottom: '10px', fontSize: '12px' }}>
                <div style={{ marginBottom: '5px' }}>
                  속도: {ttsRate}x | 음조: {ttsPitch}
                </div>
                {/* TTS 속도 드롭다운 */}
                <label htmlFor="tts-rate-select" style={{ marginRight: '8px' }}>속도:</label>
                <select
                  id="tts-rate-select"
                  value={ttsRate}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setTtsRate(val);
                    ttsService.setRate(val);
                  }}
                  style={{ marginRight: '16px', fontSize: '12px' }}
                >
                  {Array.from({ length: 21 }, (_, i) => (1.0 + i * 0.05).toFixed(2)).map(val => (
                    <option key={val} value={Number(val)}>{val}</option>
                  ))}
                </select>
                {/* TTS 음조 드롭다운 */}
                <label htmlFor="tts-pitch-select" style={{ marginRight: '8px' }}>음조:</label>
                <select
                  id="tts-pitch-select"
                  value={ttsPitch}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setTtsPitch(val);
                    ttsService.setPitch(val);
                  }}
                  style={{ fontSize: '12px' }}
                >
                  {Array.from({ length: 21 }, (_, i) => (1.0 + i * 0.05).toFixed(2)).map(val => (
                    <option key={val} value={Number(val)}>{val}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label htmlFor="voice-select-modal" style={{
                  display: 'block',
                  marginBottom: '5px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  음성 선택:
                </label>
                <select
                  id="voice-select-modal"
                  value={ttsVoice ? ttsVoice.name : ''}
                  onChange={e => {
                    const selected = voiceList.find(v => v.name === e.target.value);
                    setTtsVoice(selected);
                    console.log('선택된 음성:', selected?.name, '(', selected?.lang, ')');
                  }}
                  style={{
                    width: '100%',
                    padding: '5px',
                    borderRadius: '3px',
                    border: '1px solid #ccc',
                    fontSize: '12px'
                  }}
                >
                  {voiceList.length === 0 ? (
                    <option value="">음성 목록 로딩 중...</option>
                  ) : (
                    voiceList.map((voice, idx) => (
                      <option key={voice.name + idx} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>
          {/* 음성인식/자동전송/마이크 권한 토글 버튼 한 줄 배치 */}
          <div className="voice-modal-section" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* 음성인식 on/off 토글 */}
            <button
              onClick={handleVoiceRecognitionToggle}
              className={`mic-toggle ${isVoiceRecognitionEnabled ? 'active' : ''}`}
              title={isVoiceRecognitionEnabled ? '음성인식 끄기' : '음성인식 켜기'}
            >
              {isVoiceRecognitionEnabled ? '🎤 음성인식 켜짐' : '🔇 음성인식 꺼짐'}
            </button>
            {/* 자동전송 토글 */}
            <button
              onClick={() => setAutoSend(!autoSend)}
              className={`auto-send-toggle ${autoSend ? 'active' : ''}`}
              title={autoSend ? '자동전송 끄기' : '자동전송 켜기'}
            >
              {autoSend ? '🚀 자동전송 켜짐' : '✏️ 자동전송 꺼짐'}
            </button>
          </div>
          {/* VoiceRecognition 전체 UI 복구 */}
          <div className="voice-modal-section">
            <VoiceRecognition
              ref={voiceRecognitionRef}
              enabled={isVoiceRecognitionEnabled}
              continuous={isContinuousRecognition}
              onResult={handleVoiceResult}
              onInterimResult={handleVoiceInterimResult}
              onStart={() => setIsContinuousRecognition(true)}
              onStop={() => setIsContinuousRecognition(false)}
              onAutoSend={(finalText) => {
                console.log('onAutoSend (chat_box.jsx) 호출, finalText:', finalText);
                if (autoSend && finalText && finalText.trim()) {
                  // setInput(finalText); // input창에만 반영, 실제 전송에는 불필요하므로 주석처리
                  sendMessage(finalText);
                  setAccumulatedVoiceText('');
                }
              }}
            />
          </div>
        </Modal>
      </div>
    </>
  );
};

export default ChatBox;
