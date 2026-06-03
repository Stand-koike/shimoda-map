/**
 * エリア設定 — 下田MAP（本番値）
 *
 * 新エリア展開時:
 *   1. config.example.js をコピーしてこのファイルを編集
 *   2. MAP_IMAGE（画像パス・四隅座標）と TRANSLATIONS を更新
 *   3. 画像差し替え時は MAP_IMAGE.cacheVersion を更新（ブラウザキャッシュ対策）
 *
 * ローカル上書き: config.local.js（Git 除外）で MAP_IMAGE.latOffset 等を微調整可
 *
 * @see docs/AREA_MIGRATION_GUIDE.md（ローカル docs/）
 */
(function () {
    'use strict';

    var secrets = (typeof window !== 'undefined' && window.__SHIMODA_MAP_SECRETS__)
        ? window.__SHIMODA_MAP_SECRETS__
        : {};

    window.__SHIMODA_MAP_CONFIG__ = {
        /** ブラウザタブタイトル */
        APP_TITLE: '下田マップ',

        /** GA4 測定 ID（不要なら空文字） */
        GA_MEASUREMENT_ID: 'G-XW0F1B5T6E',

        MAPBOX_TOKEN: secrets.MAPBOX_TOKEN || 'pk.YOUR_MAPBOX_TOKEN',
        SHEET_ID:     secrets.SHEET_ID     || 'YOUR_GOOGLE_SHEET_ID',

        // Google Sheets 列マッピング (0-index) — シート列順と一致させる
        COLS: {
            NAME: 1, LAT: 2, LNG: 3, EMOJI: 4, URL: 5, DESC: 6,
            CAT: 7, HIDDEN: 8,
            STORE_ID: 9, RESERVED: 10,
            STATUS: 11, NEWS: 12, DETAIL: 13, COUPON: 14,
            NAME_EN: 15, DESC_EN: 16, CAT_EN: 17, NEWS_EN: 18, DETAIL_EN: 19, COUPON_EN: 20,
            ADDRESS: 21, ADDRESS_EN: 22, PHONE: 23, PHONE_EN: 24,
            TAGS: 25, TAGS_EN: 26, HOURS: 27, HOURS_EN: 28,
            IMAGE_URL_2: 29, IMAGE_URL_3: 30
        },

        COLORS: { DEFAULT: '#0096C7', RED: '#FF5252', YELLOW: '#FFCA28' },

        // ----------------------------------------------------------------
        // イラストマップ地理参照（100.png / 100.wld, EPSG:6676）
        //   ラスタサイズ 2280×1706 px。四隅は wld と pyproj で 4326 に変換した値。
        //   ズレ調整: latOffset / lngOffset（度）
        //   画像差し替え時: cacheVersion を必ず更新
        // ----------------------------------------------------------------
        MAP_IMAGE: {
            url:        '100.png',
            urlSunset:  '100_sunset.png',
            urlNight:   '100_nihgt.png',
            /** ブラウザキャッシュ bust。PNG 差し替え時に YYYYMMDD 等へ更新 */
            cacheVersion: '20260603-shimoda',
            solarLat:   null,
            solarLng:   null,
            timezone:   'Asia/Tokyo',
            sunsetPreheatMinutes: 45,
            duskBand:   'nautical',

            coordinates: [
                [138.9371389, 34.6812813],
                [138.9587739, 34.6812018],
                [138.9587002, 34.6678289],
                [138.9370686, 34.6679084]
            ],
            latOffset:  0,
            lngOffset:  0,
            center:    [138.9479213, 34.6745551],
            initZoom:  15.6,
            minZoom:   13,
            maxZoom:   19,
            maxBounds: [[138.924, 34.654], [138.972, 34.694]],
            bearing:   -90,
            pitch:     45
        },

        POLL_INTERVAL: 30000,

        POSTS_SHEET: secrets.POSTS_SHEET || 'posts',
        LIVE_POST_POLL_INTERVAL: 30000,

        EVENTS_SHEET:                 secrets.EVENTS_SHEET || 'event_schedule',
        EVENT_SCHEDULE_LEAD_MINUTES:  30,
        EVENT_SCHEDULE_POLL_INTERVAL: 60000,
        EVENT_SCHEDULE_TICK_MS:       60000,

        TRANSLATIONS: {
            ja: {
                all: 'すべて', go: 'Google Mapsで見る', coupon: 'クーポンを使う',
                loading: '読み込み中...', noData: 'データなし', filter: '絞り込み',
                layers: 'レイヤー', newsListTitle: 'お知らせ一覧', updating: 'データ更新中...',
                hours: '営業時間', tags: 'タグ', allTags: 'すべてのタグ', map: 'マップ'
            },
            en: {
                all: 'All', go: 'Open in Google Maps', coupon: 'Use Coupon',
                loading: 'Loading...', noData: 'No Data', filter: 'Filter',
                layers: 'Layers', newsListTitle: 'News List', updating: 'Updating...',
                hours: 'Hours', tags: 'Tags', allTags: 'All Tags', map: 'Map'
            }
        }
    };
})();
