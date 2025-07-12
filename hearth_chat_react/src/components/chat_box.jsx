import React, { useState, useEffect, useRef, useMemo } from 'react';
import RealisticAvatar3D from './RealisticAvatar3D';
import EmotionCamera from './EmotionCamera';
import VoiceRecognition from './VoiceRecognition';
import LoginModal from './LoginModal';
import UserMenuModal from './UserMenuModal';
import ttsService from '../services/ttsService';
import readyPlayerMeService from '../services/readyPlayerMe';
import faceTrackingService from '../services/faceTrackingService';
import './chat_box.css';
import axios from 'axios';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { Line as ChartLine } from 'react-chartjs-2';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import InsertChartIcon from '@mui/icons-material/InsertChart';
import CodeIcon from '@mui/icons-material/Code';

// Chart.js core 등록 필수!
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend
);

// 모달 컴포넌트 추가
const Modal = ({ open, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="voice-modal-overlay" onClick={onClose}>
      <div className="voice-modal-content" onClick={e => e.stopPropagation()}>
        <button className="voice-modal-close" onClick={onClose}>❌</button>
        {children}
      </div>
    </div>
  );
};

// 테스트용 차트 데이터 및 컴포넌트
// const testChartData = [
//   { name: '1월', 방문자수: 4000, 매출: 2400, 비용: 2400 },
//   { name: '2월', 방문자수: 3000, 매출: 1398, 비용: 2210 },
//   { name: '3월', 방문자수: 2000, 매출: 9800, 비용: 2290 },
//   { name: '4월', 방문자수: 2780, 매출: 3908, 비용: 2000 },
//   { name: '5월', 방문자수: 1890, 매출: 4800, 비용: 2181 },
//   { name: '6월', 방문자수: 2390, 매출: 3800, 비용: 2500 },
//   { name: '7월', 방문자수: 3490, 매출: 4300, 비용: 2100 }
// ];

// Chart.js용 데이터 및 옵션
const chartData = {
  labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월'],
  datasets: [
    {
      label: '방문자수',
      data: [4000, 3000, 2000, 2780, 1890, 2390, 3490],
      borderColor: '#8884d8',
      backgroundColor: 'rgba(136,132,216,0.2)',
      fill: false,
      tension: 0.3,
    },
    {
      label: '매출',
      data: [2400, 1398, 9800, 3908, 4800, 3800, 4300],
      borderColor: '#82ca9d',
      backgroundColor: 'rgba(130,202,157,0.2)',
      fill: false,
      tension: 0.3,
    },
    {
      label: '비용',
      data: [2400, 2210, 2290, 2000, 2181, 2500, 2100],
      borderColor: '#ff7300',
      backgroundColor: 'rgba(255,115,0,0.2)',
      fill: false,
      tension: 0.3,
    },
  ],
};

const chartOptions = {
  responsive: true,
  plugins: {
    legend: {
      position: 'top',
    },
    title: {
      display: true,
      text: '월별 방문자수/매출/비용',
    },
  },
};

