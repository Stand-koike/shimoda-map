/**
 * ============================================================
 * LINE → GAS → Google Sheets（黒船祭 LIVEマップ / 複数ロール投稿）
 * ============================================================
 *
 * 【秘密情報・運用（本番）】
 *   実 ID・LINE トークン・管理者 ID 等は **ソースに書かない**。
 *   GAS の「プロジェクトの設定」→「スクリプトプロパティ」に登録する（キー一覧は logWebhookScriptPropertyKeys を実行してログ確認）。
 *
 * 【初回セットアップ】
 *   1. logWebhookScriptPropertyKeys を実行し、必須キーをスクリプトプロパティへ手入力
 *   2. setupSheets()（紐づけスクリプトなら表を開いて実行可）
 *   3. ウェブアプリをデプロイ。「アクセスできるユーザー」は「全員」（LINE は匿名アクセス）
 *
 * 【開発用フォールバック】
 *   WEBHOOK_CONFIG にだけ値がある場合は最後の手段として読む。本番ではキーを空のままにしておくこと。
 *
 * 【ロールと投稿】
 *   店舗: 固定座標（スプレッドシート先頭シートの store_id と座標）。
 *   運営: venue_spots から番号選択 → 選択座標へ投稿。
 *   協力者: LINE 位置メッセージ後に写真・短文 → GPS 投稿。
 *
 * 【スプレッドシートでのモデレーション】
 *   posts シートの isVisible を FALSE にするとマップから非表示。
 */

// ---------------------------------------------------------------
/**
 * ローカル試験用フォールバックのみ。**本番は空のまま**し、スクリプトプロパティへ SHEET_ID / LINE_CHANNEL_ACCESS_TOKEN を設定すること。
 */
const WEBHOOK_CONFIG = {
  SHEET_ID: '',
  LINE_CHANNEL_ACCESS_TOKEN: ''
};
/** setup Sheets でアクティブ表から補完した ID（その実行中だけ） */
var __webhookSheetIdRuntimeOverride_ = '';

/**
 * スプレッドシート ID。
 * 優先: 実行時オーバーライド → スクリプトプロパティ（SHEET_ID / YOUR_GOOGLE_SHEET_ID）→ WEBHOOK_CONFIG（空でなければ）
 */
function getWebhookSheetId_() {
  if (__webhookSheetIdRuntimeOverride_) return __webhookSheetIdRuntimeOverride_;
  var props = PropertiesService.getScriptProperties();
  var keys = ['SHEET_ID', 'YOUR_GOOGLE_SHEET_ID'];
  for (var i = 0; i < keys.length; i++) {
    var raw = props.getProperty(keys[i]);
    if (!raw) continue;
    var p = String(raw).trim();
    if (p && p !== 'YOUR_GOOGLE_SHEET_ID' && !/^YOUR_/i.test(p)) return p;
  }
  var c = String(WEBHOOK_CONFIG.SHEET_ID || '').trim();
  if (c && c !== 'YOUR_GOOGLE_SHEET_ID' && !/^YOUR_/i.test(c)) return c;
  return '';
}

/**
 * LINE チャネルアクセストークン。
 * 優先: スクリプトプロパティ（LINE_CHANNEL_ACCESS_TOKEN / YOUR_LINE_CHANNEL_ACCESS_TOKEN）→ WEBHOOK_CONFIG
 */
