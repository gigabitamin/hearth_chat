import MultiImageUpload from './MultiImageUpload';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import RealisticAvatar3D from './RealisticAvatar3D';
import EmotionCamera from './EmotionCamera';
import VoiceRecognition from './VoiceRecognition';
import ttsService from '../services/ttsService';
import readyPlayerMeService from '../services/readyPlayerMe';
import faceTrackingService from '../services/faceTrackingService';
import aiService from '../services/aiService';
import './chat_box.css';
import RoomSettingsModal from './RoomSettingsModal';

import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

import VirtualizedMessageList from './VirtualizedMessageList';

// 새로 생성된 모듈들 import
import { useWebSocket, useMessageHandling, useMessageFetching, useFavoriteMessages, useMessageDeletion, fetchMyFavoriteMessages, fetchOffsetForMessageId, fetchTotalCountAndFetchLatest, handleRoomSettingsSuccess, getSenderColor, handleToggleFavorite, fetchMessages, handleMessageClick, handleRemoveAttachedImage, handleRemoveAllAttachedImages, LILY_API_URL } from './ChatBoxCore';
import { Modal } from './ChatBoxUI';
import { speakAIMessage, getAIEmotionResponse, initializeTTSService, initializeAvatars, getAiAvatarStyle, getUserAvatarStyle, getCameraStyle, setTTSInterrupted } from './ChatBoxMedia';
// Chart.js core 등록 - ChatBoxUI에서 처리됨



// 이미지 URL을 절대 경로로 변환하는 함수 - ChatBoxCore로 이동됨



// 모달 컴포넌트 - ChatBoxUI에서 import됨

// 테스트용 차트 데이터 및 컴포넌트 - ChatBoxUI에서 import됨

// Chart.js용 데이터 및 옵션 - ChatBoxUI에서 import됨

// 테스트용 차트 컴포넌트 - ChatBoxUI에서 import됨

