import React, { useRef, useEffect, useState, Suspense, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import SimpleTestAvatar from './SimpleTestAvatar';

// VRM 아바타 컴포넌트
function VRMAvatar({ avatarUrl, isTalking, emotion, mouthTrigger, onLoadSuccess, onLoadError, position }) {
    const [vrm, setVrm] = useState(null);
    const [error, setError] = useState(null);
    const avatarRef = useRef();
    const [mouthOpen, setMouthOpen] = useState(0);
    const [eyeBlink, setEyeBlink] = useState(0);
    const [currentEmotion, setCurrentEmotion] = useState('neutral');

    // VRM 모델 로딩
    useEffect(() => {
        if (!avatarUrl) return;
        setVrm(null);
        setError(null);
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));
        loader.load(
            avatarUrl,
            (gltf) => {
                const vrmInstance = gltf.userData.vrm;
                if (!vrmInstance) {
                    setError('VRM 변환 실패');
                    if (onLoadError) onLoadError('VRM 변환 실패');
                    return;
                }
                VRMUtils.removeUnnecessaryJoints(vrmInstance.scene);
                // vrmInstance.scene.rotation.y = Math.PI; // 좌우 반전, 180도 회전
                vrmInstance.scene.rotation.y = 0;
                    if (position === 'left') {
                    vrmInstance.scene.position.set(0, 0, 0);
                    } else {
                    vrmInstance.scene.position.set(0, 0, 0);
                    }
                    vrmInstance.scene.scale.set(1.2, 1.2, 1.2);
                    setVrm(vrmInstance);
                    if (onLoadSuccess) onLoadSuccess();
            },
            undefined,
            (e) => {
                setError('VRM 파일 로드 실패');
                if (onLoadError) onLoadError(e);
            }
        );
    }, [avatarUrl, onLoadSuccess, onLoadError, position]);

    // 립싱크: mouthTrigger가 바뀔 때마다 입을 잠깐 열었다 닫음
    useEffect(() => {
        if (mouthTrigger === undefined) return;
        if (mouthTrigger === 0) {
            setMouthOpen(0);
        } else {
            if (mouthTrigger % 9 < 4) {
                setMouthOpen(1);
            } else {
                setMouthOpen(0);
            }
        }
    }, [mouthTrigger, isTalking]);

    // isTalking이 false가 되면 입을 닫고 눈을 뜨게 함
    useEffect(() => {
        if (!isTalking) {
            setMouthOpen(0);
            setTimeout(() => {
                setEyeBlink(1);
            }, 100);
        }
    }, [isTalking]);

    // 눈 깜빡임
    useEffect(() => {
        let running = true;
        let blinkTimeout;
        let nextBlinkTimeout;
        function blinkLoop() {
            if (!running) return;
            if (isTalking) {
                if (blinkTimeout) {
                    clearTimeout(blinkTimeout);
                    blinkTimeout = null;
                }
                setEyeBlink(1);
                nextBlinkTimeout = setTimeout(blinkLoop, 1000);
                return;
            }
            setEyeBlink(0);
            blinkTimeout = setTimeout(() => {
                if (!running || isTalking) {
                    setEyeBlink(1);
                    return;
                }
                setEyeBlink(1);
                if (!isTalking && running) {
                    nextBlinkTimeout = setTimeout(blinkLoop, 3000 + Math.random() * 5000);
                }
            }, 100 + Math.random() * 100);
        }
        if (blinkTimeout) clearTimeout(blinkTimeout);
        if (nextBlinkTimeout) clearTimeout(nextBlinkTimeout);
        setEyeBlink(1);
        if (!isTalking) {
            nextBlinkTimeout = setTimeout(blinkLoop, 1500 + Math.random() * 2000);
        } else {
            nextBlinkTimeout = setTimeout(blinkLoop, 1000);
        }
        return () => {
            running = false;
            setEyeBlink(1);
            if (blinkTimeout) clearTimeout(blinkTimeout);
            if (nextBlinkTimeout) clearTimeout(nextBlinkTimeout);
        };
    }, [isTalking]);

    // 감정 변화 처리
    useEffect(() => {
        if (emotion !== currentEmotion) {
            setCurrentEmotion(emotion);
        }
    }, [emotion, currentEmotion]);

    // VRM 표정/립싱크/눈깜빡임/감정 적용 (최적화)
    useFrame(() => {
        if (!vrm) return;

        // VRM 내부 애니메이션 업데이트
        if (vrm.update) {
            vrm.update(1 / 60); // 60fps로 복원
        }

        // 표정 설정
        if (vrm.expressionManager) {
            // 기본 표정 설정
            vrm.expressionManager.setValue('neutral', 1.0);

            // 립싱크 (더 명확하게)
            if (mouthOpen > 0) {
                vrm.expressionManager.setValue('aa', 0.8);
                vrm.expressionManager.setValue('ih', 0.6);
            } else {
            vrm.expressionManager.setValue('aa', 0);
            vrm.expressionManager.setValue('ih', 0);
            }

            // 눈깜빡임
            vrm.expressionManager.setValue('blink', 1.0 - eyeBlink);
        }
    });

    if (error) {
        return null;
    }
    if (!vrm) {
        return null;
    }
    return (
        <primitive
            ref={avatarRef}
            object={vrm.scene}
            scale={[14, 14, 14]}
            position={position === 'left' ? [0, -22, 0] : [0, -20, 0]}
        />
    );
}