function getWebhookLineToken_() {
  var props = PropertiesService.getScriptProperties();
  var keys = ['LINE_CHANNEL_ACCESS_TOKEN', 'YOUR_LINE_CHANNEL_ACCESS_TOKEN'];
  for (var i = 0; i < keys.length; i++) {
    var raw = props.getProperty(keys[i]);
    if (!raw) continue;
    var p = String(raw).trim();
    if (p && p !== 'YOUR_LINE_CHANNEL_ACCESS_TOKEN' && !/^YOUR_/i.test(p)) return p;
  }
  var c = String(WEBHOOK_CONFIG.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  if (c && c !== 'YOUR_LINE_CHANNEL_ACCESS_TOKEN' && !/^YOUR_/i.test(c)) return c;
  return '';
}

/** 管理者 LINE ユーザー ID（スクリプトプロパティ ADMIN_LINE_USER_ID） */
function getAdminLineUserId_() {
  var p = PropertiesService.getScriptProperties().getProperty('ADMIN_LINE_USER_ID');
  return p != null ? String(p).trim() : '';
}

/** 店舗・運営系登録用パスワード（スクリプトプロパティ REGISTRATION_PASSWORD。空なら店舗登録はパスワード不要） */
function getRegistrationPassword_() {
  var p = PropertiesService.getScriptProperties().getProperty('REGISTRATION_PASSWORD');
  return p != null ? String(p).trim() : '';
}

// メインスポット列（browser CONFIG.COLS と一致する 0-based index）
const MASTER_COL_STORE_ID = 9;
const MASTER_COL_LAT = 2;
const MASTER_COL_LNG = 3;

const POSTS_SHEET_NAME = 'posts';
const VENUE_SPOTS_SHEET_NAME = 'venue_spots';
const BOT_SESSIONS_SHEET_NAME = 'bot_sessions';
const USER_MAP_SHEET_NAME = 'user_map';
const PENDING_SHEET_NAME = 'pending_posts';

const MAX_MESSAGE_LENGTH = 50;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const DRIVE_FOLDER_NAME = 'LINE_MAP_IMAGES';
const PENDING_EXPIRE_MS = 3 * 60 * 1000;

const ROLE_STORE = 'store';
const ROLE_OPERATOR = 'operator';
const ROLE_CONTRIBUTOR = 'contributor';
const ROLES = [ROLE_STORE, ROLE_OPERATOR, ROLE_CONTRIBUTOR];

const CATEGORIES = ['グルメ', '混雑', '景色', 'ステージ', '子連れ', 'お知らせ'];

const STEP_IDLE = 'idle';
const STEP_AWAITING_CONTENT = 'awaiting_content';
const STEP_AWAITING_SPOT = 'awaiting_spot';
const STEP_AWAITING_CATEGORY = 'awaiting_category';

const TTL_MS = {
  [ROLE_STORE]: 3 * 60 * 60 * 1000,
  [ROLE_OPERATOR]: 45 * 60 * 1000,
  [ROLE_CONTRIBUTOR]: 22 * 60 * 1000
};

const SOURCE_FIXED = 'fixed';
const SOURCE_SELECTED = 'selected';
const SOURCE_GPS = 'gps';

/** 1 引数 insertSheet は先頭挿入になり gviz の先頭シート（店舗マスタ）がずれるため末尾に追加する */
function insertSheetAtEnd_(ss, name) {
  const n = ss.getSheets().length;
  return ss.insertSheet(name, n + 1);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const events = body.events || [];

    events.forEach(event => {
      if (event.type !== 'message') return;

      const userId = event.source?.userId;
      const replyToken = event.replyToken;
      const msg = event.message;

      if (!userId || !msg) return;

      if (msg.type === 'text') {
        handleTextIncoming(userId, replyToken, msg.text.trim());
        return;
      }
      if (msg.type === 'image') {
        handleImageIncoming(userId, replyToken, msg.id);
        return;
      }
      if (msg.type === 'location') {
        handleLocationIncoming(userId, replyToken, msg.latitude, msg.longitude);
        return;
      }
    });

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.error('[doPost]', err);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}

// ==================================================================
// ルーティング
// ==================================================================

function handleTextIncoming(userId, replyToken, text) {
  if (!text) return;

  if (/^マイID$/i.test(text) || /^my\s*id$/i.test(text)) {
    replyText(replyToken, buildMyIdMessage(userId));
    return;
  }
  if (/^ヘルプ$/.test(text) || /^help$/i.test(text)) {
    replyText(replyToken, buildHelpMessage(userId));
    return;
  }
  if (/^登録/.test(text)) {
    handleRegisterCommand(userId, replyToken, text);
    return;
  }
  if (/^登録確認$/.test(text)) {
    handleCheckCommand(userId, replyToken);
    return;
  }
  if (/^登録解除$/.test(text)) {
    handleUnregisterCommand(userId, replyToken);
    return;
  }

  const adminLineUserId = getAdminLineUserId_();
  if (adminLineUserId && userId === adminLineUserId) {
    if (/^ユーザー一覧$/.test(text)) {
      handleAdminListCommand(replyToken);
      return;
    }
    if (/^削除\s+\S+$/.test(text)) {
      const targetId = text.split(/\s+/)[1];
      handleAdminDeleteCommand(replyToken, targetId);
      return;
    }
    if (/^テスト投稿$/.test(text)) {
      handleAdminTestPost(replyToken, userId);
      return;
    }
  }

  const user = getUserRecord(userId);
  if (!user || user.isActive === false) {
    replyText(replyToken, buildUnknownUserMessage(userId));
    return;
  }

  let catPick = parseCategoryFromText(text);
  const sess0 = getSession(userId);
  if (!catPick && sess0.step === STEP_AWAITING_CATEGORY && CATEGORIES.indexOf(text.trim()) >= 0) {
    catPick = text.trim();
  }
  if (catPick) {
    if (sess0.step === STEP_AWAITING_CATEGORY) {
      finalizePostWithCategory(userId, replyToken, user, catPick);
      return;
    }
  }

  if (user.role === ROLE_OPERATOR && getSession(userId).step === STEP_AWAITING_SPOT) {
    const n = parseInt(text, 10);
    if (/^\d+$/.test(text) && !isNaN(n)) {
      handleOperatorSpotNumber(userId, replyToken, n);
      return;
    }
    replyText(replyToken, '番号だけ送ってください（例：2）');
    return;
  }

  flushExpiredPending();

  if (user.role === ROLE_STORE) {
    handleStoreContentText(userId, replyToken, user, text);
  } else if (user.role === ROLE_OPERATOR) {
    handleOperatorContentText(userId, replyToken, user, text);
  } else if (user.role === ROLE_CONTRIBUTOR) {
    handleContributorContentText(userId, replyToken, user, text);
  }
}

function handleImageIncoming(userId, replyToken, messageId) {
  flushExpiredPending();

  const user = getUserRecord(userId);
  if (!user || user.isActive === false) {
    replyText(replyToken, buildUnknownUserMessage(userId));
    return;
  }

  if (user.role === ROLE_CONTRIBUTOR) {
    const sess = getSession(userId);
    if (sess.payload.lat == null || sess.payload.lng == null) {
      replyText(replyToken, '先に📍位置情報メッセージを送ってください。');
      return;
    }
    handleContributorImage(userId, replyToken, user, messageId);
    return;
  }

  let imageUrl;
  try {
    imageUrl = fetchLineImageToDrive(messageId);
  } catch (err) {
    console.error('[handleImageIncoming]', err);
    replyText(replyToken, '⚠️ 画像の取得に失敗しました。もう一度お試しください。');
    return;
  }

  if (user.role === ROLE_STORE) {
    mergeImageWithPendingThenAskCategory(userId, replyToken, user, imageUrl);
  } else {
    mergeImageWithPendingThenAskSpot(userId, replyToken, user, imageUrl);
  }
}

function handleLocationIncoming(userId, replyToken, lat, lng) {
  const user = getUserRecord(userId);
  if (!user || user.isActive === false) {
    replyText(replyToken, buildUnknownUserMessage(userId));
    return;
  }
  if (user.role !== ROLE_CONTRIBUTOR) {
    replyText(replyToken, '位置情報投稿は「協力者」登録のアカウントのみ使えます。');
    return;
  }
  setSession(userId, STEP_AWAITING_CONTENT, {
    text: '', imageUrl: '', lat, lng, spotId: '', spotName: ''
  });
  replyText(replyToken,
    '📍位置を受け取りました。\n続けて写真と短文（50文字以内）を送ってください📸\n（どちら先でもOK）');
}

// ==================================================================
// 店舗: テキスト→保留 / 画像でマージ→カテゴリ
// ==================================================================

function handleStoreContentText(userId, replyToken, user, text) {
  const truncated = text.substring(0, MAX_MESSAGE_LENGTH);
  savePending(userId, user.fixedStoreId, truncated);
  replyText(replyToken,
    `📝 受け付けました「${truncated}」\n続けて写真を送るとセットで反映されます📸（${PENDING_EXPIRE_MS / 60000}分以内）\n写真不要ならそのまま待つとカテゴリ選択に進みます。`
  );
}

function mergeImageWithPendingThenAskCategory(userId, replyToken, user, imageUrl) {
  const pending = loadPending(userId);
  const text = pending ? String(pending.message || '') : '';
  if (pending) deletePending(userId);

  const prev = getSession(userId).payload || {};
  setSession(userId, STEP_AWAITING_CATEGORY, {
    text,
    imageUrl: imageUrl || '',
    lat: prev.lat != null ? prev.lat : null,
    lng: prev.lng != null ? prev.lng : null,
    spotId: prev.spotId || '',
    spotName: prev.spotName || ''
  });
  replyWithCategoryQuickReply(replyToken,
    (text || imageUrl ? '内容を確認しました。' : '') + 'カテゴリを選んでください👇');
}

function mergeImageWithPendingThenAskSpot(userId, replyToken, user, imageUrl) {
  const pending = loadPending(userId);
  const text = pending ? String(pending.message || '') : '';
  if (pending) deletePending(userId);

  if (!text && !imageUrl) {
    replyText(replyToken, 'テキストか画像を送ってください。');
    return;
  }

  setSession(userId, STEP_AWAITING_SPOT, {
    text, imageUrl: imageUrl || '', lat: null, lng: null, spotId: '', spotName: ''
  });
  replyText(replyToken, buildSpotListMessage());
}

// ==================================================================
// 運営: テキスト保留 / 画像→スポット一覧
// ==================================================================

function handleOperatorContentText(userId, replyToken, user, text) {
  const sess = getSession(userId);
  if (sess.step === STEP_AWAITING_CATEGORY || sess.step === STEP_AWAITING_SPOT) {
    replyText(replyToken, 'いまは投稿フローの途中です。案内に従って番号またはカテゴリを選んでください。');
    return;
  }
  const truncated = text.substring(0, MAX_MESSAGE_LENGTH);
  savePending(userId, '_op_', truncated);
  replyText(replyToken,
    `📝 受け付けました「${truncated}」\n続けて写真📸（${PENDING_EXPIRE_MS / 60000}分以内）\n写真のみでもOKです。`);
}

// ==================================================================
// 協力者: 位置後のみ / テキスト・画像
// ==================================================================

function handleContributorContentText(userId, replyToken, user, text) {
  const sess = getSession(userId);
  if (sess.payload.lat == null) {
    replyText(replyToken, 'まずLINEの「📍位置情報」メッセージを送信してください。');
    return;
  }
  if (sess.step === STEP_AWAITING_CATEGORY) {
    replyText(replyToken, 'カテゴリをボタンから選んでください👇');
    return;
  }
  const truncated = text.substring(0, MAX_MESSAGE_LENGTH);
  savePending(userId, '_liv_', truncated);
  replyText(replyToken,
    `📝 受け付けました「${truncated}」\n続けて写真を📸（${PENDING_EXPIRE_MS / 60000}分以内）`);
}

function handleContributorImage(userId, replyToken, user, messageId) {
  let imageUrl;
  try {
    imageUrl = fetchLineImageToDrive(messageId);
  } catch (err) {
    replyText(replyToken, '⚠️ 画像取得に失敗しました。');
    return;
  }

  mergeImageWithPendingThenAskCategory(userId, replyToken, user, imageUrl);
}

function handleOperatorSpotNumber(userId, replyToken, n) {
  const spots = getVenueSpots();
  if (n < 1 || n > spots.length) {
    replyText(replyToken, `1〜${spots.length} の番号で送ってください。`);
    return;
  }
  const sp = spots[n - 1];
  const sess = getSession(userId);
  const p = Object.assign({}, sess.payload, {
    lat: sp.lat, lng: sp.lng, spotId: sp.spotId, spotName: sp.name
  });
  setSession(userId, STEP_AWAITING_CATEGORY, p);
  replyWithCategoryQuickReply(replyToken, `📍「${sp.name}」に紐づけます。\nカテゴリを選んでください👇`);
}

// ==================================================================
// 投稿確定
// ==================================================================

function finalizePostWithCategory(userId, replyToken, user, category) {
  const sess = getSession(userId);
  if (sess.step !== STEP_AWAITING_CATEGORY) {
    replyText(replyToken, 'カテゴリ選択のタイミングではありません。投稿を送り直してください。');
    return;
  }
  const { text, imageUrl, lat, lng, spotId, spotName } = sess.payload;
  if (!text && !imageUrl) {
    replyText(replyToken, 'テキストか画像がありません。最初から送り直してください。');
    deleteSession(userId);
    return;
  }

  let sourceType;
  let finalLat = lat;
  let finalLng = lng;
  let storeId = '';
  let spotIdOut = spotId || '';

  if (user.role === ROLE_STORE) {
    sourceType = SOURCE_FIXED;
    storeId = user.fixedStoreId || '';
    const c = getStoreCoordsFromMaster(storeId);
    if (!c) {
      replyText(replyToken, `店舗座標が見つかりません（store_id: ${storeId}）。管理者に確認してください。`);
      deleteSession(userId);
      return;
    }
    finalLat = c.lat;
    finalLng = c.lng;
  } else if (user.role === ROLE_OPERATOR) {
    sourceType = SOURCE_SELECTED;
    if (finalLat == null || finalLng == null) {
      replyText(replyToken, 'スポットが未選択です。');
      deleteSession(userId);
      return;
    }
  } else {
    sourceType = SOURCE_GPS;
    storeId = '';
    if (finalLat == null || finalLng == null) {
      replyText(replyToken, '位置情報がありません。');
      deleteSession(userId);
      return;
    }
  }

  const postId = Utilities.getUuid();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + TTL_MS[user.role]);

  appendPostRow({
    postId, userId, role: user.role, sourceType, category,
    text: text || '', imageUrl: imageUrl || '',
    lat: finalLat, lng: finalLng, storeId, spotId: spotIdOut,
    createdAt, expiresAt, isVisible: true
  });

  deleteSession(userId);
  deletePending(userId);

  let locHint = '';
  if (spotName) locHint = `\n場所:${spotName}`;
  replyText(replyToken,
    `✅ マップに反映しました！\nカテゴリ:${category}${locHint}\n（約${Math.round(TTL_MS[user.role] / 60000)}分で自動的に終了します）`);
}