const ChatBox = ({
  selectedRoom,
  loginUser,
  loginLoading,
  checkLoginStatus,
  userSettings,
  setUserSettings,
  onUserMenuOpen,
  isSettingsModalOpen,
  setIsSettingsModalOpen,
  isLoginModalOpen,
  setIsLoginModalOpen,
  settingsTab,
  setSettingsTab,
  pendingImageFile,
  setPendingImageFile,
  highlightMessageId,
}) => {
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

  // 랜덤 색상 생성 함수 - ChatBoxCore에서 import됨

  // 발신자별 색상 가져오기 - ChatBoxCore에서 import됨

  // 로그인 모달 상태

  // 사용자 메뉴 모달 상태
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // TTS 관련 상태
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [ttsVoice, setTtsVoice] = useState(null);
  const [ttsRate, setTtsRate] = useState(1.5);
  const [ttsPitch, setTtsPitch] = useState(1.5);
  const [voiceList, setVoiceList] = useState([]);
  const [ttsInterrupted, setTtsInterrupted] = useState(false); // TTS 중단 상태 추적

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
            imageUrl: data.imageUrl || null,      // 단일 이미지(호환성)
            imageUrls: data.imageUrls || [],       // 다중 이미지 배열 추가
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
            imageUrl: null,
            imageUrls: data.imageUrls || [],  // AI 메시지에 첨부된 이미지 URL 배열
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
              imageUrl: null,
              imageUrls: data.imageUrls || [],
            };

            const arr = [...prev, newMsg];

            return arr;
          });
          setCurrentAiMessage(data.message);
          setIsAiTalking(true);
          if (isTTSEnabled) {
            // TTS가 중단된 상태였다면 다시 활성화
            if (ttsInterrupted) {
              setTtsInterrupted(false);
              console.log('[TTS] 중단된 TTS 재활성화됨');
            }
            speakAIMessage(data.message, setTtsInterrupted, userSettings);
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
              emotion: data.emotion,
              imageUrl: data.imageUrl || null,  // 단일 이미지 (호환성 유지)
              imageUrls: data.imageUrls || [],  // 다중 이미지 배열              
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
              imageUrl: null,
              imageUrls: data.imageUrls || [],  // AI 메시지는 이미지 없음
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
            imageUrl: data.imageUrl || null,
            imageUrls: data.imageUrls || [],
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
            imageUrl: null,
            imageUrls: data.imageUrls || [],
            pending: false,
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
              imageUrl: null,
              imageUrls: data.imageUrls || [],
              pending: false,
            };

            const arr = [...prev, newMsg];

            return arr;
          });
          setCurrentAiMessage(data.message);
          setIsAiTalking(true);
          if (isTTSEnabled) {
            // TTS가 중단된 상태였다면 다시 활성화
            if (ttsInterrupted) {
              setTtsInterrupted(false);
              console.log('[TTS] 중단된 TTS 재활성화됨');
            }
            speakAIMessage(data.message, setTtsInterrupted, userSettings);
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

  // speakAIMessage 함수 - ChatBoxMedia에서 import됨

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

  // LaTeX 수식 렌더링 함수 - ChatBoxUI에서 import됨
  // 수식 블록 전처리 함수 - ChatBoxUI에서 import됨   
  // TTS 서비스 초기화 - ChatBoxMedia에서 import됨

  // 음성 설정 상태 확인을 위한 useEffect
  useEffect(() => {
    if (ttsVoice) {

    }
  }, [ttsVoice]);

  // 음성 목록 불러오기 - ChatBoxMedia에서 import됨


  // checkFileExists, listMediaFiles 함수 - ChatBoxMedia에서 import됨

  // initializeAvatars 함수 - ChatBoxMedia에서 import됨

  // analyzeEmotion 함수 - ChatBoxMedia에서 import됨

  // getAIEmotionResponse 함수 - ChatBoxMedia에서 import됨

  // startEmotionBasedConversation 함수 - ChatBoxMedia에서 import됨

  // toggleCamera, toggleRealTimeMode 함수 - ChatBoxMedia에서 import됨

  // handleVoiceResult 함수 - ChatBoxMedia에서 import됨

  // 음성인식 중간 결과 처리 - ChatBoxMedia에서 import됨

  // 음성인식 on/off 토글 및 즉시 start/stop - ChatBoxMedia에서 import됨

  // 스페이스바 이벤트 리스너 추가 - ChatBoxMedia에서 처리됨

  // 연속 음성인식 시작/중지 - ChatBoxMedia에서 import됨

  // 트래킹 기능 제어 - ChatBoxMedia에서 import됨




  // 마이크 권한 요청 함수 - ChatBoxMedia에서 import됨

  // 음성인식 버튼 클릭 핸들러 - ChatBoxMedia에서 import됨

  // 멀티 이미지 첨부 핸들러 - ChatBoxMedia에서 import됨


  // 첨부 이미지 해제/제거 - ChatBoxMedia에서 import됨

  // 이미지 업로드 후 전송 (파일 직접 전달) - ChatBoxMedia에서 import됨

  // 이미지 업로드 및 전송 함수들 - ChatBoxMedia에서 import됨

  // 메시지 전송 함수 - ChatBoxCore에서 import됨

  // AI 응답 생성 함수 - ChatBoxCore에서 import됨



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

  // 페이지 언로드 시 TTS 강제 중지 - ChatBoxMedia에서 처리됨

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

  // 첨부 이미지 상태, 미리보기용
  const [attachedImages, setAttachedImages] = useState([]);
  const [attachedImagePreviews, setAttachedImagePreviews] = useState([]);
  const [viewerImage, setViewerImage] = useState(null); // 이미지 뷰어 모달 상태

  // ESC 키로 이미지 뷰어 닫기 - ChatBoxMedia에서 처리됨

  // 아바타 on/off 상태 추가
  const [isUserAvatarOn, setIsUserAvatarOn] = useState(false); // 기본값 off
  const [isAiAvatarOn, setIsAiAvatarOn] = useState(false); // 기본값 off

  // 수식과 일반 텍스트를 분리 렌더링하는 함수 - ChatBoxUI에서 import됨

  // 차트 렌더링 함수 - ChatBoxUI에서 import됨

  // 메시지 블록 파싱 함수 - ChatBoxUI에서 import됨

  // 차트 렌더링 함수 - ChatBoxUI에서 import됨

  // 코드/JSON/차트 카드 컴포넌트
  // 코드/JSON/차트 카드 컴포넌트 - ChatBoxUI에서 import됨

  // 코드블록 뒤에 빈 줄 2개를 자동으로 추가하는 전처리 함수 - ChatBoxUI에서 import됨

  // latex 코드블록 안의 $$ ... $$ 수식을 추출해 수식 블록으로 변환하는 전처리 함수 - ChatBoxUI에서 import됨

  // 클립보드에서 이미지 붙여넣기 핸들러 - ChatBoxMedia에서 import됨

  // TTS 상태 참조 - ChatBoxMedia에서 import됨

  // 로그인 성공 postMessage 수신 시 모달 닫고 새로고침 - ChatBoxCore에서 import됨

  // AI 서비스 초기화
  useEffect(() => {
    if (userSettings) {
      try {

        // 기본 AI 설정
        let aiSettings = {
          aiEnabled: !!userSettings.ai_response_enabled,
          aiProvider: 'lily', // 기본값
          lilyApiUrl: LILY_API_URL,
          lilyModel: 'kanana-1.5-v-3b-instruct',
          chatgptApiKey: '',
          geminiApiKey: '',
          autoRespond: false,
          responseDelay: 1000,
          maxTokens: 1000,
          temperature: 0.7
        };


        // 저장된 AI 설정이 있으면 파싱하고 병합
        if (userSettings.ai_settings) {
          try {
            const savedSettings = JSON.parse(userSettings.ai_settings);

            // 저장된 설정으로 기본값을 덮어씌움 (병합이 아닌 덮어씌움)
            aiSettings = {
              ...aiSettings,
              ...savedSettings,
              // aiEnabled는 별도로 관리
              aiEnabled: !!userSettings.ai_response_enabled
            };

          } catch (e) {
            console.error('❌ AI 설정 파싱 실패:', e);
            console.error('❌ 원본 ai_settings:', userSettings.ai_settings);
          }
        } else {
          console.log('⚠️ 저장된 AI 설정이 없습니다. 기본값 사용');
        }

        // AI 서비스 초기화
        aiService.initialize(aiSettings);
        // 현재 설정 상태 출력
      } catch (error) {
        console.error('❌ AI 서비스 초기화 실패:', error);
      }
    }
  }, [userSettings]);

  // 소셜 로그인 팝업 오픈 함수 - ChatBoxCore에서 import됨

  // 버튼 스타일 - ChatBoxUI에서 import됨

  // 메시지 불러오기 함수 - ChatBoxCore에서 import됨

  // 대화방이 바뀔 때마다 메시지 초기화 및 불러오기 (중복 제거를 위해 주석 처리)
  // useEffect(() => {
  //   if (selectedRoom && selectedRoom.id) {
  //     setMessages([]);
  //     setMessageOffset(0);
  //     setHasMore(true);
  //     setFirstItemIndex(0);
  //     setTotalCount(0);
  //     setScrollToMessageId(null);
  //     // (1) messageId가 있으면 해당 메시지가 포함된 페이지로 fetch
  //     if (messageIdFromUrl) {
  //       fetchOffsetForMessageId(selectedRoom.id, messageIdFromUrl);
  //     } else {
  //       // (2) 일반 입장: 전체 개수 fetch 후 최신 20개 fetch
  //       fetchTotalCountAndFetchLatest(selectedRoom.id);
  //     }
  //     // ... WebSocket join_room 등 기존 코드 유지 ...
  //   }
  // }, [selectedRoom, messageIdFromUrl]);

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

  // (2) 전체 메시지 개수 fetch 후 최신 20개 fetch - ChatBoxCore에서 import됨

  // (3) messageId로 offset을 계산해서 fetch하는 함수 (슬라이딩 윈도우 40개 유지) - ChatBoxCore에서 import됨

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

      speakAIMessage(lastMsg.text, null, userSettings);
    }
  }, [messages]);

  // pendingImageFile이 변경될 때 이미지 업로드 처리 (수정)
  useEffect(() => {
    if (pendingImageFile && selectedRoom) {
      // pendingImageFile이 유효한 File 객체인지 확인
      if (pendingImageFile instanceof File || pendingImageFile instanceof Blob) {
        setAttachedImages(pendingImageFile);
        setAttachedImagePreviews(URL.createObjectURL(pendingImageFile));
        setPendingImageFile(null);
        // 자동 전송 제거: 버튼 클릭 시점에서만 전송
      } else {
        console.warn('pendingImageFile이 유효한 File 객체가 아닙니다:', pendingImageFile);
        setPendingImageFile(null);
      }
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

  // 방 정보 갱신 핸들러 - ChatBoxCore에서 import됨

  useEffect(() => {
    if (isMenuOpen) {

    }
  }, [isMenuOpen, selectedRoom, loginUser]);

  const [favoriteMessages, setFavoriteMessages] = useState([]);
  const [favoriteMessagesLoading, setFavoriteMessagesLoading] = useState(false);

  // 내 즐겨찾기 메시지 목록 fetch - ChatBoxCore에서 import됨
  useEffect(() => { fetchMyFavoriteMessages(); }, [selectedRoom?.id]);

  // selectedRoom 변경 시 메시지 로드 (중복 제거를 위해 통합)
  useEffect(() => {
    if (selectedRoom && selectedRoom.id) {
      console.log('방 변경됨:', selectedRoom.id);
      // 기존 메시지 초기화
      setMessages([]);
      setMessageOffset(0);
      setFirstItemIndex(0);
      setHasMore(true);
      setTotalCount(0);
      setScrollToMessageId(null);

      // (1) messageId가 있으면 해당 메시지가 포함된 페이지로 fetch
      if (messageIdFromUrl) {
        fetchOffsetForMessageId(
          selectedRoom.id,
          messageIdFromUrl,
          setIsJumpingToMessage,
          setFirstItemIndex,
          setMessageOffset
        );
      } else {
        // (2) 일반 입장: 전체 개수 fetch 후 최신 20개 fetch
        fetchTotalCountAndFetchLatest(
          selectedRoom.id,
          setTotalCount,
          setFirstItemIndex,
          setMessageOffset,
          setMessages,
          messages
        );
      }
    }
  }, [selectedRoom?.id, messageIdFromUrl]);

  // 메시지 즐겨찾기 토글 - ChatBoxCore에서 import됨

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

  // 메시지 삭제 함수 - ChatBoxCore에서 import됨

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

  // 메시지 클릭 핸들러 - ChatBoxCore에서 import됨

  const [isJumpingToMessage, setIsJumpingToMessage] = useState(false);

  // TTS 중단 콜백 설정
  useEffect(() => {
    if (ttsService && ttsService.setOnStopCallback) {
      ttsService.setOnStopCallback(() => {
        setTtsInterrupted(true);
        console.log('[TTS] TTS 중단됨 - 상태 업데이트');
      });
    }

    return () => {
      if (ttsService && ttsService.removeOnStopCallback) {
        ttsService.removeOnStopCallback();
      }
    };
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
                      fetchMessages(selectedRoom.id, 0, 20, false, false);
                    }
                  }}
                  onLoadMore={(isPrepending) => {
                    if (!loadingMessages && hasMore && selectedRoom && selectedRoom.id) {
                      if (isPrepending) {
                        // 위로 스크롤: 현재 첫 번째 메시지 기준으로 이전 20개 fetch
                        const newOffset = Math.max(0, firstItemIndex - 20);
                        fetchMessages(selectedRoom.id, newOffset, 20, true, false);
                      } else {
                        // 아래로 스크롤: 현재 마지막 메시지 기준으로 다음 20개 fetch
                        const newOffset = firstItemIndex + messages.length;
                        fetchMessages(selectedRoom.id, newOffset, 20, false, false);
                      }
                    }
                  }}
                  hasMore={hasMore}
                  selectedRoomId={selectedRoom?.id}
                  loadingMessages={loadingMessages}
                  firstItemIndex={firstItemIndex}
                  totalCount={totalCount}
                  onMessageClick={handleMessageClick}
                  userSettings={userSettings}
                />
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* 입력창 위에 첨부 이미지 미리보기 UI */}
      {attachedImagePreviews.length > 0 && (
        <div className="attached-image-preview-box" style={{
          margin: '8px 0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center'
        }}>
          {attachedImagePreviews.map((preview, index) => (
            <div key={index} style={{ position: 'relative', display: 'inline-block' }}>
              <img
                src={preview}
                alt={`첨부 이미지 ${index + 1}`}
                style={{
                  maxWidth: 120,
                  maxHeight: 120,
                  borderRadius: 8,
                  border: '1px solid #ddd'
                }}
              />
              <button
                onClick={() => handleRemoveAttachedImage(index)}
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  background: '#ff4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>
          ))}
          {attachedImagePreviews.length > 1 && (
            <button
              onClick={handleRemoveAllAttachedImages}
              style={{
                color: '#f44336',
                background: 'none',
                border: 'none',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              모두 제거
            </button>
          )}
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

// 스타일 함수들 - ChatBoxUI에서 import됨
