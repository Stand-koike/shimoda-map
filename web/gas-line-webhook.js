/**
 * ============================================================
 * LINE → GAS → Google Sheets  /  登録システム付きWebhook
 * ============================================================
 *
 * 【初回セットアップ手順】
 *   1. スプレッドシートを開く → 拡張機能 → Apps Script
 *   2. このコードを貼り付け
 *   3. SHEET_ID / LINE_CHANNEL_ACCESS_TOKEN を確認・設定
 *   4. ADMIN_LINE_USER_ID に自分のLINE IDを仮で空のまま残す
 *   5. GASエディタで setupSheets() を実行 → シートが自動作成される
 *   6. デプロイ → 新しいデプロイ → ウェブアプリ
 *      実行ユーザー: 自分（所有者のアカウント）
 *      アクセスできるユーザー: 「全員」（＝匿名ユーザーを含む。英語UIなら Anyone）
 *        ★「Googleアカウントを持つユーザー」のみにすると LINE 側が 302 になり失敗します
 *   7. 発行されたURLをそのままコピー（末尾が /exec のもの）
 *      ★ /dev や /userCodeAppPanel は LINE には使わない
 *      ★ ブラウザで URL を開き「OK」と表示され、Googleログインに飛ばされなければ正しい設定です
 *   8. 上記URLを LINE Developers の Webhook URL に設定
 *   9. LINEで「マイID」と送信 → ボットが自分のIDを返信してくれる
 *  10. 返信されたIDを ADMIN_LINE_USER_ID に貼り付け → 再デプロイ
 *  11. LINEで「登録 [store_id]」と送信 → 登録完了
 *
 * 【302 Found が出るとき（よくある原因）】
 *   ・「アクセスできるユーザー」が「全員」になっていない
 *      → 「デプロイを管理」→ デプロイの鉛筆 → 「新バージョン」で再デプロイし、
 *        「全員 / Anyone（匿名を含む）」を必ず選ぶ
 *   ・Webhook URL が /dev になっている、または古いデプロイURLをコピーしている
 *      → 最新の「ウェブアプリ」デプロイの /exec URL を貼り直す
 *   ・Workspace 組織で「全員」公開が禁止されている
 *      → 管理者に GAS の匿名アクセス許可を依頼する
 *
 * 【ブラウザで /exec を開くと「ファイルを開くことができません」になるとき】
 *   ★ ほとんどは「URLが間違っている」か「デプロイIDではないIDを使っている」ことが原因です。
 *
 *   ・正しいURLの形（例）:
 *     https://script.google.com/macros/s/AKfycby........................../exec
 *     「/macros/s/」のあとに続くコードは **ウェブアプリのデプロイID** です。
 *   × 誤り: エディタのアドレスバーに出る「プロジェクトID」（.../projects/xxxxxxxx/edit）
 *     をそのまま /exec にすると **開けません**。デプロイIDとは別物です。
 *   ・対処: GAS の **「デプロイ」→「デプロイを管理」** で、種類が「ウェブアプリ」
 *     の行を選び、表示される **ウェブアプリの URL** を **すべて丸ごと** コピーする。
 *     （途中で改行・スペースが入っていないか確認）
 *   ・「テストデプロイ」のURLではなく、「本番のウェブアプリ」デプロイのURLを使う。
 *   ・まだ一度も「ウェブアプリ」としてデプロイしていない
 *     → **「デプロイ」→「新しいデプロイ」** で種類に **ウェブアプリ** を選び、
 *       実行ユーザー・全員アクセスを設定して **デプロイ** 後に出るURLを使う。
 *   ・別ブラウザ / シークレットウィンドウ / ログイン中のGoogleアカウントを差し替えて再試行。
 *
 * 【LINEコマンド一覧】
 *   マイID          → 自分のLINE IDを確認（誰でも使用可）
 *   登録 store_001  → store_001 として登録
 *   登録確認        → 現在の登録状況を確認
 *   登録解除        → 自分の登録を削除
 *   ヘルプ          → コマンド一覧を表示
 *
 * 【管理者コマンド】（ADMIN_LINE_USER_ID のみ）
 *   ユーザー一覧    → 登録済みユーザー全員を表示
 *   削除 store_001  → 指定store_idの登録を強制削除
 *   テスト投稿      → news_logにテストデータを書き込む
 */