// ==================================================================
// posts シート
// ==================================================================

function appendPostRow(row) {
  const ss = SpreadsheetApp.openById(getWebhookSheetId_());
  let sheet = ss.getSheetByName(POSTS_SHEET_NAME);
  if (!sheet) {
    ensurePostsSheet(ss);
    sheet = ss.getSheetByName(POSTS_SHEET_NAME);
  }

  sheet.appendRow([
    row.postId,
    row.userId,
    row.role,
    row.sourceType,
    row.category,
    row.text,
    row.imageUrl,
    row.lat,
    row.lng,
    row.storeId,
    row.spotId,
    row.createdAt,
    row.expiresAt,
    row.isVisible === false ? false : true
  ]);
}

function ensurePostsSheet(ss) {
  const s = insertSheetAtEnd_(ss, POSTS_SHEET_NAME);
  s.appendRow([
    'postId', 'userId', 'role', 'sourceType', 'category',
    'text', 'imageUrl', 'lat', 'lng', 'storeId', 'spotId',
    'createdAt', 'expiresAt', 'isVisible'
  ]);
  s.setFrozenRows(1);
  s.getRange('A1:N1').setBackground('#2E7D32').setFontColor('#FFFFFF').setFontWeight('bold');
}

// ==================================================================
// ユーザーマップ（拡張列）
// userId | role | fixed_store_id | is_active | display_name | registered_at
// ==================================================================