function MyChart() {
  return (
    <div style={{ width: '100%', maxWidth: 700, margin: '0 auto', background: '#fff', borderRadius: 12, marginBottom: 16, padding: 16 }}>
      <ChartLine data={chartData} options={chartOptions} />
    </div>
  );
}

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

  // 로그인 모달 상태
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  // 사용자 메뉴 모달 상태
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  // 로그인 사용자 정보
  const [loginUser, setLoginUser] = useState(null);
  // 로그인 상태 로딩
  const [loginLoading, setLoginLoading] = useState(true);

  // TTS 관련 상태
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
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

  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  const [chartViewMap, setChartViewMap] = useState({}); // 메시지별 차트뷰 상태

  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  // TTS 상태가 바뀔 때마다 WebSocket 재연결
  useEffect(() => {
    if (ws.current) {
      ws.current.close();
    }
    connectWebSocket();
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
  // 립싱크 마지막 프레임을 기억
  const [lastLipSyncValue, setLastLipSyncValue] = useState(0);

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
      // 타이핑 효과 코드 (주석 처리)
      /*
      typingIntervalRef.current = setInterval(() => {
        setDisplayedAiText(text.slice(0, i + 1));
        i++;
        if (i >= text.length) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
      }, 30);
      */
      // 한 번에 전체 출력
      setDisplayedAiText(text);
    };
    const handleEnd = (text) => {
      console.log('TTS 종료(이벤트)');
      setIsAiTalking(false);
      setTtsSpeaking(false);
      // 립싱크 애니메이션: 1초간 랜덤 입모양 반복 후 닫기 (일시 비활성화)
      /*
      let animCount = 0;
      const animMax = 10; // 1초(100ms*10)
      const animInterval = setInterval(() => {
        // 0(닫힘)~4(최대) 중 랜덤
        setMouthTrigger(Math.floor(Math.random() * 5));
        animCount++;
        if (animCount >= animMax) {
          clearInterval(animInterval);
          setMouthTrigger(0); // 마지막엔 닫기
          setLastLipSyncValue(0);
        }
      }, 100);
      */
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
          setLastLipSyncValue(triggerValue); // 마지막 립싱크 값 저장
          // console.log('립싱크:', currentPhoneme.phoneme, currentPhoneme.mouthShape, triggerValue, '시간:', elapsedTime);
        } else {
          // 현재 시간에 해당하는 음소가 없으면 마지막 립싱크 값 유지
          setMouthTrigger(lastLipSyncValue);
        }

        // TTS 종료 시점 체크
        if (elapsedTime >= totalDuration) {
          clearInterval(interval);
          setLipSyncInterval(null);
          // 립싱크가 먼저 끝나도 TTS가 끝날 때까지 마지막 입모양 유지
          setMouthTrigger(lastLipSyncValue);
          console.log('[LIP SYNC] 립싱크 종료, 마지막 프레임 유지');
        }
      }, 50); // 50ms 간격으로 더 빠르게 업데이트

      setLipSyncInterval(interval);
      return () => {
        if (interval) clearInterval(interval);
      };
    } else if (ttsSpeaking) {
      console.log('[LIP SYNC] 기본 립싱크 시작 (fallback)');
      const baseInterval = 200;
      const rateMultiplier = ttsRate || 1.0;
      const lipSyncInterval = Math.max(100, Math.min(400, baseInterval / rateMultiplier));
      console.log('기본 립싱크 간격 설정:', lipSyncInterval, 'ms (TTS 속도:', rateMultiplier, ')');

      const interval = setInterval(() => {
        setMouthTrigger(prev => {
          const next = prev + 1;
          setLastLipSyncValue(next);
          return next;
        });
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

  // LaTeX 수식 렌더링 함수 (원상복구)
  const renderLatexInText = (text) => {
    return text || '';
  };

  // 수식 블록 전처리 함수
  const preprocessLatexBlocks = (text) => {
    if (!text) return '';
    // 코드블록(```latex ... ```, ``` ... ```)을 $$...$$로 변환
    let processed = text.replace(/```(?:latex)?([\s\S]*?)```/g, (match, p1) => {
      return `$$${p1.trim()}$$`;
    });
    // 따옴표(‘ ’, ", ")로 감싼 수식도 $$...$$로 변환 (너무 짧은 경우는 무시)
    processed = processed.replace(/[‘'“”"]([\s\S]{5,}?)[’'“”"]/g, (match, p1) => {
      return `$$${p1.trim()}$$`;
    });
    return processed;
  };

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
    ttsService.stop(); // 메시지 전송 시 TTS 즉시 중단
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
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
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

    // 환경에 따라 WebSocket URL 설정
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '192.168.44.9';
    const wsUrl = isLocalhost ? `${protocol}//${host}:8000/ws/chat/` : `${protocol}//${host}/ws/chat/`;

    console.log('WebSocket 연결 시도:', wsUrl);
    ws.current = new WebSocket(wsUrl);

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
      } else {
        setDisplayedAiText(data.message); // 텍스트만 출력
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

    ws.current.onerror = (error) => {
      console.error('WebSocket 연결 오류:', error);
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

  // 수식과 일반 텍스트를 분리 렌더링하는 함수 (katex 직접 사용)
  const renderMessageWithLatex = (text) => {
    if (!text) return null;
    // $$...$$ 블록 수식 분리
    const blockParts = text.split(/(\$\$[^$]+\$\$)/g);
    return blockParts.map((part, i) => {
      if (/^\$\$[^$]+\$\$$/.test(part)) {
        const math = part.replace(/^\$\$|\$\$$/g, '');
        return (
          <div
            key={i}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(math, { displayMode: true, throwOnError: false }),
            }}
          />
        );
      } else {
        // 인라인 수식 분리
        const inlineParts = part.split(/(\$[^$]+\$)/g);
        return inlineParts.map((inline, j) => {
          if (/^\$[^$]+\$/.test(inline)) {
            const math = inline.replace(/^\$|\$$/g, '');
            return (
              <span
                key={j}
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(math, { displayMode: false, throwOnError: false }),
                }}
              />
            );
          } else {
            // 일반 텍스트 (줄바꿈 처리)
            return inline.split(/\n/g).map((line, k) => (
              <span key={k}>
                {line}
                {k < inline.split(/\n/g).length - 1 && <br />}
              </span>
            ));
          }
        });
      }
    });
  };

  // 차트 렌더링 함수
  const renderChartIfData = (text) => {
    // 차트 렌더링 비활성화 (recharts 제거)
    return null;
  };

  // 메시지 블록 파싱 함수
  function parseMessageBlocks(text) {
    if (!text || typeof text !== 'string') return [];
    const blocks = [];
    let lastIndex = 0;
    // $$...$$ (블록 수식)
    const blockMathRegex = /\$\$([\s\S]+?)\$\$/g;
    // ```json ... ``` (차트 데이터)
    const chartRegex = /```json\s*([\s\S]+?)```/g;
    // ```언어 ... ``` (코드블록)
    const codeBlockRegex = /```(\w+)?\s*([\s\S]+?)```/g;

    // 두 정규식 모두 찾아서 출현 순서대로 분할
    let match;
    const matches = [];
    while ((match = blockMathRegex.exec(text)) !== null) {
      matches.push({ type: 'math', value: match[1], index: match.index, length: match[0].length });
    }
    while ((match = chartRegex.exec(text)) !== null) {
      matches.push({ type: 'chart', value: match[1], index: match.index, length: match[0].length });
    }
    while ((match = codeBlockRegex.exec(text)) !== null) {
      // chartRegex와 중복되는 부분은 chart로만 처리
      if (match[1] === 'json') continue;
      matches.push({ type: 'code', value: match[2], language: match[1] || 'javascript', index: match.index, length: match[0].length });
    }
    matches.sort((a, b) => a.index - b.index);

    for (const m of matches) {
      if (lastIndex < m.index) {
        blocks.push({ type: 'markdown', value: text.slice(lastIndex, m.index) });
      }
      if (m.type === 'code') {
        blocks.push({ type: 'code', value: m.value || '', language: m.language });
      } else if (m.type === 'chart') {
        blocks.push({ type: 'chart', value: m.value || '' });
      } else if (m.type === 'math') {
        blocks.push({ type: 'math', value: m.value || '' });
      }
      lastIndex = m.index + m.length;
    }
    if (lastIndex < text.length) {
      blocks.push({ type: 'markdown', value: text.slice(lastIndex) });
    }
    return blocks;
  }

  // 차트 렌더링 함수
  const renderChartBlock = (value, key) => {
    // 차트 렌더링 비활성화 (recharts 제거)
    // 차트 데이터 텍스트만 출력
    return <pre key={key}>{value}</pre>;
  };

  // 코드/JSON/차트 카드 컴포넌트
  function CodeJsonChartCard({ code, language, isChartCandidate, isChartView, onToggleChartView }) {
    const [copyMsg, setCopyMsg] = React.useState('');
    const [isChartModalOpen, setIsChartModalOpen] = React.useState(false);

    // 차트 변환 함수
    function convertToChartData(data) {
      // Chart.js 형식 데이터인지 확인 (labels와 datasets가 있는 경우)
      if (data.labels && data.datasets && Array.isArray(data.labels) && Array.isArray(data.datasets)) {
        return data; // 이미 Chart.js 형식이면 그대로 반환
      }

      // 기존 형식: 배열 형태의 데이터
      if (Array.isArray(data) && data.length > 0) {
      const labels = data.map(item => item.name);
      const keys = Object.keys(data[0]).filter(key => key !== 'name');
      const colorList = ['#FFD600', '#00E5FF', '#76FF03', '#FF4081', '#FFFFFF'];
      const datasets = keys.map((key, idx) => ({
        label: key,
        data: data.map(item => item[key]),
        borderColor: colorList[idx % colorList.length],
        backgroundColor: colorList[idx % colorList.length] + '80',
        pointBackgroundColor: colorList[idx % colorList.length],
        borderWidth: 3,
        pointRadius: 4,
        tension: 0.3,
        fill: false,
      }));
      return { labels, datasets };
      }

      return null;
    }

    let chartData = null;
    let isJson = false;
    try {
      const parsed = typeof code === 'string' ? JSON.parse(code) : code;
      // Chart.js 형식 또는 기존 배열 형식 모두 감지
      if ((parsed.labels && parsed.datasets) || (Array.isArray(parsed) && parsed[0]?.name)) {
        isJson = true;
        chartData = convertToChartData(parsed);
        console.log('Chart detection:', { isChartCandidate, isJson, chartData, parsed });
      }
    } catch (e) {
      console.log('JSON parse error:', e);
    }

    // JSON 파싱이 성공하고 차트 데이터가 있으면 차트 후보로 인식
    if (isJson && chartData) {
      console.log('Chart candidate detected!');
    }

    // 차트 옵션: 어두운 배경에서 잘 보이도록 색상 지정
    const chartOptions = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#fff' },
        },
        title: {
          display: false,
          color: '#fff',
        },
      },
      scales: {
        x: {
          ticks: { color: '#fff' },
          grid: { color: 'rgba(255,255,255,0.1)' },
        },
        y: {
          ticks: { color: '#fff' },
          grid: { color: 'rgba(255,255,255,0.1)' },
        },
      },
    };

    // 클립보드 복사
    const handleCopy = () => {
      navigator.clipboard.writeText(code);
      setCopyMsg('복사됨!');
      setTimeout(() => setCopyMsg(''), 1000);
    };

    // 차트 모달 닫기
    const closeModal = () => setIsChartModalOpen(false);

    return (
      <div className="code-json-card" style={{ position: 'relative', margin: '12px 0' }}>
        <button
          className="copy-btn"
          style={{ position: 'absolute', top: 8, right: (isChartCandidate || (isJson && chartData)) ? 40 : 8, zIndex: 2 }}
          onClick={handleCopy}
          title="클립보드 복사"
        >
          <ContentCopyIcon fontSize="small" />
        </button>
        {(isChartCandidate || (isJson && chartData)) && (
          <button
            className="chart-toggle-btn"
            style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}
            onClick={onToggleChartView}
            title={isChartView ? '코드로 보기' : '차트로 보기'}
          >
            {isChartView ? <CodeIcon fontSize="small" /> : <InsertChartIcon fontSize="small" />}
          </button>
        )}
        {(isChartCandidate || (isJson && chartData)) && isChartView && chartData ? (
          <div onClick={() => setIsChartModalOpen(true)} style={{ cursor: 'zoom-in' }}>
            <ChartLine data={chartData} options={chartOptions} />
          </div>
        ) : (
          <pre style={{ background: '#222', color: '#fff', borderRadius: 6, padding: 12, overflowX: 'auto', margin: 0 }}
            dangerouslySetInnerHTML={{
              __html: Prism.highlight(code, Prism.languages[language] || Prism.languages.javascript, language)
            }}
          />
        )}
        {copyMsg && <span className="copy-msg" style={{ position: 'absolute', top: 8, left: 8, color: '#4caf50', fontSize: 12 }}>{copyMsg}</span>}
        {/* 차트 확대 모달 */}
        {isChartModalOpen && (
          <div className="chart-modal-overlay" onClick={closeModal} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="chart-modal-content" onClick={e => e.stopPropagation()} style={{ background: '#23272f', borderRadius: 16, padding: 32, maxWidth: '90vw', maxHeight: '90vh', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
              <button onClick={closeModal} style={{ position: 'absolute', top: 24, right: 32, background: 'none', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer', zIndex: 10000 }}>✖</button>
              <div style={{ width: '80vw', height: '60vh', minWidth: 320, minHeight: 240 }}>
                <ChartLine data={chartData} options={chartOptions} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 메시지 배열 최대 길이 제한 (예: 100개)
  useEffect(() => {
    if (messages.length > 100) {
      setMessages(msgs => msgs.slice(msgs.length - 100));
    }
  }, [messages]);

  // 코드블록 뒤에 빈 줄 2개를 자동으로 추가하는 전처리 함수
  function ensureDoubleNewlineAfterCodeBlocks(text) {
    if (!text || typeof text !== 'string') return text;
    // 코드블록 뒤에 이미 빈 줄 2개가 있지 않으면 추가
    return text.replace(/(```[\s\S]*?```)(?!\n\n)/g, '$1\n\n');
  }

  // latex 코드블록 안의 $$ ... $$ 수식을 추출해 수식 블록으로 변환하는 전처리 함수
  function extractLatexBlocks(text) {
    if (!text || typeof text !== 'string') return text;
    // latex 코드블록을 찾아서
    return text.replace(/```latex\s*([\s\S]*?)```/g, (match, p1) => {
      // $$ ... $$로 감싸진 부분만 추출
      const latexBlocks = p1.match(/\$\$[\s\S]*?\$\$/g);
      if (latexBlocks) {
        // 여러 개의 $$ ... $$가 있을 수 있으니 모두 합쳐서 반환
        return latexBlocks.join('\n\n');
      }
      // $$ ... $$가 없으면 원래 코드블록 유지
      return match;
    });
  }

  // 클립보드에서 이미지 붙여넣기 핸들러
  const handlePaste = (e) => {
    if (!e.clipboardData) return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          setAttachedImage(file);
          setAttachedImagePreview(URL.createObjectURL(file));
          e.preventDefault();
          break;
        }
      }
    }
  };

  const isTTSEnabledRef = useRef(isTTSEnabled);
  useEffect(() => {
    isTTSEnabledRef.current = isTTSEnabled;
  }, [isTTSEnabled]);

  // 로그인 상태 확인
  useEffect(() => {
    fetch('/chat/api/user/', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setLoginUser(data.user);
        } else {
          setLoginUser(null);
        }
      })
      .catch(() => setLoginUser(null))
      .finally(() => setLoginLoading(false));
  }, []);

  // 로그인 성공 postMessage 수신 시 새로고침
  useEffect(() => {
    const handleLoginSuccess = (event) => {
      if (event.data === 'login_success') {
        window.location.reload();
      }
    };
    window.addEventListener('message', handleLoginSuccess);
    return () => window.removeEventListener('message', handleLoginSuccess);
  }, []);

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
            {/* 로그인/내 계정 버튼 - 오른쪽 끝 */}
            {loginLoading ? null : loginUser ? (
              <button
                onClick={() => setIsUserMenuOpen(true)}
                className="login-btn-header"
                style={{
                  marginLeft: 12,
                  background: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  borderRadius: 4,
                  padding: '6px 12px',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: 18,
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
                title="내 계정"
              >
                <span role="img" aria-label="user" style={{ marginRight: 6 }}>👤</span>
                {loginUser.username || '내 계정'}
              </button>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="login-btn-header"
                style={{
                  marginLeft: 12,
                  background: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  borderRadius: 4,
                  padding: '6px 12px',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: 18,
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
                title="로그인"
              >
                <span role="img" aria-label="login" style={{ marginRight: 6 }}>🔑</span>
              </button>
            )}
          </div>
        </div>
        {/* 차트 렌더링 */}
        {/* <MyChart /> */}
        {/* 아바타/카메라를 항상 렌더링하고, style로만 분할/숨김/오버레이 처리 */}
        <div
          className="avatar-container"
          style={{
            display: (!isCameraActive && !isAiAvatarOn && !isUserAvatarOn) ? 'none' : 'flex',
            flexDirection: 'row',
            width: '100%',
            height: (!isCameraActive && !isAiAvatarOn && !isUserAvatarOn) ? 0 : '50%',
            margin: 0,
            padding: 0,
            position: 'relative',
            minHeight: 0,
            minWidth: 0,
          }}
        >
          {/* AI 아바타 */}
          <div style={getAiAvatarStyle(isCameraActive, isAiAvatarOn, isUserAvatarOn)}>
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
          {/* 사용자 아바타 */}
          <div style={getUserAvatarStyle(isCameraActive, isAiAvatarOn, isUserAvatarOn)}>
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
          {/* 카메라 */}
          <div style={getCameraStyle(isCameraActive, isAiAvatarOn, isUserAvatarOn)}>
            <EmotionCamera
              isActive={isCameraActive}
              userAvatar={userAvatar}
              userEmotion={userEmotion}
              isUserTalking={isUserTalking}
              mouthTrigger={mouthTrigger}
              emotionCaptureStatus={emotionCaptureStatus.user}
              enableTracking={isUserAvatarOn}
              showAvatarOverlay={isCameraActive && isUserAvatarOn}
            />
          </div>
        </div>
        {/* 채팅창 (아래쪽), avatar-container가 없으면 전체를 차지 */}
        <div
          className="chat-section"
          style={{
            height: `${viewportHeight}px`,
            margin: 0,
            padding: 0,
            width: '100%'
          }}
        >
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
                    style={{
                      display: 'flex',
                      flexDirection: msg.type === 'send' ? 'row-reverse' : 'row',
                      alignItems: 'flex-end',
                      width: '100%',
                      justifyContent: msg.type === 'send' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {/* 사용자/AI 메시지 버블+날짜 영역 */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: msg.type === 'send' ? 'flex-end' : 'flex-start',
                        height: '100%',
                        maxWidth: '80vw',
                        minWidth: 0,
                        width: '80%',
                        marginLeft: msg.type === 'send' ? 'auto' : 0,
                        marginRight: msg.type === 'send' ? 0 : 'auto',
                      }}
                    >
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
                        {msg.text && parseMessageBlocks(
                          msg.type === 'recv' && idx === messages.length - 1 && isAiTalking
                            ? ensureDoubleNewlineAfterCodeBlocks(extractLatexBlocks(displayedAiText))
                            : ensureDoubleNewlineAfterCodeBlocks(extractLatexBlocks(msg.text))
                        ).map((block, i) => {
                          if (!block || !block.type) return null;
                          const chartKey = `${idx}_${i}`;
                          if (block.type === 'math') {
                            return (
                              <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(block.value || '', { throwOnError: false }) }} />
                            );
                          } else if (block.type === 'chart') {
                            return (
                              <CodeJsonChartCard
                                key={i}
                                code={block.value || ''}
                                language="json"
                                isChartCandidate={true}
                                isChartView={!!chartViewMap[chartKey]}
                                onToggleChartView={() => setChartViewMap(prev => ({ ...prev, [chartKey]: !prev[chartKey] }))}
                              />
                            );
                          } else if (block.type === 'code') {
                            return (
                              <CodeJsonChartCard
                                key={i}
                                code={block.value || ''}
                                language={block.language}
                                isChartCandidate={block.language === 'json'}
                                isChartView={!!chartViewMap[chartKey]}
                                onToggleChartView={() => setChartViewMap(prev => ({ ...prev, [chartKey]: !prev[chartKey] }))}
                              />
                            );
                          } else if (block.type === 'markdown') {
                            return (
                              <ReactMarkdown
                                key={i}
                                children={block.value || ''}
                                remarkPlugins={[remarkMath, remarkGfm]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                  code({ node, inline, className, children, ...props }) {
                                    return (
                                      <code className={className} {...props} style={{ background: '#222', color: '#fff', borderRadius: 4, padding: '2px 6px' }}>
                                        {children}
                                      </code>
                                    );
                                  },
                                  table({ node, ...props }) {
                                    return (
                                      <div className="markdown-table-wrapper">
                                        <table {...props} />
                                      </div>
                                    );
                                  },
                                }}
                              />
                            );
                          }
                          return null;
                        })}
                      </div>
                      {/* 날짜 박스는 버블 하단, 같은 라인 오른쪽/왼쪽에 위치 */}
                      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: msg.type === 'send' ? 'flex-end' : 'flex-start', width: '100%' }}>
                        {msg.type === 'send' ? (
                          <div style={{ marginLeft: 'auto' }}>{dateTimeBox}</div>
                        ) : (
                          <div style={{ marginRight: 'auto' }}>{dateTimeBox}</div>
                        )}
                      </div>
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
                    onPaste={handlePaste}
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
        {/* 로그인 모달 */}
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
        />
        {/* 사용자 메뉴 모달 */}
        <UserMenuModal
          isOpen={isUserMenuOpen}
          onClose={() => setIsUserMenuOpen(false)}
        />
      </div>
    </>
  );
};

