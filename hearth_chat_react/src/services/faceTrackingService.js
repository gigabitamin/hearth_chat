class FaceTrackingService {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.isTracking = false;
        this.faceMesh = null;
        this.camera = null;
        this.animationId = null;
        this.isReady = false; // MediaPipe 준비 상태
        this.isInitializing = false; // 초기화 중 여부
        this.onReadyCallback = null; // 준비 완료 콜백
        this.retryCount = 0; // 초기화 재시도 횟수

        // 트래킹 데이터
        this.trackingData = {
            headRotation: { x: 0, y: 0, z: 0 },
            eyeBlink: { left: 0, right: 0 },
            mouthOpen: 0,
            eyebrowRaise: { left: 0, right: 0 },
            smile: 0,
            isDetected: false
        };

        // 콜백 함수들
        this.onTrackingUpdate = null;
        this.onFaceDetected = null;
        this.onFaceLost = null;

        this.initializeMediaPipe();
    }

    // MediaPipe 초기화
    async initializeMediaPipe() {
        if (this.isInitializing || this.isReady) return;

        console.log('MediaPipe FaceMesh 초기화 시작...');
        this.isInitializing = true;

        try {
            // MediaPipe Face Mesh 로드 (더 안정적인 방법)
            console.log('MediaPipe 라이브러리 로딩 시도...');
            const { FaceMesh } = await import('@mediapipe/face_mesh');
            console.log('MediaPipe 라이브러리 로딩 성공');

            this.faceMesh = new FaceMesh({
                locateFile: (file) => {
                    // 여러 CDN 시도
                    const cdnUrls = [
                        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
                        `https://unpkg.com/@mediapipe/face_mesh/${file}`,
                        `https://cdn.skypack.dev/@mediapipe/face_mesh/${file}`
                    ];
                    console.log(`MediaPipe 파일 로딩: ${file}`);
                    return cdnUrls[0]; // 첫 번째 CDN 사용
                }
            });

            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            this.faceMesh.onResults((results) => {
                this.processFaceResults(results);
            });

            this.isReady = true;
            this.isInitializing = false;
            console.log('MediaPipe Face Mesh 초기화 완료');

            // 준비 완료 콜백 호출
            if (this.onReadyCallback) {
                this.onReadyCallback();
            }
        } catch (error) {
            this.isReady = false;
            this.isInitializing = false;
            console.error('MediaPipe 초기화 실패:', error);

            // 무한 재시도 방지 - 최대 2번만 시도
            if (!this.retryCount) {
                this.retryCount = 1;
                // 5초 후 재시도
                setTimeout(() => {
                    console.log(`MediaPipe 초기화 재시도... (${this.retryCount}/2)`);
                    this.initializeMediaPipe();
                }, 5000);
            } else {
                console.error('MediaPipe 초기화 실패. 트래킹 기능을 사용할 수 없습니다.');
                // 실패 시에도 트래킹 버튼을 활성화할 수 있도록 준비 상태를 true로 설정
                this.isReady = true;
            }
        }
    }

    // 준비 완료 콜백 설정
    onReady(callback) {
        this.onReadyCallback = callback;
        if (this.isReady) {
            callback();
        }
    }

    // 얼굴 결과 처리
    processFaceResults(results) {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];
            this.updateTrackingData(landmarks);

            if (!this.trackingData.isDetected) {
                this.trackingData.isDetected = true;
                if (this.onFaceDetected) this.onFaceDetected();
            }

            if (this.onTrackingUpdate) {
                this.onTrackingUpdate(this.trackingData);
            }
        } else {
            if (this.trackingData.isDetected) {
                this.trackingData.isDetected = false;
                if (this.onFaceLost) this.onFaceLost();
            }
        }
    }

    // 트래킹 데이터 업데이트
    updateTrackingData(landmarks) {
        // 머리 회전 계산 (눈과 코 기준)
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const nose = landmarks[1];

        // Y축 회전 (좌우)
        const eyeDistance = Math.sqrt(
            Math.pow(rightEye.x - leftEye.x, 2) +
            Math.pow(rightEye.y - leftEye.y, 2)
        );
        const normalizedEyeDistance = 0.3; // 기준 거리
        const yRotation = (eyeDistance - normalizedEyeDistance) * 2;

        // X축 회전 (상하)
        const eyeCenterY = (leftEye.y + rightEye.y) / 2;
        const noseY = nose.y;
        const xRotation = (eyeCenterY - noseY) * 2;

        // Z축 회전 (기울기)
        const eyeAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
        const zRotation = eyeAngle;

        this.trackingData.headRotation = {
            x: Math.max(-0.5, Math.min(0.5, xRotation)),
            y: Math.max(-0.5, Math.min(0.5, yRotation)),
            z: Math.max(-0.3, Math.min(0.3, zRotation))
        };

        // 눈 깜빡임 계산
        const leftEyeUpper = landmarks[159];
        const leftEyeLower = landmarks[145];
        const rightEyeUpper = landmarks[386];
        const rightEyeLower = landmarks[374];

        const leftEyeOpen = Math.abs(leftEyeUpper.y - leftEyeLower.y);
        const rightEyeOpen = Math.abs(rightEyeUpper.y - rightEyeLower.y);

        this.trackingData.eyeBlink = {
            left: Math.max(0, Math.min(1, 1 - leftEyeOpen * 10)),
            right: Math.max(0, Math.min(1, 1 - rightEyeOpen * 10))
        };

        // 입 벌림 계산
        const upperLip = landmarks[13];
        const lowerLip = landmarks[14];
        const mouthOpen = Math.abs(upperLip.y - lowerLip.y);
        this.trackingData.mouthOpen = Math.max(0, Math.min(1, mouthOpen * 5));

        // 눈썹 올림 계산
        const leftEyebrow = landmarks[66];
        const rightEyebrow = landmarks[296];
        const eyebrowBase = landmarks[70];

        const leftEyebrowRaise = Math.abs(leftEyebrow.y - eyebrowBase.y);
        const rightEyebrowRaise = Math.abs(rightEyebrow.y - eyebrowBase.y);

        this.trackingData.eyebrowRaise = {
            left: Math.max(0, Math.min(1, leftEyebrowRaise * 3)),
            right: Math.max(0, Math.min(1, rightEyebrowRaise * 3))
        };

        // 미소 계산 (입꼬리 위치)
        const leftMouthCorner = landmarks[61];
        const rightMouthCorner = landmarks[291];
        const mouthCenter = landmarks[13];

        const leftSmile = Math.abs(leftMouthCorner.y - mouthCenter.y);
        const rightSmile = Math.abs(rightMouthCorner.y - mouthCenter.y);

        this.trackingData.smile = Math.max(0, Math.min(1, (leftSmile + rightSmile) * 2));
    }

    // 웹캠 시작
    async startCamera() {
        if (!this.isReady) {
            console.warn('MediaPipe가 아직 준비되지 않았습니다.');
            return false;
        }
        try {
            console.log('카메라 권한 요청 중...');
            
            // 비디오 요소 생성
            this.video = document.createElement('video');
            this.video.style.display = 'none';
            document.body.appendChild(this.video);

            // 캔버스 요소 생성
            this.canvas = document.createElement('canvas');
            this.canvas.style.display = 'none';
            document.body.appendChild(this.canvas);
            this.ctx = this.canvas.getContext('2d');

            // 웹캠 스트림 가져오기
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 640,
                    height: 480,
                    facingMode: 'user'
                }
            });

            console.log('카메라 스트림 획득 성공');
            this.video.srcObject = stream;
            this.video.play();

            // 캔버스 크기 설정
            this.canvas.width = 640;
            this.canvas.height = 480;

            this.isTracking = true;
            this.startTracking();

            console.log('웹캠 트래킹 시작됨');
            return true;

        } catch (error) {
            console.error('웹캠 시작 실패:', error);
            return false;
        }
    }

    // 트래킹 루프 시작
    startTracking() {
        const processFrame = async () => {
            if (!this.isTracking || !this.video || !this.faceMesh) return;

            try {
                // 비디오 프레임을 캔버스에 그리기
                this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

                // MediaPipe에 프레임 전송
                await this.faceMesh.send({ image: this.canvas });

                this.animationId = requestAnimationFrame(processFrame);
            } catch (error) {
                console.error('트래킹 프레임 처리 오류:', error);
            }
        };

        processFrame();
    }

    // 웹캠 중지
    stopCamera() {
        this.isTracking = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.video && this.video.srcObject) {
            const tracks = this.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
        }

        if (this.video) {
            document.body.removeChild(this.video);
            this.video = null;
        }

        if (this.canvas) {
            document.body.removeChild(this.canvas);
            this.canvas = null;
            this.ctx = null;
        }

        console.log('웹캠 트래킹 중지됨');
    }

    // 트래킹 데이터 가져오기
    getTrackingData() {
        return this.trackingData;
    }

    // 이벤트 리스너 설정
    on(event, callback) {
        switch (event) {
            case 'trackingUpdate':
                this.onTrackingUpdate = callback;
                break;
            case 'faceDetected':
                this.onFaceDetected = callback;
                break;
            case 'faceLost':
                this.onFaceLost = callback;
                break;
            default:
                console.warn('알 수 없는 이벤트:', event);
        }
    }

    // 트래킹 상태 확인
    isCurrentlyTracking() {
        return this.isTracking;
    }

    // 얼굴 감지 상태 확인
    isFaceDetected() {
        return this.trackingData.isDetected;
    }
}

// 싱글톤 인스턴스 생성
const faceTrackingService = new FaceTrackingService();
export default faceTrackingService; 