function parseUserRow(row) {
  if (!row || !row[0]) return null;
  const B = row[1];
  const bStr = B != null ? String(B).trim() : '';

  if (ROLES.indexOf(bStr) >= 0) {
    const activeCell = row[3];
    const isActive = activeCell !== false && String(activeCell || 'TRUE').toUpperCase() !== 'FALSE';
    return {
      userId: row[0],
      role: bStr,
      fixedStoreId: row[2] != null ? String(row[2]).trim() : '',
      isActive,
      displayName: row[4] != null ? String(row[4]) : '',
      registeredAt: row[5]
    };
  }

  return {
    userId: row[0],
    role: ROLE_STORE,
    fixedStoreId: bStr,
    isActive: true,
    displayName: '',
    registeredAt: row[2]
  };
}

function getUserRecord(userId) {
  const sheet = getUserMapSheet(false);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) return parseUserRow(data[i]);
  }
  return null;
}

function saveUserRecord(userId, role, fixedStoreId) {
  const sheet = getUserMapSheet(true);
  const data = sheet.getDataRange().getValues();
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      sheet.getRange(i + 1, 2, i + 1, 6).setValues([[
        role,
        fixedStoreId || '',
        true,
        '',
        now
      ]]);
      return;
    }
  }
  sheet.appendRow([userId, role, fixedStoreId || '', true, '', now]);
}

function deleteUserFromMap(userId) {
  const sheet = getUserMapSheet(false);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === userId) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function lookupUserIdByFixedStoreId(storeId) {
  const sheet = getUserMapSheet(false);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const u = parseUserRow(data[i]);
    if (u && u.role === ROLE_STORE && u.fixedStoreId === storeId) return u.userId;
  }
  return null;
}

