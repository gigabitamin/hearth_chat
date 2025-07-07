import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import './VoiceRecognition.css';
import speechRecognitionService from '../services/speechRecognitionService';

const VoiceRecognition = forwardRef(({ onResult, onInterimResult, enabled = true, continuous = false, onStart, onStop }, ref) => {
    const [isListening, setIsListening] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const [currentLanguage, setCurrentLanguage] = useState('ko-KR');
    const [interimText, setInterimText] = useState('');
    const [error, setError] = useState(null);
    const [supportedLanguages, setSupportedLanguages] = useState([]);

    const buttonRef = useRef(null);

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

        speechRecognitionService.on('result', (finalText) => {
            console.log('최종 음성인식 결과:', finalText);
            if (onResult) {
                onResult(finalText);
            }
            setInterimText('');
        });

        speechRecognitionService.on('interim', (interimText) => {
            console.log('중간 음성인식 결과:', interimText);
            setInterimText(interimText);
            if (onInterimResult) {
                onInterimResult(interimText);
            }
        });

        speechRecognitionService.on('error', (error) => {
            console.error('음성인식 오류:', error);
            setError(error);
            setIsListening(false);
            setInterimText('');
        });

        return () => {
            // 컴포넌트 언마운트 시 음성인식 중지
            if (isListening) {
                speechRecognitionService.stop();
            }
        };
    }, [onResult, onInterimResult, isListening, continuous, enabled, onStart]);

    // 음성인식 시작/중지 토글
    const toggleListening = () => {
        if (!isSupported || !enabled) {
            return;
        }

        if (isListening) {
            speechRecognitionService.stop();
            if (onStop) {
                onStop();
            }
        } else {
            const success = speechRecognitionService.start();
            if (success && onStart) {
                onStart();
            } else {
                setError('음성인식을 시작할 수 없습니다.');
            }
        }
    };

    // 언어 변경
    const handleLanguageChange = (event) => {
        const newLanguage = event.target.value;
        setCurrentLanguage(newLanguage);
        speechRecognitionService.setLanguage(newLanguage);
        console.log('음성인식 언어 변경:', newLanguage);
    };

    // 키보드 단축키 지원
    useEffect(() => {
        const handleKeyPress = (event) => {
            // Space 키로 음성인식 토글 (입력 필드에 포커스가 없을 때만)
            if (event.code === 'Space' &&
                document.activeElement.tagName !== 'INPUT' &&
                document.activeElement.tagName !== 'TEXTAREA') {
                event.preventDefault();
                toggleListening();
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        return () => {
            document.removeEventListener('keydown', handleKeyPress);
        };
    }, [isListening, isSupported, enabled]);

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

            {/* 음성인식 버튼 */}
            <button
                ref={buttonRef}
                className={`voice-recognition-button ${isListening ? 'listening' : ''} ${!enabled ? 'disabled' : ''}`}
                onClick={toggleListening}
                disabled={!enabled}
                title={isListening ? '음성인식 중지 (Space)' : '음성인식 시작 (Space)'}
            >
                <div className="voice-button-icon">
                    {isListening ? (
                        <i className="fas fa-microphone-slash"></i>
                    ) : (
                        <i className="fas fa-microphone"></i>
                    )}
                </div>
                <div className="voice-button-text">
                    {isListening ? '음성인식 중지' : '음성인식 시작'}
                </div>
                {isListening && (
                    <div className="voice-listening-indicator">
                        <div className="pulse-ring"></div>
                    </div>
                )}
            </button>

            {/* 중간 결과 표시 */}
            {interimText && (
                <div className="voice-interim-result">
                    <i className="fas fa-volume-up"></i>
                    <span>{interimText}</span>
                </div>
            )}

            {/* 오류 메시지 표시 */}
            {error && (
                <div className="voice-error-message">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
});

export default VoiceRecognition; 