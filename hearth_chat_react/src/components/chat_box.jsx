import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import RealisticAvatar3D from './RealisticAvatar3D';
import EmotionCamera from './EmotionCamera';
import VoiceRecognition from './VoiceRecognition';
import ttsService from '../services/ttsService';
import readyPlayerMeService from '../services/readyPlayerMe';
import faceTrackingService from '../services/faceTrackingService';
import aiService from '../services/aiService';
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
import RoomSettingsModal from './RoomSettingsModal';

import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

import VirtualizedMessageList from './VirtualizedMessageList';
import { getApiBase, getCookie, csrfFetch, API_BASE } from '../utils/apiConfig';
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

// 이미지 URL을 절대 경로로 변환하는 함수
const getImageUrl = (imageUrl) => {
  if (!imageUrl) return null;

  // 이미 절대 URL인 경우 그대로 반환
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // 상대 경로인 경우 Django 서버 주소를 앞에 붙임
  if (imageUrl.startsWith('/media/')) {
    return `${API_BASE}${imageUrl}`;
  }

  // 기타 경우는 그대로 반환
  return imageUrl;
};



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

const ChatBox = ({ selectedRoom, loginUser, loginLoading, checkLoginStatus, userSettings, setUserSettings, onUserMenuOpen, isSettingsModalOpen, setIsSettingsModalOpen, isLoginModalOpen, setIsLoginModalOpen, settingsTab, setSettingsTab, pendingImageFile, setPendingImageFile, highlightMessageId }) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const messageIdFromUrl = searchParams.get('messageId');
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

  // 상대방 메시지 랜덤 색상 관리
  const [senderColors, setSenderColors] = useState({});

  // 랜덤 색상 생성 함수
  const getRandomColor = () => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // 발신자별 색상 가져오기
  const getSenderColor = (sender) => {
    if (!sender || sender === loginUser?.username || sender === 'AI') {
      return null; // 내 메시지와 AI 메시지는 기본 색상 사용
    }

    if (!senderColors[sender]) {
      setSenderColors(prev => ({
        ...prev,
        [sender]: getRandomColor()
      }));
      return getRandomColor();
    }

    return senderColors[sender];
  };

  // 로그인 모달 상태

  // 사용자 메뉴 모달 상태
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

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

  // 메시지 강조 관련 상태 (제거됨)

  // MediaPipe 준비 상태
  const [isTrackingReady, setIsTrackingReady] = useState(false);
  const [isTrackingLoading, setIsTrackingLoading] = useState(true);

  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  const [chartViewMap, setChartViewMap] = useState({}); // 메시지별 차트뷰 상태

  const [hasMore, setHasMore] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);
  const [firstItemIndex, setFirstItemIndex] = useState(0); // 전체 메시지 중 현재 배열의 시작 인덱스
  const [totalCount, setTotalCount] = useState(0); // 전체 메시지 개수

  // 그룹 채팅방 참가자 목록 상태 (실시간 갱신)
  const [groupParticipants, setGroupParticipants] = useState([]);

  // WebRTC 관련 상태 추가
  const [localStream, setLocalStream] = useState(null);
  const [isLocalVideoEnabled, setIsLocalVideoEnabled] = useState(false);
  const [isLocalAudioEnabled, setIsLocalAudioEnabled] = useState(false);
  const [localVideoRef, setLocalVideoRef] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { userId: MediaStream }
  const [peerConnections, setPeerConnections] = useState({}); // { userId: RTCPeerConnection }

  // selectedRoom, loginUser를 useRef로 관리
  const selectedRoomRef = useRef(selectedRoom);
  const loginUserRef = useRef(loginUser);

  const navigate = useNavigate();

  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);
  useEffect(() => {
    loginUserRef.current = loginUser;
  }, [loginUser]);

  // 그룹 채팅방 입장 시 participants 초기화
  useEffect(() => {
    if (selectedRoom?.room_type === 'group') {
      if (selectedRoom.participants && Array.isArray(selectedRoom.participants)) {
        setGroupParticipants(selectedRoom.participants.slice(0, 4));
      } else {
        setGroupParticipants([]);
      }
    }
  }, [selectedRoom]);

  // selectedRoom이 바뀔 때마다 메시지 초기화
  useEffect(() => {
    setMessages([]);
  }, [selectedRoom?.id]);

  // 안전한 WebSocket 메시지 전송 함수
  const safeWebSocketSend = (message) => {
    if (!ws.current || ws.current.readyState !== 1) {
      console.warn('[WebSocket] 연결되지 않음, 메시지 전송 실패');
      return false;
    }

    try {
      ws.current.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[WebSocket] 메시지 전송 실패:', error);
      return false;
    }
  };

  // WebSocket 연결/해제 및 join/leave 관리
  useEffect(() => {
    if (!selectedRoom || !selectedRoom.id) return;

    // 기존 연결 해제
    if (ws.current) {
      try {
        if (ws.current.readyState === 1) {
          safeWebSocketSend({ type: 'leave_room', roomId: selectedRoomRef.current?.id });
        }
        ws.current.close();
      } catch (error) {
        console.error('[WebSocket] 기존 연결 해제 중 오류:', error);
      }
    }

    // 새 연결 생성
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    // 배포 환경에서는 포트 없이 wss://도메인/ws/chat/로 연결
    const wsUrl = isLocalhost ? `${protocol}//${host}:8000/ws/chat/` : `${protocol}//${host}/ws/chat/`;


    try {
      ws.current = new window.WebSocket(wsUrl);
    } catch (error) {
      console.error('[WebSocket] 연결 생성 실패:', error);
      return;
    }

    // join_room 메시지 전송을 readyState가 1(OPEN)일 때까지 반복 시도
    let joinSent = false;
    const joinInterval = setInterval(() => {
      if (ws.current && ws.current.readyState === 1 && !joinSent) {
        const joinMessage = { type: 'join_room', roomId: selectedRoom.id };
        if (safeWebSocketSend(joinMessage)) {
          joinSent = true;

          clearInterval(joinInterval);
        }
      }
    }, 500); // 500ms 간격으로 안전하게 처리

    ws.current.onopen = () => {


      // 연결 후 약간의 지연을 두고 join_room 메시지 전송
      setTimeout(() => {
        if (!joinSent && ws.current && ws.current.readyState === 1) {
          const joinMessage = { type: 'join_room', roomId: selectedRoom.id };
          if (safeWebSocketSend(joinMessage)) {
            joinSent = true;

          }
        }
      }, 200); // 100ms에서 200ms로 증가하여 더 안전하게 처리
    };
    ws.current.onmessage = (e) => {

      try {
        const data = JSON.parse(e.data);

        if (data.type === 'user_message' && data.message) {
          const isMyMessage = (data.sender === loginUserRef.current?.username) || (data.user_id === loginUserRef.current?.id);

          const newMessage = {
            id: Date.now(),
            type: isMyMessage ? 'send' : 'recv',
            text: data.message,
            date: data.timestamp,
            sender: data.sender,
            sender_type: 'user',
            user_id: data.user_id,
            emotion: data.emotion,
            imageUrl: data.imageUrl || null  // data.imageUrl 사용
          };

          setMessages((prev) => {
            let next;
            if (isMyMessage) {
              // echo 메시지라면 pending 메시지 제거
              next = [
                ...prev.filter(msg => !(msg.pending && msg.text === data.message)),
                newMessage
              ];

            } else {
              next = [...prev, newMessage];

            }
            return next;
          });
        } else if (data.type === 'ai_message' && data.message) {
          const newMessage = {
            id: Date.now(),
            type: 'recv',
            text: data.message,
            date: data.timestamp,
            sender: 'AI',
            sender_type: 'ai',
            questioner_username: data.questioner_username,
            ai_name: data.ai_name, // AI 이름 포함
            emotion: null,
            imageUrl: null
          };

          setMessages((prev) => {
            // 중복 메시지 방지: 동일 timestamp/text/questioner_username/ai_name이 이미 있으면 추가하지 않음
            if (prev.some(m => m.type === 'ai' && m.date === data.timestamp && m.text === data.message && m.questioner_username === data.questioner_username && m.ai_name === data.ai_name)) {
              return prev;
            }
            const newMsg = {
              id: data.id || `ai_${data.timestamp}`,
              type: 'ai',
              text: data.message,
              date: data.timestamp,
              sender: data.ai_name, // sender는 항상 ai_name
              ai_name: data.ai_name,
              questioner_username: data.questioner_username,
              pending: false,
            };
            const arr = [...prev, newMsg];

            return arr;
          });
          setCurrentAiMessage(data.message);
          setIsAiTalking(true);
          if (isTTSEnabled) {
            speakAIMessage(data.message);
          } else {
            setDisplayedAiText(data.message);
          }
          const aiEmotionResponse = getAIEmotionResponse(userEmotion, data.message);
          setAiEmotion(aiEmotionResponse.primary);
          setEmotionDisplay(prev => ({ ...prev, ai: aiEmotionResponse.primary }));
          setEmotionCaptureStatus(prev => ({ ...prev, ai: true }));
          setTimeout(() => {
            setAiEmotion('neutral');
            setEmotionDisplay(prev => ({ ...prev, ai: 'neutral' }));
            setEmotionCaptureStatus(prev => ({ ...prev, ai: false }));
          }, aiEmotionResponse.duration);
        }
        // 기타 message 타입에서는 setMessages를 호출하지 않음
      } catch (error) {
        console.error('WebSocket 메시지 처리 중 오류:', error);
      }
    };
    ws.current.onclose = () => {


      // 연결이 끊어지면 3초 후 재연결 시도 (단, 컴포넌트가 마운트된 상태일 때만)
      setTimeout(() => {
        if (selectedRoomRef.current?.id && ws.current) {

        }
      }, 3000);
    };
    ws.current.onerror = (error) => {
      console.error('[WebSocket] 연결 오류:', error);
    };
    // 방 나갈 때 leave_room 및 연결 해제
    return () => {
      clearInterval(joinInterval);
      if (ws.current) {
        try {
          if (ws.current.readyState === 1) {
            safeWebSocketSend({ type: 'leave_room', roomId: selectedRoomRef.current?.id });
          }
          ws.current.close();
        } catch (error) {
          console.error('[WebSocket] 연결 해제 중 오류:', error);
        }
      }
    };
  }, [selectedRoom?.id, loginUser?.username]);

  // 4명 미만이면 빈 자리 채우기
  const groupParticipantsDisplay = selectedRoom?.room_type === 'group'
    ? [...groupParticipants.slice(0, 4), ...Array(4 - groupParticipants.length).fill(null)].slice(0, 4)
    : [];

  // WebRTC 로컬 스트림 초기화
  const initializeLocalStream = async () => {
    try {

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);


      // 로컬 비디오 요소에 스트림 연결
      if (localVideoRef) {
        localVideoRef.srcObject = stream;
      }
    } catch (error) {
      console.error('로컬 스트림 초기화 실패:', error);
    }
  };

  // 로컬 비디오 on/off 토글
  const toggleLocalVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsLocalVideoEnabled(videoTrack.enabled);

      }
    }
  };

  // 로컬 오디오 on/off 토글
  const toggleLocalAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsLocalAudioEnabled(audioTrack.enabled);

      }
    }
  };

  // 그룹 채팅방 입장 시 로컬 스트림 초기화
  useEffect(() => {
    if (selectedRoom?.room_type === 'group') {
      initializeLocalStream();
    }
    return () => {
      // 컴포넌트 언마운트 시 스트림 정리
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      // PeerConnection 정리
      Object.values(peerConnections).forEach(pc => pc.close());
      setPeerConnections({});
      setRemoteStreams({});
    };
  }, [selectedRoom?.room_type]);

  // 로컬 스트림이 준비되면 기존 참가자들에게 Offer 전송
  useEffect(() => {
    if (selectedRoom?.room_type === 'group' && localStream && loginUser && groupParticipants.length > 0) {
      groupParticipants.forEach(participant => {
        if (participant.id !== loginUser.id && !peerConnections[participant.id]) {

          createAndSendOffer(participant.id);
        }
      });
    }
  }, [localStream, groupParticipants, loginUser, selectedRoom?.room_type]);

  // 로컬 비디오 ref 설정
  const setLocalVideoRefHandler = (el) => {
    setLocalVideoRef(el);
    if (el && localStream) {
      el.srcObject = localStream;
    }
  };

  // WebRTC 시그널링 처리
  const handleWebRTCSignaling = (data) => {
    const { type, senderUser, targetUser, data: signalData, candidate, sdp } = data;

    if (type === 'offer') {
      handleOffer(senderUser, sdp);
    } else if (type === 'answer') {
      handleAnswer(senderUser, sdp);
    } else if (type === 'candidate') {
      handleCandidate(senderUser, candidate);
    }
  };

  // Offer 처리
  const handleOffer = async (senderUser, sdp) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // 로컬 스트림 추가
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }

      // 원격 스트림 처리
      pc.ontrack = (event) => {
        setRemoteStreams(prev => ({
          ...prev,
          [senderUser]: event.streams[0]
        }));
      };

      // ICE candidate 처리
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          ws.current.send(JSON.stringify({
            type: 'candidate',
            senderUser: loginUser?.id,
            targetUser: senderUser,
            candidate: event.candidate
          }));
        }
      };

      // Offer 설정
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Answer 전송
      ws.current.send(JSON.stringify({
        type: 'answer',
        senderUser: loginUser?.id,
        targetUser: senderUser,
        sdp: answer.sdp
      }));

      setPeerConnections(prev => ({
        ...prev,
        [senderUser]: pc
      }));

    } catch (error) {
      console.error('Offer 처리 실패:', error);
    }
  };

  // Answer 처리
  const handleAnswer = async (senderUser, sdp) => {
    try {
      const pc = peerConnections[senderUser];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
      }
    } catch (error) {
      console.error('Answer 처리 실패:', error);
    }
  };

  // ICE Candidate 처리
  const handleCandidate = async (senderUser, candidate) => {
    try {
      const pc = peerConnections[senderUser];
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('ICE Candidate 처리 실패:', error);
    }
  };

  // Offer 생성 및 전송
  const createAndSendOffer = async (targetUser) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // 로컬 스트림 추가
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }

      // 원격 스트림 처리
      pc.ontrack = (event) => {
        setRemoteStreams(prev => ({
          ...prev,
          [targetUser]: event.streams[0]
        }));
      };

      // ICE candidate 처리
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          ws.current.send(JSON.stringify({
            type: 'candidate',
            senderUser: loginUser?.id,
            targetUser: targetUser,
            candidate: event.candidate
          }));
        }
      };

      // Offer 생성
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Offer 전송
      ws.current.send(JSON.stringify({
        type: 'offer',
        senderUser: loginUser?.id,
        targetUser: targetUser,
        sdp: offer.sdp
      }));

      setPeerConnections(prev => ({
        ...prev,
        [targetUser]: pc
      }));

    } catch (error) {
      console.error('Offer 생성 실패:', error);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // // 모바일 브라우저에서 실제 보이는 영역의 높이로 --real-vh CSS 변수 설정
  // useEffect(() => {
  //   function setRealVh() {
  //     const vh = window.visualViewport
  //       ? window.visualViewport.height * 0.01
  //       : window.innerHeight * 0.01;
  //     document.documentElement.style.setProperty('--real-vh', `${vh}px`);
  //   }
  //   window.addEventListener('resize', setRealVh);
  //   window.addEventListener('orientationchange', setRealVh);
  //   if (window.visualViewport) {
  //     window.visualViewport.addEventListener('resize', setRealVh);
  //     window.visualViewport.addEventListener('scroll', setRealVh);
  //   }
  //   setRealVh();
  //   return () => {
  //     window.removeEventListener('resize', setRealVh);
  //     window.removeEventListener('orientationchange', setRealVh);
  //     if (window.visualViewport) {
  //       window.visualViewport.removeEventListener('resize', setRealVh);
  //       window.visualViewport.removeEventListener('scroll', setRealVh);
  //     }
  //   };
  // }, []);

  // 컴포넌트 마운트 시 실행
  useEffect(() => {


    // WebSocket 연결
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const wsUrl = isLocalhost ? `${protocol}//${host}:8000/ws/chat/` : `${protocol}//${host}/ws/chat/`;


    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {

    };

    ws.current.onclose = () => {

    };

    ws.current.onerror = (error) => {
      console.error('WebSocket 연결 오류:', error);
    };

    // WebSocket 메시지 수신 처리 (재연결 시에도 동일하게)
    ws.current.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const username = loginUserRef.current?.username;
        const userId = loginUserRef.current?.id;
        if (data.type === 'user_message' && data.message) {
          const isMyMessage = (data.sender === username) || (data.user_id === userId);
          // 서버 echo 메시지에 client_id가 있으면, 해당 pending 메시지 제거
          setMessages((prev) => {
            let arr = prev;
            // 1. client_id로 매칭 제거(가장 정확)
            if (data.client_id) {
              arr = arr.filter(
                (msg) => !(msg.pending && msg.client_id === data.client_id)
              );
            } else {
              // 2. fallback: text+timestamp+sender로 매칭
              arr = arr.filter(
                (msg) =>
                  !(
                    msg.pending &&
                    msg.text === data.message &&
                    msg.sender === data.sender &&
                    Math.abs(new Date(msg.date).getTime() - new Date(data.timestamp).getTime()) < 2000
                  )
              );
            }
            // 서버 메시지 추가
            const newMsg = {
              id: data.id || `${data.sender}_${data.timestamp}`,
              type: isMyMessage ? 'send' : 'recv',
              text: data.message,
              date: data.timestamp,
              sender: data.sender,
              user_id: data.user_id,
              pending: false,
            };
            const result = [...arr, newMsg];

            return result;
          });
        } else if (data.type === 'ai_message' && data.message) {
          setMessages((prev) => {
            // 중복 메시지 방지: 동일 timestamp/text/questioner_username/ai_name이 이미 있으면 추가하지 않음
            if (prev.some(m => m.type === 'ai' && m.date === data.timestamp && m.text === data.message && m.questioner_username === data.questioner_username && m.ai_name === data.ai_name)) {
              return prev;
            }
            const newMsg = {
              id: data.id || `ai_${data.timestamp}`,
              type: 'ai',
              text: data.message,
              date: data.timestamp,
              sender: data.ai_name, // sender는 항상 ai_name
              ai_name: data.ai_name,
              questioner_username: data.questioner_username,
              pending: false,
            };
            const arr = [...prev, newMsg];

            return arr;
          });
        }
      } catch (err) {
        console.error('[WebSocket onmessage] 파싱 오류:', err, e.data);
      }
    };

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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const wsUrl = isLocalhost ? `${protocol}//${host}:8000/ws/chat/` : `${protocol}//${host}/ws/chat/`;


    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {

    };

    ws.current.onclose = () => {

    };

    ws.current.onerror = (error) => {
      console.error('WebSocket 연결 오류:', error);
    };

    // WebSocket 메시지 수신 처리 (재연결 시에도 동일하게)
    ws.current.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        const username = loginUserRef.current?.username;
        const userId = loginUserRef.current?.id;
        if (data.type === 'user_message' && data.message) {
          const isMyMessage = (data.sender === username) || (data.user_id === userId);

          const newMessage = {
            id: Date.now(),
            type: isMyMessage ? 'send' : 'recv',
            text: data.message,
            date: data.timestamp,
            sender: data.sender,
            sender_type: 'user',
            user_id: data.user_id,
            emotion: data.emotion,
            imageUrl: data.imageUrl || null  // data.imageUrl 사용
          };

          setMessages((prev) => {
            let next;
            if (isMyMessage) {
              // echo 메시지라면 pending 메시지 제거
              next = [
                ...prev.filter(msg => !(msg.pending && msg.text === data.message)),
                newMessage
              ];

            } else {
              next = [...prev, newMessage];

            }
            return next;
          });
        } else if (data.type === 'ai_message' && data.message) {
          const newMessage = {
            id: Date.now(),
            type: 'recv',
            text: data.message,
            date: data.timestamp,
            sender: 'AI',
            sender_type: 'ai',
            questioner_username: data.questioner_username,
            ai_name: data.ai_name, // AI 이름 포함
            emotion: null,
            imageUrl: null
          };
          setMessages((prev) => {
            // 중복 메시지 방지: 동일 timestamp/text/questioner_username/ai_name이 이미 있으면 추가하지 않음
            if (prev.some(m => m.type === 'ai' && m.date === data.timestamp && m.text === data.message && m.questioner_username === data.questioner_username && m.ai_name === data.ai_name)) {
              return prev;
            }
            const newMsg = {
              id: data.id || `ai_${data.timestamp}`,
              type: 'ai',
              text: data.message,
              date: data.timestamp,
              sender: data.ai_name, // sender는 항상 ai_name
              ai_name: data.ai_name,
              questioner_username: data.questioner_username,
              pending: false,
            };
            const arr = [...prev, newMsg];

            return arr;
          });
          setCurrentAiMessage(data.message);
          setIsAiTalking(true);
          if (isTTSEnabled) {
            speakAIMessage(data.message);
          } else {
            setDisplayedAiText(data.message);
          }
          const aiEmotionResponse = getAIEmotionResponse(userEmotion, data.message);
          setAiEmotion(aiEmotionResponse.primary);
          setEmotionDisplay(prev => ({ ...prev, ai: aiEmotionResponse.primary }));
          setEmotionCaptureStatus(prev => ({ ...prev, ai: true }));
          setTimeout(() => {
            setAiEmotion('neutral');
            setEmotionDisplay(prev => ({ ...prev, ai: 'neutral' }));
            setEmotionCaptureStatus(prev => ({ ...prev, ai: false }));
          }, aiEmotionResponse.duration);
        }
        // 기타 message 타입에서는 setMessages를 호출하지 않음
      } catch (error) {
        console.error('WebSocket 메시지 처리 중 오류:', error);
      }
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
      // 
      setIsAiTalking(true);
      setTtsSpeaking(true);

      // 립싱크 시퀀스 저장 및 초기화
      if (lipSyncSequence && lipSyncSequence.length > 0) {
        setLipSyncSequence(lipSyncSequence);
        setCurrentLipSyncIndex(0);

      } else {
        setLipSyncSequence([]);
        setCurrentLipSyncIndex(0);
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
      // 음성 목록이 준비되지 않았으면 대기
      if (!voiceList || voiceList.length === 0) {

        return;
      }
      // TTS용 텍스트 정리 (이모티콘, 특수문자 제거)
      const cleanedMessage = ttsService.cleanTextForTTS(message);
      if (!cleanedMessage) {

        return;
      }


      setTtsSpeaking(true); // 립싱크 강제 시작

      if (isTTSEnabled && ttsVoice && message) {

        await ttsService.speak(message, { voice: ttsVoice, rate: ttsRate, pitch: ttsPitch });
      }
    } catch (error) {
      console.error('TTS 재생 실패:', error);
    }
  };

  // 3. 고급 립싱크 시스템 (음소 기반)
  useEffect(() => {


    if (ttsSpeaking && lipSyncSequence.length > 0) {


      // 음소 기반 립싱크
      const totalDuration = lipSyncSequence[lipSyncSequence.length - 1]?.endTime || 5000; // 기본 5초
      const startTime = Date.now();



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

        }
      }, 50); // 50ms 간격으로 더 빠르게 업데이트

      setLipSyncInterval(interval);
      return () => {
        if (interval) clearInterval(interval);
      };
    } else if (ttsSpeaking) {

      const baseInterval = 200;
      const rateMultiplier = ttsRate || 1.0;
      const lipSyncInterval = Math.max(100, Math.min(400, baseInterval / rateMultiplier));


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


    } catch (error) {
      console.error('TTS 서비스 초기화 실패:', error);
    }
  };

  // 음성 설정 상태 확인을 위한 useEffect
  useEffect(() => {
    if (ttsVoice) {

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
  // 파일 존재 여부 확인
  const checkFileExists = async (relPath) => {
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/chat/file_exists/?path=${relPath}`);
      const data = await res.json();
      return data.exists;
    } catch (e) {
      console.warn('파일 존재 확인 중 오류:', e);
      return false;
    }
  };

  const listMediaFiles = async () => {
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/chat/list_media_files/`);
      const data = await res.json();
      return data.files;
    } catch (e) {
      console.warn('미디어 파일 목록 조회 중 오류:', e);
      return [];
    }
  };

  // 아바타 초기화
  const initializeAvatars = async () => {
    try {
      const userAvatarUrl = `/avatar_vrm/gb_m_v2.vrm`;
      // let userAvatarUrl = `/avatar_vrm_test/test.vrm`;
      // const userAvatarUrl_ex = `avatar_vrm_test/test.vrm`;      

      // const exists_user = await checkFileExists(userAvatarUrl_ex);
      // console.log('userAvatarUrl_exists', exists_user);

      // if (exists_user) {
      //   console.log('userAvatarUrl', userAvatarUrl);
      ;
      let aiAvatarUrl = `/avatar_vrm/gb_f_v2.vrm`;
      // let aiAvatarUrl_ex = `avatar_vrm/gb_f_v2.vrm`;
      // const exists_ai = await checkFileExists(aiAvatarUrl);
      // console.log('exists_ai_exists', exists_ai);

      // fetch('/media/avatar_vrm_test/test.vrm', { credentials: 'include' })
      // .then(res => {        
      //   return res.text();
      // })
      // .then(text => console.log('body', text));

      const testPath = '/uploads/test.vrm';  // 슬래시 없이
      const exists = await checkFileExists(testPath);
      // console.log('exists_test_model', exists);

      if (exists) {
        aiAvatarUrl = `/media${testPath}`;
      }

      setUserAvatar(userAvatarUrl);
      setAiAvatar(aiAvatarUrl);

      // 미디어 파일 목록 조회
      // const mediaFiles = await listMediaFiles();
      // console.log('mediaFiles', mediaFiles);

    } catch (error) {
      console.error('아바타 초기화 실패:', error);
    }
  };

  // 감정 분석 (더 정교한 키워드 기반)
  const analyzeEmotion = (text) => {
    // text가 undefined, null, 또는 빈 문자열인 경우 처리
    if (!text || typeof text !== 'string') {
      return 'neutral';
    }

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

    // AI 메시지 내용도 고려하여 감정 조정 (안전하게 처리)
    if (aiMessage && typeof aiMessage === 'string') {
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
        emotion: emotion,
        roomId: selectedRoom?.id || null
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

  };

  // 실시간 모드 토글 핸들러
  const toggleRealTimeMode = () => {
    setIsRealTimeMode(!isRealTimeMode);
  };

  // 음성인식 결과 처리
  const handleVoiceResult = (finalText) => {


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

      } else {
        // MediaPipe 준비 상태 확인
        if (!faceTrackingService.isReady) {

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


      // 모바일 브라우저 감지
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());


      // navigator.permissions API 지원 확인
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permission = await navigator.permissions.query({ name: 'microphone' });
          setPermissionStatus(permission.state);




          if (permission.state === 'denied') {

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

      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // 

      // 스트림 즉시 중지
      stream.getTracks().forEach(track => {
        track.stop();

      });

      setPermissionStatus('granted');
      return true;

    } catch (error) {
      console.error('마이크 권한 요청 실패:', error);
      console.error('오류 이름:', error.name);
      console.error('오류 메시지:', error.message);

      setPermissionStatus('denied');

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('마이크 권한이 거부되었습니다.\n\n브라우저 설정에서 마이크 권한을 허용해주세요.');
        return false;
      }

      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        alert('마이크 장치를 찾을 수 없습니다.\n\n마이크가 연결되어 있는지 확인해주세요.');
        return false;
      }

      if (error.name === 'NotSupportedError' || error.name === 'ConstraintNotSatisfiedError') {
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

  // 이미지 업로드 후 전송 (파일 직접 전달)
  const handleImageUploadAndSendWithFile = async (imageFile, messageText) => {
    if (!imageFile || !ws.current || ws.current.readyState !== 1) return;
    // input에는 절대 의존하지 않고, 오직 messageText만 사용
    const finalMessageText = messageText || '이미지 첨부';
    try {
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('content', finalMessageText);
      const res = await axios.post(`${API_BASE}/api/chat/upload_image/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-CSRFToken': getCookie('csrftoken'),
        },
        withCredentials: true,
      });
      if (res.data.status === 'success') {
        const messageData = {
          message: finalMessageText,
          imageUrl: res.data.file_url,
          roomId: selectedRoom?.id || null
        };

        ws.current.send(JSON.stringify(messageData));
        setInput('');
        setAttachedImage(null);
        setAttachedImagePreview(null);
        setTimeout(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
          }
        }, 0);
      }
    } catch (error) {
      console.error('이미지 업로드 실패:', error);
      alert('이미지 업로드에 실패했습니다.');
    }
  };

  // 이미지 업로드 후 전송 (기존 함수 - attachedImage 사용)
  const handleImageUploadAndSend = async () => {
    if (!attachedImage || !ws.current || ws.current.readyState !== 1) return;

    // 입력된 텍스트를 미리 저장 (초기화 전에)
    const messageText = input || '이미지 첨부';

    try {
      // FormData로 이미지 업로드
      const formData = new FormData();
      formData.append('file', attachedImage);
      formData.append('content', messageText);

      const res = await axios.post(`${API_BASE}/api/chat/upload_image/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-CSRFToken': getCookie('csrftoken'),
        },
        withCredentials: true,
      });

      if (res.data.status === 'success') {
        const messageData = {
          message: messageText,
          imageUrl: res.data.file_url,
          roomId: selectedRoom?.id || null
        };


        ws.current.send(JSON.stringify(messageData));

        // 입력 상태 초기화 (WebSocket 전송 후)
        setInput('');
        setAttachedImage(null);
        setAttachedImagePreview(null);

        setTimeout(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
          }
        }, 0);
      }
    } catch (error) {
      console.error('이미지 업로드 실패:', error);
      alert('이미지 업로드에 실패했습니다.');
    }
  };

  // 메시지 전송 함수
  const sendMessage = async (messageText = null) => {
    const textToSend = messageText || input;
    if (!textToSend.trim()) return;

    if (!ws.current || ws.current.readyState !== 1) {
      console.warn('[sendMessage] WebSocket이 연결되지 않음. 상태:', ws.current?.readyState);
      alert('연결이 끊어졌습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const clientId = `${Date.now()}_${Math.random()}`;
    const messageData = {
      message: textToSend,
      roomId: selectedRoom?.id || null,
      client_id: clientId, // 클라이언트 고유 식별자
    };


    if (!safeWebSocketSend(messageData)) {
      console.error('[sendMessage] 메시지 전송 실패');
      return;
    }
    // 내 메시지 로컬에 즉시 추가 (pending 플래그, client_id 포함)
    setMessages((prev) => {
      const newMsg = {
        id: clientId,
        type: 'send',
        text: textToSend,
        date: new Date().toISOString(),
        sender: loginUserRef.current?.username,
        user_id: loginUserRef.current?.id,
        pending: true,
        client_id: clientId,
      };
      const arr = [...prev, newMsg];

      return arr;
    });
    setInput('');
    let newMessageId = null;
    try {
      // 1. 메시지(Chat) 전송
      const res = await csrfFetch(`${getApiBase()}/api/chat/messages/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: selectedRoom?.id,
          content: textToSend,
          sender_type: 'user',
          message_type: 'text',
          username: loginUser?.username,
          user_id: loginUser?.id,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '메시지 전송 실패');
      newMessageId = data.id;
      // 2. replyTo가 있으면 MessageReply 생성
      if (replyTo && newMessageId) {
        const replyRes = await fetch('/api/replies/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            original_message: replyTo.id,
            reply_message: newMessageId
          })
        });
        if (!replyRes.ok) {
          alert('답장 정보 저장에 실패했습니다.');
        }
      }
      setReplyTo(null); // 전송 후 답장 상태 초기화
      setInput('');
    } catch (e) {
      alert('메시지 전송 중 오류: ' + e.message);
    }

    // AI 자동 응답 처리
    if (aiService.isAutoRespondEnabled()) {
      generateAIResponse(textToSend);
    }
  };

  // AI 응답 생성 함수
  const generateAIResponse = async (userMessage) => {
    try {
      // AI 응답 생성 중임을 표시
      const aiTypingMessage = {
        id: `ai_typing_${Date.now()}`,
        type: 'ai_typing',
        text: '🤖 AI가 응답을 생성하고 있습니다...',
        date: new Date().toISOString(),
        sender: 'AI Assistant',
        pending: true
      };

      setMessages(prev => [...prev, aiTypingMessage]);

      // AI 응답 생성
      const aiResponse = await aiService.generateResponseWithDelay(userMessage);

      // 타이핑 메시지 제거
      setMessages(prev => prev.filter(msg => msg.id !== aiTypingMessage.id));

      // AI 응답 메시지 추가
      const aiMessage = {
        id: `ai_${Date.now()}`,
        type: 'ai',
        text: aiResponse.text,
        date: new Date().toISOString(),
        sender: 'AI Assistant',
        model: aiResponse.model,
        processingTime: aiResponse.processingTime
      };

      setMessages(prev => [...prev, aiMessage]);

      // AI 응답을 서버에 저장
      try {
        await csrfFetch(`${getApiBase()}/api/chat/messages/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: selectedRoom?.id,
            content: aiResponse.text,
            sender_type: 'ai',
            message_type: 'text',
            username: 'AI Assistant',
            user_id: null,
            ai_model: aiResponse.model,
            processing_time: aiResponse.processingTime
          }),
          credentials: 'include',
        });
      } catch (e) {
        console.error('AI 응답 서버 저장 실패:', e);
      }

      // TTS로 AI 응답 읽기 (설정에 따라)
      if (userSettings?.tts_enabled && aiResponse.text) {
        speakAIMessage(aiResponse.text);
      }

    } catch (error) {
      console.error('AI 응답 생성 실패:', error);

      // 에러 메시지 표시
      const errorMessage = {
        id: `ai_error_${Date.now()}`,
        type: 'ai_error',
        text: `AI 응답 생성에 실패했습니다: ${error.message}`,
        date: new Date().toISOString(),
        sender: 'AI Assistant',
        error: true
      };

      setMessages(prev => {
        // 타이핑 메시지 제거
        const filtered = prev.filter(msg => msg.id !== `ai_typing_${Date.now()}`);
        return [...filtered, errorMessage];
      });
    }
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

      ttsService.stop();
      // 브라우저의 speechSynthesis도 직접 중지
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {

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
        blocks.push({ type: 'text', value: text.slice(lastIndex, m.index) });
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
      blocks.push({ type: 'text', value: text.slice(lastIndex) });
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

      }
    } catch (e) {
      console.log('JSON parse error:', e);
    }

    // JSON 파싱이 성공하고 차트 데이터가 있으면 차트 후보로 인식


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

  // 로그인 성공 postMessage 수신 시 모달 닫고 새로고침
  useEffect(() => {
    const handleLoginSuccess = (event) => {
      if (event.data === 'login_success' || event.data === 'connection_success') {
        setIsLoginModalOpen(false);
        setTimeout(() => window.location.reload(), 100);
      }
    };
    window.addEventListener('message', handleLoginSuccess);
    return () => window.removeEventListener('message', handleLoginSuccess);
  }, []);

  // AI 서비스 초기화
  useEffect(() => {
    if (userSettings) {
      try {
        // AI 설정이 저장되어 있으면 로드
        let aiSettings = {
          aiEnabled: !!userSettings.ai_response_enabled,
          aiProvider: 'lily',
          lilyApiUrl: 'http://localhost:8001',
          lilyModel: 'polyglot-ko-1.3b-chat',
          chatgptApiKey: '',
          geminiApiKey: '',
          autoRespond: false,
          responseDelay: 1000,
          maxTokens: 1000,
          temperature: 0.7
        };

        // 저장된 AI 설정이 있으면 파싱
        if (userSettings.ai_settings) {
          try {
            const savedSettings = JSON.parse(userSettings.ai_settings);
            aiSettings = { ...aiSettings, ...savedSettings };
          } catch (e) {
            console.error('AI 설정 파싱 실패:', e);
          }
        }

        // AI 서비스 초기화
        aiService.initialize(aiSettings);
        console.log('🤖 AI 서비스 초기화 완료:', aiSettings);
      } catch (error) {
        console.error('AI 서비스 초기화 실패:', error);
      }
    }
  }, [userSettings]);

  // 소셜 로그인 팝업 오픈 함수 (최상위에서 정의)
  const openSocialLoginPopup = (url) => {
    const popupWidth = 480;
    const popupHeight = 600;
    const left = window.screenX + (window.outerWidth - popupWidth) / 2;
    const top = window.screenY + (window.outerHeight - popupHeight) / 2;
    window.open(
      url,
      'social_login_popup',
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );
  };

  const buttonStyle = {
    marginLeft: 12,
    background: 'rgba(255,255,255,0.12)',
    border: 'none',
    borderRadius: 4,
    padding: '6px 12px',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    textDecoration: 'none',
    cursor: 'pointer',
    minWidth: 100,
    justifyContent: 'center',
  };

  // 메시지 불러오기 함수
  const fetchMessages = async (roomId, offset = 0, limit = 20, isPrepending = false, isInit = false, scrollToId = null) => {
    // 연속성 체크 및 fallback 전체 reload 로직
    const reloadWindow = async (reloadOffset, reloadLimit) => {
      console.warn('[슬라이딩윈도우:fallback] 전체 reload 시도 - offset:', reloadOffset, 'limit:', reloadLimit);
      setLoadingMessages(true);
      try {
        const response = await fetch(`/api/chat/messages/messages/?room=${selectedRoom.id}&limit=${reloadLimit}&offset=${reloadOffset}`);
        const data = await response.json();
        setMessages(data.results);
        setFirstItemIndex(reloadOffset);
        setMessageOffset(reloadOffset);
        setTotalCount(data.count || 0);
        setLoadingMessages(false);
      } catch (err) {
        setLoadingMessages(false);
        console.error('[슬라이딩윈도우:fallback] 전체 reload 실패', err);
      }
    };

    if (loadingMessages) {
      return;
    }

    setLoadingMessages(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat/messages/messages/?room=${roomId}&limit=${limit}&offset=${offset}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setTotalCount(data.count || 0);
        // setHasMore(data.has_more); // 제거: hasMore는 동적으로 계산됨        

        // 특정 메시지 찾아가기 디버깅
        // if (scrollToId) {
        //   console.log('[특정 메시지 찾아가기] 로딩된 메시지들:', data.results.map(m => m.id));
        //   console.log('[특정 메시지 찾아가기] 찾을 메시지 ID:', scrollToId);
        //   console.log('[특정 메시지 찾아가기] 찾을 메시지가 로딩된 목록에 포함됨:', data.results.some(m => m.id == scrollToId));
        // }

        // 중복 제거 로직을 실제 메시지 ID 기반으로 변경
        let uniqueNewMessages = data.results;

        // 초기 로딩이 아닐 때만 중복 제거 수행
        if (!isInit) {
          const existingIds = new Set(messages.map(m => m.id));
          uniqueNewMessages = data.results.filter(msg => !existingIds.has(msg.id));

          // if (uniqueNewMessages.length === 0) {
          //   console.log('[중복 제거] 모든 메시지가 중복 - 기존 ID 개수:', existingIds.size, '새 메시지 개수:', data.results.length);
          // } else {
          //   console.log('[중복 제거] 중복 제거 완료 - 기존 ID 개수:', existingIds.size, '새 메시지 개수:', data.results.length, '고유 메시지 개수:', uniqueNewMessages.length);
          // }
        }

        if (uniqueNewMessages.length === 0) {
          // console.log('[fetchMessages] 새로운 메시지가 없으므로 스킵');
          return;
        }

        if (isPrepending) {
          // 연속성 체크 및 fallback 전체 reload 로직
          const reloadWindow = async (reloadOffset, reloadLimit) => {
            setLoadingMessages(true);
            try {
              const response = await fetch(`/api/chat/messages/messages/?room=${selectedRoom.id}&limit=${reloadLimit}&offset=${reloadOffset}`);
              const data = await response.json();
              setMessages(data.results);
              setFirstItemIndex(reloadOffset);
              setMessageOffset(reloadOffset);
              setTotalCount(data.count || 0);
              setLoadingMessages(false);
            } catch (err) {
              setLoadingMessages(false);
            }
          };

          // 연속성 체크: 기존 첫 메시지 date와 새 메시지 마지막 date가 연속되는지
          const prevFirstDate = messages[0]?.timestamp || messages[0]?.date;
          const newLastDate = uniqueNewMessages[uniqueNewMessages.length - 1]?.timestamp || uniqueNewMessages[uniqueNewMessages.length - 1]?.date;
          if (prevFirstDate && newLastDate && prevFirstDate !== newLastDate && !scrollToMessageId && messages.length > 0) {
            // 더 관대한 연속성 체크: timestamp가 완전히 동일하지 않아도 허용
            const timeDiff = Math.abs(new Date(prevFirstDate) - new Date(newLastDate));
            if (timeDiff > 60000) { // 1분 이상 차이나는 경우에만 연속성 오류로 판단
              console.warn('[슬라이딩윈도우:prepend] 연속성 오류! prevFirstDate:', prevFirstDate, 'newLastDate:', newLastDate, '→ 전체 reload');
              reloadWindow(offset, 40);
              return;
            }
          }
          setMessages(prev => {
            const newArr = [...uniqueNewMessages, ...prev];
            const sliced = newArr.slice(0, 40); // 앞쪽 40개만 유지
            setFirstItemIndex(offset);
            setMessageOffset(offset);
            return sliced;
          });
        } else {
          // 연속성 체크: 기존 마지막 메시지 date와 새 메시지 첫 date가 연속되는지
          const prevLastDate = messages[messages.length - 1]?.timestamp || messages[messages.length - 1]?.date;
          const newFirstDate = uniqueNewMessages[0]?.timestamp || uniqueNewMessages[0]?.date;
          if (prevLastDate && newFirstDate && prevLastDate !== newFirstDate && !scrollToMessageId && messages.length > 0) {
            // 더 관대한 연속성 체크: timestamp가 완전히 동일하지 않아도 허용
            const timeDiff = Math.abs(new Date(prevLastDate) - new Date(newFirstDate));
            if (timeDiff > 60000) { // 1분 이상 차이나는 경우에만 연속성 오류로 판단
              console.warn('[슬라이딩윈도우:append] 연속성 오류! prevLastDate:', prevLastDate, 'newFirstDate:', newFirstDate, '→ 전체 reload');
              reloadWindow(offset, 40);
              return;
            }
          }
          setMessages(prev => {
            const newArr = [...prev, ...uniqueNewMessages];
            const sliced = newArr.slice(-40); // 뒤쪽 40개만 유지
            setFirstItemIndex(offset);
            setMessageOffset(offset);
            return sliced;
          });
        }
        if (scrollToId) {
          // setScrollToMessageId(scrollToId); // 제거
          // console.log('[특정 메시지 이동] scrollToMessageId 설정:', scrollToId);
        }
      }
    } catch (error) {
      console.error('[fetchMessages] 오류:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // 대화방이 바뀔 때마다 메시지 초기화 및 불러오기
  useEffect(() => {
    if (selectedRoom && selectedRoom.id) {
      setMessages([]);
      setMessageOffset(0);
      setHasMore(true);
      setFirstItemIndex(0);
      setTotalCount(0);
      setScrollToMessageId(null);
      // (1) messageId가 있으면 해당 메시지가 포함된 페이지로 fetch
      if (messageIdFromUrl) {
        fetchOffsetForMessageId(selectedRoom.id, messageIdFromUrl);
      } else {
        // (2) 일반 입장: 전체 개수 fetch 후 최신 20개 fetch
        fetchTotalCountAndFetchLatest(selectedRoom.id);
      }
      // ... WebSocket join_room 등 기존 코드 유지 ...
    }
  }, [selectedRoom, messageIdFromUrl]);

  // messages가 바뀔 때마다 firstItemIndex와 messages.length의 관계 확인 및 동기화
  useEffect(() => {
    if (messages.length > 0) {
      // Virtuoso의 startReached 조건 확인
      const canScrollUp = firstItemIndex > 0;
      const canScrollDown = firstItemIndex + messages.length < totalCount;
      const newHasMore = canScrollUp || canScrollDown;

      // hasMore 상태를 동적으로 업데이트
      if (newHasMore !== hasMore) {
        setHasMore(newHasMore);
      }
    }
  }, [messages, firstItemIndex, totalCount, hasMore]);

  // (2) 전체 메시지 개수 fetch 후 최신 20개 fetch
  const fetchTotalCountAndFetchLatest = async (roomId) => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/messages/messages/?room=${roomId}&limit=1&offset=0`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const total = data.count || 0;
        setTotalCount(total);
        const offset = Math.max(0, total - 20);
        fetchMessages(roomId, offset, 20, false, true);
        setFirstItemIndex(offset);
        setMessageOffset(offset);
      }
    } catch (e) {
      fetchMessages(roomId, 0, 20, false, true);
      setFirstItemIndex(0);
      setMessageOffset(0);
    }
  };

  // (3) messageId로 offset을 계산해서 fetch하는 함수 (슬라이딩 윈도우 40개 유지)
  const fetchOffsetForMessageId = async (roomId, messageId) => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/messages/offset/?room=${roomId}&messageId=${messageId}&page_size=40`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();

        // 백엔드에서 이미 윈도우 중앙에 위치하도록 offset을 계산해줬으므로 그대로 사용
        const offset = data.offset;
        setIsJumpingToMessage(true); // 특정 메시지 찾아가기 모드 진입
        fetchMessages(roomId, offset, 40, false, true, messageId);
        setFirstItemIndex(offset);
        setMessageOffset(offset);
      } else {
        console.error('[특정 메시지 이동] API 오류:', res.status);
        setIsJumpingToMessage(true);
        fetchMessages(roomId, 0, 40, false, true, messageId);
        setFirstItemIndex(0);
        setMessageOffset(0);
      }
    } catch (error) {
      console.error('[특정 메시지 이동] 네트워크 오류:', error);
      setIsJumpingToMessage(true);
      fetchMessages(roomId, 0, 40, false, true, messageId);
      setFirstItemIndex(0);
      setMessageOffset(0);
    }
  };

  // 메시지 강조 처리 (제거됨)

  // 기존 스크롤 이벤트 리스너 제거 (Virtuoso가 처리함)

  // userSettings가 바뀔 때마다 각 상태에 자동 반영
  useEffect(() => {
    if (!userSettings) return;
    if (userSettings.tts_enabled !== undefined) setIsTTSEnabled(userSettings.tts_enabled);
    if (userSettings.tts_voice !== undefined) setTtsVoice(userSettings.tts_voice);
    if (userSettings.tts_speed !== undefined) setTtsRate(userSettings.tts_speed);
    if (userSettings.tts_pitch !== undefined) setTtsPitch(userSettings.tts_pitch);
    if (userSettings.voice_recognition_enabled !== undefined) setIsVoiceRecognitionEnabled(userSettings.voice_recognition_enabled);
    if (userSettings.auto_send_enabled !== undefined) setAutoSend(userSettings.auto_send_enabled);
    if (userSettings.camera_enabled !== undefined) setIsCameraActive(userSettings.camera_enabled);
    if (userSettings.user_avatar_enabled !== undefined) setIsUserAvatarOn(userSettings.user_avatar_enabled);
    if (userSettings.ai_avatar_enabled !== undefined) setIsAiAvatarOn(userSettings.ai_avatar_enabled);
    // ... 필요시 추가 ...
  }, [userSettings]);

  // useEffect로 AI 메시지 수신 시 TTS 실행
  useEffect(() => {

    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.type === 'ai') {

      speakAIMessage(lastMsg.text);
    }
  }, [messages]);

  // pendingImageFile이 변경될 때 이미지 업로드 처리
  useEffect(() => {
    if (pendingImageFile && selectedRoom) {

      setAttachedImage(pendingImageFile);
      setAttachedImagePreview(URL.createObjectURL(pendingImageFile));
      setPendingImageFile(null);
      // 자동 전송 제거: 버튼 클릭 시점에서만 전송
    }
  }, [pendingImageFile, selectedRoom]);

  // 햄버거 메뉴 상태
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 메뉴 바깥 클릭 시 닫기
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClick = (e) => {
      if (!e.target.closest('.chat-floating-menu')) setIsMenuOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [isMenuOpen]);

  // 1. 상태 추가
  const [replyTo, setReplyTo] = useState(null);

  const [showRoomSettings, setShowRoomSettings] = useState(false);

  // isRoomOwner: 현재 로그인 유저가 방장인지 판별
  const isRoomOwner = useMemo(() => {
    if (!selectedRoom || !selectedRoom.participants || !loginUser) return false;
    return selectedRoom.participants.some(
      p => p.user?.id === loginUser.id && p.is_owner
    );
  }, [selectedRoom, loginUser]);

  // 방 정보 갱신 핸들러
  const handleRoomSettingsSuccess = (updatedRoom) => {
    // selectedRoom을 갱신하거나, 필요시 fetchRooms 등 호출
    if (updatedRoom && updatedRoom.id === selectedRoom.id) {
      // shallow merge (필요시 setSelectedRoom 등 사용)
      Object.assign(selectedRoom, updatedRoom);
      // 강제 리렌더링이 필요하면 상태로 관리
      // setSelectedRoom({ ...selectedRoom, ...updatedRoom });
    }
    // 추가로 방 목록/참여자 등 갱신 필요시 fetchRooms 등 호출 가능
  };

  useEffect(() => {
    if (isMenuOpen) {

    }
  }, [isMenuOpen, selectedRoom, loginUser]);

  const [favoriteMessages, setFavoriteMessages] = useState([]);
  const [favoriteMessagesLoading, setFavoriteMessagesLoading] = useState(false);

  // 내 즐겨찾기 메시지 목록 fetch
  const fetchMyFavoriteMessages = async () => {
    setFavoriteMessagesLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/chat/messages/my_favorites/`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setFavoriteMessages(data.results ? data.results.map(m => m.id) : data.map(m => m.id));
      }
    } catch { }
    setFavoriteMessagesLoading(false);
  };
  useEffect(() => { fetchMyFavoriteMessages(); }, [selectedRoom?.id]);

  // 메시지 즐겨찾기 토글
  const handleToggleFavorite = async (msg) => {
    if (!msg.id) return;
    const isFav = favoriteMessages.includes(msg.id);
    const url = `${getApiBase()}/api/chat/messages/${msg.id}/favorite/`;
    const method = isFav ? 'DELETE' : 'POST';
    try {
      const csrftoken = getCookie('csrftoken');
      await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'X-CSRFToken': csrftoken },
      });
      fetchMyFavoriteMessages();
    } catch (err) {
      alert('메시지 즐겨찾기 처리 실패: ' + err.message);
    }
  };

  useEffect(() => {
    // 채팅방 입장 시 자동 메시지 전송 및 AI 응답 활성화
    if (selectedRoom && selectedRoom.id) {
      const autoMsg = localStorage.getItem('pending_auto_message');
      const autoImg = localStorage.getItem('pending_image_url');
      if (autoMsg || autoImg) {
        setTimeout(() => {
          if (ws.current && ws.current.readyState === 1) {
            const clientId = `${Date.now()}_${Math.random()}`;
            const messageData = {
              message: autoMsg || '[이미지 첨부]',
              imageUrl: autoImg || '',
              roomId: selectedRoom.id,
              client_id: clientId,
            };
            ws.current.send(JSON.stringify(messageData));
            // localStorage 정리
            localStorage.removeItem('pending_auto_message');
            localStorage.removeItem('pending_image_url');
          }
        }, 500);
      }
    }
  }, [selectedRoom]);

  // 메시지 삭제 함수
  const handleDeleteMessage = async (msg) => {
    if (!msg.id) return;
    if (!(loginUser && (msg.username === loginUser.username || msg.user_id === loginUser.id))) {
      alert('본인 메시지만 삭제할 수 있습니다.');
      return;
    }
    if (!window.confirm('정말 이 메시지를 삭제하시겠습니까?')) return;
    try {
      const res = await csrfFetch(`${getApiBase()}/api/chat/messages/${msg.id}/`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== msg.id));
      } else {
        alert('메시지 삭제에 실패했습니다.');
      }
    } catch (e) {
      alert('메시지 삭제 중 오류: ' + e.message);
    }
  };

  // 메시지 클릭 시 해당 메시지로 이동
  const [scrollToMessageId, setScrollToMessageId] = useState(null);

  // useEffect(() => {
  //   const params = new URLSearchParams(location.search);
  //   const messageId = params.get('messageId');
  //   if (!messageId) return;
  //   // messages에 해당 메시지가 없으면 추가 fetch
  //   if (!messages.some(m => String(m.id) === String(messageId))) {
  //     // 예시: 해당 메시지 id로 단일 메시지 fetch 후, messages에 추가
  //     fetch(`${getApiBase()}/api/chat/messages/${messageId}/`, { credentials: 'include' })
  //       .then(res => res.json())
  //       .then(msg => {
  //         if (msg && msg.id) {
  //           setMessages(prev => {
  //             // 이미 있으면 추가하지 않음
  //             if (prev.some(m => String(m.id) === String(msg.id))) return prev;
  //             return [...prev, msg].sort((a, b) => new Date(a.date) - new Date(b.date));
  //           });
  //         }
  //       });
  //   } else {
  //     setScrollToMessageId(messageId);
  //   }
  // }, [location, messages]);  

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const messageId = params.get('messageId');
    if (!messageId) return;

    if (messages.length > 0 && messages.some(m => String(m.id) === String(messageId))) {
      setScrollToMessageId(messageId);
    }
  }, [location, messages]);

  // messages와 scrollToMessageId를 감시하여 스크롤 트리거
  useEffect(() => {
    if (scrollToMessageId && messages.some(m => m.id == scrollToMessageId)) {
      // VirtualizedMessageList에서 직접 처리하므로 여기서는 아무것도 하지 않음
    }
  }, [messages, scrollToMessageId]);

  // 메시지 클릭 핸들러
  const handleMessageClick = (message, action) => {
    if (action === 'resetScrollToMessageId') {
      setScrollToMessageId(null);
      setIsJumpingToMessage(false); // 스크롤 완료 후 모드 해제      
    }
  };

  const [isJumpingToMessage, setIsJumpingToMessage] = useState(false);

  return (
    <>
      {/* 이미지 뷰어 모달 */}
      {viewerImage && (
        <div className="image-viewer-modal" onClick={() => setViewerImage(null)}>
          <img src={viewerImage} alt="확대 이미지" className="image-viewer-img" onClick={e => e.stopPropagation()} />
          <button className="image-viewer-close" onClick={() => setViewerImage(null)}>✖</button>
        </div>
      )}
      <div className="chat-box-root" style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* 플로팅 메뉴(햄버거) 복구 */}
        <div className="chat-floating-menu" style={{ position: 'absolute', top: 15, left: -15, zIndex: 10 }}>
          <button
            onClick={() => setIsMenuOpen(v => !v)}
            style={{ background: '#222', color: '#fff', border: 'none', borderRadius: 8, width: 40, height: 40, fontSize: 22, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
            aria-label="메뉴 열기"
          >
            ☰
          </button>
          {isMenuOpen && (
            <div style={{ position: 'absolute', top: 44, left: 0, background: '#222', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.18)', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* 방장일 때만 방 설정 버튼 노출 */}
              {isRoomOwner && (
                <button style={{ color: '#fff', background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: 8, textAlign: 'left' }} onClick={() => { setShowRoomSettings(true); setIsMenuOpen(false); }}>
                  🛠️ room
                </button>
              )}
              <button style={{ color: '#fff', background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: 8, textAlign: 'left' }} onClick={() => { setIsAiAvatarOn(v => !v); setIsMenuOpen(false); }}>
                🤖 {isAiAvatarOn ? 'off' : 'on'}
              </button>
              <button style={{ color: '#fff', background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: 8, textAlign: 'left' }} onClick={() => { setIsUserAvatarOn(v => !v); setIsMenuOpen(false); }}>
                👤 {isUserAvatarOn ? 'off' : 'on'}
              </button>
              <button style={{ color: '#fff', background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: 8, textAlign: 'left' }} onClick={() => { setIsCameraActive(v => !v); setIsMenuOpen(false); }}>
                📷 {isCameraActive ? 'off' : 'on'}
              </button>
            </div>
          )}
        </div>
        {showRoomSettings && (
          <RoomSettingsModal
            open={showRoomSettings}
            onClose={() => setShowRoomSettings(false)}
            room={selectedRoom}
            onSuccess={handleRoomSettingsSuccess}
          />
        )}
        {/* 아바타/카메라/햄버거 메뉴 복구 */}
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
        <div className="chat-log" style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '100vw', minWidth: 0, boxSizing: 'border-box', overflowX: 'hidden' }}>
          {/* 플로팅 메뉴, 그룹채팅, 아바타 등 기존 상단 UI는 그대로 유지 */}
          {/* ... (생략: 기존 상단 UI) ... */}
          <div className="chat-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', width: '100%', maxWidth: '100vw', minWidth: 0, boxSizing: 'border-box', overflowX: 'hidden' }}>
            <div className="chat-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', width: '100%', maxWidth: '100vw', minWidth: 0, boxSizing: 'border-box', overflowX: 'hidden' }}>
              <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <VirtualizedMessageList
                  messages={messages}
                  loginUser={loginUser}
                  highlightMessageId={highlightMessageId}
                  getSenderColor={getSenderColor}
                  onReply={msg => setReplyTo(msg)}
                  // onMessageClick={msg => { }} // 메시지 강조 기능 제거
                  // onReplyQuoteClick={id => { }} // 메시지 강조 기능 제거
                  onImageClick={setViewerImage}
                  favoriteMessages={favoriteMessages}
                  onToggleFavorite={handleToggleFavorite}
                  scrollToMessageId={scrollToMessageId}
                  onMessageDelete={() => {
                    if (selectedRoom && selectedRoom.id) {
                      fetchMessages(selectedRoom.id, 0, 20, false);
                    }
                  }}
                  onLoadMore={(isPrepending) => {
                    if (!loadingMessages && hasMore && selectedRoom && selectedRoom.id) {
                      if (isPrepending) {
                        // 위로 스크롤: 현재 첫 번째 메시지 기준으로 이전 20개 fetch
                        const newOffset = Math.max(0, firstItemIndex - 20);
                        fetchMessages(selectedRoom.id, newOffset, 20, true);
                      } else {
                        // 아래로 스크롤: 현재 마지막 메시지 기준으로 다음 20개 fetch
                        const newOffset = firstItemIndex + messages.length;
                        fetchMessages(selectedRoom.id, newOffset, 20, false);
                      }
                    }
                  }}
                  hasMore={hasMore}
                  selectedRoomId={selectedRoom?.id}
                  loadingMessages={loadingMessages}
                  firstItemIndex={firstItemIndex}
                  totalCount={totalCount}
                  onMessageClick={handleMessageClick}
                />
              </div>

            </div>
          </div>
        </div>
      </div>
      {/* 입력창 위에 첨부 이미지 미리보기 UI */}
      {attachedImagePreview && (
        <div className="attached-image-preview-box" style={{ margin: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={attachedImagePreview} alt="첨부 미리보기" className="attached-image-thumb" style={{ maxWidth: 120, maxHeight: 120, borderRadius: 8 }} />
          <button className="attached-image-remove-btn" style={{ color: '#f44336', background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', marginLeft: 8 }} onClick={handleRemoveAttachedImage}>제거</button>
        </div>
      )}
      {/* 입력창 위에 답장 인용 미리보기 UI */}
      {replyTo && (
        <div className="reply-preview-bar" style={{
          background: 'rgba(33,150,243,0.08)',
          borderLeft: '3px solid #2196f3',
          padding: '6px 12px',
          margin: '4px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderRadius: 4,
          fontSize: 14,
          color: '#2196f3',
          maxWidth: '95%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }} onClick={() => { }}>
          <b>{replyTo.sender || replyTo.username || '익명'}</b>: {replyTo.text ? replyTo.text.slice(0, 60) : '[첨부/삭제됨]'}
          <button style={{ marginLeft: 8, color: '#2196f3', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15 }} onClick={() => setReplyTo(null)}>취소</button>
        </div>
      )}
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