function getAllUserMapRows() {
  const sheet = getUserMapSheet(false);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const u = parseUserRow(data[i]);
    if (u) {
      rows.push({
        userId: u.userId,
        role: u.role,
        fixedStoreId: u.fixedStoreId,
        registeredAt: u.registeredAt
          ? Utilities.formatDate(new Date(u.registeredAt), 'Asia/Tokyo', 'MM/dd HH:mm')
          : '不明'
      });
    }
  }
  return rows;
}

function getUserMapSheet(createIfMissing) {
  const ss = SpreadsheetApp.openById(getWebhookSheetId_());
  let sheet = ss.getSheetByName(USER_MAP_SHEET_NAME);
  if (!sheet && createIfMissing) {
    sheet = insertSheetAtEnd_(ss, USER_MAP_SHEET_NAME);
    sheet.appendRow(['userId', 'role', 'fixed_store_id', 'is_active', 'display_name', 'registered_at']);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:F1').setBackground('#4A90D9').setFontColor('#FFFFFF').setFontWeight('bold');
  }
  return sheet;
}

// ==================================================================
// bot_sessions: userId | step | payload_json | updated_at
// ==================================================================

function getSession(userId) {
  const sheet = getBotSessionSheet(false);
  if (!sheet) {
    return { step: STEP_IDLE, payload: {} };
  }
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] !== userId) continue;
    let payload = {};
    try {
      payload = data[i][2] ? JSON.parse(String(data[i][2])) : {};
    } catch (e) {
      payload = {};
    }
    return { step: String(data[i][1] || STEP_IDLE), payload };
  }
  return { step: STEP_IDLE, payload: {} };
}

function setSession(userId, step, payload) {
  const sheet = getBotSessionSheet(true);
  const data = sheet.getDataRange().getValues();
  const json = JSON.stringify(payload || {});
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      sheet.getRange(i + 1, 2, i + 1, 4).setValues([[step, json, now]]);
      return;
    }
  }
  sheet.appendRow([userId, step, json, now]);
}

function deleteSession(userId) {
  const sheet = getBotSessionSheet(false);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === userId) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function getBotSessionSheet(createIfMissing) {
  const ss = SpreadsheetApp.openById(getWebhookSheetId_());
  let sheet = ss.getSheetByName(BOT_SESSIONS_SHEET_NAME);
  if (!sheet && createIfMissing) {
    sheet = insertSheetAtEnd_(ss, BOT_SESSIONS_SHEET_NAME);
    sheet.appendRow(['userId', 'step', 'payload_json', 'updated_at']);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:D1').setBackground('#6A1B9A').setFontColor('#FFFFFF').setFontWeight('bold');
  }
  return sheet;
}

// ==================================================================
// venue_spots
// ==================================================================

function getVenueSpots() {
  const ss = SpreadsheetApp.openById(getWebhookSheetId_());
  const sheet = ss.getSheetByName(VENUE_SPOTS_SHEET_NAME);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    const spotId = data[i][0] != null ? String(data[i][0]).trim() : '';
    const name = data[i][1] != null ? String(data[i][1]).trim() : '';
    const lat = data[i][2];
    const lng = data[i][3];
    if (!name || lat == null || lng == null) continue;
    list.push({
      spotId: spotId || `spot_${i}`,
      name,
      lat: Number(lat),
      lng: Number(lng)
    });
  }
  return list;
}

function buildSpotListMessage() {
  const spots = getVenueSpots();
  if (spots.length === 0) {
    return '⚠️ venue_spots シートにスポットが未登録です。管理者が Google スプレッドシートに追加してください。\n運営投稿はできません。';
  }
  const lines = spots.map((s, idx) => `${idx + 1}. ${s.name}`);
  return `投稿する場所の番号を送ってください（半角数字）\n\n${lines.join('\n')}`;
}

// ==================================================================
// マスター座標（先頭シート = gviz 既定と同一）
// ==================================================================

function getStoreCoordsFromMaster(storeId) {
  const ss = SpreadsheetApp.openById(getWebhookSheetId_());
  const sheet = ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const sidWant = String(storeId).trim();

  for (let i = 1; i < data.length; i++) {
    const sid = data[i][MASTER_COL_STORE_ID];
    if (sid != null && String(sid).trim() === sidWant) {
      const lat = data[i][MASTER_COL_LAT];
      const lng = data[i][MASTER_COL_LNG];
      if (lat == null || lng == null) continue;
      return { lat: Number(lat), lng: Number(lng) };
    }
  }
  return null;
}

// ==================================================================
// pending_posts
// ==================================================================

function savePending(userId, storeKey, message) {
  const sheet = getPendingSheet(true);
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      sheet.getRange(i + 1, 2).setValue(storeKey);
      sheet.getRange(i + 1, 3).setValue(message);
      sheet.getRange(i + 1, 4).setValue(now);
      return;
    }
  }
  sheet.appendRow([userId, storeKey, message, now]);
}

function loadPending(userId) {
  const sheet = getPendingSheet(false);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const now = Date.now();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] !== userId) continue;
    const savedAt = data[i][3] ? new Date(data[i][3]).getTime() : 0;
    if (now - savedAt > PENDING_EXPIRE_MS) return null;
    return { storeId: data[i][1], message: data[i][2] };
  }
  return null;
}

