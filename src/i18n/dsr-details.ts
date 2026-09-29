export const dsrDetails = {
  'zh-Hant': {
    correction: '申請資料更正', correctionHint: '指出資料位置、目前內容與希望更正的內容。', submitCorrection: '送出更正請求', scope: '申請範圍（選填）',
    location: '需要更正的資料或位置', current: '目前內容', requested: '希望更正的內容', additional: '補充資料', sendAdditional: '送出補充資料',
    operations: '預約與小家資料', watermark: '網站存取紀錄', expired: '匯出檔案已到期，請重新申請。', requestAgain: '重新申請匯出', deadline: '下載期限',
    conflict: '此請求已更新，請重新整理後再操作。', refresh: '重新整理', submitted: '申請時間',
  },
  'zh-Hans': {
    correction: '申请数据更正', correctionHint: '指出数据位置、当前内容与希望更正的内容。', submitCorrection: '提交更正请求', scope: '申请范围（选填）',
    location: '需要更正的数据或位置', current: '当前内容', requested: '希望更正的内容', additional: '补充资料', sendAdditional: '提交补充资料',
    operations: '预约与小家数据', watermark: '网站访问记录', expired: '导出文件已过期，请重新申请。', requestAgain: '重新申请导出', deadline: '下载期限',
    conflict: '此请求已更新，请刷新后再操作。', refresh: '刷新', submitted: '申请时间',
  },
  en: {
    correction: 'Request data correction', correctionHint: 'Identify the data, its current value and the requested correction.', submitCorrection: 'Submit correction', scope: 'Request scope (optional)',
    location: 'Data or location to correct', current: 'Current value', requested: 'Requested value', additional: 'Additional information', sendAdditional: 'Send additional information',
    operations: 'Reservations and groups', watermark: 'Website access records', expired: 'This export has expired. Request a new export.', requestAgain: 'Request a new export', deadline: 'Download deadline',
    conflict: 'This request has changed. Refresh before trying again.', refresh: 'Refresh', submitted: 'Submitted at',
  },
  ja: {
    correction: 'データ修正を申請', correctionHint: 'データの場所、現在の内容、希望する修正内容を記載してください。', submitCorrection: '修正リクエストを送信', scope: '対象範囲（任意）',
    location: '修正するデータまたは場所', current: '現在の内容', requested: '希望する内容', additional: '追加情報', sendAdditional: '追加情報を送信',
    operations: '予約とグループのデータ', watermark: 'ウェブサイトアクセス記録', expired: 'ダウンロード期限が切れました。再申請してください。', requestAgain: '書き出しを再申請', deadline: 'ダウンロード期限',
    conflict: 'リクエストが更新されました。再読み込みしてから操作してください。', refresh: '再読み込み', submitted: '申請日時',
  },
  ko: {
    correction: '데이터 수정 요청', correctionHint: '데이터 위치, 현재 내용, 수정할 내용을 알려 주세요.', submitCorrection: '수정 요청 보내기', scope: '요청 범위 (선택)',
    location: '수정할 데이터 또는 위치', current: '현재 내용', requested: '수정할 내용', additional: '추가 정보', sendAdditional: '추가 정보 보내기',
    operations: '예약 및 소그룹 데이터', watermark: '웹사이트 접근 기록', expired: '내보내기 파일이 만료되었습니다. 다시 요청해 주세요.', requestAgain: '새 내보내기 요청', deadline: '다운로드 기한',
    conflict: '요청이 변경되었습니다. 새로고침 후 다시 시도해 주세요.', refresh: '새로고침', submitted: '신청 시간',
  },
} as const
