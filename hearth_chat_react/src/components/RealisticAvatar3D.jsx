import React, { useRef, useEffect, useState, Suspense, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import SimpleTestAvatar from './SimpleTestAvatar';
import faceTrackingService from '../services/faceTrackingService';

// VRM 아바타 컴포넌트
function VRMAvatar({ avatarUrl, isTalking, emotion, mouthTrigger, onLoadSuccess, onLoadError, position, enableTracking = false }) {
    // console.log('=== [TEST 1] ===');

    const [vrm, setVrm] = useState(null);
    const [error, setError] = useState(null);
    const avatarRef = useRef();
    const [mouthOpen, setMouthOpen] = useState(0);
    const [eyeBlink, setEyeBlink] = useState(0);
    const [currentEmotion, setCurrentEmotion] = useState('neutral');

    // 트래킹 데이터 상태
    const [trackingData, setTrackingData] = useState({
        headRotation: { x: 0, y: 0, z: 0 },
        eyeBlink: { left: 0, right: 0 },
        mouthOpen: 0,
        eyebrowRaise: { left: 0, right: 0 },
        smile: 0,
        isDetected: false
    });

    // === state 추가 ===
    const [headRotationOffset, setHeadRotationOffset] = useState(null);
    const prevDetectedRef = useRef(false);

    // === 눈 깜빡임 보간 및 임계값 수치 선언 ===
    const BLINK_LERP_SPEED = 0.1; // 보간 속도 (0.05~0.3 추천)
    const BLINK_THRESHOLD = 0.03; // 임계값 (0.01~0.05 추천)
    const prevBlinkRef = useRef(0);
    const prevBlinkLeftRef = useRef(0);
    const prevBlinkRightRef = useRef(0);

    // === 눈 깜빡임 오프셋(눈 뜬 상태 기준점) ===
    const BLINK_SHAPE_MAX = 0.7;
    const [blinkOffset, setBlinkOffset] = useState(null);
    useEffect(() => {
        if (blinkOffset === null && trackingData.isDetected) {
            setBlinkOffset(Math.max(trackingData.eyeBlink.left, trackingData.eyeBlink.right));
        }
    }, [trackingData.isDetected, trackingData.eyeBlink.left, trackingData.eyeBlink.right, blinkOffset]);

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

                // VRM 초기화 개선 (안전한 방식)
                try {
                    // 새로운 방식으로 스켈레톤 최적화
                    if (VRMUtils.combineSkeletons) {
                        VRMUtils.combineSkeletons(vrmInstance.scene);
                    } else {
                        // fallback: deprecated 함수 사용
                        VRMUtils.removeUnnecessaryJoints(vrmInstance.scene);
                    }
                } catch (e) {
                    console.warn('VRM 스켈레톤 최적화 실패:', e);
                }

                // VRM 내부 업데이트 활성화
                if (vrmInstance.update) {
                    vrmInstance.update(1 / 60);
                }

                // 헤어 물리 시뮬레이션 활성화 (안전한 방식)
                if (vrmInstance.humanoid) {
                    try {
                        // 새로운 방식으로 본 노드 가져오기
                        const headBone = vrmInstance.humanoid.getNormalizedBoneNode ?
                            vrmInstance.humanoid.getNormalizedBoneNode('head') :
                            vrmInstance.humanoid.getBoneNode('head');

                        if (headBone) {
                            // 헤어 관련 본들에 물리 적용
                            vrmInstance.scene.traverse((child) => {
                                if (child.isBone && child.name.toLowerCase().includes('hair')) {
                                    child.visible = true;
                                    // 헤어 본들의 물리 속성 활성화
                                    if (child.userData && child.userData.springBone) {
                                        child.userData.springBone.enabled = true;
                                    }
                                }
                            });
                        }
                    } catch (e) {
                        console.warn('헤어 본 활성화 실패:', e);
                    }
                }

                // 스프링 본 매니저 초기화 및 활성화 (안전한 방식)
                if (vrmInstance.springBoneManager) {
                    try {
                        vrmInstance.springBoneManager.reset();
                        // 스프링 본 그룹이 존재하는지 확인 후 활성화
                        if (vrmInstance.springBoneManager.springBoneGroups &&
                            Array.isArray(vrmInstance.springBoneManager.springBoneGroups)) {
                            vrmInstance.springBoneManager.springBoneGroups.forEach(group => {
                                if (group && group.springBones && Array.isArray(group.springBones)) {
                                    group.springBones.forEach(springBone => {
                                        if (springBone) {
                                            springBone.enabled = true;
                                        }
                                    });
                                }
                            });
                        }
                    } catch (e) {
                        console.warn('스프링 본 매니저 초기화 실패:', e);
                    }
                }

                // 기본 포즈 설정 (T-pose에서 자연스러운 자세로) - 안전한 방식
                if (vrmInstance.humanoid) {
                    try {
                        // 새로운 방식으로 본 노드들 가져오기
                        const getBoneNode = (boneName) => {
                            return vrmInstance.humanoid.getNormalizedBoneNode ?
                                vrmInstance.humanoid.getNormalizedBoneNode(boneName) :
                                vrmInstance.humanoid.getBoneNode(boneName);
                        };

                        const leftArm = getBoneNode('leftUpperArm');
                        const rightArm = getBoneNode('rightUpperArm');
                        const leftForeArm = getBoneNode('leftLowerArm');
                        const rightForeArm = getBoneNode('rightLowerArm');

                        console.log('포즈 설정 시작:', {
                            leftArm: !!leftArm,
                            rightArm: !!rightArm,
                            leftForeArm: !!leftForeArm,
                            rightForeArm: !!rightForeArm
                        });

                        // T자 모양에서 팔을 더 많이 내린 상태로 설정
                        if (leftArm) {
                            // 왼팔을 T자에서 더 많이 내리기
                            leftArm.rotation.set(0, 0, -Math.PI / 3);
                            console.log('왼팔 포즈 설정 완료 (T자에서 더 내림)');
                        }
                        if (rightArm) {
                            // 오른팔을 T자에서 더 많이 내리기
                            rightArm.rotation.set(0, 0, Math.PI / 3);
                            console.log('오른팔 포즈 설정 완료 (T자에서 더 내림)');
                        }
                        if (leftForeArm) {
                            // 왼팔꿈치를 T자에서 더 많이 내리기
                            leftForeArm.rotation.set(0, 0, -Math.PI / 6);
                        }
                        if (rightForeArm) {
                            // 오른팔꿈치를 T자에서 더 많이 내리기
                            rightForeArm.rotation.set(0, 0, Math.PI / 6);
                        }

                        console.log('포즈 설정 완료');
                    } catch (e) {
                        console.warn('포즈 설정 실패:', e);
                    }
                }

                // 표정 매니저 초기화
                if (vrmInstance.expressionManager) {
                    // 모든 표정을 0으로 초기화
                    const expressions = vrmInstance.expressionManager.expressions;
                    Object.keys(expressions).forEach(expressionName => {
                        vrmInstance.expressionManager.setValue(expressionName, 0);
                    });
                    // 기본 표정 설정
                    vrmInstance.expressionManager.setValue('neutral', 1.0);
                }



                // 위치 및 회전 설정
                vrmInstance.scene.rotation.y = 0;
                if (position === 'left') {
                    vrmInstance.scene.position.set(0, 0, 0);
                } else {
                    vrmInstance.scene.position.set(0, 0, 0);
                }
                vrmInstance.scene.scale.set(1.2, 1.2, 1.2);

                setVrm(vrmInstance);
                if (onLoadSuccess) onLoadSuccess();

                console.log('VRM 모델 초기화 완료:', {
                    hasHumanoid: !!vrmInstance.humanoid,
                    hasExpressionManager: !!vrmInstance.expressionManager,
                    hasSpringBoneManager: !!vrmInstance.springBoneManager
                });
            },
            undefined,
            (e) => {
                setError('VRM 파일 로드 실패');
                if (onLoadError) onLoadError(e);
            }
        );
    }, [avatarUrl, onLoadSuccess, onLoadError, position]);

    // 트래킹 서비스 연동
    useEffect(() => {
        if (!enableTracking) return;

        console.log('트래킹 활성화됨 - VRMAvatar');

        const handleTrackingUpdate = (data) => {
            // 트래킹이 처음 감지될 때 오프셋 저장
            if (data.isDetected && !prevDetectedRef.current) {
                setHeadRotationOffset({
                    x: data.headRotation.x,
                    y: data.headRotation.y,
                    z: data.headRotation.z
                });
            }
            prevDetectedRef.current = data.isDetected;
            setTrackingData(data);
        };

        const handleFaceDetected = () => {
            console.log('얼굴이 감지되었습니다.');
        };

        const handleFaceLost = () => {
            console.log('얼굴이 감지되지 않습니다.');
        };

        faceTrackingService.on('trackingUpdate', handleTrackingUpdate);
        faceTrackingService.on('faceDetected', handleFaceDetected);
        faceTrackingService.on('faceLost', handleFaceLost);

        return () => {
            faceTrackingService.on('trackingUpdate', null);
            faceTrackingService.on('faceDetected', null);
            faceTrackingService.on('faceLost', null);
        };
    }, [enableTracking]);

    // 립싱크: mouthTrigger가 바뀔 때마다 입을 잠깐 열었다 닫음 (TTS 속도에 맞춤)
    useEffect(() => {
        if (enableTracking && trackingData.isDetected) {
            // 트래킹 데이터에서 입 벌림 사용
            setMouthOpen(trackingData.mouthOpen);
        } else if (mouthTrigger === undefined) {
            return;
        } else if (mouthTrigger === 0) {
            setMouthOpen(0);
        } else {
            // TTS 속도에 맞춰 더 자연스러운 립싱크 패턴
            if (mouthTrigger % 6 < 3) {
                setMouthOpen(1);
            } else {
                setMouthOpen(0);
            }
        }
    }, [mouthTrigger, isTalking, enableTracking, trackingData.mouthOpen, trackingData.isDetected]);

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

        // VRM 내부 애니메이션 업데이트 (헤어 물리 포함)
        if (vrm.update) {
            vrm.update(1 / 60); // 60fps로 복원
        }

        // 스프링 본 매니저 업데이트 (헤어 물리 시뮬레이션) - 안전한 방식
        if (vrm.springBoneManager && vrm.springBoneManager.update) {
            try {
                vrm.springBoneManager.update(1 / 60);
            } catch (e) {
                console.warn('스프링 본 업데이트 실패:', e);
            }
        }

        // 트래킹 데이터 적용
        if (enableTracking && trackingData.isDetected && vrm.humanoid) {
            console.log('트래킹 데이터 아바타에 적용:', trackingData.headRotation);

            // 머리 회전 적용
            const headBone = vrm.humanoid.getNormalizedBoneNode ?
                vrm.humanoid.getNormalizedBoneNode('head') :
                vrm.humanoid.getBoneNode('head');

            if (headBone) {
                // 오프셋 보정 적용
                let targetX = trackingData.headRotation.x;
                let targetY = trackingData.headRotation.y;
                let targetZ = trackingData.headRotation.z;
                if (headRotationOffset) {
                    targetX = trackingData.headRotation.x - headRotationOffset.x;
                    targetY = trackingData.headRotation.y - headRotationOffset.y;
                    targetZ = trackingData.headRotation.z - headRotationOffset.z;
                }
                // === 증폭(스케일) 적용 ===
                const HEAD_PITCH_SCALE = 3.0; // 고개 끄덕임 증폭 (1.5~3.0 사이에서 실험)
                targetX = -targetX * HEAD_PITCH_SCALE;
                // === (필요시) 라디안 변환 ===
                // targetX = THREE.MathUtils.degToRad(targetX); // 트래킹 데이터가 도(degree)라면 주석 해제

                headBone.rotation.x = THREE.MathUtils.lerp(
                    headBone.rotation.x,
                    targetX,
                    0.1
                );
                headBone.rotation.y = THREE.MathUtils.lerp(
                    headBone.rotation.y,
                    targetY,
                    0.1
                );
                headBone.rotation.z = THREE.MathUtils.lerp(
                    headBone.rotation.z,
                    targetZ,
                    0.1
                );
            }
        }

        // 표정 설정 - 안전한 방식
        if (vrm.expressionManager) {
            try {
                // 모든 표정을 0으로 초기화
                const expressions = vrm.expressionManager.expressions;
                if (expressions && typeof expressions === 'object') {
                    Object.keys(expressions).forEach(expressionName => {
                        vrm.expressionManager.setValue(expressionName, 0);
                    });
                }

                // 기본 표정 설정
                vrm.expressionManager.setValue('neutral', 1.0);

                // 트래킹 데이터 우선 적용
                if (enableTracking && trackingData.isDetected) {
                    // === 눈 트래킹(깜빡임) 표준 적용 ===
                    const blinkValue = Math.max(trackingData.eyeBlink.left, trackingData.eyeBlink.right);
                    const blinkLeft = trackingData.eyeBlink.left;
                    const blinkRight = trackingData.eyeBlink.right;
                    // === 오프셋 보정 적용 ===
                    const adjustedBlink = Math.max(0, blinkValue - (blinkOffset ?? 0));
                    const adjustedBlinkLeft = Math.max(0, blinkLeft - (blinkOffset ?? 0));
                    const adjustedBlinkRight = Math.max(0, blinkRight - (blinkOffset ?? 0));
                    // === 정규화 구간 ===
                    let minBlink = 0.0;
                    let maxBlink = 0.01;
                    let normalizedBlink = (adjustedBlink - minBlink) / (maxBlink - minBlink);
                    normalizedBlink = Math.min(Math.max(normalizedBlink, 0), 1);
                    let normalizedBlinkLeft = (adjustedBlinkLeft - minBlink) / (maxBlink - minBlink);
                    normalizedBlinkLeft = Math.min(Math.max(normalizedBlinkLeft, 0), 1);
                    let normalizedBlinkRight = (adjustedBlinkRight - minBlink) / (maxBlink - minBlink);
                    normalizedBlinkRight = Math.min(Math.max(normalizedBlinkRight, 0), 1);
                    // === lerp(보간) 및 임계값 적용(기존 유지) ===
                    let lerpedBlink = prevBlinkRef.current + (normalizedBlink - prevBlinkRef.current) * BLINK_LERP_SPEED;
                    if (Math.abs(lerpedBlink - prevBlinkRef.current) < BLINK_THRESHOLD) {
                        lerpedBlink = prevBlinkRef.current;
                    }
                    prevBlinkRef.current = lerpedBlink;
                    let lerpedBlinkLeft = prevBlinkLeftRef.current + (normalizedBlinkLeft - prevBlinkLeftRef.current) * BLINK_LERP_SPEED;
                    if (Math.abs(lerpedBlinkLeft - prevBlinkLeftRef.current) < BLINK_THRESHOLD) {
                        lerpedBlinkLeft = prevBlinkLeftRef.current;
                    }
                    prevBlinkLeftRef.current = lerpedBlinkLeft;
                    let lerpedBlinkRight = prevBlinkRightRef.current + (normalizedBlinkRight - prevBlinkRightRef.current) * BLINK_LERP_SPEED;
                    if (Math.abs(lerpedBlinkRight - prevBlinkRightRef.current) < BLINK_THRESHOLD) {
                        lerpedBlinkRight = prevBlinkRightRef.current;
                    }
                    prevBlinkRightRef.current = lerpedBlinkRight;
                    const BLINK_OFFSET = -0.2;
                    vrm.expressionManager.setValue('blink', lerpedBlink * BLINK_SHAPE_MAX + BLINK_OFFSET);
                    vrm.expressionManager.setValue('blinkLeft', lerpedBlinkLeft * BLINK_SHAPE_MAX + BLINK_OFFSET);
                    vrm.expressionManager.setValue('blinkRight', lerpedBlinkRight * BLINK_SHAPE_MAX + BLINK_OFFSET);
                    console.log('[EYE BLINK] blink:', blinkValue, 'offset:', blinkOffset, 'adjusted:', adjustedBlink, 'normalized:', normalizedBlink, 'lerped:', lerpedBlink, 'blinkLeft:', blinkLeft, 'blinkRight:', blinkRight);
                }

                // 립싱크 (트래킹 데이터 우선)
                if (enableTracking && trackingData.isDetected) {
                    // 트래킹 데이터에서 입 벌림 사용
                    if (trackingData.mouthOpen > 0.1) {
                        vrm.expressionManager.setValue('aa', trackingData.mouthOpen * 0.8);
                        vrm.expressionManager.setValue('ih', trackingData.mouthOpen * 0.6);
                    } else {
                        vrm.expressionManager.setValue('aa', 0);
                        vrm.expressionManager.setValue('ih', 0);
                    }
                } else {
                    // 기존 립싱크
                    if (mouthOpen > 0) {
                        vrm.expressionManager.setValue('aa', 0.8);
                        vrm.expressionManager.setValue('ih', 0.6);
                    } else {
                        vrm.expressionManager.setValue('aa', 0);
                        vrm.expressionManager.setValue('ih', 0);
                    }
                }
            } catch (e) {
                console.warn('표정 설정 실패:', e);
            }
        }

        // 헤어 본들 활성화 유지 - 안전한 방식
        if (vrm.humanoid) {
            try {
                vrm.scene.traverse((child) => {
                    if (child.isBone && child.name.toLowerCase().includes('hair')) {
                        child.visible = true;
                    }
                });
            } catch (e) {
                console.warn('헤어 본 활성화 유지 실패:', e);
            }
        }

        // 포즈 유지 (필요시)
        if (vrm.humanoid) {
            try {
                const getBoneNode = (boneName) => {
                    return vrm.humanoid.getNormalizedBoneNode ?
                        vrm.humanoid.getNormalizedBoneNode(boneName) :
                        vrm.humanoid.getBoneNode(boneName);
                };

                const leftArm = getBoneNode('leftUpperArm');
                const rightArm = getBoneNode('rightUpperArm');

                // T자 모양에서 팔이 올라가면 더 많이 내리기
                if (leftArm && leftArm.rotation.z > Math.PI / 6) {
                    leftArm.rotation.set(0, 0, -Math.PI / 3);
                }
                if (rightArm && rightArm.rotation.z < -Math.PI / 6) {
                    rightArm.rotation.set(0, 0, Math.PI / 3);
                }
            } catch (e) {
                // 포즈 유지 실패는 무시 (주요 기능이 아니므로)
            }
        }
    });

    // VRM 표정(BlendShape/Expression) 목록 출력
    useEffect(() => {
        if (vrm && vrm.expressionManager && vrm.expressionManager.expressions) {
            console.log('[VRM 표정(BlendShape/Expression) 목록]');
            Object.keys(vrm.expressionManager.expressions).forEach(name => {
                console.log('표정 이름:', name);
            });
        }
    }, [vrm]);

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
            scale={[12, 12, 12]}
            position={position === 'left' ? [0, -16.7, 0] : [0, -18.7, 0]}
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
    onAvatarClick = null,
    enableTracking = false
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

    // === 눈 깜빡임 보간 및 임계값 수치 상단에 선언 ===
    const BLINK_LERP_SPEED = 0.2; // 보간 속도 (0.05~0.3 추천)
    const BLINK_THRESHOLD = 0.03; // 임계값 (0.01~0.05 추천)
    const prevBlinkRef = useRef(0);
    const prevBlinkLeftRef = useRef(0);
    const prevBlinkRightRef = useRef(0);
    // === 눈 깜빡임 BlendShape 최대치 제한 ===
    const BLINK_SHAPE_MAX = 0.7; // 0.5~0.8 사이에서 직접 실험 가능


    return (
        <div
            className={`realistic-avatar-3d${onAvatarClick ? ' clickable' : ''}`}
            style={{
                width: typeof size === "number" ? `${size}px` : size,
                height: typeof size === "number" ? `${size}px` : size
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
                className={`avatar-canvas${isHovered ? ' hovered' : ''}`}
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
                            enableTracking={enableTracking}
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
                <div className="avatar-error-message">
                    아바타 URL이 설정되지 않았습니다.
                </div>
            )}

            {loadError && (
                <div className="avatar-load-error">
                    {loadError}
                </div>
            )}

            {/* 감정 표시 (Canvas 바닥) */}
            {showEmotionIndicator && emotion !== 'neutral' && (
                <div className={`avatar-emotion-indicator${emotionCaptureStatus ? ' pulse' : ''}`}>
                    {getEmotionDisplay(emotion)}
                </div>
            )}

            {/* 호버 효과 */}
            {isHovered && (
                <div className="avatar-hover-overlay" />
            )}
        </div>
    );
}

export default RealisticAvatar3D; 