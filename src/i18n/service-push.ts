import type { Locale } from './locales'
const en = {
  label: 'Notifications on this browser',
  denied: 'Notifications are blocked. Allow them in your browser settings.',
  unsupported: 'This browser does not support push notifications.',
  install:
    'Add Account to your Home Screen, then open it there to enable notifications.',
  failed: 'Unable to update browser notifications. Please try again.',
  retry: 'Retry',
  pending: 'Notifications could not be turned off. Retry to finish.',
}
export const servicePushMessages: Record<Locale, typeof en> = {
  en,
  'zh-Hant': {
    label: '此瀏覽器通知',
    denied: '通知已被封鎖，請至瀏覽器設定允許通知。',
    unsupported: '此瀏覽器不支援推播通知。',
    install: '將 Account 加入主畫面，再從主畫面開啟即可啟用通知。',
    failed: '無法更新瀏覽器通知，請重試。',
    retry: '重試',
    pending: '通知尚未完全關閉，請重試。',
  },
  'zh-Hans': {
    label: '此浏览器通知',
    denied: '通知已被屏蔽，请在浏览器设置中允许通知。',
    unsupported: '此浏览器不支持推送通知。',
    install: '将 Account 添加到主屏幕，再从主屏幕打开即可启用通知。',
    failed: '无法更新浏览器通知，请重试。',
    retry: '重试',
    pending: '通知尚未完全关闭，请重试。',
  },
  ja: {
    label: 'このブラウザーの通知',
    denied: '通知がブロックされています。ブラウザーの設定で許可してください。',
    unsupported: 'このブラウザーはプッシュ通知に対応していません。',
    install:
      'Account をホーム画面に追加し、そこから開いて通知を有効にしてください。',
    failed: '通知を更新できませんでした。もう一度お試しください。',
    retry: '再試行',
    pending: '通知をオフにできませんでした。再試行してください。',
  },
  ko: {
    label: '이 브라우저의 알림',
    denied: '알림이 차단되었습니다. 브라우저 설정에서 허용해 주세요.',
    unsupported: '이 브라우저는 푸시 알림을 지원하지 않습니다.',
    install: 'Account를 홈 화면에 추가한 뒤 홈 화면에서 열어 알림을 켜세요.',
    failed: '브라우저 알림을 변경하지 못했습니다. 다시 시도해 주세요.',
    retry: '다시 시도',
    pending: '알림을 끄지 못했습니다. 다시 시도해 주세요.',
  },
}
