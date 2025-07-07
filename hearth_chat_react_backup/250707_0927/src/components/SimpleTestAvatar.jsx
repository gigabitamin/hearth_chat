import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 간단한 테스트용 아바타 (GLB 대신 기본 geometry 사용)
function SimpleTestAvatar({ isTalking, emotion, mouthTrigger }) {
    const meshRef = useRef();
    const [mouthOpen, setMouthOpen] = React.useState(0);

    // 립싱크 애니메이션
    React.useEffect(() => {
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

    // isTalking이 false가 되면 입을 닫음
    React.useEffect(() => {
        if (!isTalking) {
            setMouthOpen(0);
        }
    }, [isTalking]);

    // 애니메이션 프레임
    useFrame(() => {
        if (meshRef.current) {
            meshRef.current.rotation.y += 0.01;
        }
    });

    // 감정에 따른 색상
    const getEmotionColor = (emotion) => {
        switch (emotion) {
            case 'happy': return '#FFD700'; // 노란색
            case 'sad': return '#4169E1';   // 파란색
            case 'angry': return '#FF4500'; // 빨간색
            case 'surprised': return '#FF69B4'; // 분홍색
            default: return '#32CD32'; // 초록색
        }
    };

    return (
        <group>
            {/* 머리 */}
            <mesh position={[0, 1.5, 0]} ref={meshRef}>
                <sphereGeometry args={[0.5, 32, 32]} />
                <meshStandardMaterial color={getEmotionColor(emotion)} />
            </mesh>

            {/* 몸통 */}
            <mesh position={[0, 0.5, 0]}>
                <boxGeometry args={[0.8, 1, 0.4]} />
                <meshStandardMaterial color="#4682B4" />
            </mesh>

            {/* 팔 */}
            <mesh position={[-0.6, 0.5, 0]}>
                <boxGeometry args={[0.2, 0.8, 0.2]} />
                <meshStandardMaterial color="#4682B4" />
            </mesh>
            <mesh position={[0.6, 0.5, 0]}>
                <boxGeometry args={[0.2, 0.8, 0.2]} />
                <meshStandardMaterial color="#4682B4" />
            </mesh>

            {/* 다리 */}
            <mesh position={[-0.2, -0.5, 0]}>
                <boxGeometry args={[0.2, 0.8, 0.2]} />
                <meshStandardMaterial color="#2F4F4F" />
            </mesh>
            <mesh position={[0.2, -0.5, 0]}>
                <boxGeometry args={[0.2, 0.8, 0.2]} />
                <meshStandardMaterial color="#2F4F4F" />
            </mesh>

            {/* 입 (말할 때만 표시) */}
            {isTalking && (
                <mesh position={[0, 1.3, 0.4]}>
                    <sphereGeometry args={[0.1 * mouthOpen, 16, 16]} />
                    <meshStandardMaterial color="#FF0000" />
                </mesh>
            )}

            {/* 눈 */}
            <mesh position={[-0.15, 1.6, 0.4]}>
                <sphereGeometry args={[0.05, 16, 16]} />
                <meshStandardMaterial color="#000000" />
            </mesh>
            <mesh position={[0.15, 1.6, 0.4]}>
                <sphereGeometry args={[0.05, 16, 16]} />
                <meshStandardMaterial color="#000000" />
            </mesh>
        </group>
    );
}

export default SimpleTestAvatar; 