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

        // 카메라 전환 관련
        this.availableCameras = [];
        this.currentCameraIndex = 0;
        this.isMobile = false;

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
        this.checkMobile();
    }

    // 모바일 감지
    checkMobile() {
        const userAgent = navigator.userAgent.toLowerCase();
        this.isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        console.log('[FaceTrackingService] 모바일 감지:', this.isMobile);
    }

    // 사용 가능한 카메라 목록 가져오기
    async getAvailableCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');

            // 모바일에서는 후면 카메라를 우선으로 정렬
            if (this.isMobile) {
                videoDevices.sort((a, b) => {
                    const aIsBack = a.label.toLowerCase().includes('back') || a.label.toLowerCase().includes('후면');
                    const bIsBack = b.label.toLowerCase().includes('back') || b.label.toLowerCase().includes('후면');
                    if (aIsBack && !bIsBack) return -1;
                    if (!aIsBack && bIsBack) return 1;
                    return 0;
                });
            }

            this.availableCameras = videoDevices;
            console.log('[FaceTrackingService] 사용 가능한 카메라 목록:', videoDevices);

            // 모바일에서 후면 카메라가 있으면 기본 선택
            if (this.isMobile && videoDevices.length > 0) {
                const backCameraIndex = videoDevices.findIndex(device =>
                    device.label.toLowerCase().includes('back') ||
                    device.label.toLowerCase().includes('후면')
                );
                if (backCameraIndex !== -1) {
                    this.currentCameraIndex = backCameraIndex;
                    console.log('[FaceTrackingService] 모바일 후면 카메라 기본 선택:', backCameraIndex);
                }
            }

            return videoDevices;
        } catch (err) {
            console.error('[FaceTrackingService] 카메라 목록 가져오기 실패:', err);
            return [];
        }
    }

    // 다음 카메라로 전환
    async switchToNextCamera() {
        if (this.availableCameras.length <= 1) {
            console.log('[FaceTrackingService] 전환 가능한 카메라가 없음');
            return false;
        }

        // 현재 카메라 중지
        if (this.isTracking) {
            this.stopCamera();
        }

        // 다음 카메라 인덱스 계산
        this.currentCameraIndex = (this.currentCameraIndex + 1) % this.availableCameras.length;

        console.log('[FaceTrackingService] 다음 카메라로 전환:', this.currentCameraIndex, this.availableCameras[this.currentCameraIndex]?.label);

        // 새 카메라로 시작
        if (this.isTracking) {
            return await this.startCamera();
        }

        return true;
    }

    // MediaPipe 초기화
    async initializeMediaPipe() {
        if (this.isInitializing || this.isReady) return;

        this.isInitializing = true;

        try {
            // MediaPipe Face Mesh 로드 (더 안정적인 방법)

            const { FaceMesh } = await import('@mediapipe/face_mesh');


            this.faceMesh = new FaceMesh({
                locateFile: (file) => {
                    // 여러 CDN 시도
                    const cdnUrls = [
                        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
                        `https://unpkg.com/@mediapipe/face_mesh/${file}`,
                        `https://cdn.skypack.dev/@mediapipe/face_mesh/${file}`
                    ];

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
        console.log('[FaceTrackingService] processFaceResults 호출됨:', results);

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];
            console.log('[FaceTrackingService] 얼굴 랜드마크 감지됨, 개수:', landmarks.length);

            this.updateTrackingData(landmarks);

            if (!this.trackingData.isDetected) {
                this.trackingData.isDetected = true;
                console.log('[FaceTrackingService] 얼굴 감지됨 - 이벤트 발생');
                if (this.onFaceDetected) this.onFaceDetected();
            }

            if (this.onTrackingUpdate) {
                console.log('[FaceTrackingService] 트래킹 업데이트 이벤트 발생:', this.trackingData);
                this.onTrackingUpdate(this.trackingData);
            }
        } else {
            if (this.trackingData.isDetected) {
                this.trackingData.isDetected = false;
                console.log('[FaceTrackingService] 얼굴 감지 안됨 - 이벤트 발생');
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
        console.log('[FaceTrackingService] startCamera 호출됨, isReady:', this.isReady);

        if (!this.isReady) {
            console.warn('[FaceTrackingService] MediaPipe가 아직 준비되지 않았습니다.');
            return false;
        }

        try {
            console.log('[FaceTrackingService] 웹캠 스트림 요청 시작...');

            // 사용 가능한 카메라 목록이 없으면 가져오기
            if (this.availableCameras.length === 0) {
                await this.getAvailableCameras();
            }

            // 현재 선택된 카메라의 deviceId 사용
            const currentCamera = this.availableCameras[this.currentCameraIndex];
            const constraints = {
                video: {
                    width: { min: 320, ideal: 640, max: 1280 },
                    height: { min: 240, ideal: 480, max: 720 },
                    frameRate: { ideal: 30 }
                }
            };

            // 특정 카메라가 선택된 경우 deviceId 추가
            if (currentCamera && currentCamera.deviceId) {
                constraints.video.deviceId = { exact: currentCamera.deviceId };
                console.log('[FaceTrackingService] 선택된 카메라:', currentCamera.label, currentCamera.deviceId);
            } else {
                // 모바일에서는 후면 카메라 우선
                if (this.isMobile) {
                    constraints.video.facingMode = 'environment';
                } else {
                    constraints.video.facingMode = 'user';
                }
                console.log('[FaceTrackingService] 기본 카메라 설정 (facingMode):', constraints.video.facingMode);
            }

            // 비디오 요소 생성
            this.video = document.createElement('video');
            this.video.style.display = 'none';
            document.body.appendChild(this.video);
            console.log('[FaceTrackingService] 비디오 요소 생성됨');

            // 캔버스 요소 생성
            this.canvas = document.createElement('canvas');
            this.canvas.style.display = 'none';
            document.body.appendChild(this.canvas);
            this.ctx = this.canvas.getContext('2d');
            console.log('[FaceTrackingService] 캔버스 요소 생성됨');

            // 웹캠 스트림 가져오기
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('[FaceTrackingService] 웹캠 스트림 획득 성공, 카메라:', currentCamera?.label || '기본');

            this.video.srcObject = stream;
            this.video.play();
            console.log('[FaceTrackingService] 비디오 재생 시작');

            // 캔버스 크기 설정
            this.canvas.width = 640;
            this.canvas.height = 480;

            this.isTracking = true;
            this.startTracking();
            console.log('[FaceTrackingService] 트래킹 시작됨');

            return true;

        } catch (error) {
            console.error('[FaceTrackingService] 웹캠 시작 실패:', error);
            return false;
        }
    }

    // 트래킹 루프 시작
    startTracking() {
        console.log('[FaceTrackingService] startTracking 호출됨');

        const processFrame = async () => {
            if (!this.isTracking || !this.video || !this.faceMesh) {
                console.log('[FaceTrackingService] 트래킹 중단됨:', {
                    isTracking: this.isTracking,
                    hasVideo: !!this.video,
                    hasFaceMesh: !!this.faceMesh
                });
                return;
            }

            try {
                // 비디오 프레임을 캔버스에 그리기
                this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

                // MediaPipe에 프레임 전송
                await this.faceMesh.send({ image: this.canvas });

                this.animationId = requestAnimationFrame(processFrame);
            } catch (error) {
                console.error('[FaceTrackingService] 트래킹 프레임 처리 오류:', error);
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