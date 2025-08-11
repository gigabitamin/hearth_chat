import React, { useRef, useEffect, useState, useCallback } from 'react';
import './EmotionCamera.css';
import RealisticAvatar3D from './RealisticAvatar3D';

const EmotionCamera = ({ isActive = true, hideControls = false, userAvatar, userEmotion, isUserTalking, mouthTrigger, emotionCaptureStatus, enableTracking, showAvatarOverlay }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [error, setError] = useState(null);

    // 카메라 전환 관련 상태
    const [availableCameras, setAvailableCameras] = useState([]);
    const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
    const [isMobile, setIsMobile] = useState(false);

    // 모바일 감지
    useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent.toLowerCase();
            const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
            setIsMobile(isMobileDevice);
            console.log('[카메라] 모바일 감지:', isMobileDevice);
        };
        checkMobile();
    }, []);

    // 사용 가능한 카메라 목록 가져오기
    const getAvailableCameras = useCallback(async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');

            // 모바일에서는 후면 카메라를 우선으로 정렬
            if (isMobile) {
                videoDevices.sort((a, b) => {
                    const aIsBack = a.label.toLowerCase().includes('back') || a.label.toLowerCase().includes('후면');
                    const bIsBack = b.label.toLowerCase().includes('back') || b.label.toLowerCase().includes('후면');
                    if (aIsBack && !bIsBack) return -1;
                    if (!aIsBack && bIsBack) return 1;
                    return 0;
                });
            }

            setAvailableCameras(videoDevices);
            console.log('[카메라] 사용 가능한 카메라 목록:', videoDevices);

            // 모바일에서 후면 카메라가 있으면 기본 선택
            if (isMobile && videoDevices.length > 0) {
                const backCameraIndex = videoDevices.findIndex(device =>
                    device.label.toLowerCase().includes('back') ||
                    device.label.toLowerCase().includes('후면')
                );
                if (backCameraIndex !== -1) {
                    setCurrentCameraIndex(backCameraIndex);
                    console.log('[카메라] 모바일 후면 카메라 기본 선택:', backCameraIndex);
                }
            }
        } catch (err) {
            console.error('[카메라] 카메라 목록 가져오기 실패:', err);
        }
    }, [isMobile]);

    // 다음 카메라로 전환
    const switchToNextCamera = useCallback(async () => {
        if (availableCameras.length <= 1) {
            console.log('[카메라] 전환 가능한 카메라가 없음');
            return;
        }

        // 현재 카메라 중지
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        // 다음 카메라 인덱스 계산
        const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
        setCurrentCameraIndex(nextIndex);

        console.log('[카메라] 다음 카메라로 전환:', nextIndex, availableCameras[nextIndex]?.label);

        // 새 카메라로 시작
        await startCamera();
    }, [availableCameras, currentCameraIndex]);

    // 웹캠 시작
    const startCamera = useCallback(async () => {
        try {
            setError(null);
            console.log('[카메라] 웹캠 시작 시도...');

            // 사용 가능한 카메라 목록이 없으면 가져오기
            if (availableCameras.length === 0) {
                await getAvailableCameras();
            }

            // 현재 선택된 카메라의 deviceId 사용
            const currentCamera = availableCameras[currentCameraIndex];
            const constraints = {
                video: {
                    width: { min: 320, ideal: 640, max: 1280 },
                    height: { min: 240, ideal: 480, max: 720 },
                    frameRate: { ideal: 30 },
                    aspectRatio: { ideal: 1.333333 }
                },
                audio: false
            };

            // 특정 카메라가 선택된 경우 deviceId 추가
            if (currentCamera && currentCamera.deviceId) {
                constraints.video.deviceId = { exact: currentCamera.deviceId };
                console.log('[카메라] 선택된 카메라:', currentCamera.label, currentCamera.deviceId);
            } else {
                // 모바일에서는 후면 카메라 우선
                if (isMobile) {
                    constraints.video.facingMode = 'environment';
                } else {
                    constraints.video.facingMode = 'user';
                }
                console.log('[카메라] 기본 카메라 설정 (facingMode):', constraints.video.facingMode);
            }

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            console.log('[카메라] 웹캠 스트림 획득 성공:', {
                id: stream.id,
                active: stream.active,
                cameraLabel: currentCamera?.label || '기본 카메라',
                tracks: stream.getTracks().map(track => ({
                    kind: track.kind,
                    enabled: track.enabled,
                    readyState: track.readyState
                }))
            });

            streamRef.current = stream;
            setIsCameraOn(true);

        } catch (err) {
            console.error('[카메라] 웹캠 시작 실패:', err);
            setError(`웹캠에 접근할 수 없습니다: ${err.message}`);
            alert(`웹캠에 접근할 수 없습니다: ${err.message}`);
        }
    }, [availableCameras, currentCameraIndex, isMobile, getAvailableCameras]);

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
            // 카메라 목록 가져오기
            getAvailableCameras();
            startCamera();
        } else {
            stopCamera();
        }

        return () => {
            stopCamera();
        };
    }, [isActive, startCamera, stopCamera, getAvailableCameras]);

    return (
        <div className="emotion-camera">
            {/* 카메라 제어 버튼 및 공간 완전 삭제 */}

            <div className="camera-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
                {/* 카메라 전환 버튼 */}
                {availableCameras.length > 1 && (
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        zIndex: 10
                    }}>
                        <button
                            onClick={switchToNextCamera}
                            style={{
                                padding: '8px 12px',
                                backgroundColor: '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                            title={`다음 카메라로 전환 (${currentCameraIndex + 1}/${availableCameras.length})`}
                        >
                            📷 {availableCameras[currentCameraIndex]?.label || '카메라'}
                        </button>

                        {/* 카메라 정보 표시 */}
                        <div style={{
                            position: 'absolute',
                            top: '40px',
                            right: '0px',
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            color: 'white',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            maxWidth: '150px',
                            textAlign: 'center'
                        }}>
                            {availableCameras[currentCameraIndex]?.label || '기본 카메라'}
                            <br />
                            <small>{currentCameraIndex + 1} / {availableCameras.length}</small>
                        </div>
                    </div>
                )}

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