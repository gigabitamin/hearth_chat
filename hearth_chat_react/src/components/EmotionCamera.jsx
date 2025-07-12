import React, { useRef, useEffect, useState, useCallback } from 'react';
import './EmotionCamera.css';
import RealisticAvatar3D from './RealisticAvatar3D';

const EmotionCamera = ({ isActive = true, hideControls = false, userAvatar, userEmotion, isUserTalking, mouthTrigger, emotionCaptureStatus, enableTracking, showAvatarOverlay }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [error, setError] = useState(null);

    // 웹캠 시작
    const startCamera = useCallback(async () => {
        try {
            setError(null);
            console.log('웹캠 시작 시도...');

            // 사용 가능한 미디어 디바이스 확인
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            console.log('사용 가능한 비디오 디바이스:', videoDevices);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { min: 320, ideal: 640, max: 1280 },
                    height: { min: 240, ideal: 480, max: 720 },
                    frameRate: { ideal: 30 },
                    facingMode: 'user',
                    aspectRatio: { ideal: 1.333333 }
                },
                audio: false
            });

            console.log('웹캠 스트림 획득 성공:', {
                id: stream.id,
                active: stream.active,
                tracks: stream.getTracks().map(track => ({
                    kind: track.kind,
                    enabled: track.enabled,
                    readyState: track.readyState
                }))
            });

            streamRef.current = stream;
            setIsCameraOn(true);

        } catch (err) {
            console.error('웹캠 시작 실패:', err);
            setError(`웹캠에 접근할 수 없습니다: ${err.message}`);
            alert(`웹캠에 접근할 수 없습니다: ${err.message}`);
        }
    }, []);

    // 스트림 할당을 위한 useEffect
    useEffect(() => {
        if (isCameraOn && streamRef.current && videoRef.current) {
            console.log('비디오 요소에 스트림 할당 중...');

            // 스트림 할당
            videoRef.current.srcObject = streamRef.current;

            console.log('스트림 할당 후 상태:', {
                srcObject: !!videoRef.current.srcObject,
                readyState: videoRef.current.readyState,
                videoWidth: videoRef.current.videoWidth,
                videoHeight: videoRef.current.videoHeight
            });

            // 재생 시도
            videoRef.current.play().then(() => {
                console.log('비디오 재생 시작 성공');
            }).catch((playError) => {
                console.log('비디오 초기 재생 실패 (정상적):', playError.message);
            });

            console.log('비디오 요소 설정 완료:', {
                srcObject: !!videoRef.current.srcObject,
                autoplay: videoRef.current.autoplay,
                playsInline: videoRef.current.playsInline,
                muted: videoRef.current.muted,
                width: videoRef.current.width,
                height: videoRef.current.height
            });
        }
    }, [isCameraOn]);

    // 웹캠 중지
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraOn(false);
    }, []);

    // 컴포넌트 마운트/언마운트 처리
    useEffect(() => {
        if (isActive) {
            startCamera();
        } else {
            stopCamera();
        }

        return () => {
            stopCamera();
        };
    }, [isActive, startCamera, stopCamera]);

    return (
        <div className="emotion-camera">
            {/* 카메라 제어 버튼 및 공간 완전 삭제 */}

            <div className="camera-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="camera-video custom-camera-video"
                />
                {/* 사용자 아바타 오버레이 */}
                {showAvatarOverlay && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '40%',
                            height: '40%',
                            opacity: 0.40,
                            pointerEvents: 'none',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'flex-start',
                        }}
                    >
                        <RealisticAvatar3D
                            avatarUrl={userAvatar}
                            isTalking={isUserTalking}
                            emotion={userEmotion}
                            mouthTrigger={mouthTrigger}
                            position="right"
                            size="100%"
                            showEmotionIndicator={false}
                            emotionCaptureStatus={emotionCaptureStatus}
                            enableTracking={enableTracking}
                        />
                    </div>
                )}
                {/* 오류 메시지 */}
                {error && (
                    <div className="error-message">
                        <span>{error}</span>
                        <button onClick={startCamera} className="retry-button">
                            다시 시도
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmotionCamera; 