export default ChatBox;

function getAiAvatarStyle(isCameraActive, isAiAvatarOn, isUserAvatarOn) {
  // AI 아바타가 꺼져있으면 숨김
  if (!isAiAvatarOn) return { display: 'none' };
  // AI+사용자+카메라: 50% 분할
  if (isCameraActive && isUserAvatarOn) return { flex: 1, width: '50%', height: '100%', transition: 'all 0.3s' };
  // AI+카메라: 50% 분할
  if (isCameraActive) return { flex: 1, width: '50%', height: '100%', transition: 'all 0.3s' };
  // AI+사용자: 50% 분할
  if (isUserAvatarOn) return { flex: 1, width: '50%', height: '100%', transition: 'all 0.3s' };
  // AI만: 전체
  return { flex: 1, width: '100%', height: '100%', transition: 'all 0.3s' };
}
function getUserAvatarStyle(isCameraActive, isAiAvatarOn, isUserAvatarOn) {
  if (!isUserAvatarOn) return { display: 'none' };
  // AI+사용자+카메라: width 0, opacity 0 등으로 숨김(완전 unmount 대신)
  if (isCameraActive && isAiAvatarOn) return { width: 0, opacity: 0, pointerEvents: 'none', transition: 'all 0.3s' };
  // AI+사용자: 50% 분할
  if (isAiAvatarOn) return { flex: 1, width: '50%', height: '100%', transition: 'all 0.3s' };
  // 카메라+사용자: width 0, opacity 0 등으로 숨김
  if (isCameraActive) return { width: 0, opacity: 0, pointerEvents: 'none', transition: 'all 0.3s' };
  // 사용자만: 전체
  return { flex: 1, width: '100%', height: '100%', transition: 'all 0.3s' };
}
function getCameraStyle(isCameraActive, isAiAvatarOn, isUserAvatarOn) {
  if (!isCameraActive) return { display: 'none' };
  // AI+카메라: 50% 분할
  if (isAiAvatarOn && !isUserAvatarOn) return { flex: 1, width: '50%', height: '100%', transition: 'all 0.3s' };
  // AI+사용자+카메라: 50% 분할(오버레이)
  if (isAiAvatarOn && isUserAvatarOn) return { flex: 1, width: '50%', height: '100%', transition: 'all 0.3s', position: 'relative', zIndex: 2 };
  // 카메라+사용자: 전체(오버레이)
  if (isUserAvatarOn) return { flex: 1, width: '100%', height: '100%', transition: 'all 0.3s', position: 'relative', zIndex: 2 };
  // 카메라만: 전체
  return { flex: 1, width: '100%', height: '100%', transition: 'all 0.3s' };
}
