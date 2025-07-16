import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import RealisticAvatar3D from './RealisticAvatar3D';
import EmotionCamera from './EmotionCamera';
import VoiceRecognition from './VoiceRecognition';
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

import { useNavigate } from 'react-router-dom';

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

const ChatBox = ({ selectedRoom, loginUser, loginLoading, checkLoginStatus, userSettings, setUserSettings, onUserMenuOpen, isSettingsModalOpen, setIsSettingsModalOpen, isLoginModalOpen, setIsLoginModalOpen, settingsTab, setSettingsTab, highlightMessageId }) => {
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

  // 메시지 강조 관련 상태
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [hasScrolledToMessage, setHasScrolledToMessage] = useState(false);

  // MediaPipe 준비 상태
  const [isTrackingReady, setIsTrackingReady] = useState(false);
  const [isTrackingLoading, setIsTrackingLoading] = useState(true);

  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  const [chartViewMap, setChartViewMap] = useState({}); // 메시지별 차트뷰 상태

  const [hasMore, setHasMore] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);

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

    console.log('[WebSocket] 연결 시도:', wsUrl);
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
          console.log('[WebSocket] join_room 메시지 전송:', selectedRoom.id);
          clearInterval(joinInterval);
        }
      }
    }, 500); // 500ms 간격으로 안전하게 처리

    ws.current.onopen = () => {
      console.log('[WebSocket] 연결 성공');

      // 연결 후 약간의 지연을 두고 join_room 메시지 전송
      setTimeout(() => {
        if (!joinSent && ws.current && ws.current.readyState === 1) {
          const joinMessage = { type: 'join_room', roomId: selectedRoom.id };
          if (safeWebSocketSend(joinMessage)) {
            joinSent = true;
            console.log('[WebSocket] onopen에서 join_room 전송:', selectedRoom.id);
          }
        }
      }, 200); // 100ms에서 200ms로 증가하여 더 안전하게 처리
    };
    ws.current.onmessage = (e) => {
      console.log('[WebSocket] onmessage 수신:', e.data);
      try {
        const data = JSON.parse(e.data);
        if (data.roomId !== selectedRoomRef.current?.id) {
          console.log('[WebSocket] 다른 방 메시지 무시:', data.roomId);
          return;
        }
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
            imageUrl: null
          };
          setMessages((prev) => {
            let next;
            if (isMyMessage) {
              // echo 메시지라면 pending 메시지 제거
              next = [
                ...prev.filter(msg => !(msg.pending && msg.text === data.message)),
                newMessage
              ];
              console.log('[setMessages][onmessage][echo] pending 제거 후:', next);
            } else {
              next = [...prev, newMessage];
              console.log('[setMessages][onmessage][상대] 추가 후:', next);
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
            console.log('[setMessages][ai_message 수신] 전체:', arr);
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
      console.log('[WebSocket] 연결 종료');

      // 연결이 끊어지면 3초 후 재연결 시도 (단, 컴포넌트가 마운트된 상태일 때만)
      setTimeout(() => {
        if (selectedRoomRef.current?.id && ws.current) {
          console.log('[WebSocket] 재연결 시도...');
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
      console.log('로컬 스트림 초기화 시작...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);
      console.log('로컬 스트림 초기화 완료:', stream);

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
        console.log('로컬 비디오 토글:', videoTrack.enabled ? 'ON' : 'OFF');
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
        console.log('로컬 오디오 토글:', audioTrack.enabled ? 'ON' : 'OFF');
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
          console.log(`새로운 참가자 ${participant.id}에게 Offer 전송`);
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const wsUrl = isLocalhost ? `${protocol}//${host}:8000/ws/chat/` : `${protocol}//${host}/ws/chat/`;

    console.log('WebSocket 연결 시도:', wsUrl);
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket 연결 성공');
    };

    ws.current.onclose = () => {
      console.log('WebSocket 연결 종료');
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
            console.log('[setMessages][user_message 수신] 전체:', result);
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
            console.log('[setMessages][ai_message 수신] 전체:', arr);
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const wsUrl = isLocalhost ? `${protocol}//${host}:8000/ws/chat/` : `${protocol}//${host}/ws/chat/`;

    console.log('WebSocket 재연결 시도:', wsUrl);
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket 재연결 성공');
    };

    ws.current.onclose = () => {
      console.log('WebSocket 연결 종료');
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
            console.log('[setMessages][user_message 수신] 전체:', result);
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
            console.log('[setMessages][ai_message 수신] 전체:', arr);
            return arr;
          });
        }
      } catch (err) {
        console.error('[WebSocket onmessage] 파싱 오류:', err, e.data);
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
    console.log('[TTS] speakAIMessage 진입', message);
    try {
      ttsService.stop(); // 항상 먼저 중단
      if (!isTTSEnabled || !message) return;
      // 음성 목록이 준비되지 않았으면 대기
      if (!voiceList || voiceList.length === 0) {
        console.warn('TTS 음성 목록이 준비되지 않았습니다.');
        return;
      }
      // TTS용 텍스트 정리 (이모티콘, 특수문자 제거)
      const cleanedMessage = ttsService.cleanTextForTTS(message);
      if (!cleanedMessage) {
        console.log('TTS로 읽을 수 있는 텍스트가 없습니다:', message);
        return;
      }
      console.log('TTS 원본 텍스트:', message);
      console.log('TTS 정리된 텍스트:', cleanedMessage);
      setTtsSpeaking(true); // 립싱크 강제 시작
      console.log('[TTS] speak 조건', isTTSEnabled, ttsVoice, message);
      if (isTTSEnabled && ttsVoice && message) {
        console.log('[TTS] speak 실행!');
        await ttsService.speak(message, { voice: ttsVoice, rate: ttsRate, pitch: ttsPitch });
      }
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

  // 이미지 업로드 후 전송
  const handleImageUploadAndSend = async () => {
    if (!attachedImage || !ws.current || ws.current.readyState !== 1) return;

    try {
      // FormData로 이미지 업로드
      const formData = new FormData();
      formData.append('file', attachedImage);
      formData.append('content', input || '이미지 첨부');

      // 환경에 따라 API URL 설정
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const apiUrl = isLocalhost
        ? 'http://localhost:8000'
        : `${window.location.protocol}//${window.location.hostname}`;

      const res = await axios.post(`${apiUrl}/chat/api/chat/upload_image/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        withCredentials: true,
      });

      if (res.data.success) {
        // WebSocket으로 이미지 URL 전송
        const messageData = {
          message: input || '이미지 첨부',
          imageUrl: res.data.file_url,
          roomId: selectedRoom?.id || null
        };

        ws.current.send(JSON.stringify(messageData));

        // 메시지 목록에 추가
        setMessages((prev) => [...prev, {
          type: 'send',
          text: input || '이미지 첨부',
          imageUrl: res.data.file_url,
          date: new Date().toISOString()
        }]);

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
  const sendMessage = (messageText = null) => {
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

    console.log('[sendMessage] 전송:', messageData);
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
      console.log('[setMessages][pending 추가] 전체:', arr);
      return arr;
    });
    setInput('');
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
  const fetchMessages = async (roomId, offset = 0, limit = 20, append = false) => {
    if (!roomId) return;
    setLoadingMessages(true);
    try {
      // 환경에 따라 API URL 설정
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const apiUrl = isLocalhost
        ? 'http://localhost:8000'
        : `${window.location.protocol}//${window.location.hostname}`;

      console.log('메시지 조회 API 호출:', `${apiUrl}/api/chat/messages/messages/?room=${roomId}&limit=${limit}&offset=${offset}`);

      const res = await fetch(`${apiUrl}/api/chat/messages/messages/?room=${roomId}&limit=${limit}&offset=${offset}`, {
        credentials: 'include',
      });

      console.log('메시지 조회 응답 상태:', res.status);

      if (res.ok) {
        const data = await res.json();
        console.log('메시지 조회 결과:', data);
        const username = loginUserRef.current?.username;
        const userId = loginUserRef.current?.id;
        console.log('내 username:', username, '내 userId:', userId);
        if (!userId) {
          console.warn('userId가 undefined입니다! 로그인 상태/응답을 확인하세요.');
        }
        const mappedMessages = (data.results || []).map(msg => {
          // 방향 판별 통일
          let isMine = false;
          if (msg.sender_type === 'user') {
            if (userId !== undefined && userId !== null) {
              isMine = Number(msg.user_id) === Number(userId);
              console.log('내 userId:', userId, 'msg.user_id:', msg.user_id, 'isMine:', isMine);
            } else {
              isMine = msg.username === username;
              console.log('userId 없음, username 비교:', msg.username, username, 'isMine:', isMine);
            }
          }
          let sender = '';
          if (msg.sender_type === 'user') {
            sender = msg.username || '사용자';
          } else if (msg.sender_type === 'ai') {
            sender = msg.ai_name || 'AI';
          } else if (msg.sender_type === 'system') {
            sender = 'System';
          } else {
            sender = msg.sender || '알 수 없음';
          }
          return {
            ...msg,
            sender: sender,
            type: isMine ? 'send' : 'recv',
          };
        });
        if (append) {
          setMessages(prev => [...mappedMessages.reverse(), ...prev]);
        } else {
          setMessages(mappedMessages.reverse());
        }
        setHasMore(data.has_more);
        setMessageOffset(offset + data.results.length);
      } else {
        console.error('메시지 조회 실패:', res.status, res.statusText);
      }
    } catch (error) {
      console.error('메시지 조회 중 오류:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // 대화방이 바뀔 때마다 메시지 초기화 및 불러오기 + join_room 메시지 전송 보장
  useEffect(() => {
    if (selectedRoom && selectedRoom.id) {
      setMessages([]);
      setMessageOffset(0);
      setHasMore(true);
      setHighlightedMessageId(null);
      setHasScrolledToMessage(false);
      fetchMessages(selectedRoom.id, 0, 20, false);
      // 방에 입장 메시지 전송 (WebSocket 연결이 이미 되어 있으면 바로 전송)
      if (ws.current && ws.current.readyState === 1) {
        ws.current.send(JSON.stringify({
          type: 'join_room',
          roomId: selectedRoom.id
        }));
      }
    }
  }, [selectedRoom]);

  // 메시지 강조 처리
  useEffect(() => {
    if (highlightMessageId && messages.length > 0 && !hasScrolledToMessage) {
      setHighlightedMessageId(highlightMessageId);
      setHasScrolledToMessage(true);

      // 메시지를 찾아서 스크롤
      setTimeout(() => {
        const messageElement = document.getElementById(`message-${highlightMessageId}`);
        if (messageElement) {
          messageElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });

          // 3초 후 강조 제거
          setTimeout(() => {
            setHighlightedMessageId(null);
          }, 3000);
        }
      }, 500);
    }
  }, [highlightMessageId, messages, hasScrolledToMessage]);

  // 스크롤 상단 도달 시 이전 메시지 추가 로드
  useEffect(() => {
    const handleScroll = () => {
      if (!chatScrollRef.current || loadingMessages || !hasMore) return;
      if (chatScrollRef.current.scrollTop < 50) {
        // 이전 메시지 추가 로드
        fetchMessages(selectedRoom.id, messageOffset, 20, true);
      }
    };
    const ref = chatScrollRef.current;
    if (ref) ref.addEventListener('scroll', handleScroll);
    return () => { if (ref) ref.removeEventListener('scroll', handleScroll); };
  }, [selectedRoom, messageOffset, hasMore, loadingMessages]);

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
    console.log('[TTS] useEffect 진입', messages);
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.type === 'ai') {
      console.log('[TTS] AI 메시지 수신', lastMsg);
      speakAIMessage(lastMsg.text);
    }
  }, [messages]);

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
        <div className="chat-log" style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {/* 플로팅 메뉴 버튼 (오른쪽 상단) */}
          <div className="chat-floating-menu" style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
            <button
              onClick={() => setIsMenuOpen(v => !v)}
              style={{ background: '#222', color: '#fff', border: 'none', borderRadius: 8, width: 40, height: 40, fontSize: 22, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
              aria-label="메뉴 열기"
            >
              ☰
            </button>
            {isMenuOpen && (
              <div style={{ position: 'absolute', top: 44, right: 0, background: '#222', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.18)', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
          {/* 그룹 채팅방 2x2 UI */}
          {selectedRoom?.room_type === 'group' && (
            <div className="group-chat-2x2-grid">
              {groupParticipantsDisplay.map((user, idx) => {
                const isMe = user && loginUser && user.id === loginUser.id;
                return (
                  <div key={idx} className="group-chat-cell">
                    {user ? (
                      <>
                        <div className="group-chat-media">
                          {/* 본인: 내 카메라/마이크, 타인: 상대방 스트림/아바타 */}
                          {isMe ? (
                            // 본인: 로컬 스트림 표시
                            <div className="local-stream-container">
                              {localStream && isLocalVideoEnabled ? (
                                <video
                                  ref={setLocalVideoRefHandler}
                                  autoPlay
                                  muted
                                  playsInline
                                  style={{ width: 80, height: 60, borderRadius: 8, background: '#111' }}
                                />
                              ) : (
                                <div className="local-stream-placeholder">
                                  <span role="img" aria-label="camera-off" style={{ fontSize: 24 }}>📷</span>
                                  <div style={{ fontSize: 10, marginTop: 4 }}>카메라 OFF</div>
                                </div>
                              )}
                              {/* 로컬 스트림 제어 버튼들 */}
                              <div className="local-stream-controls">
                                <button
                                  onClick={toggleLocalVideo}
                                  className={`stream-control-btn ${isLocalVideoEnabled ? 'active' : ''}`}
                                  title={isLocalVideoEnabled ? '카메라 끄기' : '카메라 켜기'}
                                >
                                  {isLocalVideoEnabled ? '📹' : '❌'}
                                </button>
                                <button
                                  onClick={toggleLocalAudio}
                                  className={`stream-control-btn ${isLocalAudioEnabled ? 'active' : ''}`}
                                  title={isLocalAudioEnabled ? '마이크 끄기' : '마이크 켜기'}
                                >
                                  {isLocalAudioEnabled ? '🎤' : '🔇'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            // 타인: 원격 스트림 또는 아바타 표시
                            <div className="remote-stream-container">
                              {remoteStreams[user.id] ? (
                                <video
                                  ref={el => {
                                    if (el) {
                                      el.srcObject = remoteStreams[user.id];
                                      window[`peerVideoRef_${user.id}`] = el;
                                    }
                                  }}
                                  autoPlay
                                  playsInline
                                  style={{ width: 80, height: 60, borderRadius: 8, background: '#111' }}
                                />
                              ) : (
                                <div className="remote-stream-placeholder">
                                  <span role="img" aria-label="avatar" style={{ fontSize: 48 }}>
                                    {user.avatar ? <img src={user.avatar} alt="avatar" style={{ width: 48, height: 48, borderRadius: '50%' }} /> : '🧑'}
                                  </span>
                                  <div style={{ fontSize: 10, marginTop: 4, color: '#888' }}>연결 대기</div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="group-chat-name">{isMe ? '나' : user.name}</div>
                        <div className="group-chat-status">
                          {isMe ? (
                            <>
                              {isLocalVideoEnabled ? '📹' : '❌'} {isLocalAudioEnabled ? '🎤' : '🔇'}
                              <span style={{ marginLeft: 6, color: '#ff9800', fontSize: 13 }}>(나)</span>
                            </>
                          ) : (
                            <>
                              {user.video ? '📹' : '❌'} {user.audio ? '🎤' : '🔇'}
                            </>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="group-chat-waiting">참가 대기</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* 타이틀+음성/카메라/트래킹 버튼 헤더 */}

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
              height: '100%',
              margin: 0,
              padding: 0,
              width: '100%'
            }}
          >
            <div className="chat-container">
              <div className="chat-log" ref={chatScrollRef}>
                {messages.map((msg, idx) => {
                  console.log(`메시지 ${idx} 렌더링:`, msg);
                  console.log(`메시지 ${idx} 텍스트 내용:`, msg.text);
                  console.log(`메시지 ${idx} 타입:`, msg.type);
                  console.log(`메시지 ${idx} 발신자:`, msg.sender);

                  // 날짜/시간 포맷 함수
                  const dateObj = msg.date ? new Date(msg.date) : new Date();
                  const yyyy = dateObj.getFullYear();
                  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                  const dd = String(dateObj.getDate()).padStart(2, '0');
                  const hh = String(dateObj.getHours()).padStart(2, '0');
                  const min = String(dateObj.getMinutes()).padStart(2, '0');

                  // 발신자 라벨 결정
                  let senderLabel = '';
                  if (msg.sender_type === 'user' && msg.username) {
                    senderLabel = msg.username;
                  } else if (msg.sender_type === 'ai' && msg.ai_name) {
                    senderLabel = msg.ai_name;
                  } else if (msg.sender_type === 'system') {
                    senderLabel = 'System';
                  } else if (msg.sender) {
                    senderLabel = msg.sender;
                  } else if (msg.type === 'send') {
                    senderLabel = loginUserRef.current?.username || '나';
                  } else {
                    senderLabel = 'AI';
                  }

                  const dateTimeBox = (
                    <div className="chat-date-time-box">
                      <div className="chat-date-time-sender">{senderLabel}</div>
                      <div className="chat-date-time-year">{yyyy}-</div>
                      <div className="chat-date-time-md">{mm}-{dd}</div>
                      <div className="chat-date-time-hm">{hh}:{min}</div>
                    </div>
                  );
                  const isHighlighted = highlightedMessageId === msg.id;
                  return (
                    <div
                      key={idx}
                      id={`message-${msg.id}`}
                      style={{
                        display: 'flex',
                        flexDirection: msg.type === 'send' ? 'row-reverse' : 'row',
                        alignItems: 'flex-end',
                        width: '100%',
                        justifyContent: msg.type === 'send' ? 'flex-end' : 'flex-start',
                        backgroundColor: isHighlighted ? 'rgba(255, 255, 0, 0.2)' : 'transparent',
                        borderRadius: isHighlighted ? '8px' : '0',
                        padding: isHighlighted ? '8px' : '0',
                        margin: isHighlighted ? '4px 0' : '0',
                        transition: 'all 0.3s ease',
                        animation: isHighlighted ? 'pulse 2s infinite' : 'none',
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
                          style={{
                            marginRight: msg.type === 'send' ? 8 : 0,
                            marginLeft: msg.type === 'send' ? 0 : 8,
                            backgroundColor: msg.type === 'send' ? undefined : getSenderColor(msg.sender),
                            color: msg.type === 'send' ? undefined : (getSenderColor(msg.sender) ? '#fff' : undefined),
                            position: 'relative',
                          }}
                        >
                          {/* AI 응답일 때 질문자 username 표시 - 상단 */}
                          {msg.type === 'ai' && msg.questioner_username && (
                            <div className="ai-questioner-username">
                              {msg.questioner_username}
                            </div>
                          )}
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
                          {msg.text && (() => {
                            const textToParse = msg.type === 'recv' && idx === messages.length - 1 && isAiTalking
                              ? ensureDoubleNewlineAfterCodeBlocks(extractLatexBlocks(displayedAiText))
                              : ensureDoubleNewlineAfterCodeBlocks(extractLatexBlocks(msg.text));
                            const blocks = parseMessageBlocks(textToParse);
                            console.log(`메시지 ${idx} 파싱 결과:`, { text: msg.text, blocks });
                            return blocks.map((block, i) => {
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
                              } else if (block.type === 'text') {
                                // 일반 텍스트 블록 처리 추가
                                return (
                                  <span key={i}>{block.value || ''}</span>
                                );
                              } else if (block.type === 'markdown') {
                                // 마크다운 블록 처리 (하위 호환성)
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
                            });
                          })()}
                          {/* 메시지가 비어있거나 파싱에 실패한 경우 기본 텍스트 표시 */}
                          {(!msg.text || msg.text.trim() === '') && (
                            <span style={{ color: '#999', fontStyle: 'italic' }}>메시지 내용을 불러올 수 없습니다.</span>
                          )}
                        </div>
                        {/* 날짜 박스는 버블 하단, 같은 라인 오른쪽/왼쪽에 위치 */}
                        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: msg.type === 'send' ? 'flex-end' : 'flex-start', width: '100%' }}>
                          {msg.type === 'send' ? (
                            <div style={{ marginLeft: 'auto' }}>{dateTimeBox}</div>
                          ) : (
                            <div style={{ marginRight: 'auto' }}>
                              {/* AI 메시지일 때는 ai_name, 그 외에는 sender */}
                              {msg.type === 'ai' ? msg.ai_name : msg.sender}
                              {dateTimeBox}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="chat-input-area" style={{ position: 'relative', zIndex: 2, background: '#18191c', borderTop: '1px solid #222', flexShrink: 0 }}>
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
                    <button
                      onClick={() => attachedImage ? handleImageUploadAndSend() : sendMessage()}
                      className="unified-btn"
                    >
                      {attachedImage ? '📤' : '🔥'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* 음성 메뉴 모달 완전 삭제 */}

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

