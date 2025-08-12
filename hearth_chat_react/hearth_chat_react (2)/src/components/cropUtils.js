/**
 * base64 인코딩된 이미지와 픽셀 crop 정보를 받아
 * 잘린 이미지를 생성하는 함수
 * @param {string} imageSrc - base64 이미지 소스
 * @param {object} pixelCrop - react-easy-crop에서 받은 픽셀 crop 정보
 */
export const getCroppedImg = (imageSrc, pixelCrop) => {
    // Promise를 반환하여 비동기 작업(이미지 로드)을 처리합니다.
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.src = imageSrc;
        // CORS 관련 문제를 방지하기 위해 crossOrigin 속성을 추가할 수 있습니다.
        image.crossOrigin = 'Anonymous';

        // 💡 핵심: 이미지가 성공적으로 로드되면 이 함수가 실행됩니다.
        image.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = pixelCrop.width;
            canvas.height = pixelCrop.height;

            // 이미지가 로드된 후에 그리기 작업을 수행합니다.
            ctx.drawImage(
                image,
                pixelCrop.x,
                pixelCrop.y,
                pixelCrop.width,
                pixelCrop.height,
                0,
                0,
                pixelCrop.width,
                pixelCrop.height
            );

            // 💡 수정: canvas.toDataURL()을 사용해 base64 데이터 URL을 받습니다.
            // 이 값을 dataURLtoFile 함수로 넘겨주어야 합니다.
            const dataUrl = canvas.toDataURL('image/jpeg');
            resolve(dataUrl);
        };

        // 이미지 로드에 실패하면 Promise를 reject 합니다.
        image.onerror = (error) => {
            console.error('이미지 로드 실패:', error);
            reject(new Error('Image load error'));
        };
    });
};


/**
 * Data URL(base64)을 File 객체로 변환하는 함수
 * (이 함수는 수정할 필요 없습니다.)
 * @param {string} dataurl - 변환할 Data URL
 * @param {string} filename - 생성할 파일의 이름
 */
export function dataURLtoFile(dataurl, filename) {
    let arr = dataurl.split(','),
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]),
        n = bstr.length,
        u8arr = new Uint8Array(n);

    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}