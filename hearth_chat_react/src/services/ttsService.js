class TTSService {
    constructor() {
        // speechSynthesis 지원 확인
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            this.synthesis = window.speechSynthesis;
            this.isSupported = true;
        } else {
            this.synthesis = null;
            this.isSupported = false;
            console.warn('TTS가 지원되지 않는 브라우저입니다.');
        }

        this.utterance = null;
        this.isSpeaking = false;
        this.onSpeakStart = null;
        this.onSpeakEnd = null;
        this.onSpeakPause = null;
        this.onSpeakResume = null;
        this.onSpeakError = null;
        this.onStop = null; // TTS 중단 시 호출될 콜백

        // 음성 설정
        this.voiceSettings = {
            rate: 1.0,        // 속도 (0.1 ~ 10)
            pitch: 1.0,       // 음조 (0 ~ 2)
            volume: 1.0,      // 볼륨 (0 ~ 1)
            voice: null       // 음성 (시스템에서 선택)
        };

        // 립싱크 관련 설정
        this.lipSyncSettings = {
            enabled: true,    // 립싱크 활성화
            intensity: 0.8,   // 립싱크 강도 (0 ~ 1)
            speed: 1.0        // 립싱크 속도 배율
        };

        // 스크롤 안정화 관련
        this.scrollPosition = { x: 0, y: 0 };
        this.isScrollLocked = false;

        if (this.isSupported) {
            this.initializeVoice();
            // 전역 이벤트 리스너 설정 및 정리 함수 저장
            this._cleanupListeners = this.setupGlobalEventListeners();
        }
    }

    // TTS 중단 콜백 설정
    setOnStopCallback(callback) {
        this.onStop = callback;
    }

    // TTS 중단 콜백 제거
    removeOnStopCallback() {
        this.onStop = null;
    }

    // 음성 초기화
    initializeVoice() {
        if (!this.isSupported || !this.synthesis) {
            console.warn('TTS가 지원되지 않아 초기화를 건너뜁니다.');
            return;
        }

        try {
            // 음성 목록 로드 대기
            if (this.synthesis.onvoiceschanged !== undefined) {
                this.synthesis.onvoiceschanged = () => {
                    this.setDefaultVoice();
                };
            }

            // 기본 음성 설정
            this.setDefaultVoice();
        } catch (error) {
            console.error('TTS 초기화 중 오류 발생:', error);
            this.isSupported = false;
        }
    }

    // 기본 음성 설정
    setDefaultVoice() {
        if (!this.isSupported || !this.synthesis) {
            console.warn('TTS가 지원되지 않아 음성 설정을 건너뜁니다.');
            return;
        }

        try {
            const voices = this.synthesis.getVoices();

            // 한국어 음성 우선 선택
            let koreanVoice = voices.find(voice =>
                voice.lang.includes('ko') || voice.lang.includes('ko-KR')
            );

            // 한국어가 없으면 영어 음성 선택
            let englishVoice = voices.find(voice =>
                voice.lang.includes('en') || voice.lang.includes('en-US')
            );

            // 기본 음성 설정
            this.voiceSettings.voice = koreanVoice || englishVoice || voices[0];

        } catch (error) {
            console.error('TTS 음성 설정 중 오류 발생:', error);
        }
    }

    // 음성 목록 가져오기
    getVoices() {
        if (!this.isSupported || !this.synthesis) {
            console.warn('TTS가 지원되지 않습니다.');
            return [];
        }
        return this.synthesis.getVoices();
    }

    // 음성 설정 변경
    setVoice(voice) {
        this.voiceSettings.voice = voice;
    }

    // 속도 설정
    setRate(rate) {
        this.voiceSettings.rate = Math.max(0.1, Math.min(10, rate));
    }

    // 음조 설정
    setPitch(pitch) {
        this.voiceSettings.pitch = Math.max(0, Math.min(2, pitch));
    }

    // 볼륨 설정
    setVolume(volume) {
        this.voiceSettings.volume = Math.max(0, Math.min(1, volume));
    }

    // TTS용 텍스트 정리 (이모티콘, 특수문자 제거)
    cleanTextForTTS(text) {
        if (!text) return '';

        let cleanedText = text;

        // 1. 마크다운 스타일 제거 (** **, * *, ` ` 등)
        cleanedText = cleanedText.replace(/\*\*(.*?)\*\*/g, '$1'); // **텍스트** -> 텍스트
        cleanedText = cleanedText.replace(/\*(.*?)\*/g, '$1');     // *텍스트* -> 텍스트
        cleanedText = cleanedText.replace(/`(.*?)`/g, '$1');       // `텍스트` -> 텍스트
        cleanedText = cleanedText.replace(/~~(.*?)~~/g, '$1');     // ~~텍스트~~ -> 텍스트

        // 1-1. 단독으로 있는 특수문자 제거 (*, #, @, %, &, +, =, |, \, /, <, > 등)
        cleanedText = cleanedText.replace(/(?<!\w)[*#@%&+=|\\/<>](?!\w)/g, ''); // 단독 특수문자 제거

        // 2. 이모티콘 제거 (유니코드 이모티콘 범위)
        const emojiRanges = [
            /[\u{1F600}-\u{1F64F}]/gu,  // 감정 표현
            /[\u{1F300}-\u{1F5FF}]/gu,  // 기호와 픽토그램
            /[\u{1F680}-\u{1F6FF}]/gu,  // 교통과 지도
            /[\u{1F1E0}-\u{1F1FF}]/gu,  // 국기
            /[\u{2600}-\u{26FF}]/gu,    // 기타 기호
            /[\u{2700}-\u{27BF}]/gu,    // 장식 기호
            /[\u{1F900}-\u{1F9FF}]/gu,  // 보충 기호와 픽토그램
            /[\u{1FA70}-\u{1FAFF}]/gu,  // 기호와 픽토그램 확장
            /[\u{1FAB0}-\u{1FABF}]/gu,  // 동물과 자연
            /[\u{1FAC0}-\u{1FAFF}]/gu,  // 신체 부위
            /[\u{1FAD0}-\u{1FAFF}]/gu,  // 음식과 음료
            /[\u{1FAE0}-\u{1FAFF}]/gu,  // 장소
            /[\u{1FAF0}-\u{1FAFF}]/gu   // 기타
        ];

        emojiRanges.forEach(range => {
            cleanedText = cleanedText.replace(range, '');
        });

        // 3. 특정 이모티콘 패턴 제거 (이스케이프된 이모티콘)
        cleanedText = cleanedText.replace(/\\u[\dA-Fa-f]{4}/g, '');

        // 4. 특수문자 제거 (한글, 영어, 숫자, 기본 문장부호만 유지)
        cleanedText = cleanedText.replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ.,!?;:()[\]{}"'`~@#$%^&*+=|\\<>/]/g, '');

        // 5. 연속된 공백을 하나로 정리
        cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

        // 6. 빈 문자열 체크 및 대체 텍스트 제공
        if (!cleanedText || cleanedText.length === 0) {
            // 원본에서 한글/영어/숫자만 추출
            const fallbackText = text.replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ]/g, '').trim();
            return fallbackText || '음성 메시지';
        }

        return cleanedText;
    }

    // 한글 자음/모음 분석
    analyzeKoreanPhonemes(text) {
        const phonemes = [];

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const code = char.charCodeAt(0);

            // 한글 유니코드 범위 (가-힣: 44032-55203)
            if (code >= 44032 && code <= 55203) {
                const syllable = code - 44032;
                const initial = Math.floor(syllable / 588);      // 초성
                const medial = Math.floor((syllable % 588) / 28); // 중성
                const final = syllable % 28;                     // 종성

                // 초성 (자음)
                const initialConsonants = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
                if (initial < initialConsonants.length) {
                    phonemes.push({
                        type: 'consonant',
                        char: initialConsonants[initial],
                        position: 'initial',
                        mouthShape: this.getMouthShapeForConsonant(initialConsonants[initial])
                    });
                }

                // 중성 (모음)
                const medialVowels = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
                if (medial < medialVowels.length) {
                    phonemes.push({
                        type: 'vowel',
                        char: medialVowels[medial],
                        position: 'medial',
                        mouthShape: this.getMouthShapeForVowel(medialVowels[medial])
                    });
                }

                // 종성 (자음)
                const finalConsonants = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
                if (final > 0 && final < finalConsonants.length) {
                    phonemes.push({
                        type: 'consonant',
                        char: finalConsonants[final],
                        position: 'final',
                        mouthShape: this.getMouthShapeForConsonant(finalConsonants[final])
                    });
                }
            } else if (/[a-zA-Z]/.test(char)) {
                // 영어 알파벳
                phonemes.push({
                    type: 'english',
                    char: char.toLowerCase(),
                    position: 'single',
                    mouthShape: this.getMouthShapeForEnglish(char.toLowerCase())
                });
            } else if (/[0-9]/.test(char)) {
                // 숫자
                phonemes.push({
                    type: 'number',
                    char: char,
                    position: 'single',
                    mouthShape: 'neutral'
                });
            } else {
                // 기타 문자 (공백, 문장부호 등)
                phonemes.push({
                    type: 'other',
                    char: char,
                    position: 'single',
                    mouthShape: 'neutral'
                });
            }
        }

        return phonemes;
    }

    // 자음에 따른 입모양 매핑
    getMouthShapeForConsonant(consonant) {
        const mouthShapes = {
            'ㄱ': 'closed',      // 입을 다물고
            'ㄲ': 'closed',      // 입을 다물고
            'ㄴ': 'slightly_open', // 살짝 벌리고
            'ㄷ': 'closed',      // 입을 다물고
            'ㄸ': 'closed',      // 입을 다물고
            'ㄹ': 'slightly_open', // 살짝 벌리고
            'ㅁ': 'closed',      // 입을 다물고
            'ㅂ': 'closed',      // 입을 다물고
            'ㅃ': 'closed',      // 입을 다물고
            'ㅅ': 'slightly_open', // 살짝 벌리고
            'ㅆ': 'slightly_open', // 살짝 벌리고
            'ㅇ': 'open',        // 입을 벌리고
            'ㅈ': 'slightly_open', // 살짝 벌리고
            'ㅉ': 'slightly_open', // 살짝 벌리고
            'ㅊ': 'slightly_open', // 살짝 벌리고
            'ㅋ': 'open',        // 입을 벌리고
            'ㅌ': 'slightly_open', // 살짝 벌리고
            'ㅍ': 'closed',      // 입을 다물고
            'ㅎ': 'open'         // 입을 벌리고
        };
        return mouthShapes[consonant] || 'neutral';
    }

    // 모음에 따른 입모양 매핑
    getMouthShapeForVowel(vowel) {
        const mouthShapes = {
            'ㅏ': 'wide_open',   // 입을 크게 벌리고
            'ㅐ': 'wide_open',   // 입을 크게 벌리고
            'ㅑ': 'wide_open',   // 입을 크게 벌리고
            'ㅒ': 'wide_open',   // 입을 크게 벌리고
            'ㅓ': 'open',        // 입을 벌리고
            'ㅔ': 'open',        // 입을 벌리고
            'ㅕ': 'open',        // 입을 벌리고
            'ㅖ': 'open',        // 입을 벌리고
            'ㅗ': 'rounded',     // 입을 둥글게
            'ㅘ': 'rounded',     // 입을 둥글게
            'ㅙ': 'rounded',     // 입을 둥글게
            'ㅚ': 'rounded',     // 입을 둥글게
            'ㅛ': 'rounded',     // 입을 둥글게
            'ㅜ': 'rounded',     // 입을 둥글게
            'ㅝ': 'rounded',     // 입을 둥글게
            'ㅞ': 'rounded',     // 입을 둥글게
            'ㅟ': 'rounded',     // 입을 둥글게
            'ㅠ': 'rounded',     // 입을 둥글게
            'ㅡ': 'neutral',     // 중립
            'ㅢ': 'neutral',     // 중립
            'ㅣ': 'wide_open'    // 입을 크게 벌리고
        };
        return mouthShapes[vowel] || 'neutral';
    }

    // 영어 알파벳에 따른 입모양 매핑
    getMouthShapeForEnglish(letter) {
        const mouthShapes = {
            'a': 'wide_open',   // 입을 크게 벌리고
            'e': 'open',        // 입을 벌리고
            'i': 'wide_open',   // 입을 크게 벌리고
            'o': 'rounded',     // 입을 둥글게
            'u': 'rounded',     // 입을 둥글게
            'b': 'closed',      // 입을 다물고
            'p': 'closed',      // 입을 다물고
            'm': 'closed',      // 입을 다물고
            'f': 'slightly_open', // 살짝 벌리고
            'v': 'slightly_open', // 살짝 벌리고
            'w': 'rounded',     // 입을 둥글게
            'y': 'slightly_open', // 살짝 벌리고
            'l': 'slightly_open', // 살짝 벌리고
            'r': 'slightly_open', // 살짝 벌리고
            's': 'slightly_open', // 살짝 벌리고
            'z': 'slightly_open', // 살짝 벌리고
            't': 'slightly_open', // 살짝 벌리고
            'd': 'slightly_open', // 살짝 벌리고
            'n': 'slightly_open', // 살짝 벌리고
            'g': 'open',        // 입을 벌리고
            'k': 'open',        // 입을 벌리고
            'h': 'open'         // 입을 벌리고
        };
        return mouthShapes[letter] || 'neutral';
    }

    // 립싱크 시퀀스 생성
    generateLipSyncSequence(text, duration) {
        console.log('[LIP SYNC] 시퀀스 생성 시작 - 텍스트:', text, '지속시간:', duration);

        if (!this.lipSyncSettings.enabled) {
            console.warn('[LIP SYNC] 립싱크가 비활성화됨');
            return [];
        }

        const phonemes = this.analyzeKoreanPhonemes(text);
        console.log('[LIP SYNC] 음소 분석 결과:', phonemes);

        const sequence = [];
        const totalPhonemes = phonemes.length;

        if (totalPhonemes === 0) {
            console.warn('[LIP SYNC] 분석된 음소가 없음');
            return sequence;
        }

        // 각 음소당 시간 계산 (더 정확한 시간 분배)
        const timePerPhoneme = duration / totalPhonemes;
        console.log('[LIP SYNC] 음소당 시간:', timePerPhoneme, 'ms');

        phonemes.forEach((phoneme, index) => {
            const startTime = index * timePerPhoneme;
            const endTime = (index + 1) * timePerPhoneme;

            // 음소 타입에 따른 지속 시간 조정
            let adjustedStartTime = startTime;
            let adjustedEndTime = endTime;

            if (phoneme.type === 'vowel') {
                // 모음은 더 길게 지속
                adjustedEndTime = endTime + timePerPhoneme * 0.3;
            } else if (phoneme.type === 'consonant') {
                // 자음은 더 짧게
                adjustedEndTime = endTime - timePerPhoneme * 0.2;
            }

            // mouthTrigger 값으로 변환 (RealisticAvatar3D.jsx와 일치)
            const mouthTriggerValue = this.convertMouthShapeToTrigger(phoneme.mouthShape);

            sequence.push({
                startTime: adjustedStartTime,
                endTime: adjustedEndTime,
                mouthTrigger: mouthTriggerValue,
                intensity: this.lipSyncSettings.intensity,
                phoneme: phoneme.char,
                type: phoneme.type
            });
        });

        console.log('[LIP SYNC] 최종 시퀀스:', sequence);
        return sequence;
    }

    // 입모양 문자열을 mouthTrigger 값으로 변환
    convertMouthShapeToTrigger(mouthShape) {
        const shapeToTrigger = {
            'closed': 1,           // 살짝 열림
            'slightly_open': 2,    // 조금 열림
            'open': 3,             // 열림
            'wide_open': 4,        // 크게 열림
            'rounded': 5,          // 둥글게 열림
            'neutral': 0           // 닫힘
        };
        return shapeToTrigger[mouthShape] || 0;
    }

    // TTS 지속 시간 추정 (텍스트 길이와 속도 기반)
    estimateTTSDuration(text, rate = 1.0) {
        if (!text) return 1000; // 기본 1초

        // 한국어 기준: 평균적으로 한 글자당 0.3초 (속도 1.0 기준)
        const baseTimePerChar = 300; // ms
        const adjustedTimePerChar = baseTimePerChar / rate;

        // 텍스트 길이에 따른 기본 시간 계산
        let estimatedDuration = text.length * adjustedTimePerChar;

        // 최소/최대 시간 제한
        estimatedDuration = Math.max(1000, Math.min(estimatedDuration, 30000)); // 1초 ~ 30초

        return estimatedDuration;
    }

    // 음성 목록이 준비될 때까지 대기
    async waitForVoices(timeout = 2000) {
        const start = Date.now();
        while (this.synthesis && this.synthesis.getVoices().length === 0) {
            if (Date.now() - start > timeout) break;
            await new Promise(res => setTimeout(res, 100));
        }
    }

    // 텍스트를 음성으로 변환
    async speak(text, options = {}) {
        if (!this.isSupported() || !this.synthesis) {
            console.warn('[TTS] 지원 안함');
            return Promise.reject(new Error('TTS가 지원되지 않는 브라우저입니다.'));
        }
        if (!text || this.isSpeaking) {
            console.warn('[TTS] 텍스트 없음 또는 이미 재생 중');
            return Promise.reject(new Error('이미 재생 중이거나 텍스트가 없습니다.'));
        }
        const cleanedText = this.cleanTextForTTS(text);
        if (!cleanedText) {
            console.warn('[TTS] 정리된 텍스트 없음');
            return Promise.reject(new Error('TTS로 읽을 수 있는 텍스트가 없습니다.'));
        }
        await this.waitForVoices();
        return new Promise((resolve, reject) => {
            try {
                this.stop();
                this.utterance = new SpeechSynthesisUtterance(cleanedText);

                // 음성 객체 할당
                if (options.voice) {
                    const voices = this.synthesis.getVoices();
                    if (typeof options.voice === 'string') {
                        this.utterance.voice = voices.find(v => v.name === options.voice) || null;

                    } else {
                        this.utterance.voice = options.voice;

                    }
                }
                this.utterance.rate = options.rate || this.voiceSettings.rate;
                this.utterance.pitch = options.pitch || this.voiceSettings.pitch;
                this.utterance.volume = options.volume || this.voiceSettings.volume;
                // 이벤트 리스너
                this.utterance.onstart = () => {
                    this.isSpeaking = true;
                    // TTS 재생 시작 시 스크롤 안정화
                    this.saveScrollPosition();
                    this.lockScroll();

                    // 립싱크 시퀀스 생성 및 전달
                    if (this.onSpeakStart) {
                        // TTS 지속 시간 계산 (텍스트 길이와 속도 기반)
                        const estimatedDuration = this.estimateTTSDuration(cleanedText, options.rate || this.voiceSettings.rate);
                        console.log('[LIP SYNC] TTS 시작, 텍스트:', cleanedText, '예상 지속시간:', estimatedDuration, 'ms');

                        const lipSyncSequence = this.generateLipSyncSequence(cleanedText, estimatedDuration);
                        console.log('[LIP SYNC] 립싱크 시퀀스 생성됨:', lipSyncSequence);

                        this.onSpeakStart(cleanedText, lipSyncSequence);
                    } else {
                        console.warn('[LIP SYNC] onSpeakStart 콜백이 설정되지 않음');
                    }
                };
                this.utterance.onend = () => {
                    this.isSpeaking = false;
                    // TTS 재생 종료 시 스크롤 해제 및 위치 복원
                    this.unlockScroll();
                    this.restoreScrollPosition();
                    if (this.onSpeakEnd) this.onSpeakEnd();
                    resolve();
                };
                this.utterance.onerror = (e) => {
                    this.isSpeaking = false;
                    // TTS 오류 시에도 스크롤 해제 및 위치 복원
                    this.unlockScroll();
                    this.restoreScrollPosition();
                    if (this.onSpeakError) this.onSpeakError(e.error);
                    reject(new Error(`TTS 오류: ${e.error}`));
                };

                this.synthesis.speak(this.utterance);

            } catch (error) {
                console.error('[TTS] 예외 발생', error);
                reject(error);
            }
        });
    }
    // 음성 중지
    stop() {
        if (this.isSupported() && this.synthesis) {
            // 모든 진행 중인 음성 중지
            this.synthesis.cancel();
            this.isSpeaking = false;
            this.utterance = null;

            // TTS 중단 시 스크롤 해제 및 위치 복원
            this.unlockScroll();
            this.restoreScrollPosition();

            // TTS 중단 콜백 호출
            if (this.onStop && typeof this.onStop === 'function') {
                this.onStop();
            }
        }
    }

    // 음성 일시정지
    pause() {
        if (this.isSupported() && this.synthesis && this.isSpeaking) {
            this.synthesis.pause();
        }
    }

    // 음성 재개
    resume() {
        if (this.isSupported() && this.synthesis && this.isSpeaking) {
            this.synthesis.resume();
        }
    }

    // 현재 재생 상태 확인
    isCurrentlySpeaking() {
        return this.isSupported() && this.isSpeaking;
    }

    // TTS 지원 여부 확인
    isSupported() {
        return typeof window !== 'undefined' && !!window.speechSynthesis;
    }

    // 스크롤 위치 저장
    saveScrollPosition() {
        if (typeof window !== 'undefined') {
            this.scrollPosition = {
                x: window.pageXOffset || document.documentElement.scrollLeft,
                y: window.pageYOffset || document.documentElement.scrollTop
            };
            console.log('[TTS] 스크롤 위치 저장:', this.scrollPosition);
        }
    }

    // 스크롤 고정
    lockScroll() {
        if (typeof window !== 'undefined' && !this.isScrollLocked) {
            this.isScrollLocked = true;
            document.body.style.overflow = 'hidden';
            console.log('[TTS] 스크롤 고정됨');
        }
    }

    // 스크롤 해제
    unlockScroll() {
        if (typeof window !== 'undefined' && this.isScrollLocked) {
            this.isScrollLocked = false;
            document.body.style.overflow = '';
            console.log('[TTS] 스크롤 해제됨');
        }
    }

    // 저장된 스크롤 위치로 복원
    restoreScrollPosition() {
        if (typeof window !== 'undefined' && this.scrollPosition) {
            window.scrollTo(this.scrollPosition.x, this.scrollPosition.y);
            console.log('[TTS] 스크롤 위치 복원:', this.scrollPosition);
        }
    }

    // 전역 이벤트 리스너 설정
    setupGlobalEventListeners() {
        if (typeof window !== 'undefined') {
            const handleBeforeUnload = () => {
                if (this.isSpeaking) {
                    this.stop();
                }
            };

            const handleVisibilityChange = () => {
                if (document.hidden && this.isSpeaking) {
                    this.stop();
                }
            };

            window.addEventListener('beforeunload', handleBeforeUnload);
            document.addEventListener('visibilitychange', handleVisibilityChange);

            // 정리 함수 반환
            return () => {
                window.removeEventListener('beforeunload', handleBeforeUnload);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            };
        }
    }

    // TTS 중단 상태 설정 함수
    setTTSInterrupted(interrupted) {
        if (this.onStop && typeof this.onStop === 'function') {
            this.onStop();
        }
    }

    // TTS 이벤트 콜백 설정 메서드들
    setOnSpeakStart(callback) {
        this.onSpeakStart = callback;
    }

    setOnSpeakEnd(callback) {
        this.onSpeakEnd = callback;
    }

    setOnSpeakError(callback) {
        this.onSpeakError = callback;
    }

    setOnStop(callback) {
        this.onStop = callback;
    }

    // 전역 이벤트 리스너 정리
    cleanup() {
        if (this._cleanupListeners && typeof this._cleanupListeners === 'function') {
            this._cleanupListeners();
        }
    }
}

// 싱글톤 인스턴스 생성
const ttsService = new TTSService();

ttsService.isSupported = function () {
    return typeof window !== 'undefined' && !!window.speechSynthesis;
};

export default ttsService; 