function deletePending(userId) {
  const sheet = getPendingSheet(false);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === userId) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function flushExpiredPending() {
  const sheet = getPendingSheet(false);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const nowMs = Date.now();

  for (let i = data.length - 1; i >= 1; i--) {
    const savedAt = data[i][3] ? new Date(data[i][3]).getTime() : 0;
    if (nowMs - savedAt <= PENDING_EXPIRE_MS) continue;

    const userId = data[i][0];
    const message = data[i][2] ? String(data[i][2]) : '';

    sheet.deleteRow(i + 1);

    if (!message.trim()) continue;

    const user = getUserRecord(userId);
    if (!user || user.isActive === false) continue;

    if (user.role === ROLE_STORE) {
      setSession(userId, STEP_AWAITING_CATEGORY, {
        text: message, imageUrl: '', lat: null, lng: null, spotId: '', spotName: '',
        storeId: user.fixedStoreId || ''
      });
      replyWithCategoryQuickReplyPush(userId, 'テキストを確定しました。カテゴリを選んでください👇');
    } else if (user.role === ROLE_OPERATOR) {
      setSession(userId, STEP_AWAITING_SPOT, {
        text: message, imageUrl: '', lat: null, lng: null, spotId: '', spotName: ''
      });
      pushText(userId,
        buildSpotListMessage().indexOf('⚠️') === 0
          ? buildSpotListMessage()
          : '📝テキスト確定しました。\n' + buildSpotListMessage()
      );
    } else if (user.role === ROLE_CONTRIBUTOR) {
      const sess = getSession(userId);
      if (sess.payload.lat == null) continue;
      setSession(userId, STEP_AWAITING_CATEGORY, Object.assign({}, sess.payload, {
        text: message, imageUrl: ''
      }));
      replyWithCategoryQuickReplyPush(userId, 'カテゴリを選んでください👇');
    }
  }
}

function getPendingSheet(createIfMissing) {
  const ss = SpreadsheetApp.openById(getWebhookSheetId_());
  let sheet = ss.getSheetByName(PENDING_SHEET_NAME);
  if (!sheet && createIfMissing) {
    sheet = insertSheetAtEnd_(ss, PENDING_SHEET_NAME);
    sheet.appendRow(['userId', 'store_id', 'message', 'saved_at']);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:D1').setBackground('#FFA000').setFontColor('#FFFFFF').setFontWeight('bold');
  }
  return sheet;
}

// ==================================================================
// LINE API
// ==================================================================

function replyText(replyToken, text) {
  if (!replyToken) return;
  const payload = { replyToken, messages: [{ type: 'text', text }] };
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + getWebhookLineToken_() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function pushText(userId, text) {
  pushMessages(userId, [{ type: 'text', text: text }]);
}

function pushMessages(userId, messages) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + getWebhookLineToken_() },
    payload: JSON.stringify({ to: userId, messages }),
    muteHttpExceptions: true
  });
}

function replyWithCategoryQuickReply(replyToken, headerText) {
  const qr = buildCategoryQuickReply();
  replyMessages(replyToken, [{ type: 'text', text: headerText, quickReply: qr }]);
}

function replyWithCategoryQuickReplyPush(userId, headerText) {
  const qr = buildCategoryQuickReply();
  pushMessages(userId, [{ type: 'text', text: headerText, quickReply: qr }]);
}

function buildCategoryQuickReply() {
  const items = CATEGORIES.map(cat => ({
    type: 'action',
    action: {
      type: 'message',
      label: cat.length > 12 ? cat.slice(0, 11) + '…' : cat,
      text: 'カテゴリ:' + cat
    }
  }));
  return { items };
}

function replyMessages(replyToken, messages) {
  if (!replyToken) return;
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + getWebhookLineToken_() },
    payload: JSON.stringify({ replyToken, messages }),
    muteHttpExceptions: true
  });
}

function parseCategoryFromText(text) {
  const m = /^カテゴリ[:：]\s*(.+)$/.exec(text.trim());
  if (!m) return null;
  const name = m[1].trim();
  return CATEGORIES.indexOf(name) >= 0 ? name : null;
}

// ==================================================================
// 登録 / ヘルプ / 管理者
// ==================================================================

function canRegisterSpecialRoles(userId, passwordArg) {
  const adminLineUserId = getAdminLineUserId_();
  if (adminLineUserId && userId === adminLineUserId) return true;
  const regPw = getRegistrationPassword_();
  if (regPw && passwordArg === regPw) return true;
  return false;
}

function handleRegisterCommand(userId, replyToken, text) {
  const parts = text.split(/\s+/);
  const sub = parts[1] ? parts[1].trim() : '';
  const specialPw = parts.slice(2).join(' ') || '';

  if (!sub) {
    replyText(replyToken,
      '⚠️ 使い方\n店舗: 登録 store_001\n運営: 登録 運営（パスワード）\n協力: 登録 協力（パスワード）');
    return;
  }

  if (sub === '運営' || sub === 'operator') {
    if (!canRegisterSpecialRoles(userId, specialPw)) {
      replyText(replyToken, '🔒 運営登録には管理者または登録パスワードが必要です。');
      return;
    }
    saveUserRecord(userId, ROLE_OPERATOR, '');
    deleteSession(userId);
    replyText(replyToken, '✅ 運営として登録しました。写真または短文→スポット番号→カテゴリの順で投稿できます。');
    return;
  }

  if (sub === '協力' || sub === '協力者' || sub === 'contributor') {
    if (!canRegisterSpecialRoles(userId, specialPw)) {
      replyText(replyToken, '🔒 協力者登録には管理者または登録パスワードが必要です。');
      return;
    }
    saveUserRecord(userId, ROLE_CONTRIBUTOR, '');
    setSession(userId, STEP_IDLE, { text: '', imageUrl: '', lat: null, lng: null, spotId: '', spotName: '' });
    replyText(replyToken, '✅ 協力者として登録しました。\n投稿は 📍位置情報 → 写真・短文 → カテゴリ の流れです。');
    return;
  }

  const storeId = sub;
  if (!/^[\w.\-]+$/.test(storeId)) {
    replyText(replyToken, '⚠️ store_id に使えない文字があります。');
    return;
  }
  const storePw = parts.length > 2 ? parts.slice(2).join(' ') : '';
  const regPw = getRegistrationPassword_();
  if (regPw && storePw !== regPw) {
    replyText(replyToken, '🔒 登録パスワードが違います。\n例：登録 store_001（パスワード）');
    return;
  }

  const existing = lookupUserIdByFixedStoreId(storeId);
  if (existing && existing !== userId) {
    replyText(replyToken, `⚠️「${storeId}」は別のユーザーが登録済みです。`);
    return;
  }

  saveUserRecord(userId, ROLE_STORE, storeId);
  deleteSession(userId);

  replyText(replyToken,
    `✅ 店舗登録しました（store:${storeId}）\n写真・短文→カテゴリでライブ投稿できます。\n※店舗座標はスプレッドシートで設定してください。`);
}

