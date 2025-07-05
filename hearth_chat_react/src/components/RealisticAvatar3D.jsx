import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import SimpleTestAvatar from './SimpleTestAvatar';

// Ready Player Me 아바타 모델 컴포넌트
function ReadyPlayerMeAvatar({ avatarUrl, isTalking, emotion, mouthTrigger, onLoadSuccess, onLoadError, position }) {
    const [gltf, setGltf] = useState(null);
    const [error, setError] = useState(null);
    const avatarRef = useRef();
    const [mouthOpen, setMouthOpen] = useState(0);
    const [eyeBlink, setEyeBlink] = useState(0);
    const [currentEmotion, setCurrentEmotion] = useState('neutral');

    // GLTF 모델 로딩
    useEffect(() => {
        if (!avatarUrl) return;

        console.log('GLB 파일 로딩 시작:', avatarUrl);
        const loader = new GLTFLoader();

        loader.load(
            avatarUrl,
            (gltf) => {
                console.log('Ready Player Me 아바타 로딩 성공:', avatarUrl);
                console.log('GLB 모델 정보:', gltf);
                console.log('GLB 씬 구조:', gltf.scene);

                // 모델 구조 분석
                gltf.scene.traverse((child) => {
                    if (child.isMesh) {
                        console.log('Mesh 발견:', child.name);
                        console.log('Geometry:', child.geometry);
                        console.log('Material:', child.material);
                        if (child.morphTargetDictionary) {
                            console.log('Morph Targets:', child.morphTargetDictionary);
                        }
                    }
                });

                setGltf(gltf);
                if (onLoadSuccess) onLoadSuccess();
            },
            (progress) => {
                console.log('로딩 진행률:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('Ready Player Me 아바타 로딩 실패:', error);
                setError('아바타 모델을 로드할 수 없습니다.');
                if (onLoadError) onLoadError(error);
            }
        );
    }, [avatarUrl, onLoadSuccess, onLoadError]);

    // 컴포넌트 마운트 시 눈 상태 초기화
    useEffect(() => {
        setEyeBlink(1);
        const resetTimeout = setTimeout(() => {
            setEyeBlink(1);
        }, 50);

        return () => {
            setEyeBlink(1);
            clearTimeout(resetTimeout);
        };
    }, []);

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
    }, [mouthTrigger]);

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

    // morph target 적용 (입, 눈, 감정)
    useEffect(() => {
        if (!gltf) return;

        console.log('Morph target 적용 시작');
        const scene = gltf.scene;

        // 아바타 모델을 중앙에 위치시키고 크기 조정
        // chat_box -> 203, 아바타 모델 full half 선택 라인
        // half 모델
        // scene.position.set(0, -5.5, 0);
        // scene.scale.set(9, 9, 9);
        // full 모델 : m과 f 의 키 차이가 나서 둘의 얼굴이  중앙에 배치가 안됨
        // position prop에 따라 다른 위치 설정
        // scene.position.set(0, -13.5, 0);
        if (position === 'left') {
            // 왼쪽 아바타 (사용자) - 키가 작은 경우
            scene.position.set(0, -13.8, 0); // Y값을 조정
        } else {
            // 오른쪽 아바타 (AI) - 키가 큰 경우  
            scene.position.set(0, -13.2, 0); // Y값을 조정
        }
        scene.scale.set(8, 8, 8);

        scene.traverse((child) => {
            if (child.isMesh) {
                console.log('Mesh 처리 중:', child.name);
                if (child.morphTargetDictionary) {
                    const morphTargetDictionary = child.morphTargetDictionary;
                    const morphTargetInfluences = child.morphTargetInfluences;

                    // 입 관련 morph target 찾기
                    const mouthTargets = Object.keys(morphTargetDictionary).filter(name =>
                        name.toLowerCase().includes('mouth') ||
                        name.toLowerCase().includes('jaw') ||
                        name.toLowerCase().includes('open')
                    );

                    // 눈 관련 morph target 찾기
                    const eyeTargets = Object.keys(morphTargetDictionary).filter(name =>
                        name.toLowerCase().includes('eye') ||
                        name.toLowerCase().includes('blink')
                    );

                    // 입 애니메이션 적용
                    mouthTargets.forEach(targetName => {
                        const index = morphTargetDictionary[targetName];
                        if (index !== undefined) {
                            morphTargetInfluences[index] = mouthOpen;
                        }
                    });

                    // 눈 깜빡임 적용
                    eyeTargets.forEach(targetName => {
                        const index = morphTargetDictionary[targetName];
                        if (index !== undefined) {
                            morphTargetInfluences[index] = eyeBlink;
                        }
                    });

                    // 감정 morph target 찾기 및 적용
                    const emotionTargets = Object.keys(morphTargetDictionary).filter(name => {
                        const lowerName = name.toLowerCase();
                        return lowerName.includes('happy') ||
                            lowerName.includes('sad') ||
                            lowerName.includes('angry') ||
                            lowerName.includes('surprised') ||
                            lowerName.includes('smile') ||
                            lowerName.includes('frown');
                    });

                    // 감정에 따른 morph target 적용
                    emotionTargets.forEach(targetName => {
                        const index = morphTargetDictionary[targetName];
                        if (index !== undefined) {
                            let intensity = 0;

                            switch (currentEmotion) {
                                case 'happy':
                                    if (targetName.toLowerCase().includes('happy') || targetName.toLowerCase().includes('smile')) {
                                        intensity = 1.0;
                                    }
                                    break;
                                case 'sad':
                                    if (targetName.toLowerCase().includes('sad') || targetName.toLowerCase().includes('frown')) {
                                        intensity = 1.0;
                                    }
                                    break;
                                case 'angry':
                                    if (targetName.toLowerCase().includes('angry')) {
                                        intensity = 1.0;
                                    }
                                    break;
                                case 'surprised':
                                    if (targetName.toLowerCase().includes('surprised')) {
                                        intensity = 1.0;
                                    }
                                    break;
                                default:
                                    intensity = 0;
                            }

                            morphTargetInfluences[index] = intensity;
                        }
                    });
                }
            }
        });
    }, [gltf, mouthOpen, eyeBlink, currentEmotion, position]);

    // 애니메이션 프레임
    useFrame((state) => {
        if (avatarRef.current) {
            // 아바타가 앞면을 보면서 양쪽으로 30도씩 움직이도록
            const time = state.clock.elapsedTime;
            const rotationRange = Math.PI / 12; // 30도 (π/6 라디안)
            const rotationSpeed = 0.1; // 회전 속도

            avatarRef.current.rotation.y = Math.sin(time * rotationSpeed) * rotationRange;
        }
    });

    if (error) {
        return null;
    }

    if (!gltf) {
        return null;
    }

    return (
        <primitive
            ref={avatarRef}
            object={gltf.scene}
            scale={[1, 1, 1]}
            position={[0, 0, 0]}
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

    // GLB 로딩 성공/실패 콜백
    const handleLoadSuccess = () => {
        console.log('GLB 아바타 로딩 성공!');
        setGltfLoaded(true);
        setUseFallbackAvatar(false);
        setLoadError(null);
    };

    const handleLoadError = (error) => {
        console.log('GLB 로딩 실패, 테스트 아바타로 fallback:', error);
        setUseFallbackAvatar(true);
        setLoadError('아바타 모델을 로드할 수 없습니다.');
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
                camera={{ position: [0, 1, 3], fov: 60 }}
                gl={{
                    antialias: true,
                    alpha: false,
                    powerPreference: "high-performance",
                    failIfMajorPerformanceCaveat: false
                }}
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

                {/* Ready Player Me 아바타 모델 또는 테스트 아바타 */}
                <Suspense fallback={null}>
                    {avatarUrl && !useFallbackAvatar ? (
                        <ReadyPlayerMeAvatar
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
                    fontSize: '14px',
                    textAlign: 'center',
                    zIndex: 10
                }}>
                    아바타 URL이 없습니다.
                </div>
            )}
            {loadError && useFallbackAvatar && (
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    color: '#ff0000',
                    fontSize: '12px',
                    textAlign: 'center',
                    zIndex: 10,
                    background: 'rgba(255, 255, 255, 0.8)',
                    padding: '5px',
                    borderRadius: '5px'
                }}>
                    {loadError}
                </div>
            )}

            {/* 감정 표시 오버레이 */}
            {showEmotionIndicator && (
                <div
                    className="emotion-indicator"
                    style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        background: emotionCaptureStatus ? 'rgba(76, 175, 80, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        padding: '8px 12px',
                        borderRadius: '20px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                        transition: 'all 0.3s ease',
                        zIndex: 10
                    }}
                >
                    {getEmotionDisplay(emotion)}
                </div>
            )}

            {/* 상태 표시 */}
            <div
                className="status-indicator"
                style={{
                    position: 'absolute',
                    bottom: '10px',
                    right: '10px',
                    display: 'flex',
                    gap: '5px',
                    zIndex: 10
                }}
            >
                {isTalking && (
                    <div
                        style={{
                            background: 'rgba(255, 107, 107, 0.9)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                        }}
                    >
                        🗣️ 말하는 중
                    </div>
                )}

                {emotionCaptureStatus && (
                    <div
                        style={{
                            background: 'rgba(76, 175, 80, 0.9)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                        }}
                    >
                        📷 감정 감지
                    </div>
                )}
            </div>

            {/* 호버 효과 */}
            {isHovered && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        padding: '10px 15px',
                        borderRadius: '10px',
                        fontSize: '14px',
                        pointerEvents: 'none',
                        zIndex: 20
                    }}
                >
                    {emotion} 아바타
                </div>
            )}
        </div>
    );
}

export default RealisticAvatar3D; 