import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// 새로운 3D 아바타 모델 컴포넌트
function AvatarModel({ isTalking, emotion, mouthTrigger }) {
    const groupRef = useRef();
    const headRef = useRef();
    const leftEyeRef = useRef();
    const rightEyeRef = useRef();
    const mouthRef = useRef();
    const leftEyebrowRef = useRef();
    const rightEyebrowRef = useRef();

    const [mouthOpen, setMouthOpen] = useState(0);
    const [eyeBlink, setEyeBlink] = useState(0);
    const [currentEmotion, setCurrentEmotion] = useState('neutral');

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

    // 감정에 따른 색상과 표정 변화
    const getEmotionStyle = (emotion) => {
        switch (emotion) {
            case 'happy':
                return {
                    skinColor: '#FFE4B5',
                    eyebrowRotation: 0.3,
                    mouthCurve: 0.2,
                    eyeScale: 1.1
                };
            case 'sad':
                return {
                    skinColor: '#E6E6FA',
                    eyebrowRotation: -0.2,
                    mouthCurve: -0.3,
                    eyeScale: 0.9
                };
            case 'angry':
                return {
                    skinColor: '#FFB6C1',
                    eyebrowRotation: -0.5,
                    mouthCurve: -0.1,
                    eyeScale: 0.8
                };
            case 'surprised':
                return {
                    skinColor: '#F0F8FF',
                    eyebrowRotation: 0.8,
                    mouthCurve: 0.4,
                    eyeScale: 1.3
                };
            default:
                return {
                    skinColor: '#FFE4B5',
                    eyebrowRotation: 0,
                    mouthCurve: 0,
                    eyeScale: 1.0
                };
        }
    };

    // 애니메이션 프레임
    useFrame(() => {
        if (groupRef.current) {
            // 아바타가 자연스럽게 살짝 움직이도록
            groupRef.current.rotation.y += 0.001;

            // 감정에 따른 미세한 움직임
            const emotionStyle = getEmotionStyle(currentEmotion);

            // 눈 깜빡임 애니메이션
            if (leftEyeRef.current && rightEyeRef.current) {
                const eyeScale = eyeBlink * emotionStyle.eyeScale;
                leftEyeRef.current.scale.y = eyeScale;
                rightEyeRef.current.scale.y = eyeScale;
            }

            // 입 애니메이션
            if (mouthRef.current) {
                const mouthScale = 1 + mouthOpen * 0.3;
                mouthRef.current.scale.y = mouthScale;
            }

            // 눈썹 애니메이션
            if (leftEyebrowRef.current && rightEyebrowRef.current) {
                leftEyebrowRef.current.rotation.z = emotionStyle.eyebrowRotation;
                rightEyebrowRef.current.rotation.z = emotionStyle.eyebrowRotation;
            }
        }
    });

    const emotionStyle = getEmotionStyle(currentEmotion);

    return (
        <group ref={groupRef} position={[0, 0, 0]} scale={[1, 1, 1]}>
            {/* 머리 */}
            <mesh ref={headRef} position={[0, 1.5, 0]}>
                <sphereGeometry args={[0.8, 16, 16]} />
                <meshStandardMaterial color={emotionStyle.skinColor} />
            </mesh>

            {/* 왼쪽 눈 */}
            <mesh ref={leftEyeRef} position={[-0.25, 1.6, 0.7]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshStandardMaterial color="#FFFFFF" />
            </mesh>

            {/* 왼쪽 눈동자 */}
            <mesh position={[-0.25, 1.6, 0.78]}>
                <sphereGeometry args={[0.04, 8, 8]} />
                <meshStandardMaterial color="#000000" />
            </mesh>

            {/* 오른쪽 눈 */}
            <mesh ref={rightEyeRef} position={[0.25, 1.6, 0.7]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshStandardMaterial color="#FFFFFF" />
            </mesh>

            {/* 오른쪽 눈동자 */}
            <mesh position={[0.25, 1.6, 0.78]}>
                <sphereGeometry args={[0.04, 8, 8]} />
                <meshStandardMaterial color="#000000" />
            </mesh>

            {/* 왼쪽 눈썹 */}
            <mesh ref={leftEyebrowRef} position={[-0.25, 1.75, 0.65]}>
                <boxGeometry args={[0.15, 0.02, 0.02]} />
                <meshStandardMaterial color="#000000" />
            </mesh>

            {/* 오른쪽 눈썹 */}
            <mesh ref={rightEyebrowRef} position={[0.25, 1.75, 0.65]}>
                <boxGeometry args={[0.15, 0.02, 0.02]} />
                <meshStandardMaterial color="#000000" />
            </mesh>

            {/* 입 */}
            <mesh ref={mouthRef} position={[0, 1.2, 0.75]}>
                <boxGeometry args={[0.3, 0.05, 0.05]} />
                <meshStandardMaterial color="#FF6B6B" />
            </mesh>

            {/* 몸통 */}
            <mesh position={[0, 0.3, 0]}>
                <cylinderGeometry args={[0.6, 0.8, 1.2, 16]} />
                <meshStandardMaterial color="#4A90E2" />
            </mesh>

            {/* 왼쪽 팔 */}
            <mesh position={[-1, 0.5, 0]}>
                <cylinderGeometry args={[0.15, 0.15, 1, 8]} />
                <meshStandardMaterial color="#4A90E2" />
            </mesh>

            {/* 오른쪽 팔 */}
            <mesh position={[1, 0.5, 0]}>
                <cylinderGeometry args={[0.15, 0.15, 1, 8]} />
                <meshStandardMaterial color="#4A90E2" />
            </mesh>

            {/* 왼쪽 다리 */}
            <mesh position={[-0.3, -1, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 1.5, 8]} />
                <meshStandardMaterial color="#2C3E50" />
            </mesh>

            {/* 오른쪽 다리 */}
            <mesh position={[0.3, -1, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 1.5, 8]} />
                <meshStandardMaterial color="#2C3E50" />
            </mesh>
        </group>
    );
}

// 새로운 3D 아바타 컴포넌트
function NewAvatar3D({
    isTalking = false,
    emotion = 'neutral',
    mouthTrigger = 0,
    position = 'right',
    size = 300,
    showEmotionIndicator = true,
    emotionCaptureStatus = false,
    onAvatarClick = null
}) {
    const [isHovered, setIsHovered] = useState(false);

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
            className="new-avatar-3d"
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
                camera={{ position: [0, 0, 5], fov: 75 }}
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
                <ambientLight intensity={0.6} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <pointLight position={[-10, -10, -5]} intensity={0.5} />

                {/* 아바타 모델 */}
                <Suspense fallback={null}>
                    <AvatarModel
                        isTalking={isTalking}
                        emotion={emotion}
                        mouthTrigger={mouthTrigger}
                    />
                </Suspense>

                {/* 카메라 컨트롤 */}
                <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    maxPolarAngle={Math.PI / 2}
                    minPolarAngle={Math.PI / 2}
                />
            </Canvas>

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
                        transition: 'all 0.3s ease'
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
                    gap: '5px'
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
                        zIndex: 10
                    }}
                >
                    {emotion} 아바타
                </div>
            )}
        </div>
    );
}

export default NewAvatar3D; 