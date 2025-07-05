import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

function AvatarModel({ avatarUrl, isTalking, emotion, mouthTrigger }) {
    // props 변경 시에만 로그 출력
    const prevPropsRef = useRef({ avatarUrl, isTalking, emotion, mouthTrigger });
    const hasChanged = JSON.stringify(prevPropsRef.current) !== JSON.stringify({ avatarUrl, isTalking, emotion, mouthTrigger });
    if (hasChanged) {
        console.log('AvatarModel props changed:', { avatarUrl, isTalking, emotion, mouthTrigger });
        prevPropsRef.current = { avatarUrl, isTalking, emotion, mouthTrigger };
    }
    const [gltf, setGltf] = useState(null);
    const [error, setError] = useState(null);
    const avatarRef = useRef();
    const [mouthOpen, setMouthOpen] = useState(0);
    const [eyeBlink, setEyeBlink] = useState(0);
    const [currentEmotion, setCurrentEmotion] = useState('neutral');
    const [emotionIntensity, setEmotionIntensity] = useState(0);



    // 컴포넌트 마운트 시 눈 상태 초기화
    useEffect(() => {
        // 즉시 눈을 뜨게 함 - 값이 뒤바뀜
        setEyeBlink(1);

        // 지연된 리셋 (안전장치)
        const resetTimeout = setTimeout(() => {
            setEyeBlink(1);
        }, 50);

        // console.log('Component mounted, eyeBlink reset to 0');

        return () => {
            setEyeBlink(1); // 컴포넌트 언마운트 시에도 눈을 뜨게 함 - 값이 뒤바뀜
            clearTimeout(resetTimeout);
            // console.log('Component unmounted, eyeBlink reset to 1');
        };
    }, []);

    // 타이핑 립싱크: mouthTrigger가 바뀔 때마다 입을 잠깐 열었다 닫음
    useEffect(() => {
        if (mouthTrigger === undefined) return;
        // console.log('mouthTrigger changed:', mouthTrigger);

        if (mouthTrigger === 0) {
            // mouthTrigger가 0이면 입을 닫음
            setMouthOpen(0);
            // console.log('mouthOpen set to 0 (리셋)');
        } else {
            // mouthTrigger를 4개씩 묶어서 처리 (입 여닫는 속도 더 늦추기)
            if (mouthTrigger % 9 < 4) {
                setMouthOpen(1); // 입 열기 (0,1,2,3번째)
                // console.log('mouthOpen set to 1 (열기 구간)');
            } else {
                setMouthOpen(0); // 입 닫기 (4,5,6,7번째)
                // console.log('mouthOpen set to 0 (닫기 구간)');
            }
        }
    }, [mouthTrigger]);

    useEffect(() => {
        // console.log('mouthOpen state changed:', mouthOpen);
    }, [mouthOpen]);

    // isTalking이 false가 되면 입을 닫고 눈을 뜨게 함
    useEffect(() => {
        if (!isTalking) {
            setMouthOpen(0);
            // 눈 상태를 강제로 리셋 (약간의 지연 후)
            setTimeout(() => {
                setEyeBlink(1); // 눈을 강제로 뜨게 함 - 값이 뒤바뀜
                // console.log('eyeBlink force reset to 1 after talking stopped');
            }, 100);
            // console.log('mouthOpen set to 0, eyeBlink will be reset (isTalking false)');
        }
    }, [isTalking]);

    // 눈 깜빡임: 대화 중에는 완전히 멈춤
    useEffect(() => {
        let running = true;
        let blinkTimeout;
        let nextBlinkTimeout;

        function blinkLoop() {
            if (!running) return;

            // 대화 중이면 기존 타이머를 취소하고 눈을 강제로 뜨게 함
            if (isTalking) {
                // 기존 blinkTimeout 취소
                if (blinkTimeout) {
                    clearTimeout(blinkTimeout);
                    blinkTimeout = null;
                }
                setEyeBlink(1); // 대화 중에는 항상 눈을 뜨게 함
                nextBlinkTimeout = setTimeout(blinkLoop, 1000); // 1초마다 체크
                return;
            }

            setEyeBlink(0); // 눈 감기

            // 눈을 감는 시간을 짧게 (100-200ms)
            blinkTimeout = setTimeout(() => {
                if (!running || isTalking) {
                    // 대화 중이거나 컴포넌트가 언마운트되면 눈을 강제로 뜨게 함
                    setEyeBlink(1);
                    return;
                }
                setEyeBlink(1); // 눈 뜨기

                // 다음 깜빡임 예약 (대화 중이 아닐 때만, 더 긴 간격)
                if (!isTalking && running) {
                    nextBlinkTimeout = setTimeout(blinkLoop, 3000 + Math.random() * 5000);
                }
            }, 100 + Math.random() * 100); // 100-200ms로 단축
        }

        // 기존 타이머들 정리
        if (blinkTimeout) clearTimeout(blinkTimeout);
        if (nextBlinkTimeout) clearTimeout(nextBlinkTimeout);

        // 눈을 강제로 뜨게 함 (초기화)
        setEyeBlink(1);

        // 첫 번째 깜빡임 시작 (대화 중이 아닐 때만)
        if (!isTalking) {
            nextBlinkTimeout = setTimeout(blinkLoop, 1500 + Math.random() * 2000);
        } else {
            // 대화 중이면 1초마다 체크
            nextBlinkTimeout = setTimeout(blinkLoop, 1000);
        }

        return () => {
            running = false;
            // 컴포넌트 언마운트 시 눈을 강제로 뜨게 함
            setEyeBlink(1);
            if (blinkTimeout) clearTimeout(blinkTimeout);
            if (nextBlinkTimeout) clearTimeout(nextBlinkTimeout);
        };
    }, [isTalking]);

    // 대화 상태가 바뀔 때 눈 상태 강제 조정
    useEffect(() => {
        // 대화 시작/종료 시 즉시 눈을 강제로 뜨게 함
        setEyeBlink(1);

        // 대화 중일 때는 즉시 실행
        if (isTalking) {
            // 기존 타이머들을 모두 취소하고 즉시 실행
            const immediateReset = setTimeout(() => {
                setEyeBlink(1);
            }, 0);

            return () => {
                clearTimeout(immediateReset);
            };
        }

        // 여러 번의 지연된 리셋 (안전장치)
        const resetTimeout1 = setTimeout(() => {
            setEyeBlink(1);
        }, 50);

        const resetTimeout2 = setTimeout(() => {
            setEyeBlink(1);
        }, 150);

        const resetTimeout3 = setTimeout(() => {
            setEyeBlink(1);
        }, 300);



        return () => {
            clearTimeout(resetTimeout1);
            clearTimeout(resetTimeout2);
            clearTimeout(resetTimeout3);
        };
    }, [isTalking]);

    // 대화 중일 때 눈 상태 강제 모니터링
    useEffect(() => {
        if (isTalking && eyeBlink < 0.5) {
            setEyeBlink(1);
        }
    }, [isTalking, eyeBlink]);

    // morph target 적용 (입, 눈, 감정)
    useEffect(() => {
        if (!gltf) return;

        // 눈 관련 morph target을 동적으로 찾는 함수
        const findEyeMorphTargets = (morphTargetDictionary) => {
            const allTargets = Object.keys(morphTargetDictionary);

            // 왼쪽 눈 관련 morph target 찾기
            const leftEyeTargets = allTargets.filter(name =>
                name.toLowerCase().includes('left') ||
                name.toLowerCase().includes('_l') ||
                name.toLowerCase().includes('l_')
            ).filter(name =>
                name.toLowerCase().includes('eye') ||
                name.toLowerCase().includes('blink') ||
                name.toLowerCase().includes('squint') ||
                name.toLowerCase().includes('wide')
            );

            // 오른쪽 눈 관련 morph target 찾기
            const rightEyeTargets = allTargets.filter(name =>
                name.toLowerCase().includes('right') ||
                name.toLowerCase().includes('_r') ||
                name.toLowerCase().includes('r_')
            ).filter(name =>
                name.toLowerCase().includes('eye') ||
                name.toLowerCase().includes('blink') ||
                name.toLowerCase().includes('squint') ||
                name.toLowerCase().includes('wide')
            );

            // 양쪽 눈 모두에 적용되는 morph target 찾기
            const bothEyeTargets = allTargets.filter(name =>
                (name.toLowerCase().includes('eye') ||
                    name.toLowerCase().includes('blink') ||
                    name.toLowerCase().includes('squint') ||
                    name.toLowerCase().includes('wide')) &&
                !name.toLowerCase().includes('left') &&
                !name.toLowerCase().includes('right') &&
                !name.toLowerCase().includes('_l') &&
                !name.toLowerCase().includes('_r') &&
                !name.toLowerCase().includes('l_') &&
                !name.toLowerCase().includes('r_')
            );

            return {
                leftEye: leftEyeTargets.length > 0 ? morphTargetDictionary[leftEyeTargets[0]] : undefined,
                rightEye: rightEyeTargets.length > 0 ? morphTargetDictionary[rightEyeTargets[0]] : undefined,
                bothEyes: bothEyeTargets.length > 0 ? morphTargetDictionary[bothEyeTargets[0]] : undefined,
                leftEyeName: leftEyeTargets[0],
                rightEyeName: rightEyeTargets[0],
                bothEyesName: bothEyeTargets[0]
            };
        };

        // 눈을 직접 조작하는 함수 (morph target이 없을 때 사용)
        const manipulateEyesDirectly = (scene) => {
            let eyeMeshesFound = [];
            let allMeshes = [];

            scene.traverse((child) => {
                if (child.isMesh) {
                    allMeshes.push(child.name);

                    // 눈 관련 메시 찾기 (이름으로 추정)
                    const meshName = child.name.toLowerCase();

                    // 눈꺼풀 관련 키워드들
                    const eyelidKeywords = ['eyelid', 'lid', 'upper', 'lower', 'brow', 'eyebrow', 'lash', 'lashes'];
                    // 눈알 관련 키워드들 (더 구체적으로)
                    const eyeballKeywords = ['eyeball', 'iris', 'pupil', 'sclera', 'cornea'];
                    // 일반 눈 메시들 (EyeLeft, EyeRight 등)
                    const generalEyeKeywords = ['eyeleft', 'eyeright', 'eye'];

                    // 눈꺼풀인지 확인
                    const isEyelid = eyelidKeywords.some(keyword => meshName.includes(keyword));
                    // 눈알인지 확인 (더 구체적인 키워드만)
                    const isEyeball = eyeballKeywords.some(keyword => meshName.includes(keyword));
                    // 일반 눈 메시인지 확인
                    const isGeneralEye = generalEyeKeywords.some(keyword => meshName.includes(keyword));

                    if (isEyelid || isEyeball || isGeneralEye) {
                        eyeMeshesFound.push(child.name);


                        if (isEyelid) {
                            // 눈꺼풀: 위에서 아래로 내려오는 움직임
                            if (!child.userData.originalY) {
                                child.userData.originalY = child.position.y;
                            }

                            if (isTalking) {
                                // 대화 중일 때는 강제로 눈꺼풀을 올림
                                child.rotation.x = 0;
                                child.position.y = child.userData.originalY; // 원래 위치로 복원

                            } else if (eyeBlink < 0.5) {
                                child.rotation.x = Math.PI * 0.2; // 아래로 내림
                                child.position.y = child.userData.originalY - 0.03; // 아래로 이동

                            } else {
                                child.rotation.x = 0;
                                child.position.y = child.userData.originalY; // 원래 위치로 복원

                            }

                        } else if (isEyeball) {
                            // 눈알: morph target이 없을 때만 직접 조작
                            const hasMorphTargets = child.morphTargetDictionary &&
                                Object.keys(child.morphTargetDictionary).some(name =>
                                    name.toLowerCase().includes('blink') ||
                                    name.toLowerCase().includes('eye')
                                );

                            if (!hasMorphTargets) {
                                if (isTalking) {
                                    // 대화 중일 때는 강제로 눈알을 보이게 함
                                    child.scale.x = 1;
                                    child.scale.y = 1;
                                    child.scale.z = 1;
                                    if (child.material) {
                                        child.material.opacity = 1;
                                        child.material.transparent = false;
                                    }

                                } else if (eyeBlink < 0.5) {
                                    // Z축 확장으로 눈을 감는 효과
                                    child.scale.x = 1;
                                    child.scale.y = 1;
                                    child.scale.z = 2.0;

                                    if (child.material) {
                                        child.material.opacity = 0.3;
                                        child.material.transparent = true;
                                    }

                                } else {
                                    // 원래 상태로 복원
                                    child.scale.x = 1;
                                    child.scale.y = 1;
                                    child.scale.z = 1;
                                    if (child.material) {
                                        child.material.opacity = 1;
                                        child.material.transparent = false;
                                    }

                                }
                            }
                        } else if (isGeneralEye) {
                            // 일반적인 눈 메시 (EyeLeft, EyeRight 등)
                            const hasMorphTargets = child.morphTargetDictionary &&
                                Object.keys(child.morphTargetDictionary).some(name =>
                                    name.toLowerCase().includes('blink') ||
                                    name.toLowerCase().includes('eye')
                                );

                            if (!hasMorphTargets) {
                                if (isTalking) {
                                    // 대화 중일 때는 강제로 눈을 뜨게 함
                                    if (!child.userData.originalY) {
                                        child.userData.originalY = child.position.y;
                                    }
                                    child.scale.x = 1;
                                    child.scale.y = 1;
                                    child.scale.z = 1;
                                    child.rotation.x = 0;
                                    child.rotation.y = 0;
                                    child.rotation.z = 0;
                                    child.position.y = child.userData.originalY;

                                } else if (eyeBlink < 0.5) {
                                    // 세로 압축으로 눈을 감는 효과
                                    if (!child.userData.originalY) {
                                        child.userData.originalY = child.position.y;
                                    }
                                    child.scale.x = 1;
                                    child.scale.y = 0.05; // 세로로 많이 압축
                                    child.scale.z = 1;

                                    child.rotation.x = -Math.PI * 0.3; // X축 회전
                                    child.position.y = child.userData.originalY - 0.02; // 아래로 이동

                                } else {
                                    // 원래 상태로 복원
                                    child.scale.x = 1;
                                    child.scale.y = 1;
                                    child.scale.z = 1;
                                    child.rotation.x = 0;
                                    child.position.y = child.userData.originalY || child.position.y; // 원래 위치로 복원

                                }
                            }
                        }

                        // 투명도 조절 (morph target이 없을 때만)
                        if (child.material && !isEyeball) {
                            const hasMorphTargets = child.morphTargetDictionary &&
                                Object.keys(child.morphTargetDictionary).some(name =>
                                    name.toLowerCase().includes('blink') ||
                                    name.toLowerCase().includes('eye')
                                );

                            if (!hasMorphTargets) {
                                if (isTalking) {
                                    // 대화 중일 때는 강제로 불투명하게
                                    child.material.opacity = 1;
                                    child.material.transparent = false;

                                } else if (eyeBlink < 0.5) {
                                    child.material.opacity = 0.05;
                                    child.material.transparent = true;
                                } else {
                                    child.material.opacity = 1;
                                    child.material.transparent = false;
                                }
                            }
                        }
                    }
                }
            });


        };

        gltf.scene.traverse((child) => {
            if (child.isMesh && child.morphTargetDictionary) {
                // morph target 인덱스
                const mouthSmile = child.morphTargetDictionary['mouthSmile'];
                const mouthSad = child.morphTargetDictionary['mouthSad'];
                const mouthFrown = child.morphTargetDictionary['mouthFrown'];
                const mouthOpenIdx = child.morphTargetDictionary['mouthOpen'] ?? child.morphTargetDictionary['MouthOpen'];

                // Ready Player Me 아바타의 다양한 눈 깜빡임 morph target 이름 시도
                const blinkL = child.morphTargetDictionary['eyeBlinkLeft'] ??
                    child.morphTargetDictionary['EyeBlinkLeft'] ??
                    child.morphTargetDictionary['eyeBlink_L'] ??
                    child.morphTargetDictionary['blinkLeft'] ??
                    child.morphTargetDictionary['blink_L'] ??
                    child.morphTargetDictionary['eyeSquint_L'] ??
                    child.morphTargetDictionary['eyeWide_L'] ??
                    child.morphTargetDictionary['blink'] ??
                    child.morphTargetDictionary['Blink'] ??
                    child.morphTargetDictionary['eyeBlink'] ??
                    child.morphTargetDictionary['EyeBlink'] ??
                    child.morphTargetDictionary['leftEye'] ??
                    child.morphTargetDictionary['LeftEye'] ??
                    child.morphTargetDictionary['eye_L'] ??
                    child.morphTargetDictionary['Eye_L'];

                const blinkR = child.morphTargetDictionary['eyeBlinkRight'] ??
                    child.morphTargetDictionary['EyeBlinkRight'] ??
                    child.morphTargetDictionary['eyeBlink_R'] ??
                    child.morphTargetDictionary['blinkRight'] ??
                    child.morphTargetDictionary['blink_R'] ??
                    child.morphTargetDictionary['eyeSquint_R'] ??
                    child.morphTargetDictionary['eyeWide_R'] ??
                    child.morphTargetDictionary['blink'] ??
                    child.morphTargetDictionary['Blink'] ??
                    child.morphTargetDictionary['eyeBlink'] ??
                    child.morphTargetDictionary['EyeBlink'] ??
                    child.morphTargetDictionary['rightEye'] ??
                    child.morphTargetDictionary['RightEye'] ??
                    child.morphTargetDictionary['eye_R'] ??
                    child.morphTargetDictionary['Eye_R'];

                const browInnerUp = child.morphTargetDictionary['browInnerUp'];
                const browDownLeft = child.morphTargetDictionary['browDownLeft'];
                const browDownRight = child.morphTargetDictionary['browDownRight'];

                // 동적으로 찾은 눈 morph target
                const dynamicEyeTargets = findEyeMorphTargets(child.morphTargetDictionary);

                // 최종적으로 사용할 눈 morph target (기존 방식이 실패하면 동적 검색 결과 사용)
                const finalBlinkL = blinkL ?? dynamicEyeTargets.leftEye ?? dynamicEyeTargets.bothEyes;
                const finalBlinkR = blinkR ?? dynamicEyeTargets.rightEye ?? dynamicEyeTargets.bothEyes;

                // Fallback: 모든 morph target을 시도해서 눈 깜빡임 효과 찾기
                let fallbackBlinkTarget = undefined;
                if (!finalBlinkL && !finalBlinkR) {
                    const allTargets = Object.keys(child.morphTargetDictionary);
                    // 가장 가능성이 높은 morph target들을 우선순위로 시도
                    const priorityTargets = allTargets.filter(name =>
                        name.toLowerCase().includes('blink') ||
                        name.toLowerCase().includes('eye') ||
                        name.toLowerCase().includes('squint') ||
                        name.toLowerCase().includes('wide') ||
                        name.toLowerCase().includes('close')
                    );

                    if (priorityTargets.length > 0) {
                        fallbackBlinkTarget = child.morphTargetDictionary[priorityTargets[0]];
                        // console.log('Using fallback blink target:', priorityTargets[0]);
                    }
                }



                // 감정별 morph target을 동적으로 찾는 함수
                const findEmotionMorphTargets = (morphTargetDictionary) => {
                    const allTargets = Object.keys(morphTargetDictionary);

                    // 입 관련 morph target들
                    const mouthTargets = {
                        smile: allTargets.find(name =>
                            name.toLowerCase().includes('smile') ||
                            name.toLowerCase().includes('happy') ||
                            name.toLowerCase().includes('grin')
                        ),
                        sad: allTargets.find(name =>
                            name.toLowerCase().includes('sad') ||
                            name.toLowerCase().includes('frown') ||
                            name.toLowerCase().includes('pout')
                        ),
                        angry: allTargets.find(name =>
                            name.toLowerCase().includes('angry') ||
                            name.toLowerCase().includes('mad') ||
                            name.toLowerCase().includes('scowl')
                        ),
                        surprise: allTargets.find(name =>
                            name.toLowerCase().includes('surprise') ||
                            name.toLowerCase().includes('shock') ||
                            name.toLowerCase().includes('open')
                        )
                    };



                    // 눈썹 관련 morph target들
                    const browTargets = {
                        up: allTargets.find(name =>
                            name.toLowerCase().includes('brow') &&
                            (name.toLowerCase().includes('up') || name.toLowerCase().includes('raise'))
                        ),
                        down: allTargets.find(name =>
                            name.toLowerCase().includes('brow') &&
                            (name.toLowerCase().includes('down') || name.toLowerCase().includes('lower'))
                        ),
                        innerUp: allTargets.find(name =>
                            name.toLowerCase().includes('brow') &&
                            (name.toLowerCase().includes('inner') || name.toLowerCase().includes('center'))
                        ),
                        outerUp: allTargets.find(name =>
                            name.toLowerCase().includes('brow') &&
                            (name.toLowerCase().includes('outer') || name.toLowerCase().includes('side'))
                        )
                    };

                    // 눈 관련 morph target들
                    const eyeTargets = {
                        squint: allTargets.find(name =>
                            name.toLowerCase().includes('squint') ||
                            name.toLowerCase().includes('narrow')
                        ),
                        wide: allTargets.find(name =>
                            name.toLowerCase().includes('wide') ||
                            name.toLowerCase().includes('open')
                        ),
                        sad: allTargets.find(name =>
                            name.toLowerCase().includes('eye') &&
                            name.toLowerCase().includes('sad')
                        )
                    };

                    return {
                        mouth: mouthTargets,
                        brow: browTargets,
                        eye: eyeTargets,
                        allTargets: allTargets
                    };
                };

                // 감정별 morph target 찾기
                const emotionTargets = findEmotionMorphTargets(child.morphTargetDictionary);

                // 감정별 복합 표정 적용 (눈은 제외하고 입과 눈썹만 조작)
                const applyEmotion = (targets, emotionType, intensity = 1.0) => {
                    if (emotionType === 'happy') {
                        if (targets.mouth.smile) {
                            child.morphTargetInfluences[targets.mouth.smile] = intensity;
                        }
                        if (targets.brow.innerUp) {
                            child.morphTargetInfluences[targets.brow.innerUp] = intensity * 0.5;
                        }
                    } else if (emotionType === 'sad') {
                        if (targets.mouth.sad) {
                            child.morphTargetInfluences[targets.mouth.sad] = intensity;
                        }
                        if (targets.brow.innerUp) {
                            child.morphTargetInfluences[targets.brow.innerUp] = intensity * 0.8;
                        }
                        if (targets.brow.down) {
                            child.morphTargetInfluences[targets.brow.down] = intensity * 0.4;
                        }
                    } else if (emotionType === 'angry') {
                        if (targets.mouth.angry) {
                            child.morphTargetInfluences[targets.mouth.angry] = intensity * 0.8;
                        }
                        if (targets.brow.down) {
                            child.morphTargetInfluences[targets.brow.down] = intensity;
                        }
                    } else if (emotionType === 'surprise') {
                        if (targets.mouth.surprise) {
                            child.morphTargetInfluences[targets.mouth.surprise] = intensity;
                        }
                        if (targets.brow.up) {
                            child.morphTargetInfluences[targets.brow.up] = intensity;
                        }
                    } else {
                        // neutral - 입과 눈썹 morph target만 0으로 설정
                        Object.values(targets.mouth).forEach(target => {
                            if (target) {
                                child.morphTargetInfluences[target] = 0;
                            }
                        });
                        Object.values(targets.brow).forEach(target => {
                            if (target) {
                                child.morphTargetInfluences[target] = 0;
                            }
                        });
                    }
                };

                // 현재 감정 적용 (부드러운 전환을 위해 intensity 사용)
                applyEmotion(emotionTargets, currentEmotion, emotionIntensity);



                // 입(mouthOpen)은 오직 mouthOpen state로만 제어
                if (mouthOpenIdx !== undefined && child.morphTargetInfluences) {
                    child.morphTargetInfluences[mouthOpenIdx] = mouthOpen;
                }
                // 항상 morph target 적용 (조건 제거)
                // morph target에 깜빡임 값 적용
                if (child.morphTargetInfluences) {
                    if (isTalking) {
                        // 대화 중일 때는 강제로 눈을 뜨게 함 (morph target 값 1로 설정)
                        if (finalBlinkL !== undefined) {
                            child.morphTargetInfluences[finalBlinkL] = 1; // 강제로 뜨게 함
                        }
                        if (finalBlinkR !== undefined) {
                            child.morphTargetInfluences[finalBlinkR] = 1; // 강제로 뜨게 함
                        }
                        if (fallbackBlinkTarget !== undefined) {
                            child.morphTargetInfluences[fallbackBlinkTarget] = 1; // 강제로 뜨게 함
                        }
                    } else {
                        // 대화 중이 아닐 때는 정상적인 깜빡임 적용
                        if (finalBlinkL !== undefined) {
                            child.morphTargetInfluences[finalBlinkL] = eyeBlink; // 눈 깜빡임 적용
                        }
                        if (finalBlinkR !== undefined) {
                            child.morphTargetInfluences[finalBlinkR] = eyeBlink;
                        }
                        if (fallbackBlinkTarget !== undefined) {
                            child.morphTargetInfluences[fallbackBlinkTarget] = eyeBlink;
                        }
                    }
                }
            }
        });

        // morph target이 없을 때 눈을 직접 조작
        const hasEyeMorphTargets = gltf.scene.children.some(child =>
            child.isMesh &&
            child.morphTargetDictionary &&
            Object.keys(child.morphTargetDictionary).some(name =>
                name.toLowerCase().includes('eye') ||
                name.toLowerCase().includes('blink')
            )
        );

        if (!hasEyeMorphTargets) {
            manipulateEyesDirectly(gltf.scene);
        }
    }, [mouthOpen, eyeBlink, emotion, gltf]);

    // 감정 전환 애니메이션
    useEffect(() => {
        if (emotion !== currentEmotion) {
            // 감정 강도를 0으로 리셋
            setEmotionIntensity(0);

            // 새로운 감정으로 설정
            setCurrentEmotion(emotion);

            // 부드러운 전환을 위한 애니메이션
            const animateEmotion = () => {
                setEmotionIntensity(prev => {
                    const newIntensity = Math.min(prev + 0.1, 1.0);
                    if (newIntensity < 1.0) {
                        requestAnimationFrame(animateEmotion);
                    }
                    return newIntensity;
                });
            };

            // 약간의 지연 후 애니메이션 시작
            setTimeout(animateEmotion, 100);
        }
    }, [emotion, currentEmotion]);

    useEffect(() => {
        if (!avatarUrl) return;
        const loader = new GLTFLoader();
        loader.load(
            avatarUrl,
            (gltf) => {
                setGltf(gltf);
                setError(null);
            },
            undefined,
            (err) => setError(err.message)
        );
    }, [avatarUrl]);

    useFrame(() => { });

    if (error) return <mesh><boxGeometry args={[1, 2, 1]} /><meshStandardMaterial color="#FF6B6B" /></mesh>;
    if (!gltf) return <mesh><boxGeometry args={[1, 2, 1]} /><meshStandardMaterial color="#4A90E2" /></mesh>;

    // 상반신/얼굴만 보이도록 position/scale 조정
    return (
        <group ref={avatarRef} scale={[1.8, 1.8, 1.8]} position={[0, -1.2, 0]}>
            <primitive object={gltf.scene} />
        </group>
    );
}

