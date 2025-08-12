import React, { useState, useEffect, useRef } from 'react';
import videoCallService from '../services/videoCallService';
import './VideoCallInterface.css';

const VideoCallInterface = ({ roomId, userId, onCallEnd }) => {
    // React Hooks는 조건문 이전에 호출되어야 함
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isCallActive, setIsCallActive] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [connectionState, setConnectionState] = useState('new');
    const [iceConnectionState, setIceConnectionState] = useState('new');
    const [screenShareStream, setScreenShareStream] = useState(null);

    // 카메라 전환 관련 상태 추가
    const [availableCameras, setAvailableCameras] = useState([]);
    const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

    // 모바일 음성 관련 상태 추가
    const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(false); // 통화 스피커 활성화 여부
    const [isBluetoothConnected, setIsBluetoothConnected] = useState(false); // 블루투스 이어폰 연결 여부
    const [audioOutput, setAudioOutput] = useState('earpiece'); // 'earpiece' | 'speaker' | 'bluetooth'

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    // WebSocket 참조 가져오기
    const getWebSocket = () => {
        // chat_box.jsx의 WebSocket 사용
        if (window.chatWebSocket && window.chatWebSocket.readyState === WebSocket.OPEN) {
            return window.chatWebSocket;
        }
        return null;
    };

    // 블루투스 이어폰 연결 상태 확인
    const checkBluetoothConnection = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
            const bluetoothDevices = audioOutputs.filter(device =>
                device.label.toLowerCase().includes('bluetooth') ||
                device.label.toLowerCase().includes('bt') ||
                device.deviceId.includes('bluetooth')
            );

            const hasBluetooth = bluetoothDevices.length > 0;
            setIsBluetoothConnected(hasBluetooth);

            if (hasBluetooth) {
                setAudioOutput('bluetooth');
                console.log('[화상채팅] 블루투스 이어폰 연결됨:', bluetoothDevices);
            } else {
                setAudioOutput('earpiece');
                console.log('[화상채팅] 블루투스 이어폰 연결 안됨, 이어폰 사용');
            }
        } catch (error) {
            console.error('[화상채팅] 블루투스 연결 상태 확인 실패:', error);
        }
    };

    // 음성 출력 전환 (이어폰 <-> 통화 스피커)
    const toggleAudioOutput = async () => {
        try {
            if (audioOutput === 'earpiece') {
                // 이어폰 -> 통화 스피커
                if (navigator.mediaDevices && navigator.mediaDevices.setAudioOutput) {
                    await navigator.mediaDevices.setAudioOutput('speaker');
                    setAudioOutput('speaker');
                    setIsSpeakerEnabled(true);
                    console.log('[화상채팅] 통화 스피커로 전환됨');
                } else {
                    // iOS Safari 대응
                    if (window.webkit && window.webkit.messageHandlers) {
                        window.webkit.messageHandlers.audioOutput.postMessage('speaker');
                        setAudioOutput('speaker');
                        setIsSpeakerEnabled(true);
                        console.log('[화상채팅] iOS 통화 스피커로 전환됨');
                    }
                }
            } else {
                // 통화 스피커 -> 이어폰
                if (navigator.mediaDevices && navigator.mediaDevices.setAudioOutput) {
                    await navigator.mediaDevices.setAudioOutput('earpiece');
                    setAudioOutput('earpiece');
                    setIsSpeakerEnabled(false);
                    console.log('[화상채팅] 이어폰으로 전환됨');
                } else {
                    // iOS Safari 대응
                    if (window.webkit && window.webkit.messageHandlers) {
                        window.webkit.messageHandlers.audioOutput.postMessage('earpiece');
                        setAudioOutput('earpiece');
                        setIsSpeakerEnabled(false);
                        console.log('[화상채팅] iOS 이어폰으로 전환됨');
                    }
                }
            }
        } catch (error) {
            console.error('[화상채팅] 음성 출력 전환 실패:', error);
        }
    };

    // 마이크 음소거 토글
    const toggleMute = async () => {
        try {
            if (localStream) {
                const audioTrack = localStream.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = !audioTrack.enabled;
                    setIsMuted(!audioTrack.enabled);
                    console.log('[화상채팅] 마이크 음소거:', !audioTrack.enabled);
                }
            }
        } catch (error) {
            console.error('[화상채팅] 마이크 음소거 토글 실패:', error);
        }
    };

    // 스피커 음소거 토글 (원격 오디오)
    const toggleSpeakerMute = async () => {
        try {
            if (remoteVideoRef.current) {
                const isMuted = remoteVideoRef.current.muted;
                remoteVideoRef.current.muted = !isMuted;
                console.log('[화상채팅] 스피커 음소거:', !isMuted);
            }
        } catch (error) {
            console.error('[화상채팅] 스피커 음소거 토글 실패:', error);
        }
    };

    // 모바일에서 통화 모드 방지 및 음성 설정
    const setupMobileAudio = async () => {
        try {
            // 모바일에서 통화 모드 방지
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const constraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        // 통화 모드 방지
                        sampleRate: 48000,
                        channelCount: 2
                    },
                    video: true
                };

                // 오디오 컨텍스트 설정 (통화 모드 방지)
                if (window.AudioContext || window.webkitAudioContext) {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    if (audioContext.state === 'suspended') {
                        await audioContext.resume();
                    }
                    console.log('[화상채팅] 오디오 컨텍스트 활성화됨');
                }

                console.log('[화상채팅] 모바일 오디오 설정 완료');
            }
        } catch (error) {
            console.error('[화상채팅] 모바일 오디오 설정 실패:', error);
        }
    };

    // 초기화 시 카메라 OFF 상태로 설정
    const initializeCameraOff = () => {
        setIsVideoEnabled(false);

        // 실제 카메라 스트림도 중지
        if (localVideoRef.current && localVideoRef.current.srcObject) {
            const stream = localVideoRef.current.srcObject;
            if (stream) {
                stream.getTracks().forEach(track => {
                    if (track.kind === 'video') {
                        track.enabled = false;
                        console.log('[화상채팅] 비디오 트랙 비활성화됨');
                    }
                });
            }
        }

        console.log('[화상채팅] 초기화 시 카메라 OFF 상태로 설정됨');
    };

    useEffect(() => {
        // userId가 없으면 초기화하지 않음
        if (!userId) {
            console.log('[화상채팅] userId가 없어서 초기화 대기 중...');
            return;
        }

        // 컴포넌트가 마운트된 후 초기화 실행
        const timer = setTimeout(() => {
            console.log('[화상채팅] useEffect 실행 - 초기화 시작');
            setupMobileAudio(); // 모바일 오디오 설정
            initializeVideoCall();
            getAvailableCameras(); // 카메라 목록 가져오기
            checkBluetoothConnection(); // 블루투스 연결 상태 확인
            initializeCameraOff(); // 카메라 OFF 상태로 초기화
        }, 100);

        return () => {
            clearTimeout(timer);
            videoCallService.stopVideoCall();
        };
    }, [userId]); // userId가 변경될 때마다 실행

    // 블루투스 연결 상태 주기적 확인 (모바일 대응)
    useEffect(() => {
        if (!userId) return;

        const bluetoothCheckInterval = setInterval(() => {
            checkBluetoothConnection();
        }, 5000); // 5초마다 확인

        return () => {
            clearInterval(bluetoothCheckInterval);
        };
    }, [userId]);

    // userId prop 확인 및 디버깅
    console.log('[화상채팅] VideoCallInterface props 확인:', { roomId, userId });

    // userId가 없으면 초기화하지 않음
    if (!userId) {
        console.error('[화상채팅] userId가 없어서 초기화할 수 없음');
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                color: '#666',
                fontSize: '16px',
                flexDirection: 'column',
                gap: '10px'
            }}>
                <div>사용자 정보를 불러오는 중...</div>
                <div style={{ fontSize: '14px', color: '#999' }}>
                    잠시만 기다려주세요
                </div>
            </div>
        );
    }

    // 사용 가능한 카메라 목록 가져오기
    const getAvailableCameras = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            setAvailableCameras(videoDevices);
            console.log('[화상채팅] 사용 가능한 카메라 개수:', videoDevices.length);
        } catch (err) {
            console.error('[화상채팅] 카메라 목록 가져오기 실패:', err);
        }
    };

    // 다음 카메라로 전환
    const switchToNextCamera = async () => {
        if (availableCameras.length <= 1) {
            console.log('[화상채팅] 전환 가능한 카메라가 없음');
            return;
        }

        try {
            // 현재 카메라 중지
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }

            // 다음 카메라 인덱스 계산
            const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
            setCurrentCameraIndex(nextIndex);

            console.log('[화상채팅] 다음 카메라로 전환:', nextIndex, availableCameras[nextIndex]?.label);

            // 새 카메라로 스트림 획득
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: { exact: availableCameras[nextIndex].deviceId }
                },
                audio: true
            });

            setLocalStream(newStream);

            // 로컬 비디오에 새 스트림 표시
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = newStream;
            }

            // WebRTC 연결에 새 스트림 적용
            if (videoCallService.peerConnection) {
                const videoTrack = newStream.getVideoTracks()[0];
                const sender = videoCallService.peerConnection
                    .getSenders()
                    .find(s => s.track && s.track.kind === 'video');

                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
            }

            // VideoCallService의 로컬 스트림 업데이트
            videoCallService.localStream = newStream;

        } catch (error) {
            console.error('[화상채팅] 카메라 전환 실패:', error);
        }
    };

    const initializeVideoCall = async () => {
        try {
            console.log('[화상채팅] 초기화 시작 - Room ID:', roomId, 'User ID:', userId);
            console.log('[화상채팅] 초기화 단계 1: VideoCallService 초기화');

            const stream = await videoCallService.initializeVideoCall(roomId, userId);
            setLocalStream(stream);
            console.log('[화상채팅] 초기화 단계 1 완료: 로컬 스트림 설정됨');

            // DOM 요소가 준비될 때까지 대기
            console.log('[화상채팅] DOM 요소 준비 대기 시작');
            let retryCount = 0;
            while (!localVideoRef.current && retryCount < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                retryCount++;
                console.log('[화상채팅] DOM 요소 대기 중...', retryCount);
            }

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                console.log('[화상채팅] 초기화 단계 2: 로컬 비디오 요소에 스트림 설정됨');
            } else {
                console.error('[화상채팅] DOM 요소를 찾을 수 없음, 초기화 중단');
                return;
            }

            // 기존 WebSocket을 시그널링 소켓으로 사용
            console.log('[화상채팅] 초기화 단계 3: WebSocket 설정 시작');
            const ws = getWebSocket();
            if (ws) {
                videoCallService.setSignalingSocket(ws);
                console.log('[화상채팅] WebSocket을 시그널링 소켓으로 설정됨:', ws.readyState);

                // WebRTC 시그널링 메시지 리스너 추가
                const handleWebRTCMessageEvent = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('[화상채팅] WebSocket 메시지 수신:', data);

                        if (data.type && ['offer', 'answer', 'ice_candidate', 'screen_share_start', 'screen_share_stop'].includes(data.type)) {
                            console.log('[화상채팅] WebRTC 시그널링 메시지 감지됨:', data.type);
                            processWebRTCMessage(data);
                        }
                    } catch (error) {
                        // 일반 채팅 메시지는 무시
                    }
                };

                ws.addEventListener('message', handleWebRTCMessageEvent);
                console.log('[화상채팅] WebRTC 시그널링 메시지 리스너 추가됨');
            } else {
                console.error('[화상채팅] WebSocket을 찾을 수 없음 - 계속 진행');
            }

            // 콜백 설정
            console.log('[화상채팅] 초기화 단계 4: 콜백 설정 시작');
            videoCallService.setCallbacks({
                onRemoteStreamReceived: (stream) => {
                    console.log('[화상채팅] 원격 스트림 수신됨:', stream);
                    setRemoteStream(stream);
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = stream;
                        console.log('[화상채팅] 원격 비디오 요소에 스트림 설정됨');
                    }
                },
                onConnectionStateChange: (state) => {
                    console.log('[화상채팅] WebRTC 연결 상태 변경:', state, 'User ID:', userId);
                    setConnectionState(state);

                    if (state === 'connected') {
                        console.log('[화상채팅] WebRTC 연결 성공!');
                    } else if (state === 'failed') {
                        console.error('[화상채팅] WebRTC 연결 실패!');
                    }
                },
                onIceConnectionStateChange: (state) => {
                    console.log('[화상채팅] ICE 연결 상태 변경:', state, 'User ID:', userId);
                    setIceConnectionState(state);

                    if (state === 'connected') {
                        console.log('[화상채팅] ICE 연결 성공!');
                    } else if (state === 'failed') {
                        console.error('[화상채팅] ICE 연결 실패!');
                    }
                }
            });
            console.log('[화상채팅] 초기화 단계 4 완료: 콜백 설정됨');

            // Offer 생성 (방장인 경우)
            console.log('[화상채팅] 초기화 단계 5: 방장 판별 및 Offer 생성 시작');
            console.log('[화상채팅] 방장 판별 시작 - User ID:', userId);
            const roomOwnerStatus = isRoomOwner();
            console.log('[화상채팅] 방장 여부:', roomOwnerStatus);

            if (roomOwnerStatus) {
                console.log('[화상채팅] 방장이므로 Offer 생성 시작 - User ID:', userId);
                try {
                    await videoCallService.createOffer();
                    console.log('[화상채팅] Offer 생성 및 전송 완료');
                } catch (error) {
                    console.error('[화상채팅] Offer 생성 실패:', error);
                }
            } else {
                console.log('[화상채팅] 참가자이므로 Offer 대기 중 - User ID:', userId);
            }

            console.log('[화상채팅] 초기화 단계 5 완료: Offer 생성/대기 완료');
            console.log('[화상채팅] 전체 초기화 완료!');

        } catch (error) {
            console.error('[화상채팅] 초기화 실패:', error);
        }
    };

    const isRoomOwner = () => {
        // 방장 여부 확인 로직 - 먼저 입장한 사용자가 방장
        // 실제로는 서버에서 방장 정보를 받아와야 함
        // TODO: 서버에서 방장 정보를 받아와서 처리하도록 수정 필요
        // TODO: 방 생성 시점에 방장을 설정하고, 이후 입장하는 사용자는 참가자로 처리
        // TODO: 방장이 나가면 다음 사용자를 방장으로 승격하는 로직 필요

        // 현재는 User ID가 1인 경우만 방장으로 설정 (임시)
        const result = userId === 1;

        console.log('[화상채팅] 방장 판별 함수 실행:', {
            userId: userId,
            result: result,
            note: '임시로 User ID 1을 방장으로 설정'
        });

        return result;
    };

    const toggleVideo = () => {
        const newVideoState = videoCallService.toggleVideo();
        setIsVideoEnabled(newVideoState);
    };

    const toggleScreenShare = async () => {
        try {
            const newStream = await videoCallService.toggleScreenShare();
            if (newStream) {
                setScreenShareStream(newStream);
                setIsScreenSharing(true);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = newStream;
                }
            } else {
                setScreenShareStream(null);
                setIsScreenSharing(false);
                if (localVideoRef.current && localStream) {
                    localVideoRef.current.srcObject = localStream;
                }
            }
        } catch (error) {
            console.error('[화상채팅] 화면 공유 토글 실패:', error);
        }
    };

    const endCall = () => {
        videoCallService.stopVideoCall();
        setIsCallActive(false);
        if (onCallEnd) {
            onCallEnd();
        }
    };

    const getConnectionStatusText = () => {
        if (connectionState === 'connected') return '연결됨';
        if (connectionState === 'connecting') return '연결 중...';
        if (connectionState === 'disconnected') return '연결 끊김';
        if (connectionState === 'failed') return '연결 실패';
        if (connectionState === 'closed') return '연결 종료';
        return '초기화 중...';
    };

    const getConnectionStatusColor = () => {
        if (connectionState === 'connected') return '#4CAF50';
        if (connectionState === 'connecting') return '#FF9800';
        if (connectionState === 'disconnected') return '#F44336';
        if (connectionState === 'failed') return '#F44336';
        if (connectionState === 'closed') return '#9E9E9E';
        return '#9E9E9E';
    };

    const getIceStatusText = () => {
        if (iceConnectionState === 'connected') return 'ICE 연결됨';
        if (iceConnectionState === 'connecting') return 'ICE 연결 중...';
        if (iceConnectionState === 'disconnected') return 'ICE 연결 끊김';
        if (iceConnectionState === 'failed') return 'ICE 연결 실패';
        if (iceConnectionState === 'closed') return 'ICE 연결 종료';
        return 'ICE 초기화 중...';
    };

    // WebRTC 시그널링 메시지 처리
    const processWebRTCMessage = async (data) => {
        try {
            console.log('[화상채팅] WebRTC 메시지 처리 시작:', data.type, 'from User ID:', data.userId, 'my User ID:', userId);

            switch (data.type) {
                case 'offer':
                    if (data.userId !== userId) {
                        console.log('[화상채팅] Offer 수신됨, Answer 생성 시작');
                        await videoCallService.handleOffer(data.offer, data.userId);
                        console.log('[화상채팅] Answer 생성 및 전송 완료');
                    } else {
                        console.log('[화상채팅] 자신이 보낸 Offer는 무시');
                    }
                    break;

                case 'answer':
                    if (data.userId !== userId) {
                        console.log('[화상채팅] Answer 수신됨');
                        await videoCallService.handleAnswer(data.answer);
                        console.log('[화상채팅] Answer 처리 완료');
                    } else {
                        console.log('[화상채팅] 자신이 보낸 Answer는 무시');
                    }
                    break;

                case 'ice_candidate':
                    if (data.userId !== userId) {
                        console.log('[화상채팅] ICE 후보 수신됨');
                        await videoCallService.handleIceCandidate(data.candidate);
                        console.log('[화상채팅] ICE 후보 처리 완료');
                    } else {
                        console.log('[화상채팅] 자신이 보낸 ICE 후보는 무시');
                    }
                    break;

                case 'screen_share_start':
                    if (data.userId !== userId) {
                        console.log('[화상채팅] 상대방 화면공유 시작됨');
                        // 상대방 화면공유 상태 표시 (UI 업데이트)
                    } else {
                        console.log('[화상채팅] 자신이 보낸 화면공유 시작 메시지는 무시');
                    }
                    break;

                case 'screen_share_stop':
                    if (data.userId !== userId) {
                        console.log('[화상채팅] 상대방 화면공유 중지됨');
                        // 상대방 화면공유 상태 해제 (UI 업데이트)
                    } else {
                        console.log('[화상채팅] 자신이 보낸 화면공유 중지 메시지는 무시');
                    }
                    break;

                default:
                    console.log('[화상채팅] 알 수 없는 WebRTC 메시지 타입:', data.type);
                    break;
            }
        } catch (error) {
            console.error('[화상채팅] WebRTC 메시지 처리 실패:', error);
        }
    };

    return (
        <div className="video-call-interface">
            <div className="video-call-header">
                <h3>화상채팅</h3>
                <div className="connection-status">
                    <span
                        className="status-indicator"
                        style={{ backgroundColor: getConnectionStatusColor() }}
                    ></span>
                    <span className="status-text">{getConnectionStatusText()}</span>
                </div>
            </div>

            <div className="video-container">
                <div className="remote-video-container">
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="remote-video"
                    />
                    {!remoteStream && (
                        <div className="waiting-message">
                            <div className="waiting-icon">📹</div>
                            <div className="waiting-text">상대방을 기다리는 중...</div>
                        </div>
                    )}
                </div>

                <div className="local-video-container">
                    {/* 카메라 전환 버튼 */}
                    {availableCameras.length > 1 && (
                        <div className="camera-switch-button">
                            <button
                                onClick={switchToNextCamera}
                                title={`다음 카메라로 전환 (${currentCameraIndex + 1}/${availableCameras.length})`}
                            >
                                📷
                            </button>
                            <div className="camera-info">
                                {availableCameras[currentCameraIndex]?.label || '기본 카메라'}
                                <br />
                                <small>{currentCameraIndex + 1} / {availableCameras.length}</small>
                            </div>
                        </div>
                    )}

                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="local-video"
                    />
                    <div className="local-video-overlay">
                        <span className="local-user-label">
                            {isScreenSharing ? '화면공유' : '나'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="video-controls">
                {/* 마이크 음소거 버튼 */}
                <button
                    onClick={toggleMute}
                    className={`control-btn ${isMuted ? 'muted' : ''}`}
                    title={isMuted ? '마이크 음소거 해제' : '마이크 음소거'}
                >
                    {isMuted ? '🎤❌' : '🎤'}
                </button>

                {/* 스피커 음소거 버튼 */}
                <button
                    onClick={toggleSpeakerMute}
                    className="control-btn"
                    title="스피커 음소거 토글"
                >
                    🔊
                </button>

                {/* 음성 출력 전환 버튼 (이어폰 <-> 통화 스피커) */}
                <button
                    onClick={toggleAudioOutput}
                    className={`control-btn ${isSpeakerEnabled ? 'active' : ''}`}
                    title={`현재: ${audioOutput === 'earpiece' ? '이어폰' : audioOutput === 'speaker' ? '통화 스피커' : '블루투스'}. 클릭하여 전환`}
                >
                    {audioOutput === 'earpiece' ? '👂' : audioOutput === 'speaker' ? '📢' : '🎧'}
                </button>

                {/* 블루투스 연결 상태 표시 */}
                {isBluetoothConnected && (
                    <div className="bluetooth-indicator" title="블루투스 이어폰 연결됨">
                        🎧
                    </div>
                )}

                <button
                    onClick={toggleVideo}
                    className={`control-btn ${!isVideoEnabled ? 'disabled' : ''}`}
                    title={isVideoEnabled ? '카메라 끄기' : '카메라 켜기'}
                >
                    {isVideoEnabled ? '📹' : '🚫'}
                </button>

                <button
                    onClick={toggleScreenShare}
                    className={`control-btn ${isScreenSharing ? 'active' : ''}`}
                    title={isScreenSharing ? '화면 공유 중지' : '화면 공유'}
                >
                    {isScreenSharing ? '🖥️' : '💻'}
                </button>

                {/* 디버깅용 강제 연결 테스트 버튼 */}
                <button
                    onClick={async () => {
                        console.log('[화상채팅] 강제 연결 테스트 시작');
                        console.log('[화상채팅] 현재 User ID:', userId);
                        console.log('[화상채팅] 방장 여부:', isRoomOwner());

                        if (isRoomOwner()) {
                            console.log('[화상채팅] 방장이므로 Offer 재생성');
                            try {
                                await videoCallService.createOffer();
                                console.log('[화상채팅] 강제 Offer 생성 성공');
                            } catch (error) {
                                console.error('[화상채팅] 강제 Offer 생성 실패:', error);
                            }
                        } else {
                            console.log('[화상채팅] 참가자이므로 Offer 대기 중');
                            console.log('[화상채팅] 현재 WebRTC 상태:', {
                                connectionState: videoCallService.peerConnection?.connectionState,
                                iceConnectionState: videoCallService.peerConnection?.iceConnectionState
                            });
                        }
                    }}
                    className="control-btn"
                    title="연결 테스트"
                    style={{ background: '#FF9800' }}
                >
                    🔧
                </button>

                {/* 강제 Offer 생성 버튼 (모든 사용자) */}
                <button
                    onClick={async () => {
                        console.log('[화상채팅] 강제 Offer 생성 시작 (User ID:', userId, ')');
                        try {
                            await videoCallService.createOffer();
                            console.log('[화상채팅] 강제 Offer 생성 성공');
                        } catch (error) {
                            console.error('[화상채팅] 강제 Offer 생성 실패:', error);
                        }
                    }}
                    className="control-btn"
                    title="강제 Offer 생성"
                    style={{ background: '#FF5722' }}
                >
                    🚀
                </button>

                {/* 강제 초기화 버튼 */}
                <button
                    onClick={async () => {
                        console.log('[화상채팅] 강제 초기화 시작');
                        try {
                            await initializeVideoCall();
                            console.log('[화상채팅] 강제 초기화 완료');
                        } catch (error) {
                            console.error('[화상채팅] 강제 초기화 실패:', error);
                        }
                    }}
                    className="control-btn"
                    title="강제 초기화"
                    style={{ background: '#9C27B0' }}
                >
                    🔄
                </button>

                <button
                    onClick={endCall}
                    className="control-btn end-call"
                    title="통화 종료"
                >
                    📞
                </button>
            </div>

            <div className="call-info">
                <div className="room-info">
                    <span>방 ID: {roomId}</span>
                    <span>사용자 ID: {userId}</span>
                </div>
                <div className="connection-info">
                    <span>WebRTC: {getConnectionStatusText()}</span>
                    <span>ICE: {getIceStatusText()}</span>
                </div>
                {availableCameras.length > 1 && (
                    <div className="camera-info-display">
                        <span>카메라: {currentCameraIndex + 1}/{availableCameras.length}</span>
                        <span>{availableCameras[currentCameraIndex]?.label || '기본 카메라'}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoCallInterface;