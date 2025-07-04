import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

function AvatarModel({ avatarUrl, isTalking, emotion, mouthTrigger }) {
    console.log('AvatarModel props:', { avatarUrl, isTalking, emotion, mouthTrigger });
    const [gltf, setGltf] = useState(null);
    const [error, setError] = useState(null);
    const avatarRef = useRef();
    const [mouthOpen, setMouthOpen] = useState(0);
    const [eyeBlink, setEyeBlink] = useState(0);

    // 타이핑 립싱크: mouthTrigger가 바뀔 때마다 입을 잠깐 열었다 닫음
    useEffect(() => {
        if (mouthTrigger === undefined) return;
        console.log('mouthTrigger changed:', mouthTrigger);

        if (mouthTrigger === 0) {
            // mouthTrigger가 0이면 입을 닫음
            setMouthOpen(0);
            console.log('mouthOpen set to 0 (리셋)');
        } else {
            // mouthTrigger를 4개씩 묶어서 처리 (입 여닫는 속도 더 늦추기)
            if (mouthTrigger % 9 < 4) {
                setMouthOpen(1); // 입 열기 (0,1,2,3번째)
                console.log('mouthOpen set to 1 (열기 구간)');
            } else {
                setMouthOpen(0); // 입 닫기 (4,5,6,7번째)
                console.log('mouthOpen set to 0 (닫기 구간)');
            }
        }
    }, [mouthTrigger]);

    useEffect(() => {
        console.log('mouthOpen state changed:', mouthOpen);
    }, [mouthOpen]);

    // isTalking이 false가 되면 입을 닫음
    useEffect(() => {
        if (!isTalking) {
            setMouthOpen(0);
            console.log('mouthOpen set to 0 (isTalking false)');
        }
    }, [isTalking]);

    // 눈 깜빡임: 2~5초마다 0.2초간 눈을 감았다 뜸
    useEffect(() => {
        let running = true;
        function blinkLoop() {
            if (!running) return;
            setEyeBlink(1); // 눈 감기
            console.log('눈 깜빡임: 감기');
            setTimeout(() => {
                setEyeBlink(0); // 눈 뜨기
                console.log('눈 깜빡임: 뜨기');
                if (running) setTimeout(blinkLoop, 4000 + Math.random() * 8000);
            }, 30 + Math.random() * 90); // 더 빠른 눈 깜빡임 (100-150ms)
        }
        setTimeout(blinkLoop, 2000 + Math.random() * 3000);
        return () => { running = false; };
    }, []);

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

            scene.traverse((child) => {
                if (child.isMesh) {
                    // 모든 메시 정보 로그
                    console.log('Mesh found:', {
                        name: child.name,
                        type: child.type,
                        material: child.material ? child.material.type : 'none',
                        position: child.position,
                        rotation: child.rotation,
                        scale: child.scale
                    });

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
                            console.log('Eyelid found:', child.name);

                            if (!child.userData.originalY) {
                                child.userData.originalY = child.position.y;
                            }
                            // 눈꺼풀
                            if (eyeBlink > 0.5) {
                                child.rotation.x = Math.PI * 0.2; // 아래로 내림
                                child.position.y -= 0.03; // 아래로 이동
                            } else {
                                child.rotation.x = 0;
                                // child.position.y = 원래 위치로 복원 (필요하다면 별도 변수로 원래 위치 저장)
                            }

                            // 일반 눈 메시
                            if (eyeBlink > 0.5) {
                                child.rotation.x = Math.PI * 0.3; // 아래로 회전
                                child.position.y += 0.02; // 아래로 이동
                            } else {
                                child.rotation.x = 0;
                                // child.position.y = 원래 위치로 복원
                            }


                        } else if (isEyeball) {
                            // 눈알: Z축 스케일링으로 눈 깜빡임 효과
                            console.log('Eyeball found:', child.name);
                            if (eyeBlink > 0.5) {
                                // Z축 확장으로 눈을 감는 효과
                                child.scale.x = 1; // 가로는 그대로
                                child.scale.y = 1; // 세로는 그대로
                                child.scale.z = 2.0; // 깊이로 확장

                                // 투명도로 더 자연스럽게
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
                        } else if (isGeneralEye) {
                            // 일반적인 눈 메시 (EyeLeft, EyeRight 등): 세로 압축으로 자연스러운 눈 감기
                            console.log('General eye mesh found:', child.name);
                            if (eyeBlink > 0.5) {
                                // 세로 압축으로 눈을 감는 효과 (반대 방향)
                                child.scale.x = 1; // 가로는 그대로
                                child.scale.y = 0.05; // 세로로 많이 압축 (반대 방향)
                                child.scale.z = 1; // 깊이는 그대로

                                // 회전으로 눈을 감는 효과 (반대 방향)
                                child.rotation.x = -Math.PI * 0.3; // X축 회전 반대 방향
                                // 위치 조정 (약간 아래로)
                                child.position.y -= 0.02 // 아래로 이동 (반대 방향)
                            } else {
                                // 원래 상태로 복원
                                child.scale.x = 1;
                                child.scale.y = 1;
                                child.scale.z = 1;
                                child.rotation.x = 0; // 회전 리셋
                                child.position.y += 0.02; // 원래 위치로 복원
                            }
                        }

                        // 방법 4: 투명도 조절 (재질이 있는 경우)
                        if (child.material && !isEyeball) {
                            if (eyeBlink > 0.5) {
                                child.material.opacity = 0.05; // 더 투명하게
                                child.material.transparent = true;
                            } else {
                                child.material.opacity = 1;
                                child.material.transparent = false;
                            }
                        }

                        console.log('Direct eye manipulation applied to:', meshName, 'blink value:', eyeBlink);
                    }
                }
            });

            if (eyeMeshesFound.length > 0) {
                console.log('Eye meshes found and manipulated:', eyeMeshesFound);
            } else {
                console.log('No eye meshes found. All meshes:', scene.children.map(child => child.name));
            }
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
                        console.log('Using fallback blink target:', priorityTargets[0]);
                    }
                }

                // 디버깅: morph target 이름들 출력 (한 번만 출력)
                if (child.morphTargetDictionary && Object.keys(child.morphTargetDictionary).length > 0) {
                    console.log('Available morph targets:', Object.keys(child.morphTargetDictionary));
                    console.log('Blink morph targets found:', { blinkL, blinkR });
                    console.log('Dynamic eye targets found:', dynamicEyeTargets);
                    console.log('Final blink targets:', { finalBlinkL, finalBlinkR });

                    // 눈 관련 morph target들 찾기
                    const eyeRelatedTargets = Object.keys(child.morphTargetDictionary).filter(name =>
                        name.toLowerCase().includes('eye') ||
                        name.toLowerCase().includes('blink') ||
                        name.toLowerCase().includes('squint') ||
                        name.toLowerCase().includes('wide')
                    );
                    if (eyeRelatedTargets.length > 0) {
                        console.log('Eye-related morph targets found:', eyeRelatedTargets);
                    }

                    // 전체 morph target dictionary 출력
                    console.log('Full morph target dictionary:', child.morphTargetDictionary);

                    // morph target 개수 확인
                    console.log('Total morph targets count:', child.morphTargetInfluences?.length || 0);
                }

                // 감정별 복합 표정 (mouthOpenIdx는 건드리지 않음)
                if (emotion === 'happy') {
                    if (mouthSmile !== undefined) child.morphTargetInfluences[mouthSmile] = 1;
                    if (browInnerUp !== undefined) child.morphTargetInfluences[browInnerUp] = 0.5;
                    if (finalBlinkL !== undefined) child.morphTargetInfluences[finalBlinkL] = 1; // 반대 값
                    if (finalBlinkR !== undefined) child.morphTargetInfluences[finalBlinkR] = 1; // 반대 값
                    if (fallbackBlinkTarget !== undefined) child.morphTargetInfluences[fallbackBlinkTarget] = 1; // 반대 값
                    if (mouthSad !== undefined) child.morphTargetInfluences[mouthSad] = 0;
                    if (mouthFrown !== undefined) child.morphTargetInfluences[mouthFrown] = 0;
                    if (browDownLeft !== undefined) child.morphTargetInfluences[browDownLeft] = 0;
                    if (browDownRight !== undefined) child.morphTargetInfluences[browDownRight] = 0;
                } else if (emotion === 'sad') {
                    if (mouthSad !== undefined) child.morphTargetInfluences[mouthSad] = 1;
                    if (browInnerUp !== undefined) child.morphTargetInfluences[browInnerUp] = 1;
                    if (browDownLeft !== undefined) child.morphTargetInfluences[browDownLeft] = 0.3;
                    if (browDownRight !== undefined) child.morphTargetInfluences[browDownRight] = 0.3;
                    if (finalBlinkL !== undefined) child.morphTargetInfluences[finalBlinkL] = 0.8; // 반대 값
                    if (finalBlinkR !== undefined) child.morphTargetInfluences[finalBlinkR] = 0.8; // 반대 값
                    if (fallbackBlinkTarget !== undefined) child.morphTargetInfluences[fallbackBlinkTarget] = 0.8; // 반대 값
                    if (mouthSmile !== undefined) child.morphTargetInfluences[mouthSmile] = 0;
                    if (mouthFrown !== undefined) child.morphTargetInfluences[mouthFrown] = 0;
                } else if (emotion === 'angry') {
                    if (browDownLeft !== undefined) child.morphTargetInfluences[browDownLeft] = 1;
                    if (browDownRight !== undefined) child.morphTargetInfluences[browDownRight] = 1;
                    if (mouthFrown !== undefined) child.morphTargetInfluences[mouthFrown] = 0.7;
                    if (finalBlinkL !== undefined) child.morphTargetInfluences[finalBlinkL] = 1; // 반대 값
                    if (finalBlinkR !== undefined) child.morphTargetInfluences[finalBlinkR] = 1; // 반대 값
                    if (fallbackBlinkTarget !== undefined) child.morphTargetInfluences[fallbackBlinkTarget] = 1; // 반대 값
                    if (mouthSmile !== undefined) child.morphTargetInfluences[mouthSmile] = 0;
                    if (mouthSad !== undefined) child.morphTargetInfluences[mouthSad] = 0;
                    if (browInnerUp !== undefined) child.morphTargetInfluences[browInnerUp] = 0;
                } else {
                    // neutral
                    if (mouthSmile !== undefined) child.morphTargetInfluences[mouthSmile] = 0;
                    if (mouthSad !== undefined) child.morphTargetInfluences[mouthSad] = 0;
                    if (mouthFrown !== undefined) child.morphTargetInfluences[mouthFrown] = 0;
                    if (browInnerUp !== undefined) child.morphTargetInfluences[browInnerUp] = 0;
                    if (browDownLeft !== undefined) child.morphTargetInfluences[browDownLeft] = 0;
                    if (browDownRight !== undefined) child.morphTargetInfluences[browDownRight] = 0;
                }

                // 입(mouthOpen)은 오직 mouthOpen state로만 제어
                if (mouthOpenIdx !== undefined && child.morphTargetInfluences) {
                    child.morphTargetInfluences[mouthOpenIdx] = mouthOpen;
                }
                // 항상 morph target 적용 (조건 제거)
                // morph target에 깜빡임 값 적용
                if (child.morphTargetInfluences) {
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
        });

        // morph target이 없을 때 눈을 직접 조작
        if (!gltf.scene.children.some(child =>
            child.isMesh &&
            child.morphTargetDictionary &&
            Object.keys(child.morphTargetDictionary).some(name =>
                name.toLowerCase().includes('eye') ||
                name.toLowerCase().includes('blink')
            )
        )) {
            console.log('No eye morph targets found, using direct eye manipulation');
            manipulateEyesDirectly(gltf.scene);
        }
    }, [mouthOpen, eyeBlink, emotion, gltf]);

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
    mouthTrigger // 추가
}) {
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