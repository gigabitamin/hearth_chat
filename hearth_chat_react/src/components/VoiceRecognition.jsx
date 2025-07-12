import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import './VoiceRecognition.css';
import speechRecognitionService from '../services/speechRecognitionService';

const VoiceRecognition = forwardRef(({ isTTSSpeaking, onResult, onInterimResult, enabled = true, continuous = false, onStart, onStop, onAutoSend }, ref) => {
    const [isListening, setIsListening] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const [currentLanguage, setCurrentLanguage] = useState('ko-KR');
    const [interimText, setInterimText] = useState('');
    const [error, setError] = useState(null);
    const [supportedLanguages, setSupportedLanguages] = useState([]);

    // 3단계: 품질 및 통계 상태
    const [qualityMetrics, setQualityMetrics] = useState({
        confidence: 0,
        volume: 0,
        clarity: 0,
        noiseLevel: 0
    });
    const [recognitionStats, setRecognitionStats] = useState({
        totalRecognitions: 0,
        successfulRecognitions: 0,
        failedRecognitions: 0,
        averageConfidence: 0,
        totalDuration: 0
    });
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
    const [advancedSettings, setAdvancedSettings] = useState({
        confidenceThreshold: 0.7,
        noiseReduction: true,
        adaptiveRecognition: true,
        autoRestart: true
    });

    // 4-1단계: 향상된 기능 상태
    const [isVoiceDetected, setIsVoiceDetected] = useState(false);
    const [recognitionQuality, setRecognitionQuality] = useState({
        minConfidence: 0.3,
        minWords: 1,
        maxAlternatives: 3,
        silenceTimeout: 2000
    });
    const [enhancedStats, setEnhancedStats] = useState({
        totalRecognitions: 0,
        successfulRecognitions: 0,
        averageConfidence: 0,
        averageWordCount: 0,
        voiceDetectionCount: 0,
        silenceDetectionCount: 0
    });
    const [currentRecognitionInfo, setCurrentRecognitionInfo] = useState({
        wordCount: 0,
        confidence: 0,
        status: '대기 중'
    });

    // 4-2단계: 후처리 정보 상태
    const [postProcessInfo, setPostProcessInfo] = useState({
        originalText: '',
        processedText: '',
        changes: {
            normalized: false,
            corrected: false,
            improved: false,
            totalChanges: 0
        },
        hasChanges: false
    });

    // 4-2단계: 음성 품질 모니터링 상태
    const [qualityMonitoring, setQualityMonitoring] = useState({
        volume: 0,
        noiseLevel: 0,
        clarity: 0,
        averageVolume: 0,
        averageNoise: 0,
        averageClarity: 0,
        isMonitoring: false
    });

    const buttonRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const lastFinalTextRef = useRef('');
    const lastRecognizedTextRef = useRef(''); // 마지막 인식된 텍스트 저장
    const interimTextRef = useRef(''); // 마지막 interim(중간) 텍스트 저장
    const isSilenceHandledRef = useRef(false); // 침묵 감지 중복 방지
    const lastSentTextRef = useRef(''); // 마지막 전송된 텍스트

    // 외부에서 호출할 수 있는 메서드들
    useImperativeHandle(ref, () => ({
        start: async () => {
            if (isSupported && enabled) {
                const success = await speechRecognitionService.start();
                if (success && onStart) {
                    onStart();
                }
                return success;
            }
            return false;
        },
        stop: () => {
            if (isListening) {
                speechRecognitionService.stop();
                if (onStop) {
                    onStop();
                }
            }
        }
    }));

    useEffect(() => {
        // 브라우저 지원 확인
        setIsSupported(speechRecognitionService.isBrowserSupported());
        setSupportedLanguages(speechRecognitionService.getSupportedLanguages());

        // 연속 모드 설정
        if (continuous) {
            speechRecognitionService.setContinuous(true);
        }

        // 음성인식 이벤트 리스너 설정
        speechRecognitionService.on('start', () => {
            setIsListening(true);
            setError(null);
            setInterimText('');
            console.log('음성인식 시작됨');
        });

        speechRecognitionService.on('end', () => {
            setIsListening(false);
            setInterimText('');
            console.log('음성인식 종료됨');
        });

        // 최종 결과 저장
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());
        const minWords = isMobile ? 1 : 2; // 모바일에서는 1단어도 허용
        const minConfidence = isMobile ? 0.3 : 0.6; // 모바일에서는 더 낮은 신뢰도 허용

        speechRecognitionService.on('result', (finalText, additionalInfo) => {
            lastFinalTextRef.current = finalText;
            lastRecognizedTextRef.current = finalText; // 항상 최신 텍스트 저장
            interimTextRef.current = ''; // 최종 결과가 나오면 interim은 초기화

            // 마침표 자동 추가 방지
            let cleanText = finalText.trim();
            if (cleanText.endsWith('.')) {
                cleanText = cleanText.slice(0, -1);
            }

            // 단어 수/신뢰도 기준 적용 (모바일에서는 더 관대하게)
            const wordCount = cleanText.split(/\s+/).length;
            const confidence = additionalInfo?.confidence ?? 1.0;
            console.log('음성인식 결과 검증:', {
                text: cleanText,
                wordCount,
                confidence,
                minWords,
                minConfidence,
                isMobile
            });

            if (wordCount < minWords || confidence < minConfidence) {
                // 너무 짧거나 신뢰도 낮으면 무시
                console.log('품질 기준 미달로 무시됨');
                return;
            }

            // 4-2단계: 후처리 정보 저장
            if (additionalInfo && additionalInfo.postProcessInfo) {
                setPostProcessInfo(additionalInfo.postProcessInfo);
            }
            if (onResult) {
                onResult(cleanText);
            }
            setInterimText('');
        });

        speechRecognitionService.on('interim', (interimText, qualityInfo) => {
            console.log('중간 음성인식 결과:', interimText, qualityInfo);
            setInterimText(interimText);
            interimTextRef.current = interimText; // interim 결과도 ref에 저장
            if (onInterimResult) {
                onInterimResult(interimText, qualityInfo);
            }
        });

        speechRecognitionService.on('error', (error) => {
            console.error('음성인식 오류:', error);
            setError(error);
            setIsListening(false);
            setInterimText('');
        });

        // 3단계: 품질 및 통계 이벤트 리스너
        speechRecognitionService.on('quality', (metrics) => {
            setQualityMetrics(metrics);
        });

        speechRecognitionService.on('stats', (stats) => {
            setRecognitionStats(stats);
        });

        // 3단계: 초기 설정 로드
        const initialSettings = speechRecognitionService.getAdvancedSettings();
        setAdvancedSettings(initialSettings);

        // 4-1단계: 향상된 기능 이벤트 리스너
        // 음성 감지 시 타이머 취소 및 침묵 처리 플래그 초기화
        speechRecognitionService.on('voice-detected', () => {
            setIsVoiceDetected(true);
            setCurrentRecognitionInfo(prev => ({ ...prev, status: '음성 감지됨' }));
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
            isSilenceHandledRef.current = false; // 침묵 감지 플래그 초기화
        });

        // 침묵 감지 시 타이머 시작
        speechRecognitionService.on('silence-detected', () => {
            console.log('침묵 감지! (VoiceRecognition.jsx)', lastRecognizedTextRef.current, interimTextRef.current);
            setIsVoiceDetected(false);
            setCurrentRecognitionInfo(prev => ({ ...prev, status: '침묵 감지됨' }));
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
            }
            // 중복 침묵 감지 방지
            if (isSilenceHandledRef.current) return;
            isSilenceHandledRef.current = true;
            // TTS 재생 중에는 침묵 감지 이벤트 자체를 무시
            if (isTTSSpeaking) return;
            let textToSend = interimTextRef.current && interimTextRef.current.trim() ? interimTextRef.current : lastRecognizedTextRef.current;
            // 마지막 전송된 문장과 동일하면 무시
            if (textToSend && textToSend === lastSentTextRef.current) return;
            if (typeof onAutoSend === 'function') {
                console.log('onAutoSend 호출 (VoiceRecognition.jsx)', textToSend);
                onAutoSend(textToSend);
                lastSentTextRef.current = textToSend;
            }
        });

        speechRecognitionService.on('enhanced-stats', (stats) => {
            setEnhancedStats(stats);
        });

        // 4-1단계: 초기 데이터 로드
        const initialQuality = speechRecognitionService.getRecognitionQuality();
        const initialEnhancedStats = speechRecognitionService.getEnhancedStats();

        setRecognitionQuality(initialQuality);
        setEnhancedStats(initialEnhancedStats);

        // 4-2단계: 음성 품질 모니터링 이벤트 리스너
        speechRecognitionService.on('quality-monitoring', (monitoringData) => {
            setQualityMonitoring(prev => ({
                ...prev,
                ...monitoringData,
                isMonitoring: true
            }));
        });



        return () => {
            // 컴포넌트 언마운트 시 음성인식 중지 및 타이머 정리
            if (isListening) {
                speechRecognitionService.stop();
            }
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
            }
        };
    }, [onResult, onInterimResult, isListening, continuous, enabled, onStart, onAutoSend, isTTSSpeaking]);

    // enabled prop이 변경될 때 자동으로 start/stop
    useEffect(() => {
        if (isSupported) {
            if (enabled) {
                // 모바일 브라우저에서 권한 요청을 위한 지연
                const startRecognition = async () => {
                    try {
                        const success = await speechRecognitionService.start();
                        if (success) {
                            setIsListening(true);
                            setError(null);
                            setInterimText('');
                            if (onStart) onStart();
                        } else {
                            setError('음성인식을 시작할 수 없습니다. 마이크 권한을 확인해주세요.');
                        }
                    } catch (error) {
                        console.error('음성인식 시작 오류:', error);
                        setError('음성인식을 시작할 수 없습니다: ' + error.message);
                    }
                };

                startRecognition();
            } else {
                // 자동 재시작/연속 옵션 강제 OFF
                if (speechRecognitionService.setContinuous) speechRecognitionService.setContinuous(false);
                if (speechRecognitionService.setAutoRestart) speechRecognitionService.setAutoRestart(false);
                Promise.resolve(speechRecognitionService.stop()).finally(() => {
                    setIsListening(false);
                    setInterimText('');
                    setError(null);
                    if (onStop) onStop();
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    // 음성인식 시작/중지 토글 함수 및 버튼, 관련 UI 제거

    // 언어 변경
    const handleLanguageChange = (event) => {
        const newLanguage = event.target.value;
        setCurrentLanguage(newLanguage);
        speechRecognitionService.setLanguage(newLanguage);
        console.log('음성인식 언어 변경:', newLanguage);
    };

    // 3단계: 고급 설정 변경 핸들러
    const handleAdvancedSettingChange = (setting, value) => {
        const newSettings = { ...advancedSettings, [setting]: value };
        setAdvancedSettings(newSettings);
        speechRecognitionService.updateAdvancedSettings(newSettings);
    };

    // 3단계: 통계 초기화 핸들러
    const handleResetStats = () => {
        speechRecognitionService.resetStats();
        setRecognitionStats({
            totalRecognitions: 0,
            successfulRecognitions: 0,
            failedRecognitions: 0,
            averageConfidence: 0,
            totalDuration: 0
        });
    };

    // 3단계: 품질 수준을 색상으로 변환
    const getQualityColor = (value) => {
        if (value >= 0.8) return '#4CAF50'; // 녹색
        if (value >= 0.6) return '#FF9800'; // 주황색
        return '#F44336'; // 빨간색
    };



    // 4-1단계: 인식 품질 설정 변경 핸들러
    const handleQualitySettingChange = (setting, value) => {
        const newSettings = { ...recognitionQuality, [setting]: value };
        setRecognitionQuality(newSettings);
        speechRecognitionService.updateRecognitionQuality(newSettings);
    };

    // 4-1단계: 성공률 계산
    const calculateSuccessRate = () => {
        if (enhancedStats.totalRecognitions === 0) return 0;
        return Math.round((enhancedStats.successfulRecognitions / enhancedStats.totalRecognitions) * 100);
    };

    // 4-1단계: 음성 감지 상태 색상
    const getVoiceDetectionColor = () => {
        if (isListening) {
            return isVoiceDetected ? '#4CAF50' : '#9C27B0'; // 녹색(음성) / 보라색(침묵)
        }
        return '#666';
    };

    // 4-1단계: 음성 감지 상태 아이콘
    const getVoiceDetectionIcon = () => {
        if (isListening) {
            return isVoiceDetected ? 'fas fa-microphone' : 'fas fa-volume-mute';
        }
        return 'fas fa-microphone-slash';
    };

    // 3단계: 시간 포맷팅
    const formatDuration = (ms) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    // 키보드 단축키 지원
    useEffect(() => {
        const handleKeyPress = (event) => {
            // Space 키로 음성인식 토글 (입력 필드에 포커스가 없을 때만)
            if (event.code === 'Space' &&
                document.activeElement.tagName !== 'INPUT' &&
                document.activeElement.tagName !== 'TEXTAREA') {
                event.preventDefault();
                // 현재 음성인식 상태에 따라 토글
                if (isListening) {
                    speechRecognitionService.stop();
                    if (onStop) onStop();
                } else {
                    const success = speechRecognitionService.start();
                    if (success && onStart) {
                        onStart();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        return () => {
            document.removeEventListener('keydown', handleKeyPress);
        };
    }, [isListening, isSupported, enabled, onStart, onStop]);

    if (!isSupported) {
        return (
            <div className="voice-recognition-container">
                <div className="voice-recognition-error">
                    <i className="fas fa-microphone-slash"></i>
                    <span>이 브라우저는 음성인식을 지원하지 않습니다.</span>
                    <small>Chrome 브라우저 사용을 권장합니다.</small>
                </div>
            </div>
        );
    }

    return (
        <div className="voice-recognition-container">
            {/* 언어 선택 */}
            <div className="voice-language-selector">
                <select
                    value={currentLanguage}
                    onChange={handleLanguageChange}
                    disabled={isListening}
                >
                    {supportedLanguages.map(lang => (
                        <option key={lang.code} value={lang.code}>
                            {lang.name}
                        </option>
                    ))}
                </select>
            </div>
            {/* 3단계: 고급 설정 토글 버튼 */}
            <div className="voice-advanced-toggle">
                <button
                    className="voice-settings-button"
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    title="고급 설정"
                >
                    <i className="fas fa-cog"></i>
                    <span>고급 설정</span>
                </button>
            </div>
            {/* 음성인식 버튼(동그라미) 및 관련 UI 완전 제거됨 */}

            {/* 중간 결과 표시 */}
            {interimText && (
                <div className="voice-interim-result">
                    <i className="fas fa-volume-up"></i>
                    <span>{interimText}</span>
                    {/* 3단계: 품질 표시 */}
                    <div className="voice-quality-indicator">
                        <div className="quality-bar">
                            <span>신뢰도:</span>
                            <div className="quality-progress">
                                <div
                                    className="quality-fill"
                                    style={{
                                        width: `${qualityMetrics.confidence * 100}%`,
                                        backgroundColor: getQualityColor(qualityMetrics.confidence)
                                    }}
                                ></div>
                            </div>
                            <span>{Math.round(qualityMetrics.confidence * 100)}%</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 4-1단계: 음성 감지 상태 표시 */}
            {isListening && (
                <div className="voice-detection-status">
                    <div className="detection-indicator" style={{ color: getVoiceDetectionColor() }}>
                        <i className={getVoiceDetectionIcon()}></i>
                        <span>{currentRecognitionInfo.status}</span>
                    </div>
                </div>
            )}

            {/* 오류 메시지 표시 */}
            {error && (
                <div className="voice-error-message">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span>{error}</span>
                </div>
            )}

            {/* 3단계: 고급 설정 패널 */}
            {showAdvancedSettings && (
                <div className="voice-advanced-settings">
                    <h4>고급 설정</h4>

                    <div className="setting-group">
                        <label>
                            <input
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.1"
                                value={advancedSettings.confidenceThreshold}
                                onChange={(e) => handleAdvancedSettingChange('confidenceThreshold', parseFloat(e.target.value))}
                            />
                            신뢰도 임계값: {Math.round(advancedSettings.confidenceThreshold * 100)}%
                        </label>
                    </div>

                    <div className="setting-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={advancedSettings.noiseReduction}
                                onChange={(e) => handleAdvancedSettingChange('noiseReduction', e.target.checked)}
                            />
                            노이즈 감소
                        </label>
                    </div>

                    <div className="setting-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={advancedSettings.adaptiveRecognition}
                                onChange={(e) => handleAdvancedSettingChange('adaptiveRecognition', e.target.checked)}
                            />
                            적응형 인식
                        </label>
                    </div>

                    <div className="setting-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={advancedSettings.autoRestart}
                                onChange={(e) => handleAdvancedSettingChange('autoRestart', e.target.checked)}
                            />
                            자동 재시작
                        </label>
                    </div>
                </div>
            )}



            {/* 3단계: 인식 통계 */}
            <div className="voice-recognition-stats">
                <div className="stats-header">
                    <h4>인식 통계</h4>
                    <button
                        className="reset-stats-button"
                        onClick={handleResetStats}
                        title="통계 초기화"
                    >
                        <i className="fas fa-refresh"></i>
                    </button>
                </div>

                <div className="stats-grid">
                    <div className="stat-item">
                        <span className="stat-label">총 인식:</span>
                        <span className="stat-value">{recognitionStats.totalRecognitions}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">성공:</span>
                        <span className="stat-value success">{recognitionStats.successfulRecognitions}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">실패:</span>
                        <span className="stat-value failed">{recognitionStats.failedRecognitions}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">평균 신뢰도:</span>
                        <span className="stat-value">{Math.round(recognitionStats.averageConfidence * 100)}%</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">총 시간:</span>
                        <span className="stat-value">{formatDuration(recognitionStats.totalDuration)}</span>
                    </div>
                </div>
            </div>

            {/* 4-1단계: 향상된 인식 통계 */}
            <div className="voice-enhanced-stats">
                <div className="stats-header">
                    <h4>향상된 인식 통계</h4>
                    <div className="stats-badge">
                        <i className="fas fa-chart-line"></i>
                        <span>4-1단계</span>
                    </div>
                </div>

                <div className="enhanced-stats-grid">
                    <div className="stat-item">
                        <span className="stat-label">총 인식 시도:</span>
                        <span className="stat-value">{enhancedStats.totalRecognitions}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">성공률:</span>
                        <span className="stat-value success">{calculateSuccessRate()}%</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">평균 단어 수:</span>
                        <span className="stat-value">{enhancedStats.averageWordCount.toFixed(1)}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">음성 감지:</span>
                        <span className="stat-value">{enhancedStats.voiceDetectionCount}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">침묵 감지:</span>
                        <span className="stat-value">{enhancedStats.silenceDetectionCount}</span>
                    </div>
                </div>

                {/* 4-1단계: 인식 품질 설정 */}
                <div className="quality-settings">
                    <h5>인식 품질 설정</h5>
                    <div className="setting-group">
                        <label>
                            <input
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.1"
                                value={recognitionQuality.minConfidence}
                                onChange={(e) => handleQualitySettingChange('minConfidence', parseFloat(e.target.value))}
                            />
                            최소 신뢰도: {Math.round(recognitionQuality.minConfidence * 100)}%
                        </label>
                    </div>
                    <div className="setting-group">
                        <label>
                            <input
                                type="range"
                                min="1"
                                max="5"
                                step="1"
                                value={recognitionQuality.minWords}
                                onChange={(e) => handleQualitySettingChange('minWords', parseInt(e.target.value))}
                            />
                            최소 단어 수: {recognitionQuality.minWords}
                        </label>
                    </div>
                </div>
            </div>

            {/* 4-2단계: 후처리 정보 */}
            {postProcessInfo.hasChanges && (
                <div className="voice-post-process-info">
                    <div className="stats-header">
                        <h4>후처리 결과</h4>
                        <div className="stats-badge">
                            <i className="fas fa-magic"></i>
                            <span>4-2단계</span>
                        </div>
                    </div>

                    <div className="post-process-content">
                        <div className="text-comparison">
                            <div className="original-text">
                                <h5>원본 텍스트:</h5>
                                <p>{postProcessInfo.originalText}</p>
                            </div>
                            <div className="processed-text">
                                <h5>처리된 텍스트:</h5>
                                <p>{postProcessInfo.processedText}</p>
                            </div>
                        </div>

                        <div className="changes-summary">
                            <h5>적용된 개선사항:</h5>
                            <div className="changes-list">
                                {postProcessInfo.changes.normalized && (
                                    <div className="change-item">
                                        <i className="fas fa-check-circle" style={{ color: '#4CAF50' }}></i>
                                        <span>문장 정규화</span>
                                    </div>
                                )}
                                {postProcessInfo.changes.corrected && (
                                    <div className="change-item">
                                        <i className="fas fa-check-circle" style={{ color: '#2196F3' }}></i>
                                        <span>오타 수정</span>
                                    </div>
                                )}
                                {postProcessInfo.changes.improved && (
                                    <div className="change-item">
                                        <i className="fas fa-check-circle" style={{ color: '#FF9800' }}></i>
                                        <span>문맥 개선</span>
                                    </div>
                                )}
                            </div>
                            <div className="total-changes">
                                총 <strong>{postProcessInfo.changes.totalChanges}</strong>개의 개선사항이 적용되었습니다.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 4-2단계: 음성 품질 모니터링 */}
            {qualityMonitoring.isMonitoring && (
                <div className="voice-quality-monitoring">
                    <div className="stats-header">
                        <h4>음성 품질 모니터링</h4>
                        <div className="stats-badge">
                            <i className="fas fa-microphone-alt"></i>
                            <span>4-2단계</span>
                        </div>
                    </div>

                    <div className="quality-metrics-grid">
                        <div className="metric-item">
                            <div className="metric-header">
                                <i className="fas fa-volume-up" style={{ color: '#4CAF50' }}></i>
                                <span>볼륨</span>
                            </div>
                            <div className="metric-bar">
                                <div
                                    className="metric-fill volume-fill"
                                    style={{ width: `${qualityMonitoring.volume * 100}%` }}
                                ></div>
                            </div>
                            <div className="metric-value">
                                {Math.round(qualityMonitoring.volume * 100)}%
                            </div>
                        </div>

                        <div className="metric-item">
                            <div className="metric-header">
                                <i className="fas fa-volume-mute" style={{ color: '#F44336' }}></i>
                                <span>노이즈</span>
                            </div>
                            <div className="metric-bar">
                                <div
                                    className="metric-fill noise-fill"
                                    style={{ width: `${qualityMonitoring.noiseLevel * 100}%` }}
                                ></div>
                            </div>
                            <div className="metric-value">
                                {Math.round(qualityMonitoring.noiseLevel * 100)}%
                            </div>
                        </div>

                        <div className="metric-item">
                            <div className="metric-header">
                                <i className="fas fa-bullseye" style={{ color: '#2196F3' }}></i>
                                <span>명확도</span>
                            </div>
                            <div className="metric-bar">
                                <div
                                    className="metric-fill clarity-fill"
                                    style={{ width: `${qualityMonitoring.clarity * 100}%` }}
                                ></div>
                            </div>
                            <div className="metric-value">
                                {Math.round(qualityMonitoring.clarity * 100)}%
                            </div>
                        </div>
                    </div>

                    <div className="quality-summary">
                        <div className="quality-score">
                            <h5>종합 품질 점수</h5>
                            <div className="score-display">
                                {(() => {
                                    const score = Math.round(
                                        qualityMonitoring.volume * 30 +
                                        (1 - qualityMonitoring.noiseLevel) * 30 +
                                        qualityMonitoring.clarity * 40
                                    );
                                    const quality = score >= 80 ? 'excellent' :
                                        score >= 60 ? 'good' :
                                            score >= 40 ? 'fair' : 'poor';
                                    return (
                                        <>
                                            <span className={`score-value ${quality}`}>{score}</span>
                                            <span className="score-max">/100</span>
                                            <span className={`quality-label ${quality}`}>
                                                {quality === 'excellent' ? '우수' :
                                                    quality === 'good' ? '양호' :
                                                        quality === 'fair' ? '보통' : '불량'}
                                            </span>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        <div className="quality-recommendations">
                            <h5>개선 권장사항</h5>
                            <ul>
                                {qualityMonitoring.volume < 0.3 && (
                                    <li><i className="fas fa-info-circle"></i> 마이크에 더 가까이 말씀해주세요</li>
                                )}
                                {qualityMonitoring.noiseLevel > 0.5 && (
                                    <li><i className="fas fa-info-circle"></i> 조용한 환경에서 사용해주세요</li>
                                )}
                                {qualityMonitoring.clarity < 0.4 && (
                                    <li><i className="fas fa-info-circle"></i> 더 명확하게 발음해주세요</li>
                                )}
                                {qualityMonitoring.volume >= 0.3 && qualityMonitoring.noiseLevel <= 0.5 && qualityMonitoring.clarity >= 0.4 && (
                                    <li><i className="fas fa-check-circle"></i> 음성 품질이 양호합니다</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default VoiceRecognition; 