// Ready Player Me 3D 아바타 컴포넌트
function RealisticAvatar3D({
    avatarUrl,
    isTalking = false,
    emotion = 'neutral',
    mouthTrigger = 0,
    position = 'right',
    size = 640,
    showEmotionIndicator = true,
    emotionCaptureStatus = false,
    onAvatarClick = null
}) {
    const [isHovered, setIsHovered] = useState(false);
    const [gltfLoaded, setGltfLoaded] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [useFallbackAvatar, setUseFallbackAvatar] = useState(false);

    // VRM 로딩 성공/실패 콜백 (useCallback으로 안정화)
    const handleLoadSuccess = useCallback(() => {
        console.log('VRM 아바타 로딩 성공!');
        setGltfLoaded(true);
        setUseFallbackAvatar(false);
        setLoadError(null);
    }, []);

    const handleLoadError = useCallback((error) => {
        console.log('VRM 로딩 실패, 테스트 아바타로 fallback:', error);
        setUseFallbackAvatar(true);
        setLoadError('아바타 모델을 로드할 수 없습니다.');
    }, []);

    // 감정 표시 텍스트
    const getEmotionDisplay = (emotion) => {
        const emotionMap = {
            'happy': '😊',
            'sad': '😢',
            'angry': '😠',
            'surprised': '😲',
            'neutral': '😐'
        };
        return emotionMap[emotion] || '😐';
    };



    return (
        <div
            className="realistic-avatar-3d"
            style={{
                width: `${size}px`,
                height: `${size}px`,
                position: 'relative',
                cursor: onAvatarClick ? 'pointer' : 'default'
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onAvatarClick}
        >
            {/* 3D 캔버스 */}
            <Canvas
                camera={{ position: [0, 1, 3], fov: 90 }}
                gl={{
                    antialias: false,
                    alpha: false,
                    powerPreference: "high-performance",
                    failIfMajorPerformanceCaveat: false,
                    stencil: false,
                    depth: true
                }}
                frameloop="always"
                dpr={[1, 2]}
                style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '15px',
                    border: isHovered ? '3px solid #4A90E2' : '3px solid transparent',
                    transition: 'all 0.3s ease'
                }}
            >
                {/* 조명 */}
                <ambientLight intensity={0.8} />
                <directionalLight position={[5, 5, 5]} intensity={1.2} />
                <directionalLight position={[-5, 5, 5]} intensity={0.8} />
                <pointLight position={[0, 2, 2]} intensity={0.5} />

                {/* VRM 아바타 모델 또는 테스트 아바타 */}
                <Suspense fallback={null}>
                    {avatarUrl && !useFallbackAvatar ? (
                        <VRMAvatar
                            avatarUrl={avatarUrl}
                            isTalking={isTalking}
                            emotion={emotion}
                            mouthTrigger={mouthTrigger}
                            onLoadSuccess={handleLoadSuccess}
                            onLoadError={handleLoadError}
                            position={position}
                        />
                    ) : (
                        <SimpleTestAvatar
                            isTalking={isTalking}
                            emotion={emotion}
                            mouthTrigger={mouthTrigger}
                        />
                    )}
                </Suspense>

                {/* 카메라 컨트롤 */}
                <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    maxPolarAngle={Math.PI / 2}
                    minPolarAngle={Math.PI / 2}
                />
            </Canvas>

            {/* 로딩/에러 메시지 (Canvas 바깥) */}
            {!avatarUrl && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#ffffff',
                    fontSize: '16px',
                    textAlign: 'center',
                    zIndex: 10
                }}>
                    아바타 URL이 설정되지 않았습니다.
                </div>
            )}

            {loadError && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#ff6b6b',
                    fontSize: '14px',
                    textAlign: 'center',
                    zIndex: 10,
                    background: 'rgba(0,0,0,0.7)',
                    padding: '10px',
                    borderRadius: '5px'
                }}>
                    {loadError}
                </div>
            )}

            {/* 감정 표시 (Canvas 바깥) */}
            {showEmotionIndicator && emotion !== 'neutral' && (
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    fontSize: '24px',
                    zIndex: 10,
                    animation: emotionCaptureStatus ? 'pulse 1s infinite' : 'none'
                }}>
                    {getEmotionDisplay(emotion)}
                </div>
            )}

            {/* 호버 효과 */}
            {isHovered && (
                <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    background: 'rgba(74, 144, 226, 0.1)',
                    borderRadius: '15px',
                    pointerEvents: 'none',
                    zIndex: 5
                }} />
            )}
        </div>
    );
}

export default RealisticAvatar3D; 