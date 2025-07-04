import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

function AvatarModel({ avatarUrl, isTalking, emotion }) {
    const [gltf, setGltf] = useState(null);
    const [error, setError] = useState(null);
    const avatarRef = useRef();

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

    useFrame((state) => {
        if (isTalking && avatarRef.current) {
            avatarRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 5) * 0.1;
        }
    });

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
    size = 300
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