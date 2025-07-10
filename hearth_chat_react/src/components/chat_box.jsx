import React, { useState, useEffect, useRef, useMemo } from 'react';
import RealisticAvatar3D from './RealisticAvatar3D';
import EmotionCamera from './EmotionCamera';
import VoiceRecognition from './VoiceRecognition';
import ttsService from '../services/ttsService';
import readyPlayerMeService from '../services/readyPlayerMe';
import faceTrackingService from '../services/faceTrackingService';
import './chat_box.css';
import axios from 'axios';

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
  const chatScrollRef = useRef(null);
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
    setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    }, 0);
  }, [messages, displayedAiText]);

  // TTS 기반 립싱크를 위한 상태
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const [lipSyncInterval, setLipSyncInterval] = useState(null);
  const [lipSyncSequence, setLipSyncSequence] = useState([]);
  const [currentLipSyncIndex, setCurrentLipSyncIndex] = useState(0);

  // 타이핑 효과 interval ref 추가
  const typingIntervalRef = useRef(null);

  // 1. TTS 이벤트 리스너 등록 useEffect로 최초 1회만 등록
  useEffect(() => {
    if (!ttsService.isSupported()) return;
    const handleStart = (text, lipSyncSequence) => {
      console.log('TTS 시작(이벤트):', text.substring(0, 50) + '...');
      setIsAiTalking(true);
      setTtsSpeaking(true);

      // 립싱크 시퀀스 저장 및 초기화
      if (lipSyncSequence && lipSyncSequence.length > 0) {
        setLipSyncSequence(lipSyncSequence);
        setCurrentLipSyncIndex(0);
        console.log('립싱크 시퀀스 받음:', lipSyncSequence.length, '개 음소');
        console.log('립싱크 시퀀스 샘플:', lipSyncSequence.slice(0, 5)); // 처음 5개 음소 확인
      } else {
        setLipSyncSequence([]);
        setCurrentLipSyncIndex(0);
        console.log('립싱크 시퀀스가 없음');
      }

      // 타이핑 효과 시작
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      let i = 0;
      setDisplayedAiText('');
      typingIntervalRef.current = setInterval(() => {
        setDisplayedAiText(text.slice(0, i + 1));
        i++;
        if (i >= text.length) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
      }, 30); // 타이핑 속도 조절
    };
    const handleEnd = (text) => {
      console.log('TTS 종료(이벤트)');
      setIsAiTalking(false);
      setTtsSpeaking(false);
      setMouthTrigger(0);
      // 타이핑 효과 종료 및 전체 메시지 표시
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
      setDisplayedAiText(text); // 전체 메시지 한 번에 표시
    };
    const handleError = (error) => {
      console.error('TTS 오류(이벤트):', error);
      setIsAiTalking(false);
      setTtsSpeaking(false);
      setMouthTrigger(0);
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    };
    ttsService.on('start', handleStart);
    ttsService.on('end', handleEnd);
    ttsService.on('error', handleError);
    return () => {
      ttsService.off('start', handleStart);
      ttsService.off('end', handleEnd);
      ttsService.off('error', handleError);
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    };
  }, []);

  // 2. speakAIMessage에서 TTS 재생 직후 립싱크 강제 시작
  const speakAIMessage = async (message) => {
    try {
      ttsService.stop(); // 항상 먼저 중단
      if (!isTTSEnabled || !message) return;

      // TTS용 텍스트 정리 (이모티콘, 특수문자 제거)
      const cleanedMessage = ttsService.cleanTextForTTS(message);
      if (!cleanedMessage) {
        console.log('TTS로 읽을 수 있는 텍스트가 없습니다:', message);
        return;
      }

      console.log('TTS 원본 텍스트:', message);
      console.log('TTS 정리된 텍스트:', cleanedMessage);

      setTtsSpeaking(true); // 립싱크 강제 시작
      await ttsService.speak(message, { // 원본 메시지 전달 (서비스에서 정리됨)
        voice: ttsVoice
      });
    } catch (error) {
      console.error('TTS 재생 실패:', error);
    }
  };

  // 3. 고급 립싱크 시스템 (음소 기반)
  useEffect(() => {
    console.log('[LIP SYNC DEBUG] ttsSpeaking:', ttsSpeaking, 'lipSyncSequence.length:', lipSyncSequence.length);

    if (ttsSpeaking && lipSyncSequence.length > 0) {
      console.log('[LIP SYNC] 고급 립싱크 시작, 시퀀스 길이:', lipSyncSequence.length);

      // 음소 기반 립싱크
      const totalDuration = lipSyncSequence[lipSyncSequence.length - 1]?.endTime || 5000; // 기본 5초
      const startTime = Date.now();

      console.log('[LIP SYNC] 총 재생 시간:', totalDuration, 'ms');

      const interval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const currentPhoneme = lipSyncSequence.find(p =>
          elapsedTime >= p.startTime && elapsedTime < p.endTime
        );

        if (currentPhoneme) {
          // 입모양에 따른 mouthTrigger 값 설정
          const mouthShapeValues = {
            'closed': 1,
            'slightly_open': 2,
            'open': 3,
            'wide_open': 4,
            'rounded': 5,
            'neutral': 0
          };
          const triggerValue = mouthShapeValues[currentPhoneme.mouthShape] || 0;
          setMouthTrigger(triggerValue);
          console.log('립싱크:', currentPhoneme.phoneme, currentPhoneme.mouthShape, triggerValue, '시간:', elapsedTime);
        } else {
          // 현재 시간에 해당하는 음소가 없으면 중립
          setMouthTrigger(0);
        }

        // TTS 종료 시점 체크
        if (elapsedTime >= totalDuration) {
          clearInterval(interval);
          setLipSyncInterval(null);
          setMouthTrigger(0);
          console.log('[LIP SYNC] 립싱크 종료');
        }
      }, 50); // 50ms 간격으로 더 빠르게 업데이트

      setLipSyncInterval(interval);
      return () => {
        if (interval) clearInterval(interval);
      };
    } else if (ttsSpeaking) {
      console.log('[LIP SYNC] 기본 립싱크 시작 (fallback)');
      // 기존 단순 립싱크 (fallback)
      const baseInterval = 200;
      const rateMultiplier = ttsRate || 1.0;
      const lipSyncInterval = Math.max(100, Math.min(400, baseInterval / rateMultiplier));
      console.log('기본 립싱크 간격 설정:', lipSyncInterval, 'ms (TTS 속도:', rateMultiplier, ')');

      const interval = setInterval(() => {
        setMouthTrigger(prev => prev + 1);
      }, lipSyncInterval);
      setLipSyncInterval(interval);
      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      setMouthTrigger(0);
      setCurrentLipSyncIndex(0);
      if (lipSyncInterval) {
        clearInterval(lipSyncInterval);
        setLipSyncInterval(null);
      }
    }
  }, [ttsSpeaking, ttsRate, lipSyncSequence]);

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

  // 이미지 첨부 핸들러
  const handleImageUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const allowedExt = ['jpg', 'jpeg', 'png', 'webp'];
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 4 * 1024 * 1024;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedExt.includes(ext)) {
      alert('허용되지 않는 확장자입니다: ' + ext);
      return;
    }
    if (file.size > maxSize) {
      alert('파일 용량은 4MB 이하만 허용됩니다.');
      return;
    }
    if (!allowedMime.includes(file.type)) {
      alert('허용되지 않는 이미지 형식입니다: ' + file.type);
      return;
    }
    setAttachedImage(file);
    setAttachedImagePreview(URL.createObjectURL(file));
  };

  // 첨부 이미지 해제
  const handleRemoveAttachedImage = () => {
    setAttachedImage(null);
    setAttachedImagePreview(null);
  };

  // 메시지 전송 함수 수정
  const sendMessage = async (text) => {
    const messageText = text !== undefined ? text : input;
    if (!messageText && !attachedImage) return; // 아무것도 없으면 전송X
    let imageUrl = null;
    if (attachedImage) {
      // 이미지 서버 업로드
      const formData = new FormData();
      formData.append('file', attachedImage);
      formData.append('content', messageText);
      try {
        const res = await axios.post('/chat/api/chat/upload_image/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data.status === 'success') {
          imageUrl = res.data.file_url;
        } else {
          alert('이미지 업로드 실패: ' + (res.data.message || '알 수 없는 오류'));
          return;
        }
      } catch (err) {
        alert('이미지 업로드 실패: ' + (err.response?.data?.message || err.message));
        return;
      }
    }
    setMessages(prev => ([
      ...prev,
      {
        type: 'send',
        text: messageText || (imageUrl ? '' : ''),
        imageUrl: imageUrl,
        date: new Date().toISOString(),
      }
    ]));
    setInput('');
    setAttachedImage(null);
    setAttachedImagePreview(null);
    // Gemini(백엔드)로 메시지/이미지 전송
    if (ws.current && (messageText || imageUrl)) {
      if (ws.current.readyState === 1) {
        ws.current.send(
          JSON.stringify({
            message: messageText || '',
            imageUrl: imageUrl || '',
          })
        );
      } else {
        alert('서버와의 연결이 아직 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.');
        console.warn('WebSocket이 아직 OPEN 상태가 아닙니다. 현재 상태:', ws.current.readyState);
      }
    }
  };

  // WebSocket 연결
  const connectWebSocket = () => {
    // 현재 호스트의 IP 주소를 사용하여 WebSocket 연결
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    // 배포 환경에서는 포트 없이 도메인만 사용
    ws.current = new WebSocket(`${protocol}//${host}/ws/chat/`);

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

  // 컴포넌트 언마운트 시 타이머 정리 및 TTS 중지
  useEffect(() => {
    return () => {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
      // TTS 강제 중지
      ttsService.stop();
    };
  }, [silenceTimer]);

  // 페이지 언로드 시 TTS 강제 중지
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log('페이지 언로드 시 TTS 중지');
      ttsService.stop();
      // 브라우저의 speechSynthesis도 직접 중지
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('페이지 숨김 시 TTS 중지');
        ttsService.stop();
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      }
    };

    // 페이지 언로드 이벤트
    window.addEventListener('beforeunload', handleBeforeUnload);
    // 페이지 숨김/보임 이벤트 (탭 전환, 브라우저 최소화 등)
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // 컴포넌트 언마운트 시에도 TTS 중지
      ttsService.stop();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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

  // 입력창 ref 추가
  const inputRef = useRef(null);

  const [attachedImage, setAttachedImage] = useState(null); // 첨부 이미지 상태
  const [attachedImagePreview, setAttachedImagePreview] = useState(null); // 미리보기용
  const [viewerImage, setViewerImage] = useState(null); // 이미지 뷰어 모달 상태

  // ESC 키로 이미지 뷰어 닫기
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setViewerImage(null);
    };
    if (viewerImage) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [viewerImage]);

  // 아바타 on/off 상태 추가
  const [isUserAvatarOn, setIsUserAvatarOn] = useState(false); // 기본값 off
  const [isAiAvatarOn, setIsAiAvatarOn] = useState(false); // 기본값 off

  return (
    <>
      {/* 이미지 뷰어 모달 */}
      {viewerImage && (
        <div className="image-viewer-modal" onClick={() => setViewerImage(null)}>
          <img src={viewerImage} alt="확대 이미지" className="image-viewer-img" onClick={e => e.stopPropagation()} />
          <button className="image-viewer-close" onClick={() => setViewerImage(null)}>✖</button>
        </div>
      )}
      <div className="chat-container-with-avatars">
        {/* 타이틀+음성/카메라/트래킹 버튼 헤더 */}
        <div className="chat-header">
          <div className="chat-title">
            Hearth <span role="img" aria-label="fire">🔥</span> Chat
          </div>
          {/* 버튼 렌더링 부분(마이크, 카메라, 트래킹, 아바타 토글) */}
          <div className="header-btn-group">
            <button
              onClick={() => setIsVoiceMenuOpen(true)}
              className={`voice-menu-btn-header${isVoiceMenuOpen ? ' active' : ''}`}
            >
              🎤
            </button>
            {/* AI 아바타 토글 */}
            <button className="icon-btn" onClick={() => setIsAiAvatarOn(v => !v)} title="AI 아바타 토글">
              <span role="img" aria-label="ai-avatar" style={{ opacity: isAiAvatarOn ? 1 : 0.3 }}>🤖</span>
            </button>
            {/* 사용자 아바타 토글 + 트래킹 통합 */}
            <button className="icon-btn" onClick={async () => {
              setIsUserAvatarOn(v => {
                const next = !v;
                setIsTrackingEnabled(next);
                if (next) {
                  // 트래킹 서비스 시작
                  faceTrackingService.startCamera();
                } else {
                  // 트래킹 서비스 중지
                  faceTrackingService.stopCamera();
                }
                return next;
              });
            }} title="사용자 아바타/트래킹 토글">
              <span role="img" aria-label="user-avatar" style={{ opacity: isUserAvatarOn ? 1 : 0.3 }}>👤</span>
            </button>
            {/* 카메라 버튼 */}
            <button
              onClick={toggleCamera}
              className={`camera-btn-header${isCameraActive ? ' active' : ''}`}
            >
              📷
            </button>
          </div>
        </div>
        {/* 아바타들을 위쪽에 좌우로 배치 */}
        <div className="avatar-container" style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '50%', margin: 0, padding: 0 }}>
          {/* 1. 카메라만 ON */}
          {isCameraActive && !isAiAvatarOn && !isUserAvatarOn && (
            <div style={{ flex: 1, width: '100%', height: '100%' }}>
              <EmotionCamera
                isActive={isCameraActive}
                userAvatar={userAvatar}
                userEmotion={userEmotion}
                isUserTalking={isUserTalking}
                mouthTrigger={mouthTrigger}
                emotionCaptureStatus={emotionCaptureStatus.user}
                enableTracking={false}
                showAvatarOverlay={false}
              />
            </div>
          )}
          {/* 2. AI 아바타만 ON */}
          {!isCameraActive && isAiAvatarOn && !isUserAvatarOn && (
            <div style={{ flex: 1, width: '100%', height: '100%' }}>
              <RealisticAvatar3D
                avatarUrl={aiAvatar}
                isTalking={isAiTalking}
                emotion={aiEmotion}
                mouthTrigger={mouthTrigger}
                position="left"
                size="100%"
                showEmotionIndicator={true}
                emotionCaptureStatus={emotionCaptureStatus.ai}
              />
            </div>
          )}
          {/* 3. 사용자 아바타만 ON */}
          {!isCameraActive && !isAiAvatarOn && isUserAvatarOn && (
            <div style={{ flex: 1, width: '100%', height: '100%' }}>
              <RealisticAvatar3D
                avatarUrl={userAvatar}
                isTalking={isUserTalking}
                emotion={userEmotion}
                position="right"
                size="100%"
                showEmotionIndicator={true}
                emotionCaptureStatus={emotionCaptureStatus.user}
                enableTracking={isTrackingEnabled}
              />
            </div>
          )}
          {/* 4. 카메라+AI 아바타 ON (사용자 아바타 OFF) */}
          {isCameraActive && isAiAvatarOn && !isUserAvatarOn && (
            <>
              <div style={{ flex: 1, width: '50%', height: '100%' }}>
                <RealisticAvatar3D
                  avatarUrl={aiAvatar}
                  isTalking={isAiTalking}
                  emotion={aiEmotion}
                  mouthTrigger={mouthTrigger}
                  position="left"
                  size="100%"
                  showEmotionIndicator={true}
                  emotionCaptureStatus={emotionCaptureStatus.ai}
                />
              </div>
              <div style={{ flex: 1, width: '50%', height: '100%' }}>
                <EmotionCamera
                  isActive={isCameraActive}
                  userAvatar={userAvatar}
                  userEmotion={userEmotion}
                  isUserTalking={isUserTalking}
                  mouthTrigger={mouthTrigger}
                  emotionCaptureStatus={emotionCaptureStatus.user}
                  enableTracking={false}
                  showAvatarOverlay={false}
                />
              </div>
            </>
          )}
          {/* 5. 카메라+사용자 아바타 ON (AI 아바타 OFF) */}
          {isCameraActive && !isAiAvatarOn && isUserAvatarOn && (
            <div style={{ flex: 1, width: '100%', height: '100%' }}>
              <EmotionCamera
                isActive={isCameraActive}
                userAvatar={userAvatar}
                userEmotion={userEmotion}
                isUserTalking={isUserTalking}
                mouthTrigger={mouthTrigger}
                emotionCaptureStatus={emotionCaptureStatus.user}
                enableTracking={isUserAvatarOn}
                showAvatarOverlay={true}
              />
            </div>
          )}
          {/* 6. 카메라+AI+사용자 아바타 ON */}
          {isCameraActive && isAiAvatarOn && isUserAvatarOn && (
            <>
              <div style={{ flex: 1, width: '50%', height: '100%' }}>
                <RealisticAvatar3D
                  avatarUrl={aiAvatar}
                  isTalking={isAiTalking}
                  emotion={aiEmotion}
                  mouthTrigger={mouthTrigger}
                  position="left"
                  size="100%"
                  showEmotionIndicator={true}
                  emotionCaptureStatus={emotionCaptureStatus.ai}
                />
              </div>
              <div style={{ flex: 1, width: '50%', height: '100%' }}>
                <EmotionCamera
                  isActive={isCameraActive}
                  userAvatar={userAvatar}
                  userEmotion={userEmotion}
                  isUserTalking={isUserTalking}
                  mouthTrigger={mouthTrigger}
                  emotionCaptureStatus={emotionCaptureStatus.user}
                  enableTracking={isUserAvatarOn}
                  showAvatarOverlay={true}
                />
              </div>
            </>
          )}
          {/* 7. 아무것도 없음 (빈 공간) */}
          {!isCameraActive && !isAiAvatarOn && !isUserAvatarOn && (
            <div style={{ flex: 1, width: '100%', height: '100%' }} />
          )}
        </div>
        {/* 채팅창 (아래쪽), paddingBottom:28 */}
        <div className="chat-section" style={{ height: '50%', margin: 0, padding: 0, width: '100%' }}>
          <div className="chat-container">
            <div className="chat-log" ref={chatScrollRef}>
              {messages.map((msg, idx) => {
                // 날짜/시간 포맷 함수
                const dateObj = msg.date ? new Date(msg.date) : new Date();
                const yyyy = dateObj.getFullYear();
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const dd = String(dateObj.getDate()).padStart(2, '0');
                const hh = String(dateObj.getHours()).padStart(2, '0');
                const min = String(dateObj.getMinutes()).padStart(2, '0');
                // 날짜/시간 박스 JSX
                const dateTimeBox = (
                  <div className="chat-date-time-box">
                    <div className="chat-date-time-year">{yyyy}-</div>
                    <div className="chat-date-time-md">{mm}-{dd}</div>
                    <div className="chat-date-time-hm">{hh}:{min}</div>
                  </div>
                );
                return (
                  <div
                    key={idx}
                    style={{ display: 'flex', flexDirection: msg.type === 'send' ? 'row-reverse' : 'row', alignItems: 'center' }}
                  >
                    {dateTimeBox}
                    <div
                      className={`chat-bubble ${msg.type === 'send' ? 'sent' : 'received'}`}
                      style={{ marginRight: msg.type === 'send' ? 8 : 0, marginLeft: msg.type === 'send' ? 0 : 8 }}
                    >
                      {/* 이미지+텍스트 조합 출력 */}
                      {msg.imageUrl && (
                        <img
                          src={msg.imageUrl}
                          alt="첨부 이미지"
                          className="attached-image-thumb"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setViewerImage(msg.imageUrl)}
                        />
                      )}
                      {msg.text && (
                        <div>{msg.type === 'recv' && idx === messages.length - 1 && isAiTalking ? displayedAiText : msg.text}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="chat-input-area">
              {/* 첨부 이미지 썸네일+X 버튼을 textarea 바로 위에 위치 */}
              {attachedImagePreview && (
                <div className="attached-image-preview-box">
                  <img src={attachedImagePreview} alt="첨부 이미지 미리보기" className="attached-image-thumb" />
                  <button onClick={handleRemoveAttachedImage} className="attached-image-remove-btn">✖</button>
                  {/* <span className="attached-image-label">이미지 첨부됨</span> */}
                </div>
              )}
              <div className="input-controls">
                <div className="chat-input-box">
                  {/* 이미지 첨부 버튼 (왼쪽) */}
                  <label htmlFor="chat-image-upload" className="image-upload-btn-side">
                    <input
                      id="chat-image-upload"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageUpload}
                    />
                    <span className="image-upload-btn-icon">📤</span>
                  </label>
                  <textarea
                    ref={inputRef}
                    placeholder="메시지를 입력하세요"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    onInput={e => {
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    className="input-flex chat-textarea"
                    rows={1}
                  />
                  <button onClick={() => sendMessage()} className="unified-btn">🔥</button>
                </div>
              </div>
            </div>
          </div>
        </div>
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
