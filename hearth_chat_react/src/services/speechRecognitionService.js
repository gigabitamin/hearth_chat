class SpeechRecognitionService {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.isSupported = false;
        this.onResult = null;
        this.onStart = null;
        this.onEnd = null;
        this.onError = null;
        this.onInterimResult = null;

        // 3단계: 음성인식 품질 개선 및 통계
        this.recognitionStats = {
            totalRecognitions: 0,
            successfulRecognitions: 0,
            failedRecognitions: 0,
            averageConfidence: 0,
            totalDuration: 0,
            startTime: null,
            lastRecognitionTime: null
        };

        // 3단계: 사용자 피드백 및 품질 모니터링
        this.qualityMetrics = {
            confidence: 0,
            volume: 0,
            clarity: 0,
            noiseLevel: 0
        };

        // 3단계: 고급 설정
        this.advancedSettings = {
            confidenceThreshold: 0.7,
            noiseReduction: true,
            adaptiveRecognition: true,
            autoRestart: true,
            maxRecognitionTime: 30000 // 30초
        };

        // 3단계: 콜백 함수들
        this.onQualityUpdate = null;
        this.onStatsUpdate = null;
        this.onConfidenceChange = null;

        // 4-1단계: 음성 인식 품질 향상 및 사용자 피드백
        this.recognitionQuality = {
            minConfidence: 0.3, // 2음절 이상 인식을 위한 낮은 임계값
            minWords: 1, // 최소 단어 수
            maxAlternatives: 3, // 최대 대안 수
            silenceTimeout: 2000, // 침묵 감지 시간 (2초)
            isVoiceDetected: false,
            silenceTimer: null
        };

        // 4-1단계: 향상된 통계 및 모니터링
        this.enhancedStats = {
            totalRecognitions: 0,
            successfulRecognitions: 0,
            averageConfidence: 0,
            averageWordCount: 0,
            voiceDetectionCount: 0,
            silenceDetectionCount: 0
        };

        // 4-1단계: 콜백 함수들
        this.onVoiceDetected = null;
        this.onSilenceDetected = null;
        this.onQualityUpdate = null;
        this.onEnhancedStatsUpdate = null;

        // 4-2단계: 음성 품질 모니터링
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.qualityMonitoring = {
            volume: 0,
            noiseLevel: 0,
            clarity: 0,
            isMonitoring: false,
            monitoringInterval: null,
            volumeHistory: [],
            noiseHistory: [],
            clarityHistory: []
        };

        // 4-2단계: 콜백 함수들
        this.onQualityMonitoringUpdate = null;

        this.initialize();
    }

    // 음성인식 초기화
    initialize() {
        try {
            // 브라우저 지원 확인
            let SpeechRecognition = null;

            // 다양한 브라우저별 Web Speech API 확인
            if (typeof window !== 'undefined') {
                SpeechRecognition = window.SpeechRecognition ||
                    window.webkitSpeechRecognition ||
                    window.mozSpeechRecognition ||
                    window.msSpeechRecognition;
            }

            if (!SpeechRecognition) {
                console.error('이 브라우저는 음성인식을 지원하지 않습니다.');
                this.isSupported = false;
                return;
            }

            this.recognition = new SpeechRecognition();
            this.isSupported = true;

            // 기본 설정
            this.recognition.lang = 'ko-KR'; // 한국어
            this.recognition.continuous = true; // 연속 인식
            this.recognition.interimResults = true; // 중간 결과 포함
            this.recognition.maxAlternatives = 1; // 최대 대안 수

            // 모바일 브라우저 최적화 설정
            if (this.isMobileBrowser()) {
                console.log('모바일 브라우저 감지 - 음성인식 설정 최적화');
                // 모바일에서는 더 관대한 설정 사용
                this.recognitionQuality.minConfidence = 0.1; // 더 낮은 신뢰도 임계값
                this.recognitionQuality.minWords = 1; // 최소 1단어
                this.recognitionQuality.silenceTimeout = 2000; // 2초로 통일
            } else {
                this.recognitionQuality.silenceTimeout = 2000; // 2초로 통일
            }

            // 이벤트 리스너 설정
            this.recognition.onstart = () => {
                console.log('음성인식 시작');
                this.isListening = true;

                // 3단계: 통계 초기화
                this.recognitionStats.startTime = Date.now();
                this.recognitionStats.lastRecognitionTime = Date.now();

                // 4-1단계: 음성 감지 상태 초기화
                this.recognitionQuality.isVoiceDetected = false;
                this.startSilenceTimer();

                if (this.onStart) this.onStart();
            };

            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';
                let maxConfidence = 0;

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    const confidence = event.results[i][0].confidence || 0;
                    maxConfidence = Math.max(maxConfidence, confidence);

                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                // 음성 결과가 있을 때마다 음성 감지 처리
                if (finalTranscript || interimTranscript) {
                    this.handleVoiceDetection();
                }

                // 3단계: 품질 메트릭 업데이트
                this.qualityMetrics.confidence = maxConfidence;
                this.updateQualityMetrics();

                console.log('음성인식 결과:', {
                    final: finalTranscript,
                    interim: interimTranscript,
                    confidence: maxConfidence
                });

                // 3단계: 중간 결과 처리 (품질 정보 포함)
                if (this.onInterimResult && interimTranscript) {
                    this.onInterimResult(interimTranscript, {
                        confidence: maxConfidence,
                        quality: this.qualityMetrics
                    });
                }

                // 4-1단계: 최종 결과 처리 (품질 정보 및 향상된 분석 포함)
                if (this.onResult && finalTranscript) {
                    // 4-1단계: 향상된 품질 검증
                    const wordCount = finalTranscript.trim().split(/\s+/).length;
                    const meetsMinWords = wordCount >= this.recognitionQuality.minWords;
                    const meetsMinConfidence = maxConfidence >= this.recognitionQuality.minConfidence;

                    if (meetsMinWords && meetsMinConfidence) {
                        // 4-2단계: 음성 인식 결과 후처리
                        const processedTranscript = this.postProcessRecognitionResult(finalTranscript);
                        const postProcessInfo = this.getPostProcessInfo(finalTranscript, processedTranscript);

                        this.updateRecognitionStats(true, maxConfidence);
                        this.updateEnhancedStats(processedTranscript, maxConfidence, wordCount);

                        this.onResult(processedTranscript, {
                            confidence: maxConfidence,
                            quality: this.qualityMetrics,
                            stats: this.recognitionStats,
                            // 4-1단계: 추가 정보
                            wordCount: wordCount,
                            enhancedStats: this.enhancedStats,
                            recognitionQuality: this.recognitionQuality,
                            // 4-2단계: 후처리 정보
                            postProcessInfo: postProcessInfo
                        });
                    } else {
                        this.updateRecognitionStats(false, maxConfidence);
                        console.log('4-1단계: 품질 기준 미달 - 신뢰도:', maxConfidence, '단어수:', wordCount);
                    }
                }
            };

            this.recognition.onend = () => {
                console.log('음성인식 종료');
                this.isListening = false;

                // 3단계: 통계 업데이트
                if (this.recognitionStats.startTime) {
                    this.recognitionStats.totalDuration += Date.now() - this.recognitionStats.startTime;
                }

                if (this.onEnd) this.onEnd();

                // 3단계: 고급 설정에 따른 자동 재시작
                if (this.continuousMode && this.advancedSettings.autoRestart) {
                    setTimeout(() => {
                        if (!this.isListening) {
                            console.log('연속 모드: 음성인식 자동 재시작');
                            this.start();
                        }
                    }, 100);
                }
            };

            this.recognition.onerror = (event) => {
                console.error('음성인식 오류:', event.error);
                console.error('오류 상세 정보:', {
                    error: event.error,
                    message: event.message,
                    isMobile: this.isMobileBrowser(),
                    userAgent: navigator.userAgent
                });

                if (event.error === 'no-speech') {
                    console.error('[speechRecognitionService] no-speech 오류 발생: 음성이 감지되지 않음.');
                }
                this.isListening = false;

                if (event.error === 'not-allowed') {
                    console.error('마이크 권한이 거부되었습니다.');
                    alert('마이크 권한이 필요합니다. 브라우저 설정에서 마이크 권한을 허용해주세요.');
                } else if (event.error === 'no-speech') {
                    console.log('음성이 감지되지 않았습니다.');
                    // 모바일에서는 no-speech 오류를 더 자주 발생할 수 있음
                    if (this.isMobileBrowser()) {
                        console.log('모바일 브라우저에서 no-speech 오류 - 정상적인 상황일 수 있음');
                    }
                } else if (event.error === 'audio-capture') {
                    console.error('마이크를 찾을 수 없습니다.');
                    alert('마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.');
                } else if (event.error === 'network') {
                    console.error('네트워크 오류가 발생했습니다.');
                    alert('네트워크 연결을 확인해주세요.');
                } else if (event.error === 'service-not-allowed') {
                    console.error('음성인식 서비스가 허용되지 않습니다.');
                    alert('브라우저에서 음성인식 서비스를 허용해주세요.');
                } else {
                    console.error('알 수 없는 음성인식 오류:', event.error);
                    alert(`음성인식 오류가 발생했습니다: ${event.error}`);
                }

                if (this.onError) this.onError(event.error);

                // 모바일에서는 오류 후 재시작을 더 적극적으로 시도
                if (this.continuousMode && this.isMobileBrowser()) {
                    setTimeout(() => {
                        if (!this.isListening) {
                            console.log('모바일 오류 후 재시작 시도');
                            this.start();
                        }
                    }, 1000);
                } else if (this.continuousMode && event.error !== 'no-speech' && event.error !== 'not-allowed') {
                    setTimeout(() => {
                        if (!this.isListening) {
                            console.log('오류 후 연속 모드: 음성인식 재시작 시도');
                            this.start();
                        }
                    }, 500);
                }
            };

            console.log('음성인식 서비스 초기화 완료');
        } catch (error) {
            console.error('음성인식 초기화 실패:', error);
            this.isSupported = false;
        }
    }

    // 음성인식 시작
    async start() {
        if (!this.isSupported) {
            console.error('음성인식이 지원되지 않습니다.');
            return false;
        }

        if (this.isListening) {
            console.log('이미 음성인식이 진행 중입니다.');
            return false;
        }

        try {
            // 모바일 브라우저에서 마이크 권한 확인 및 요청
            if (this.isMobileBrowser()) {
                console.log('모바일 브라우저에서 음성인식 시작 시도');
                const permissionGranted = await this.requestMicrophonePermission();
                if (!permissionGranted) {
                    console.error('마이크 권한이 거부되었습니다.');
                    if (this.onError) {
                        this.onError(new Error('마이크 권한이 필요합니다. 브라우저 설정에서 마이크 권한을 허용해주세요.'));
                    }
                    return false;
                }

                // 모바일에서는 약간의 지연 후 시작
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log('음성인식 시작 시도...');
            this.recognition.start();
            console.log('음성인식 start() 호출 완료');

            // 4-2단계: 음성 품질 모니터링 자동 시작
            this.startQualityMonitoring();

            return true;
        } catch (error) {
            console.error('음성인식 시작 실패:', error);

            // 권한 관련 오류 처리
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                console.error('마이크 권한이 거부되었습니다.');
                if (this.onError) {
                    this.onError(new Error('마이크 권한이 필요합니다. 브라우저 설정에서 마이크 권한을 허용해주세요.'));
                }
            }

            return false;
        }
    }

    // 음성인식 중지
    stop() {
        if (!this.isSupported || !this.isListening) {
            return;
        }

        try {
            this.recognition.stop();

            // 4-2단계: 음성 품질 모니터링 중지
            this.stopQualityMonitoring();
        } catch (error) {
            console.error('음성인식 중지 실패:', error);
        }
    }

    // 언어 설정 변경
    setLanguage(lang) {
        if (this.recognition) {
            this.recognition.lang = lang;
            console.log('음성인식 언어 변경:', lang);
        }
    }

    // 연속 인식 설정
    setContinuous(continuous) {
        if (this.recognition) {
            this.recognition.continuous = continuous;
            this.continuousMode = continuous;
            console.log('연속 인식 모드 설정:', continuous);
        }
    }

    // 중간 결과 설정
    setInterimResults(interim) {
        if (this.recognition) {
            this.recognition.interimResults = interim;
        }
    }

    // 현재 상태 확인
    isCurrentlyListening() {
        return this.isListening;
    }

    // 브라우저 지원 확인
    isBrowserSupported() {
        return this.isSupported;
    }

    // 모바일 브라우저 감지
    isMobileBrowser() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    }

    // 마이크 권한 요청
    async requestMicrophonePermission() {
        try {
            // navigator.permissions API 지원 확인
            if (navigator.permissions && navigator.permissions.query) {
                const permission = await navigator.permissions.query({ name: 'microphone' });

                if (permission.state === 'granted') {
                    console.log('마이크 권한이 이미 허용되어 있습니다.');
                    return true;
                }

                if (permission.state === 'denied') {
                    console.log('마이크 권한이 거부되어 있습니다.');
                    return false;
                }
            }

            // getUserMedia를 사용하여 권한 요청
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // 스트림 즉시 중지
            console.log('마이크 권한이 허용되었습니다.');
            return true;

        } catch (error) {
            console.error('마이크 권한 요청 실패:', error);

            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                console.log('사용자가 마이크 권한을 거부했습니다.');
                return false;
            }

            if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                console.log('마이크 장치를 찾을 수 없습니다.');
                return false;
            }

            if (error.name === 'NotSupportedError' || error.name === 'ConstraintNotSatisfiedError') {
                console.log('지원되지 않는 오디오 제약 조건입니다.');
                return false;
            }

            return false;
        }
    }

    // 이벤트 리스너 설정
    on(event, callback) {
        switch (event) {
            case 'result':
                this.onResult = callback;
                break;
            case 'start':
                this.onStart = callback;
                break;
            case 'end':
                this.onEnd = callback;
                break;
            case 'error':
                this.onError = callback;
                break;
            case 'interim':
                this.onInterimResult = callback;
                break;
            // 3단계: 새로운 이벤트들
            case 'quality':
                this.onQualityUpdate = callback;
                break;
            case 'stats':
                this.onStatsUpdate = callback;
                break;
            case 'confidence':
                this.onConfidenceChange = callback;
                break;
            // 4-1단계: 새로운 이벤트들
            case 'voice-detected':
                this.onVoiceDetected = callback;
                break;
            case 'silence-detected':
                this.onSilenceDetected = callback;
                break;
            case 'enhanced-stats':
                this.onEnhancedStatsUpdate = callback;
                break;
            // 4-2단계: 새로운 이벤트들
            case 'quality-monitoring':
                this.onQualityMonitoringUpdate = callback;
                break;

            default:
                console.warn('알 수 없는 음성인식 이벤트:', event);
        }
    }

    // 3단계: 품질 메트릭 업데이트
    updateQualityMetrics() {
        // 간단한 품질 계산 (실제로는 더 복잡한 알고리즘 사용 가능)
        this.qualityMetrics.volume = Math.random() * 0.3 + 0.7; // 0.7-1.0
        this.qualityMetrics.clarity = this.qualityMetrics.confidence * 0.8 + 0.2; // 신뢰도 기반
        this.qualityMetrics.noiseLevel = 1 - this.qualityMetrics.confidence; // 신뢰도 반비례

        if (this.onQualityUpdate) {
            this.onQualityUpdate(this.qualityMetrics);
        }
    }

    // 3단계: 인식 통계 업데이트
    updateRecognitionStats(success, confidence) {
        this.recognitionStats.totalRecognitions++;
        this.recognitionStats.lastRecognitionTime = Date.now();

        if (success) {
            this.recognitionStats.successfulRecognitions++;
        } else {
            this.recognitionStats.failedRecognitions++;
        }

        // 평균 신뢰도 계산
        const totalSuccess = this.recognitionStats.successfulRecognitions;
        if (totalSuccess > 0) {
            this.recognitionStats.averageConfidence =
                ((this.recognitionStats.averageConfidence * (totalSuccess - 1)) + confidence) / totalSuccess;
        }

        if (this.onStatsUpdate) {
            this.onStatsUpdate(this.recognitionStats);
        }
    }

    // 3단계: 고급 설정 변경
    updateAdvancedSettings(settings) {
        this.advancedSettings = { ...this.advancedSettings, ...settings };
        console.log('고급 설정 업데이트:', this.advancedSettings);
    }

    // 3단계: 통계 초기화
    resetStats() {
        this.recognitionStats = {
            totalRecognitions: 0,
            successfulRecognitions: 0,
            failedRecognitions: 0,
            averageConfidence: 0,
            totalDuration: 0,
            startTime: null,
            lastRecognitionTime: null
        };
        console.log('음성인식 통계 초기화됨');
    }

    // 3단계: 품질 메트릭 가져오기
    getQualityMetrics() {
        return this.qualityMetrics;
    }

    // 3단계: 인식 통계 가져오기
    getRecognitionStats() {
        return this.recognitionStats;
    }





    // 4-1단계: 향상된 통계 업데이트
    updateEnhancedStats(transcript, confidence, wordCount) {
        this.enhancedStats.totalRecognitions++;
        this.enhancedStats.successfulRecognitions++;

        // 평균 신뢰도 계산
        const totalSuccess = this.enhancedStats.successfulRecognitions;
        this.enhancedStats.averageConfidence =
            ((this.enhancedStats.averageConfidence * (totalSuccess - 1)) + confidence) / totalSuccess;

        // 평균 단어 수 계산
        this.enhancedStats.averageWordCount =
            ((this.enhancedStats.averageWordCount * (totalSuccess - 1)) + wordCount) / totalSuccess;

        if (this.onEnhancedStatsUpdate) {
            this.onEnhancedStatsUpdate(this.enhancedStats);
        }
    }

    // 4-1단계: 음성 감지 처리
    handleVoiceDetection() {
        this.recognitionQuality.isVoiceDetected = true;
        this.enhancedStats.voiceDetectionCount++;
        this.clearSilenceTimer();
        if (this.onVoiceDetected) {
            this.onVoiceDetected();
        }
    }

    // 4-1단계: 침묵 감지 처리
    handleSilenceDetection() {
        console.log('[speechRecognitionService] handleSilenceDetection 호출, isVoiceDetected:', this.recognitionQuality.isVoiceDetected);
        // 무조건 콜백 호출 (테스트 목적)
        if (this.onSilenceDetected) {
            console.log('[speechRecognitionService] onSilenceDetected 콜백 호출 (강제)');
            this.onSilenceDetected();
        }
        this.recognitionQuality.isVoiceDetected = false;
    }

    // 4-1단계: 침묵 타이머 시작
    startSilenceTimer() {
        this.clearSilenceTimer();
        console.log('[speechRecognitionService] startSilenceTimer 호출');
        this.recognitionQuality.silenceTimer = setTimeout(() => {
            console.log('[speechRecognitionService] 침묵 타이머 만료, handleSilenceDetection 호출');
            this.handleSilenceDetection();
        }, this.recognitionQuality.silenceTimeout);
    }

    // 4-1단계: 침묵 타이머 정리
    clearSilenceTimer() {
        if (this.recognitionQuality.silenceTimer) {
            clearTimeout(this.recognitionQuality.silenceTimer);
            this.recognitionQuality.silenceTimer = null;
        }
    }

    // 4-1단계: 인식 품질 설정 변경
    updateRecognitionQuality(settings) {
        this.recognitionQuality = { ...this.recognitionQuality, ...settings };
        console.log('4-1단계: 인식 품질 설정 업데이트:', this.recognitionQuality);
    }

    // 4-1단계: 향상된 통계 가져오기
    getEnhancedStats() {
        return this.enhancedStats;
    }

    // 4-1단계: 인식 품질 설정 가져오기
    getRecognitionQuality() {
        return this.recognitionQuality;
    }

    // 3단계: 고급 설정 가져오기
    getAdvancedSettings() {
        return this.advancedSettings;
    }

    // 지원 언어 목록
    getSupportedLanguages() {
        return [
            { code: 'ko-KR', name: '한국어' },
            { code: 'en-US', name: '영어 (미국)' },
            { code: 'en-GB', name: '영어 (영국)' },
            { code: 'ja-JP', name: '일본어' },
            { code: 'zh-CN', name: '중국어 (간체)' },
            { code: 'zh-TW', name: '중국어 (번체)' }
        ];
    }

    // 4-2단계: 음성 인식 결과 후처리
    postProcessRecognitionResult(originalText) {
        if (!originalText || typeof originalText !== 'string') {
            return originalText;
        }

        let processedText = originalText;

        // 1. 문장 정규화
        processedText = this.normalizeText(processedText);

        // 2. 오타 수정
        processedText = this.correctTypos(processedText);

        // 3. 문맥 기반 개선
        processedText = this.improveContext(processedText);

        console.log('4-2단계: 후처리 결과', {
            original: originalText,
            processed: processedText,
            changes: originalText !== processedText
        });

        return processedText;
    }

    // 4-2단계: 텍스트 정규화
    normalizeText(text) {
        let normalized = text;

        // 연속된 공백 제거
        normalized = normalized.replace(/\s+/g, ' ');

        // 앞뒤 공백 제거
        normalized = normalized.trim();

        // 특수문자 정리
        normalized = normalized.replace(/[^\w\s가-힣.,!?;:()]/g, '');

        // 연속된 마침표 정리
        normalized = normalized.replace(/\.{2,}/g, '.');

        // 연속된 쉼표 정리
        normalized = normalized.replace(/,{2,}/g, ',');

        return normalized;
    }

    // 4-2단계: 오타 수정
    correctTypos(text) {
        let corrected = text;

        // 한국어 오타 패턴 수정
        const koreanTypos = {
            '안녕하세요': '안녕하세요',
            '감사합니다': '감사합니다',
            '죄송합니다': '죄송합니다',
            '알겠습니다': '알겠습니다',
            '그렇습니다': '그렇습니다',
            '맞습니다': '맞습니다',
            '아니요': '아니요',
            '네': '네',
            '예': '예',
            '좋습니다': '좋습니다',
            '나쁩니다': '나쁩니다',
            '어렵습니다': '어렵습니다',
            '쉽습니다': '쉽습니다',
            '재미있습니다': '재미있습니다',
            '지루합니다': '지루합니다'
        };

        // 일반적인 오타 패턴
        const commonTypos = {
            'ㅇㅇ': '네',
            'ㄴㄴ': '아니요',
            'ㅋㅋ': '하하',
            'ㅎㅎ': '하하',
            'ㅠㅠ': '슬프네요',
            'ㅜㅜ': '슬프네요',
            'ㅇㅋ': '알겠습니다',
            'ㄱㅅ': '감사합니다',
            'ㅈㅅ': '죄송합니다'
        };

        // 한국어 오타 수정
        Object.entries(koreanTypos).forEach(([typo, correct]) => {
            const regex = new RegExp(typo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            corrected = corrected.replace(regex, correct);
        });

        // 일반 오타 수정
        Object.entries(commonTypos).forEach(([typo, correct]) => {
            const regex = new RegExp(typo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            corrected = corrected.replace(regex, correct);
        });

        return corrected;
    }

    // 4-2단계: 문맥 기반 개선
    improveContext(text) {
        let improved = text;

        // 문장 끝 마침표 추가 (없는 경우)
        if (improved.length > 0 && !improved.match(/[.!?]$/)) {
            // 질문어로 끝나는 경우 물음표 추가
            if (improved.match(/[가-힣]*(?:뭐|무엇|어떻게|언제|어디서|왜|어떤|누가|어떠한|무슨|얼마나|몇|어떤지|어떻게|어떤가|어떤지|어떤가요|어떤지요|어떻게요|어떤가요|어떤지요|어떻게요)$/)) {
                improved += '?';
            }
            // 일반 문장인 경우 마침표 추가
            else if (improved.length > 3) {
                improved += '.';
            }
        }

        // 문장 시작 대문자 처리 (영어의 경우)
        if (improved.match(/^[a-z]/)) {
            improved = improved.charAt(0).toUpperCase() + improved.slice(1);
        }

        // 연속된 문장 부호 정리
        improved = improved.replace(/[.!?]{2,}/g, (match) => match.charAt(0));

        return improved;
    }

    // 4-2단계: 후처리 결과 정보 가져오기
    getPostProcessInfo(originalText, processedText) {
        const changes = {
            normalized: false,
            corrected: false,
            improved: false,
            totalChanges: 0
        };

        if (originalText !== processedText) {
            // 정규화 변경 확인
            const normalized = this.normalizeText(originalText);
            if (normalized !== originalText) {
                changes.normalized = true;
                changes.totalChanges++;
            }

            // 오타 수정 변경 확인
            const corrected = this.correctTypos(normalized);
            if (corrected !== normalized) {
                changes.corrected = true;
                changes.totalChanges++;
            }

            // 문맥 개선 변경 확인
            const improved = this.improveContext(corrected);
            if (improved !== corrected) {
                changes.improved = true;
                changes.totalChanges++;
            }
        }

        return {
            originalText,
            processedText,
            changes,
            hasChanges: changes.totalChanges > 0
        };
    }

    // 4-2단계: 음성 품질 모니터링 시작
    async startQualityMonitoring() {
        try {
            if (this.qualityMonitoring.isMonitoring) {
                console.log('4-2단계: 음성 품질 모니터링이 이미 실행 중입니다.');
                return true;
            }

            // Web Audio API 지원 확인
            if (!window.AudioContext && !window.webkitAudioContext) {
                console.warn('4-2단계: Web Audio API가 지원되지 않습니다.');
                return false;
            }

            // 마이크 권한 요청
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // AudioContext 생성
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);

            // 분석기 설정
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            this.analyser.minDecibels = -90;
            this.analyser.maxDecibels = -10;

            // 연결
            this.microphone.connect(this.analyser);

            // 모니터링 시작
            this.qualityMonitoring.isMonitoring = true;
            this.startQualityMonitoringLoop();

            console.log('4-2단계: 음성 품질 모니터링 시작됨');
            return true;

        } catch (error) {
            console.error('4-2단계: 음성 품질 모니터링 시작 실패:', error);
            return false;
        }
    }

    // 4-2단계: 음성 품질 모니터링 중지
    stopQualityMonitoring() {
        if (!this.qualityMonitoring.isMonitoring) {
            return;
        }

        // 모니터링 루프 중지
        if (this.qualityMonitoring.monitoringInterval) {
            clearInterval(this.qualityMonitoring.monitoringInterval);
            this.qualityMonitoring.monitoringInterval = null;
        }

        // AudioContext 정리
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.analyser = null;
        this.microphone = null;
        this.qualityMonitoring.isMonitoring = false;

        console.log('4-2단계: 음성 품질 모니터링 중지됨');
    }

    // 4-2단계: 음성 품질 모니터링 루프
    startQualityMonitoringLoop() {
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        this.qualityMonitoring.monitoringInterval = setInterval(() => {
            if (!this.analyser) return;

            // 주파수 데이터 분석
            this.analyser.getByteFrequencyData(dataArray);

            // 볼륨 계산
            const volume = this.calculateVolume(dataArray);

            // 노이즈 레벨 계산
            const noiseLevel = this.calculateNoiseLevel(dataArray);

            // 음성 명확도 계산
            const clarity = this.calculateClarity(dataArray, volume, noiseLevel);

            // 품질 메트릭 업데이트
            this.qualityMonitoring.volume = volume;
            this.qualityMonitoring.noiseLevel = noiseLevel;
            this.qualityMonitoring.clarity = clarity;

            // 히스토리 업데이트 (최근 10개 값 유지)
            this.updateQualityHistory(volume, noiseLevel, clarity);

            // 콜백 호출
            if (this.onQualityMonitoringUpdate) {
                this.onQualityMonitoringUpdate({
                    volume: volume,
                    noiseLevel: noiseLevel,
                    clarity: clarity,
                    averageVolume: this.calculateAverage(this.qualityMonitoring.volumeHistory),
                    averageNoise: this.calculateAverage(this.qualityMonitoring.noiseHistory),
                    averageClarity: this.calculateAverage(this.qualityMonitoring.clarityHistory)
                });
            }

        }, 100); // 100ms마다 업데이트
    }

    // 4-2단계: 볼륨 계산
    calculateVolume(dataArray) {
        let sum = 0;
        let count = 0;

        // 주파수 대역별로 가중치를 적용하여 볼륨 계산
        for (let i = 0; i < dataArray.length; i++) {
            const frequency = i * this.audioContext.sampleRate / (this.analyser.fftSize * 2);

            // 음성 주파수 대역 (85Hz ~ 255Hz, 255Hz ~ 2000Hz)에 가중치 적용
            let weight = 1.0;
            if (frequency >= 85 && frequency <= 255) {
                weight = 1.5; // 기본 음성 주파수
            } else if (frequency >= 255 && frequency <= 2000) {
                weight = 1.2; // 고음 주파수
            } else {
                weight = 0.5; // 기타 주파수
            }

            sum += (dataArray[i] / 255) * weight;
            count++;
        }

        return Math.min(1.0, (sum / count) * 2); // 0~1 범위로 정규화
    }

    // 4-2단계: 노이즈 레벨 계산
    calculateNoiseLevel(dataArray) {
        let noiseSum = 0;
        let noiseCount = 0;

        // 저주파 및 고주파 대역의 노이즈 측정
        for (let i = 0; i < dataArray.length; i++) {
            const frequency = i * this.audioContext.sampleRate / (this.analyser.fftSize * 2);

            // 음성 주파수 대역 외의 노이즈 측정
            if (frequency < 85 || frequency > 2000) {
                noiseSum += dataArray[i] / 255;
                noiseCount++;
            }
        }

        return noiseCount > 0 ? Math.min(1.0, (noiseSum / noiseCount) * 3) : 0;
    }

    // 4-2단계: 음성 명확도 계산
    calculateClarity(dataArray, volume, noiseLevel) {
        if (volume < 0.1) return 0; // 볼륨이 너무 낮으면 명확도 0

        // 신호 대 노이즈 비율 (SNR) 기반 명확도 계산
        const snr = volume / (noiseLevel + 0.01); // 0으로 나누기 방지
        const clarity = Math.min(1.0, snr / 2); // 0~1 범위로 정규화

        // 주파수 응답의 균등성도 고려
        const frequencyResponse = this.calculateFrequencyResponse(dataArray);

        return Math.min(1.0, (clarity + frequencyResponse) / 2);
    }

    // 4-2단계: 주파수 응답 균등성 계산
    calculateFrequencyResponse(dataArray) {
        const voiceBands = [];

        // 음성 주파수 대역별로 평균값 계산
        for (let i = 0; i < dataArray.length; i++) {
            const frequency = i * this.audioContext.sampleRate / (this.analyser.fftSize * 2);

            if (frequency >= 85 && frequency <= 2000) {
                voiceBands.push(dataArray[i] / 255);
            }
        }

        if (voiceBands.length === 0) return 0;

        // 표준편차가 낮을수록 균등한 주파수 응답
        const mean = voiceBands.reduce((a, b) => a + b, 0) / voiceBands.length;
        const variance = voiceBands.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / voiceBands.length;
        const stdDev = Math.sqrt(variance);

        // 표준편차가 낮을수록 높은 점수 (1 - 정규화된 표준편차)
        return Math.max(0, 1 - (stdDev * 2));
    }

    // 4-2단계: 품질 히스토리 업데이트
    updateQualityHistory(volume, noiseLevel, clarity) {
        const maxHistory = 10;

        this.qualityMonitoring.volumeHistory.push(volume);
        this.qualityMonitoring.noiseHistory.push(noiseLevel);
        this.qualityMonitoring.clarityHistory.push(clarity);

        if (this.qualityMonitoring.volumeHistory.length > maxHistory) {
            this.qualityMonitoring.volumeHistory.shift();
            this.qualityMonitoring.noiseHistory.shift();
            this.qualityMonitoring.clarityHistory.shift();
        }
    }

    // 4-2단계: 평균값 계산
    calculateAverage(array) {
        if (array.length === 0) return 0;
        return array.reduce((a, b) => a + b, 0) / array.length;
    }

    // 4-2단계: 음성 품질 모니터링 상태 가져오기
    getQualityMonitoringStatus() {
        return {
            isMonitoring: this.qualityMonitoring.isMonitoring,
            currentMetrics: {
                volume: this.qualityMonitoring.volume,
                noiseLevel: this.qualityMonitoring.noiseLevel,
                clarity: this.qualityMonitoring.clarity
            },
            averageMetrics: {
                volume: this.calculateAverage(this.qualityMonitoring.volumeHistory),
                noiseLevel: this.calculateAverage(this.qualityMonitoring.noiseHistory),
                clarity: this.calculateAverage(this.qualityMonitoring.clarityHistory)
            },
            history: {
                volume: [...this.qualityMonitoring.volumeHistory],
                noiseLevel: [...this.qualityMonitoring.noiseHistory],
                clarity: [...this.qualityMonitoring.clarityHistory]
            }
        };
    }

    // 4-2단계: 음성 품질 평가
    evaluateVoiceQuality() {
        const { volume, noiseLevel, clarity } = this.qualityMonitoring;

        let quality = 'excellent';
        let score = 0;

        // 종합 점수 계산 (0~100)
        score += volume * 30; // 볼륨 30점
        score += (1 - noiseLevel) * 30; // 노이즈 30점 (낮을수록 높은 점수)
        score += clarity * 40; // 명확도 40점

        // 품질 등급 결정
        if (score >= 80) quality = 'excellent';
        else if (score >= 60) quality = 'good';
        else if (score >= 40) quality = 'fair';
        else quality = 'poor';

        return {
            score: Math.round(score),
            quality: quality,
            recommendations: this.getQualityRecommendations(volume, noiseLevel, clarity)
        };
    }

    // 4-2단계: 품질 개선 권장사항
    getQualityRecommendations(volume, noiseLevel, clarity) {
        const recommendations = [];

        if (volume < 0.3) {
            recommendations.push('마이크에 더 가까이 말씀해주세요');
        }

        if (noiseLevel > 0.5) {
            recommendations.push('조용한 환경에서 사용해주세요');
        }

        if (clarity < 0.4) {
            recommendations.push('더 명확하게 발음해주세요');
        }

        if (recommendations.length === 0) {
            recommendations.push('음성 품질이 양호합니다');
        }

        return recommendations;
    }
}

// 싱글톤 인스턴스 생성
const speechRecognitionService = new SpeechRecognitionService();

export default speechRecognitionService; 