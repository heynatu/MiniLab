// Camera access. Only called after the device owner agreed in MiniLab (ensureConsent)
// and then the browser asks its own permission. The stream never leaves the device.

export async function openCamera(video, { facing = 'environment', width = 1920, height = 1080 } = {}) {
  if (!window.isSecureContext) throw Object.assign(new Error('INSECURE'), { name: 'InsecureContext' });
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('NO_API'), { name: 'NoApi' });
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: facing }, width: { ideal: width }, height: { ideal: height } },
  });
  if (video) {
    video.setAttribute('playsinline', '');
    video.muted = true;
    video.srcObject = stream;
    await video.play().catch(() => {});
    if (!video.videoWidth) {
      await new Promise((res) => {
        const done = () => { video.removeEventListener('loadedmetadata', done); res(); };
        video.addEventListener('loadedmetadata', done);
        setTimeout(done, 3000);
      });
    }
  }
  return stream;
}

export function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

export function torchSupported(stream) {
  const track = stream?.getVideoTracks?.()[0];
  const caps = track?.getCapabilities?.();
  return !!caps?.torch;
}

export async function setTorch(stream, on) {
  const track = stream?.getVideoTracks?.()[0];
  if (!track) return false;
  try {
    await track.applyConstraints({ advanced: [{ torch: on }] });
    return true;
  } catch {
    return false;
  }
}

export function cameraErrorText(e) {
  switch (e?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Trình duyệt đang chặn camera. Bấm biểu tượng ổ khoá cạnh địa chỉ web, cho phép Camera rồi thử lại.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Không tìm thấy camera trên thiết bị này. Bạn có thể chọn ảnh có sẵn thay thế.';
    case 'NotReadableError':
      return 'Camera đang được ứng dụng khác dùng. Hãy đóng ứng dụng đó rồi thử lại.';
    case 'InsecureContext':
      return 'Camera chỉ hoạt động trên địa chỉ https. Hãy mở MiniLab bằng đường dẫn https.';
    case 'NoApi':
      return 'Trình duyệt này không hỗ trợ camera. Hãy dùng Chrome, Edge hoặc Safari mới.';
    default:
      return 'Chưa mở được camera. Hãy thử lại hoặc chọn ảnh có sẵn.';
  }
}