function Avatar3D({
    avatarUrl,
    isTalking = false,
    emotion = 'neutral',
    position = 'right',
    size = 300,
    mouthTrigger, // 추가
    showEmotionIndicator = true, // 감정 상태 표시 여부
    emotionCaptureStatus = false // 감정 포착 상태
}) {
    // 디버깅: 감정 prop 확인 (변경 시에만 로그)
    const prevEmotionRef = useRef(emotion);
    if (emotion !== prevEmotionRef.current) {
        console.log(`Avatar3D (${position}) - 감정 변경: ${prevEmotionRef.current} → ${emotion}`);
        prevEmotionRef.current = emotion;
    }
    const containerStyle = {
        width: `${size}px`,
        height: `${size}px`,
        border: '2px solid #222',
        borderRadius: '10px',
        overflow: 'hidden',
        backgroundColor: '#222',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
    };

    const labelStyle = {
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '5px 10px',
        borderRadius: '15px',
        fontSize: '12px',
        fontWeight: 'bold',
        zIndex: 10
    };

    // 감정 상태 표시 스타일
    const emotionIndicatorStyle = {
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: 'bold',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        minWidth: '120px',
        justifyContent: 'space-between'
    };

    // 감정별 이모지와 텍스트
    const getEmotionDisplay = (emotion) => {
        const emotionData = {
            'happy': { emoji: '😊', text: '기쁨' },
            'sad': { emoji: '😢', text: '슬픔' },
            'neutral': { emoji: '😐', text: '무표정' },
            'surprised': { emoji: '😲', text: '놀람' },
            'angry': { emoji: '😠', text: '분노' },
            'fearful': { emoji: '😨', text: '두려움' },
            'disgusted': { emoji: '🤢', text: '혐오' }
        };
        return emotionData[emotion] || { emoji: '😐', text: '분석 중...' };
    };

    const emotionDisplay = getEmotionDisplay(emotion);

    return (
        <div style={containerStyle}>
            <div style={labelStyle}>
                {position === 'left' ? '사용자' : 'AI'} 아바타
                {isTalking && ' (말하는 중)'}
            </div>


            <Canvas
                camera={{ position: [0, 0.3, 2.2], fov: 30 }}
                style={{ width: '100%', height: '100%' }}
            >
                <ambientLight intensity={0.9} />
                <directionalLight position={[5, 5, 5]} intensity={1.2} castShadow />
                <directionalLight position={[-5, 5, -5]} intensity={0.8} />
                <Suspense fallback={null}>
                    <AvatarModel
                        avatarUrl={avatarUrl}
                        isTalking={isTalking}
                        emotion={emotion}
                        mouthTrigger={mouthTrigger} // 반드시 전달
                    />
                </Suspense>
                <OrbitControls
                    enableZoom={true}
                    enablePan={false}
                    maxPolarAngle={Math.PI / 1.7}
                    minPolarAngle={Math.PI / 3.5}
                    maxDistance={4}
                    minDistance={1.2}
                />
            </Canvas>
        </div>
    );
}

export default Avatar3D; 