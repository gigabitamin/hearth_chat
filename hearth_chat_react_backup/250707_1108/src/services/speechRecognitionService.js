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

            // 이벤트 리스너 설정
            this.recognition.onstart = () => {
                console.log('음성인식 시작');
                this.isListening = true;
                if (this.onStart) this.onStart();
            };

            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;

                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                console.log('음성인식 결과:', { final: finalTranscript, interim: interimTranscript });

                // 중간 결과 콜백
                if (this.onInterimResult && interimTranscript) {
                    this.onInterimResult(interimTranscript);
                }

                // 최종 결과 콜백
                if (this.onResult && finalTranscript) {
                    this.onResult(finalTranscript);
                }
            };

            this.recognition.onend = () => {
                console.log('음성인식 종료');
                this.isListening = false;
                if (this.onEnd) this.onEnd();

                // 연속 모드일 때 자동 재시작
                if (this.continuousMode) {
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
                this.isListening = false;

                if (event.error === 'not-allowed') {
                    console.error('마이크 권한이 거부되었습니다.');
                    alert('마이크 권한이 필요합니다. 브라우저 설정에서 마이크 권한을 허용해주세요.');
                } else if (event.error === 'no-speech') {
                    console.log('음성이 감지되지 않았습니다.');
                } else if (event.error === 'audio-capture') {
                    console.error('마이크를 찾을 수 없습니다.');
                    alert('마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.');
                }

                if (this.onError) this.onError(event.error);

                // 오류 후에도 연속 모드일 때 재시작 시도 (권한 오류 제외)
                if (this.continuousMode && event.error !== 'no-speech' && event.error !== 'not-allowed') {
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
    start() {
        if (!this.isSupported) {
            console.error('음성인식이 지원되지 않습니다.');
            return false;
        }

        if (this.isListening) {
            console.log('이미 음성인식이 진행 중입니다.');
            return false;
        }

        try {
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('음성인식 시작 실패:', error);
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
            default:
                console.warn('알 수 없는 음성인식 이벤트:', event);
        }
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
}

// 싱글톤 인스턴스 생성
const speechRecognitionService = new SpeechRecognitionService();

export default speechRecognitionService; 