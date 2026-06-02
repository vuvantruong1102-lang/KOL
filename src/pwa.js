// Đăng ký service worker và quản lý nút "Cài đặt app".
// Dùng base tương đối ('./') để chạy được cả trên Vercel (root) lẫn subfolder.

let deferredPrompt = null

export function initPWA() {
  // 1) Đăng ký service worker (chỉ chạy ở production / khi được phục vụ qua http/https)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = new URL('sw.js', document.baseURI).href
      navigator.serviceWorker.register(swUrl).catch((err) => {
        console.warn('SW register failed:', err)
      })
    })
  }

  // 2) Bắt sự kiện cài đặt (Android/Chrome/Edge desktop)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    window.dispatchEvent(new CustomEvent('pwa-installable', { detail: true }))
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    window.dispatchEvent(new CustomEvent('pwa-installable', { detail: false }))
  })
}

// Mở hộp thoại cài đặt. Trả về true nếu người dùng chấp nhận.
export async function promptInstall() {
  if (!deferredPrompt) return false
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  window.dispatchEvent(new CustomEvent('pwa-installable', { detail: false }))
  return outcome === 'accepted'
}

export function canInstall() {
  return !!deferredPrompt
}

// Đang chạy ở chế độ app đã cài (standalone)?
export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
}