function handleCheckCommand(userId, replyToken) {
  const u = getUserRecord(userId);
  if (!u) {
    replyText(replyToken, '未登録です。「ヘルプ」で確認してください。');
    return;
  }
  let detail = '';
  if (u.role === ROLE_STORE) detail = `店舗ID: ${u.fixedStoreId}`;
  else if (u.role === ROLE_OPERATOR) detail = '運営（スポット選択）';
  else detail = '協力者（位置＋GPS投稿）';

  replyText(replyToken,
    `📋 登録状況\nロール:${u.role}\n${detail}\n有効:${u.isActive !== false}`);
}

function handleUnregisterCommand(userId, replyToken) {
  deleteUserFromMap(userId);
  deleteSession(userId);
  deletePending(userId);
  replyText(replyToken, '✅ 登録を解除しました。');
}

function handleAdminListCommand(replyToken) {
  const rows = getAllUserMapRows();
  if (rows.length === 0) {
    replyText(replyToken, '登録ユーザーなし');
    return;
  }
  const lines = rows.map((r, i) =>
    `${i + 1}. ${r.role} ${r.fixedStoreId ? r.fixedStoreId : '-'}\n  ${String(r.userId).slice(0, 12)}...\n  ${r.registeredAt}`
  );
  replyText(replyToken, '登録一覧\n\n' + lines.join('\n\n'));
}

/** store_id（店舗）または LINE userId 先頭一致で削除 */
function handleAdminDeleteCommand(replyToken, target) {
  const byStore = lookupUserIdByFixedStoreId(target);
  if (byStore) {
    deleteUserFromMap(byStore);
    replyText(replyToken, `✅ 削除: store ${target}`);
    return;
  }
  let hit = false;
  getAllUserMapRows().forEach(r => {
    if (String(r.userId).indexOf(target) === 0) {
      deleteUserFromMap(r.userId);
      hit = true;
    }
  });
  replyText(replyToken, hit ? '✅ 該当ユーザーを削除しました' : '見つかりません');
}

function handleAdminTestPost(replyToken, adminUserId) {
  const u = getUserRecord(adminUserId);
  if (!u || u.role !== ROLE_STORE || !u.fixedStoreId) {
    replyText(replyToken, '管理者アカウントが店舗ロールかつ fixed_store_id 付きである必要があります。');
    return;
  }
  const c = getStoreCoordsFromMaster(u.fixedStoreId);
  if (!c) {
    replyText(replyToken, '店舗座標が未取得です');
    return;
  }
  const createdAt = new Date();
  appendPostRow({
    postId: Utilities.getUuid(),
    userId: adminUserId,
    role: ROLE_STORE,
    sourceType: SOURCE_FIXED,
    category: 'お知らせ',
    text: '🧪 テスト投稿',
    imageUrl: '',
    lat: c.lat,
    lng: c.lng,
    storeId: u.fixedStoreId,
    spotId: '',
    createdAt,
    expiresAt: new Date(createdAt.getTime() + TTL_MS[ROLE_STORE]),
    isVisible: true
  });
  replyText(replyToken, '✅ posts にテスト行を書き込みしました');
}

function buildMyIdMessage(userId) {
  const u = getUserRecord(userId);
  let tail = '';
  if (u) {
    tail = `\n登録済: ${u.role}${u.fixedStoreId ? ' / ' + u.fixedStoreId : ''}`;
  } else tail = '\n未登録';

  return `🆔 LINEユーザーID\n\n${userId}${tail}`;
}

function buildUnknownUserMessage(userId) {
  return `👋 未登録です。\nあなたのID:\n${userId}\n\n「ヘルプ」でコマンドを確認し、運営に登録してもらってください。`;
}

function buildHelpMessage(userId) {
  const head =
    '📖 コマンド\nマイID / ヘルプ / 登録確認 / 登録解除\n\n' +
    '📍 登録\n' +
    '・店舗: 登録 store_xxx\n' +
    '・運営: 登録 運営 （管理者 or パスワードが必要な場合あり）\n' +
    '・協力: 登録 協力\n\n';

  let flow = '';
  const u = getUserRecord(userId);
  if (!u) {
    flow =
      '🗺️ このあと投稿するには運営にロール割当をお願いします。\n' +
      'マップモデレーション: posts の isVisible を編集できます。';
  } else if (u.role === ROLE_STORE) {
    flow = '📝 店舗投稿: 短文や写真→カテゴリ（ボタン）\n座標はスプレッドシート側のお店情報を使用します。';
  } else if (u.role === ROLE_OPERATOR) {
    flow = '📝 運営投稿: 短文や写真→番号でスポット→カテゴリ\n⚠️ venue_spots にスポットを登録しておいてください';
  } else {
    flow = '📝 協力者投稿: 📍位置→短文や写真→カテゴリ';
  }
  return head + flow + `\n\n文字数:${MAX_MESSAGE_LENGTH}文字まで`;
}

