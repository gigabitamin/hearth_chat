import React, { useState, useEffect, useRef } from 'react';
import videoCallService from '../services/videoCallService';
import './VideoCallInterface.css';

const VideoCallInterface = ({ roomId, userId, onCallEnd }) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isCallActive, setIsCallActive] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [connectionState, setConnectionState] = useState('new');
    const [iceConnectionState, setIceConnectionState] = useState('new');

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    useEffect(() => {
        initializeVideoCall();
        return () => {
            videoCallService.stopVideoCall();
        };
    }, []);

    const initializeVideoCall = async () => {
        try {
            const stream = await videoCallService.initializeVideoCall(roomId, userId);
            setLocalStream(stream);
            
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            // 시그널링 소켓 설정
            videoCallService.setSignalingSocket(window.videoCallSocket);
            
            // 콜백 설정
            videoCallService.setCallbacks({
                onRemoteStreamReceived: (stream) => {
                    setRemoteStream(stream);
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = stream;
                    }
                },
                onConnectionStateChange: (state) => {
                    setConnectionState(state);
                    console.log('WebRTC 연결 상태:', state);
                },
                onIceConnectionStateChange: (state) => {
                    setIceConnectionState(state);
                    console.log('ICE 연결 상태:', state);
                }
            });
            
            // Offer 생성 (방장인 경우)
            if (isRoomOwner()) {
                await videoCallService.createOffer();
            }
        } catch (error) {
            console.error('화상채팅 초기화 실패:', error);
        }
    };

    const isRoomOwner = () => {
        // 방장 여부 확인 로직 (임시로 true 반환)
        return true;
    };

    const toggleMute = () => {
        const newMuteState = videoCallService.toggleMute();
        setIsMuted(newMuteState);
    };

    const toggleVideo = () => {
        const newVideoState = videoCallService.toggleVideo();
        setIsVideoEnabled(newVideoState);
    };

    const toggleScreenShare = async () => {
        try {
            const newScreenShareState = await videoCallService.toggleScreenShare();
            setIsScreenSharing(newScreenShareState);
        } catch (error) {
            console.error('화면 공유 전환 실패:', error);
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
        return '초기화 중...';
    };

    const getConnectionStatusColor = () => {
        if (connectionState === 'connected') return '#4CAF50';
        if (connectionState === 'connecting') return '#FF9800';
        if (connectionState === 'disconnected') return '#F44336';
        if (connectionState === 'failed') return '#F44336';
        return '#9E9E9E';
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
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="local-video"
                    />
                    <div className="local-video-overlay">
                        <span className="local-user-label">나</span>
                    </div>
                </div>
            </div>
            
            <div className="video-controls">
                <button
                    onClick={toggleMute}
                    className={`control-btn ${isMuted ? 'muted' : ''}`}
                    title={isMuted ? '음소거 해제' : '음소거'}
                >
                    {isMuted ? '🔇' : '🔊'}
                </button>
                
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
                    <span>WebRTC: {connectionState}</span>
                    <span>ICE: {iceConnectionState}</span>
                </div>
            </div>
        </div>
    );
};

export default VideoCallInterface; 