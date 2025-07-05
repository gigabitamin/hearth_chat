import React, { useRef, useEffect, useState, useCallback } from 'react';
import './EmotionCamera.css';

const EmotionCamera = ({ onEmotionDetected, isActive = true, hideControls = false, isRealTimeMode: externalRealTimeMode = false }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const animationRef = useRef(null);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [currentEmotion, setCurrentEmotion] = useState('neutral');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState(null);
    const [emotionHistory, setEmotionHistory] = useState([]);
    const [lastAnalysisTime, setLastAnalysisTime] = useState(0);
    const [internalRealTimeMode, setInternalRealTimeMode] = useState(false); // 내부 실시간 모드 토글

    // 외부에서 전달받은 모드가 있으면 사용, 없으면 내부 상태 사용
    const isRealTimeMode = externalRealTimeMode !== false ? externalRealTimeMode : internalRealTimeMode;

    // 웹캠 시작
    const startCamera = useCallback(async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsCameraOn(true);
                // 카메라 시작 시 초기 감정 설정
                setCurrentEmotion('neutral');
                onEmotionDetected('neutral');
                console.log('카메라 시작됨, 초기 감정 설정: neutral');
            }
        } catch (err) {
            console.error('웹캠 시작 실패:', err);
            setError('웹캠에 접근할 수 없습니다. 브라우저 권한을 확인해주세요.');
        }
    }, []);

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
        setCurrentEmotion('neutral');
    }, []);

    // 감정 분석 함수
    const analyzeEmotion = useCallback(async (imageData) => {
        if (!isActive || isAnalyzing) return;

        setIsAnalyzing(true);
        try {
            // Canvas에서 이미지 데이터 추출
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            // 비디오 프레임을 캔버스에 그리기
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            // 이미지 데이터를 base64로 변환
            const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

            // 감정 분석 API 호출 (여기서는 간단한 시뮬레이션)
            const emotion = await simulateEmotionAnalysis(imageBase64);

            // 감정 안정화: 같은 감정이 3번 연속으로 감지되면 변경
            console.log('감정 분석 결과:', emotion, '현재 감정:', currentEmotion);
            if (emotion && emotion !== currentEmotion) {
                // 이전 감정들과 비교하여 안정성 확인
                if (shouldUpdateEmotion(emotion)) {
                    setCurrentEmotion(emotion);
                    onEmotionDetected(emotion);
                    console.log('감정 업데이트됨:', emotion);
                }
            }
        } catch (err) {
            console.error('감정 분석 오류:', err);
        } finally {
            setIsAnalyzing(false);
        }
    }, [isActive, isAnalyzing, currentEmotion, onEmotionDetected]);

    // 감정 업데이트 함수 (간소화된 버전)
    const shouldUpdateEmotion = useCallback((newEmotion) => {
        if (isRealTimeMode) {
            // 실시간 모드: 2번 연속 감지 시 업데이트
            const newHistory = [...emotionHistory, newEmotion].slice(-5); // 최근 5개만 유지
            setEmotionHistory(newHistory);

            // 같은 감정이 2번 이상 연속으로 감지되면 업데이트
            const consecutiveCount = newHistory.filter(emotion => emotion === newEmotion).length;
            const shouldUpdate = consecutiveCount >= 2;

            if (shouldUpdate && newEmotion !== currentEmotion) {
                console.log(`감정 변경 (실시간): ${currentEmotion} → ${newEmotion} (${consecutiveCount}번 연속 감지)`);
                return true;
            }
            return false;
        } else {
            // 안정화 모드: 1번 감지 시 업데이트 (3초 간격)
            const now = Date.now();
            const timeSinceLastAnalysis = now - lastAnalysisTime;

            // 최소 3초 간격으로만 감정 업데이트
            if (timeSinceLastAnalysis < 3000) {
                return false;
            }

            // 감정 히스토리에 새 감정 추가
            const newHistory = [...emotionHistory, newEmotion].slice(-3); // 최근 3개만 유지
            setEmotionHistory(newHistory);

            // 같은 감정이 2번 이상 연속으로 감지되면 업데이트
            const consecutiveCount = newHistory.filter(emotion => emotion === newEmotion).length;
            const shouldUpdate = consecutiveCount >= 2;

            if (shouldUpdate) {
                setLastAnalysisTime(now);
                console.log(`감정 안정화: ${newEmotion} (${consecutiveCount}번 연속 감지)`);
            }

            return shouldUpdate;
        }
    }, [isRealTimeMode, currentEmotion, emotionHistory, lastAnalysisTime]);

    // 감정 분석 시뮬레이션 (실제로는 AI API 사용)
    const simulateEmotionAnalysis = async (imageData) => {
        // 실제 구현에서는 여기에 감정 분석 API를 호출합니다
        // 예: Google Cloud Vision API, Azure Face API, 또는 로컬 AI 모델

        // 임시로 랜덤 감정 반환 (테스트용) - 더 안정적인 감정 생성
        const emotions = ['happy', 'sad', 'neutral', 'surprised', 'angry', 'fearful', 'disgusted'];

        // 감정 변화 확률 (모드에 따라 다름)
        if (isRealTimeMode) {
            // 실시간 모드: 50% 확률로 유지, 50% 확률로 변경
            if (currentEmotion && Math.random() < 0.5) {
                return currentEmotion;
            }
        } else {
            // 안정화 모드: 60% 확률로 유지, 40% 확률로 변경
            if (currentEmotion && Math.random() < 0.6) {
                return currentEmotion;
            }
        }

        const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];

        // 실제 구현을 위한 주석
        /*
        try {
            const response = await fetch('/api/analyze-emotion', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image: imageData })
            });
            
            const result = await response.json();
            return result.emotion;
        } catch (error) {
            console.error('감정 분석 API 오류:', error);
            return 'neutral';
        }
        */

        return randomEmotion;
    };

    // 프레임 분석 루프 (모드에 따라 다름)
    const analyzeFrame = useCallback(() => {
        if (isCameraOn && isActive && videoRef.current && videoRef.current.readyState === 4) {
            if (isRealTimeMode) {
                // 실시간 모드: 1초마다 분석
                const now = Date.now();
                if (now - lastAnalysisTime >= 1000) {
                    analyzeEmotion();
                    setLastAnalysisTime(now);
                }
            } else {
                // 안정화 모드: 3초마다 분석
                const now = Date.now();
                if (now - lastAnalysisTime >= 3000) {
                    analyzeEmotion();
                }
            }
        }
        animationRef.current = requestAnimationFrame(analyzeFrame);
    }, [isCameraOn, isActive, analyzeEmotion, isRealTimeMode, lastAnalysisTime]);

    // 컴포넌트 마운트/언마운트 처리
    useEffect(() => {
        if (isActive) {
            startCamera();
        } else {
            stopCamera();
        }

        return () => {
            stopCamera();
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isActive, startCamera, stopCamera]);

    // 프레임 분석 시작/중지
    useEffect(() => {
        if (isCameraOn && isActive) {
            analyzeFrame();
        } else {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isCameraOn, isActive, analyzeFrame]);

    // 감정 상태에 따른 CSS 클래스
    const getEmotionClass = (emotion) => {
        if (!emotion) return '';
        return `emotion-${emotion}`;
    };

    return (
        <div className={`emotion-camera ${getEmotionClass(currentEmotion)}`}>
            {/* 카메라 제어 버튼 (위쪽 배치) - hideControls가 false일 때만 표시 */}
            {!hideControls && (
                <div className="camera-controls-top">
                    <button
                        onClick={isCameraOn ? stopCamera : startCamera}
                        className={`camera-toggle ${isCameraOn ? 'active' : ''}`}
                    >
                        {isCameraOn ? '📷 카메라 끄기' : '📷 카메라 켜기'}
                    </button>

                    {/* 모드 토글 버튼 */}
                    <button
                        onClick={() => setInternalRealTimeMode(!internalRealTimeMode)}
                        className={`mode-toggle ${isRealTimeMode ? 'realtime' : 'stable'}`}
                        disabled={!isCameraOn}
                    >
                        {isRealTimeMode ? '⚡ 실시간 모드' : '🛡️ 안정화 모드'}
                    </button>
                </div>
            )}

            {/* 감정 상태 표시 - 카메라 위쪽 */}
            <div className="emotion-indicator-top" style={{ display: 'flex !important', visibility: 'visible !important' }}>
                <span className="emotion-label-small">
                    {currentEmotion === 'happy' && '😊'}
                    {currentEmotion === 'sad' && '😢'}
                    {currentEmotion === 'neutral' && '😐'}
                    {currentEmotion === 'surprised' && '😲'}
                    {currentEmotion === 'angry' && '😠'}
                    {currentEmotion === 'fearful' && '😨'}
                    {currentEmotion === 'disgusted' && '🤢'}
                    {!currentEmotion && '😐'}
                </span>
                <span className="emotion-text-small">
                    {currentEmotion === 'happy' && '기쁨'}
                    {currentEmotion === 'sad' && '슬픔'}
                    {currentEmotion === 'neutral' && '무표정'}
                    {currentEmotion === 'surprised' && '놀람'}
                    {currentEmotion === 'angry' && '분노'}
                    {currentEmotion === 'fearful' && '두려움'}
                    {currentEmotion === 'disgusted' && '혐오'}
                    {!currentEmotion && '분석 중...'}
                </span>
                <span className="emotion-stability-small">
                    {isRealTimeMode
                        ? `🔄 실시간 (${emotionHistory.filter(e => e === currentEmotion).length}/2)`
                        : `🔒 안정 (${emotionHistory.filter(e => e === currentEmotion).length}/2)`
                    }
                </span>
            </div>

            <div className="camera-container">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="camera-video"
                />
                <canvas
                    ref={canvasRef}
                    width="640"
                    height="480"
                    style={{ display: 'none' }}
                />

                {/* 분석 중 표시 */}
                {isAnalyzing && (
                    <div className="analyzing-indicator">
                        <div className="analyzing-spinner"></div>
                        <span>감정 분석 중...</span>
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