// ---------------------------------------------------------------
// 公開リポジトリ用: SHEET_ID と LINE_CHANNEL_ACCESS_TOKEN はプレースホルダ。
// 実値は GAS エディタに貼るときに設定するか、ローカルで gas-line-webhook.local.js を使う（Git に含めない）。
// ---------------------------------------------------------------

// ============================================================
// ★ 必須設定 ★
// ============================================================

/** スプレッドシートID（プレースホルダ。GAS に貼る前に本番 ID に差し替え） */
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';

/** LINE チャネルアクセストークン（長期）※リポジトリには載せない。LINE Developers で発行して貼る */
const LINE_CHANNEL_ACCESS_TOKEN = 'YOUR_LINE_CHANNEL_ACCESS_TOKEN';

/**
 * 管理者のLINEユーザーID
 *
 * 最初は空文字 '' のままにして、LINEで「マイID」と送信し
 * 返ってきたIDをここに貼り付けて再デプロイしてください。
 * 管理者コマンド（ユーザー一覧・強制削除など）が使えるようになります。
 */
const ADMIN_LINE_USER_ID = '';

/**
 * 登録パスワード（任意）
 *
 * 空文字 '' にするとパスワード不要でだれでも登録可能。
 * 文字列を設定した場合、「登録 store_001 パスワード」の形式が必要になります。
 * 個人テスト中は空 '' のまま推奨。
 */
const REGISTRATION_PASSWORD = '';

// ============================================================
// その他の設定
// ============================================================

const NEWS_LOG_SHEET_NAME  = 'news_log';
const USER_MAP_SHEET_NAME  = 'user_map';
const PENDING_SHEET_NAME   = 'pending_posts';  // テキスト保留シート
const MAX_MESSAGE_LENGTH   = 50;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const DRIVE_FOLDER_NAME    = 'LINE_MAP_IMAGES';

/**
 * テキスト→画像セット投稿の保留時間（ミリ秒）
 *
 * テキストを送ってからこの時間内に画像が届いた場合、
 * テキスト＋画像の1セットとして news_log に保存します。
 * 時間を過ぎた保留テキストはテキストのみで確定されます。
 *
 * デフォルト: 3分
 */
const PENDING_EXPIRE_MS = 3 * 60 * 1000;

// ============================================================
// Webhook エントリポイント
// ============================================================

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const events = body.events || [];

    events.forEach(event => {
      if (event.type !== 'message') return;

      const userId     = event.source?.userId;
      const replyToken = event.replyToken;
      const msg        = event.message;

      if (!userId) return;

      // テキストメッセージ：コマンド判定を優先
      if (msg.type === 'text') {
        const text = msg.text.trim();

        // 「マイID」コマンド：未登録でも使えるIDの確認
        if (/^マイID$/i.test(text) || /^my\s*id$/i.test(text)) {
          replyText(replyToken, buildMyIdMessage(userId));
          return;
        }

        // 「ヘルプ」コマンド
        if (/^ヘルプ$/.test(text) || /^help$/i.test(text)) {
          replyText(replyToken, buildHelpMessage());
          return;
        }

        // 「登録」コマンド
        if (/^登録/.test(text)) {
          handleRegisterCommand(userId, replyToken, text);
          return;
        }

        // 「登録確認」コマンド
        if (/^登録確認$/.test(text)) {
          handleCheckCommand(userId, replyToken);
          return;
        }

        // 「登録解除」コマンド
        if (/^登録解除$/.test(text)) {
          handleUnregisterCommand(userId, replyToken);
          return;
        }

        // ===== 管理者コマンド =====
        if (ADMIN_LINE_USER_ID && userId === ADMIN_LINE_USER_ID) {
          if (/^ユーザー一覧$/.test(text)) {
            handleAdminListCommand(replyToken);
            return;
          }
          if (/^削除\s+\S+$/.test(text)) {
            const targetStoreId = text.split(/\s+/)[1];
            handleAdminDeleteCommand(replyToken, targetStoreId);
            return;
          }
          if (/^テスト投稿$/.test(text)) {
            handleAdminTestPost(replyToken);
            return;
          }
        }

        // ===== 通常投稿（登録済みユーザーのみ） =====
        const storeId = lookupStoreId(userId);
        if (storeId) {
          handleTextMessage(userId, storeId, text, replyToken);
        } else {
          replyText(replyToken, buildUnknownUserMessage(userId));
        }

      } else if (msg.type === 'image') {
        const storeId = lookupStoreId(userId);
        if (storeId) {
          handleImageMessage(userId, storeId, msg.id, replyToken);
        } else {
          replyText(replyToken, buildUnknownUserMessage(userId));
        }
      }
    });

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.error('[doPost] エラー:', err);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GET（疎通確認用）
 *
 * ブラウザで Webhook URL（/exec）を開いたときに表示されます。
 * 「OK」と出れば HTTP 200 で匿名から到達できています。
 * Googleログイン画面に飛ぶ場合はアクセス権が「全員」になっていません（LINEは302で失敗します）。
 */
