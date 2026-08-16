/**
 * ブラウザ用の秘密設定（Mapbox 公開トークン・スプレッドシート ID）
 * このファイルを secrets.local.js にコピーして値を埋め、Git には含めないこと。
 * @see リポジトリ直下の README.md（「秘密情報」・`.gitignore`）
 */
window.__SHIMODA_MAP_SECRETS__ = {
    MAPBOX_TOKEN: 'pk.YOUR_MAPBOX_TOKEN',
    SHEET_ID:     'YOUR_GOOGLE_SHEET_ID',
    /** LINE 動画再生用 GAS ウェブアプリ URL（末尾 /exec）。Webhook と同一デプロイを推奨 */
    LIVE_VIDEO_PROXY_BASE: 'YOUR_GAS_WEBAPP_EXEC_URL',
    /** LINE 投稿シート名（既定: posts） */
    POSTS_SHEET: 'posts',
    /** 祭イベントスケジュールシート名（既定: event_schedule）。省略可。 */
    EVENTS_SHEET: 'event_schedule',
    /** 指定緊急避難場所シート名（既定: evacuation_places）。省略可。 */
    EVAC_PLACES_SHEET: 'evacuation_places',
    /** 指定避難所シート名（既定: evacuation_shelters）。省略可。 */
    EVAC_SHELTERS_SHEET: 'evacuation_shelters',
    /** AED設置箇所シート名（既定: aed_locations）。省略可。 */
    AED_SHEET: 'aed_locations'
};