function fetchLineImageToDrive(messageId) {
  const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;
  const response = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + getWebhookLineToken_() },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('HTTP ' + response.getResponseCode());
  }
  const blob = response.getBlob();
  if (blob.getBytes().length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('サイズ上限超過');
  }
  const folder = getOrCreateFolder(DRIVE_FOLDER_NAME);
  const file = folder.createFile(blob.setName(`line_${messageId}_${Date.now()}.jpg`));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w800`;
}

function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

// ==================================================================
/**
 * gviz 既定は「先頭シート」を読むため、insertSheet 後も店舗マスタが先頭になるよう並べ替える。
 */
function ensureMasterSheetIsGvizFirst_(ss) {
  const master = findMasterSheetForGviz_(ss);
  if (!master) return;
  ss.setActiveSheet(master);
  ss.moveActiveSheet(1);
}

function findMasterSheetForGviz_(ss) {
  const reserved = {};
  [
    USER_MAP_SHEET_NAME, POSTS_SHEET_NAME, VENUE_SPOTS_SHEET_NAME,
    BOT_SESSIONS_SHEET_NAME, PENDING_SHEET_NAME
  ].forEach(n => { reserved[n] = true; });

  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const sh = sheets[i];
    if (reserved[sh.getName()]) continue;
    if (String(sh.getRange('B1').getValue()) === 'name') return sh;
  }
  const s1 = ss.getSheetByName('Sheet1');
  return s1 || null;
}

/**
 * setupSheets 用: ID がどこにも無ければ、紐づけで開いている表の ID を実行中だけ使う。
 */
function ensureWebhookSheetIdFromActiveIfPlaceholder_() {
  if (getWebhookSheetId_()) return;
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error(
      'setupSheets: スクリプトプロパティに SHEET_ID（実 ID）を登録するか、' +
      '紐づけでこのスプレッドシートを開いた状態で実行してください。' +
      ' （開発試験のみ WEBHOOK_CONFIG.SHEET_ID に直書き可）'
    );
  }
  __webhookSheetIdRuntimeOverride_ = active.getId();
  console.log(
    'この実行のためだけスプレッドシート ID をアクティブな表から補完しました。' +
    ' 恒久的にはスクリプトプロパティの SHEET_ID に保存することを推奨します。'
  );
}

function setupSheets() {
  ensureWebhookSheetIdFromActiveIfPlaceholder_();
  const sid = getWebhookSheetId_();
  if (!sid) {
    throw new Error('setupSheets: スプレッドシート ID を取得できませんでした。');
  }
  const ss = SpreadsheetApp.openById(sid);

  getUserMapSheet(true);
  getPendingSheet(true);
  getBotSessionSheet(true);

  if (!ss.getSheetByName(POSTS_SHEET_NAME)) {
    ensurePostsSheet(ss);
    console.log('✅ posts');
  }
  if (!ss.getSheetByName(VENUE_SPOTS_SHEET_NAME)) {
    const s = insertSheetAtEnd_(ss, VENUE_SPOTS_SHEET_NAME);
    s.appendRow(['spotId', 'name', 'lat', 'lng', 'type']);
    s.setFrozenRows(1);
    s.getRange('A1:E1').setBackground('#1565C0').setFontColor('#FFFFFF').setFontWeight('bold');
    console.log('✅ venue_spots');
  }

  ensureMasterSheetIsGvizFirst_(ss);
  console.log('setupSheets OK');
}

/**
 * GAS エディタから1回実行 → ログ（表示→ログ）にスクリプトプロパティのキー一覧を出す。値はプロジェクトの設定で入力。
 */
function logWebhookScriptPropertyKeys() {
  console.log([
    '=== スクリプトプロパティ（本番の正／ソースに秘密を書かない） ===',
    '[必須] SHEET_ID … /d/〜/edit の間のスプレッドシート ID',
    '[必須] LINE_CHANNEL_ACCESS_TOKEN … LINE 長期チャネルアクセストークン',
    '[任意] ADMIN_LINE_USER_ID … 管理者の LINE userId',
    '[任意] REGISTRATION_PASSWORD … 運営・協力・店舗登録用（空なら店舗登録は無パスワード可）',
    '--- 互換キー（任意・誤記対策） ---',
    'YOUR_GOOGLE_SHEET_ID, YOUR_LINE_CHANNEL_ACCESS_TOKEN',
    '--- 試験用 --- WEBHOOK_CONFIG … ローカル試験のフォールバックのみ。本番は空のまま。'
  ].join('\n'));
}

function testAppend() {
  appendPostRow({
    postId: Utilities.getUuid(),
    userId: 'TEST',
    role: ROLE_STORE,
    sourceType: SOURCE_FIXED,
    category: 'お知らせ',
    text: 'テスト',
    imageUrl: '',
    lat: 34.675,
    lng: 138.943,
    storeId: 'test',
    spotId: '',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + TTL_MS[ROLE_STORE]),
    isVisible: true
  });
}