function doGet() {
  return ContentService
    .createTextOutput('OK')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================
// コマンドハンドラー
// ============================================================

/**
 * 「登録 store_001」または「登録 store_001 パスワード」
 */
function handleRegisterCommand(userId, replyToken, text) {
  const parts   = text.split(/\s+/);
  const storeId = parts[1];
  const inputPw = parts[2] || '';

  // store_id が未指定
  if (!storeId) {
    replyText(replyToken,
      '⚠️ store_id を指定してください。\n例：登録 store_001\n\n自分のstore_idはマップ管理者に確認してください。');
    return;
  }

  // store_id 形式チェック（英数字・アンダースコア・ハイフンのみ）
  if (!/^[\w.\-]+$/.test(storeId)) {
    replyText(replyToken, '⚠️ store_id に使えない文字が含まれています。');
    return;
  }

  // パスワードチェック（設定されている場合）
  if (REGISTRATION_PASSWORD && inputPw !== REGISTRATION_PASSWORD) {
    replyText(replyToken,
      '🔒 登録パスワードが違います。\n管理者にパスワードを確認してください。');
    return;
  }

  // 既に同じstore_idが登録済みか確認
  const existing = lookupUserIdByStoreId(storeId);
  if (existing && existing !== userId) {
    replyText(replyToken,
      `⚠️ store_id「${storeId}」はすでに別のユーザーが登録しています。\n管理者にお問い合わせください。`);
    return;
  }

  // 自分が既に別のstore_idで登録済みか確認
  const myStoreId = lookupStoreId(userId);
  if (myStoreId && myStoreId !== storeId) {
    // 上書き登録（既存を削除してから登録）
    deleteUserFromMap(userId);
  }

  saveUserToMap(userId, storeId);

  replyText(replyToken,
    `✅ 登録完了！\n\nstore_id：${storeId}\n\nこれでLINEに送ったテキスト・画像がマップに反映されます🗺️\nテキストは${MAX_MESSAGE_LENGTH}文字以内で送ってください。`);
}

/**
 * 「登録確認」
 */
function handleCheckCommand(userId, replyToken) {
  const storeId = lookupStoreId(userId);
  if (storeId) {
    replyText(replyToken,
      `📋 登録状況\n\nstore_id：${storeId}\n\nマップに投稿できる状態です✅`);
  } else {
    replyText(replyToken,
      `📋 登録状況\n\nまだ登録されていません。\n\n「登録 [store_id]」と送信して登録してください。`);
  }
}

/**
 * 「登録解除」
 */
function handleUnregisterCommand(userId, replyToken) {
  const storeId = lookupStoreId(userId);
  if (!storeId) {
    replyText(replyToken, '⚠️ まだ登録されていません。');
    return;
  }
  deleteUserFromMap(userId);
  replyText(replyToken, `✅ 登録を解除しました（store_id：${storeId}）`);
}

/**
 * 管理者：ユーザー一覧
 */
function handleAdminListCommand(replyToken) {
  const rows = getAllUserMapRows();
  if (rows.length === 0) {
    replyText(replyToken, '登録ユーザーはいません。');
    return;
  }
  const lines = rows.map((r, i) =>
    `${i + 1}. ${r.storeId}\n   ID: ${r.userId.substring(0, 8)}...\n   登録日: ${r.registeredAt}`
  );
  replyText(replyToken, `📋 登録ユーザー一覧 (${rows.length}件)\n\n` + lines.join('\n\n'));
}

/**
 * 管理者：強制削除
 */
function handleAdminDeleteCommand(replyToken, storeId) {
  const userId = lookupUserIdByStoreId(storeId);
  if (!userId) {
    replyText(replyToken, `⚠️ store_id「${storeId}」は登録されていません。`);
    return;
  }
  deleteUserFromMap(userId);
  replyText(replyToken, `✅ store_id「${storeId}」の登録を削除しました。`);
}

/**
 * 管理者：テスト投稿
 */
function handleAdminTestPost(replyToken) {
  const storeId = lookupStoreId(ADMIN_LINE_USER_ID);
  if (!storeId) {
    replyText(replyToken, '⚠️ 管理者アカウントがstore_idに登録されていません。');
    return;
  }
  appendNewsLog(storeId, '🧪 テスト投稿です', '');
  replyText(replyToken, `✅ テスト投稿しました（store_id：${storeId}）\nマップを確認してください。`);
}

// ============================================================
// テキスト・画像の投稿処理（セット対応）
//
// 【セット投稿の仕組み】
//   1. テキストを送る → pending_posts シートに保留（PENDING_EXPIRE_MS 分間）
//   2. その間に画像を送る → 保留テキスト＋画像を1行で news_log に確定
//   3. 時間切れ後に画像を送る → テキストはそれ以前に単独確定済みで、
//      画像も単独で保存
//   ★ 画像だけを先に送った場合はそのまま画像のみで保存
// ============================================================

/**
 * テキスト受信
 * ・コマンドは呼び出し元で処理済みなのでここは純粋な投稿テキストのみ来る
 */
function handleTextMessage(userId, storeId, text, replyToken) {
  if (!text || text.trim() === '') return;

  // 期限切れ保留を先に掃除
  flushExpiredPending();

  const truncated = text.trim().substring(0, MAX_MESSAGE_LENGTH);

  // 既に保留テキストがある場合は上書き（直前のテキストを差し替え）
  savePending(userId, storeId, truncated);

  // 「画像も送ってセットにできます」案内（初回のみでも可。ここでは毎回）
  replyText(replyToken,
    `📝 テキストを受け付けました。\n「${truncated}」\n\n続けて写真を送ると\nテキスト＋画像のセットでマップに反映されます📸\n（${PENDING_EXPIRE_MS / 60000}分以内）\n\n写真なしでOKな場合はこのまま${PENDING_EXPIRE_MS / 60000}分待つと自動確定します。`
  );
}

/**
 * 画像受信
 * ・保留テキストがあればセットで確定、なければ画像のみ
 */
function handleImageMessage(userId, storeId, messageId, replyToken) {
  // 期限切れ保留を先に掃除（掃除で単独テキスト確定もされる）
  flushExpiredPending();

  let imageUrl = '';
  try {
    imageUrl = fetchLineImageToDrive(messageId);
  } catch (err) {
    console.error('[handleImageMessage] 画像取得失敗:', err);
    if (replyToken) {
      replyText(replyToken, '⚠️ 画像の取得に失敗しました。もう一度お試しください。');
    }
    return;
  }

  // 保留テキストを確認
  const pending = loadPending(userId);

  if (pending) {
    // セット確定
    deletePending(userId);
    appendNewsLog(storeId, pending.message, imageUrl);
    replyText(replyToken,
      `✅ マップに反映しました！\n📝 ${pending.message}\n📸 画像つき`
    );
  } else {
    // 画像のみ
    appendNewsLog(storeId, '', imageUrl);
    replyText(replyToken, '✅ 画像をマップに反映しました📸');
  }
}

/**
 * LINE APIから画像を取得し Google Drive に保存して公開URLを返す
 */
function fetchLineImageToDrive(messageId) {
  const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;

  const response = UrlFetchApp.fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`LINE画像取得失敗: HTTP ${response.getResponseCode()}`);
  }

  const blob = response.getBlob();

  if (blob.getBytes().length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('画像サイズ超過 (5MB上限)');
  }

  const folder   = getOrCreateFolder(DRIVE_FOLDER_NAME);
  const fileName = `line_${messageId}_${Date.now()}.jpg`;
  const file     = folder.createFile(blob.setName(fileName));

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w800`;
}

// ============================================================
// pending_posts シート操作（テキスト保留）
// ============================================================

/** テキストを保留シートに保存（upsert） */
function savePending(userId, storeId, message) {
  const sheet = getPendingSheet(true);
  const data  = sheet.getDataRange().getValues();
  const now   = new Date();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      sheet.getRange(i + 1, 2).setValue(storeId);
      sheet.getRange(i + 1, 3).setValue(message);
      sheet.getRange(i + 1, 4).setValue(now);
      return;
    }
  }
  sheet.appendRow([userId, storeId, message, now]);
}

/** 保留テキストを取得（期限内のみ） */
function loadPending(userId) {
  const sheet = getPendingSheet();
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  const now  = Date.now();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] !== userId) continue;
    const savedAt = data[i][3] ? new Date(data[i][3]).getTime() : 0;
    if (now - savedAt > PENDING_EXPIRE_MS) return null;  // 期限切れ
    return { storeId: data[i][1], message: data[i][2] };
  }
  return null;
}

/** 保留テキストを削除 */
function deletePending(userId) {
  const sheet = getPendingSheet();
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === userId) { sheet.deleteRow(i + 1); return; }
  }
}

/**
 * 期限切れの保留テキストを掃除し、テキスト単独で news_log に確定する
 * doPost の冒頭で毎回呼ぶ（軽量処理）
 */
function flushExpiredPending() {
  const sheet = getPendingSheet();
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const now  = Date.now();

  // 後ろから削除してズレを防ぐ
  for (let i = data.length - 1; i >= 1; i--) {
    const savedAt = data[i][3] ? new Date(data[i][3]).getTime() : 0;
    if (now - savedAt > PENDING_EXPIRE_MS) {
      const storeId = data[i][1];
      const message = data[i][2];
      if (storeId && message) {
        appendNewsLog(storeId, message, '');  // テキスト単独で確定
        console.log(`[flushExpiredPending] 期限切れ確定: store=${storeId} msg="${message}"`);
      }
      sheet.deleteRow(i + 1);
    }
  }
}

/** pending_posts シートを取得（createIfMissing=trueで自動作成） */
function getPendingSheet(createIfMissing) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  let   sheet = ss.getSheetByName(PENDING_SHEET_NAME);
  if (!sheet && createIfMissing) {
    sheet = ss.insertSheet(PENDING_SHEET_NAME);
    sheet.appendRow(['userId', 'store_id', 'message', 'saved_at']);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:D1').setBackground('#FFA000').setFontColor('#FFFFFF').setFontWeight('bold');
  }
  return sheet;
}

// ============================================================
// user_map シート操作
// ============================================================

/**
 * ユーザーIDからstore_idを引く
 * @returns {string|null}
 */
function lookupStoreId(userId) {
  const sheet = getUserMapSheet();
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  // ヘッダー行をスキップ (行0)
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) return data[i][1] || null;
  }
  return null;
}

/**
 * store_idからユーザーIDを引く（重複チェック用）
 * @returns {string|null}
 */
function lookupUserIdByStoreId(storeId) {
  const sheet = getUserMapSheet();
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === storeId) return data[i][0] || null;
  }
  return null;
}

/**
 * ユーザーをuser_mapに保存（upsert）
 */
function saveUserToMap(userId, storeId) {
  const sheet = getUserMapSheet(true);
  const data  = sheet.getDataRange().getValues();

  // 既存行の更新チェック
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      sheet.getRange(i + 1, 2).setValue(storeId);
      sheet.getRange(i + 1, 3).setValue(new Date());
      console.log(`[saveUserToMap] 更新: ${userId} → ${storeId}`);
      return;
    }
  }

  // 新規追加
  sheet.appendRow([userId, storeId, new Date()]);
  console.log(`[saveUserToMap] 新規登録: ${userId} → ${storeId}`);
}

/**
 * user_mapからユーザーを削除
 */
function deleteUserFromMap(userId) {
  const sheet = getUserMapSheet();
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === userId) {
      sheet.deleteRow(i + 1);
      console.log(`[deleteUserFromMap] 削除: ${userId}`);
      return;
    }
  }
}

/**
 * user_mapの全行を返す
 */
function getAllUserMapRows() {
  const sheet = getUserMapSheet();
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      rows.push({
        userId:       data[i][0],
        storeId:      data[i][1],
        registeredAt: data[i][2] ? Utilities.formatDate(new Date(data[i][2]), 'Asia/Tokyo', 'MM/dd HH:mm') : '不明'
      });
    }
  }
  return rows;
}

/**
 * user_map シートを取得（createIfMissing=trueで自動作成）
 */
function getUserMapSheet(createIfMissing) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  let   sheet = ss.getSheetByName(USER_MAP_SHEET_NAME);

  if (!sheet && createIfMissing) {
    sheet = ss.insertSheet(USER_MAP_SHEET_NAME);
    sheet.appendRow(['userId', 'store_id', 'registered_at']);
    sheet.setFrozenRows(1);
    // ヘッダー行のスタイル
    sheet.getRange('A1:C1').setBackground('#4A90D9').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setColumnWidth(1, 250);
    sheet.setColumnWidth(2, 130);
    sheet.setColumnWidth(3, 160);
    console.log('[getUserMapSheet] user_map シートを作成しました');
  }
  return sheet;
}

// ============================================================
// news_log シート書き込み
// ============================================================

function appendNewsLog(storeId, message, imageUrl) {
  if (!message && !imageUrl) return;

  const ss    = SpreadsheetApp.openById(SHEET_ID);
  let   sheet = ss.getSheetByName(NEWS_LOG_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(NEWS_LOG_SHEET_NAME);
    sheet.appendRow(['timestamp', 'store_id', 'message', 'image_url']);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:D1').setBackground('#FF3B6B').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 130);
    sheet.setColumnWidth(3, 250);
    sheet.setColumnWidth(4, 300);
  }

  sheet.appendRow([new Date(), storeId, message || '', imageUrl || '']);
  console.log(`[appendNewsLog] store=${storeId} msg="${message}" img="${imageUrl}"`);
}

// ============================================================
// LINE Reply API
// ============================================================

function replyText(replyToken, text) {
  if (!replyToken) return;

  const payload = {
    replyToken: replyToken,
    messages: [{ type: 'text', text: text }]
  };

  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
    },
    payload:           JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

// ============================================================
// メッセージテンプレート
// ============================================================

function buildMyIdMessage(userId) {
  const storeId = lookupStoreId(userId);
  let msg = `🆔 あなたのLINEユーザーID\n\n${userId}\n\n`;

  if (storeId) {
    msg += `✅ 登録済み：${storeId}`;
  } else {
    msg += `📝 まだ登録されていません。\n「登録 [store_id]」と送信して登録してください。\n例：登録 store_001`;
  }
  return msg;
}

function buildUnknownUserMessage(userId) {
  return `👋 こんにちは！\n\nあなたはまだ登録されていません。\n\n` +
    `あなたのID：${userId}\n\n` +
    `「登録 [store_id]」と送信すると\nマップに投稿できるようになります。\n\n` +
    `詳しくは「ヘルプ」と送信してください。`;
}

function buildHelpMessage() {
  let msg =
    `📖 コマンド一覧\n\n` +
    `マイID　　　→ 自分のLINE IDを確認\n` +
    `登録 [id]　 → store_idとして登録\n` +
    `登録確認　　→ 登録状況を確認\n` +
    `登録解除　　→ 登録を削除\n\n` +
    `登録後はテキストや写真を送るだけでマップに反映されます🗺️\n\n` +
    `テキストは${MAX_MESSAGE_LENGTH}文字以内`;

  if (REGISTRATION_PASSWORD) {
    msg += `\n\n🔒 パスワードが必要です\n例：登録 store_001 パスワード`;
  }
  return msg;
}

// ============================================================
// ユーティリティ
// ============================================================

function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

// ============================================================
// 初期セットアップ（GASエディタから1回だけ実行）
// ============================================================

/**
 * ★ 最初に一度だけ実行してください ★
 *
 * news_log と user_map シートを自動作成します。
 * すでに存在する場合はスキップされます。
 */
function setupSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // news_log シート
  if (!ss.getSheetByName(NEWS_LOG_SHEET_NAME)) {
    const s = ss.insertSheet(NEWS_LOG_SHEET_NAME);
    s.appendRow(['timestamp', 'store_id', 'message', 'image_url']);
    s.setFrozenRows(1);
    s.getRange('A1:D1').setBackground('#FF3B6B').setFontColor('#FFFFFF').setFontWeight('bold');
    s.setColumnWidth(1, 160); s.setColumnWidth(2, 130);
    s.setColumnWidth(3, 250); s.setColumnWidth(4, 300);
    console.log('✅ news_log シート作成完了');
  } else {
    console.log('ℹ️ news_log はすでに存在します');
  }

  // pending_posts シート
  if (!ss.getSheetByName(PENDING_SHEET_NAME)) {
    const s = ss.insertSheet(PENDING_SHEET_NAME);
    s.appendRow(['userId', 'store_id', 'message', 'saved_at']);
    s.setFrozenRows(1);
    s.getRange('A1:D1').setBackground('#FFA000').setFontColor('#FFFFFF').setFontWeight('bold');
    console.log('✅ pending_posts シート作成完了');
  } else {
    console.log('ℹ️ pending_posts はすでに存在します');
  }

  // user_map シート
  if (!ss.getSheetByName(USER_MAP_SHEET_NAME)) {
    const s = ss.insertSheet(USER_MAP_SHEET_NAME);
    s.appendRow(['userId', 'store_id', 'registered_at']);
    s.setFrozenRows(1);
    s.getRange('A1:C1').setBackground('#4A90D9').setFontColor('#FFFFFF').setFontWeight('bold');
    s.setColumnWidth(1, 250); s.setColumnWidth(2, 130); s.setColumnWidth(3, 160);
    console.log('✅ user_map シート作成完了');
  } else {
    console.log('ℹ️ user_map はすでに存在します');
  }

  console.log('✅ セットアップ完了！次はデプロイしてWebhook URLをLINEに設定してください。');
}

// ============================================================
// デバッグ用テスト関数（GASエディタから実行）
// ============================================================

/** news_logへのテスト書き込み */
function testAppend() {
  appendNewsLog('store_001', '🧪 テスト投稿', '');
  console.log('testAppend 完了');
}

/** user_mapへのテスト登録 */
function testRegister() {
  saveUserToMap('U_TEST_USER_ID', 'store_001');
  const result = lookupStoreId('U_TEST_USER_ID');
  console.log('testRegister 結果:', result);
}

/** 登録状況の確認 */
function testListUsers() {
  const rows = getAllUserMapRows();
  console.log('登録ユーザー数:', rows.length);
  rows.forEach(r => console.log(r));
}
