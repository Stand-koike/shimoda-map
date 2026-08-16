/**
 * 災害時モード — 指定緊急避難場所 / 指定避難所
 *
 * 店舗ピン・LIVE・祭スケジュールを隠し、避難施設を表示する。
 * データ優先順: Google Sheets (gviz) → public/data/disaster_evac.json
 *
 * App.init から DisasterMode.init({ State, CONFIG, MapModule, LayerManager, UIModule, App }) を呼ぶ。
 * ver.1 の通常モードは enter/exit で完全に復元する。
 */
(function (global) {
    'use strict';

    var HAZARD_META = [
        { key: '洪水', label: '洪水', color: '#1565C0' },
        { key: '土砂', label: '土砂', color: '#6D4C41' },
        { key: '高潮', label: '高潮', color: '#0277BD' },
        { key: '地震', label: '地震', color: '#EF6C00' },
        { key: '津波', label: '津波', color: '#00838F' },
        { key: '火災', label: '火災', color: '#C62828' },
        { key: '内水', label: '内水', color: '#4527A0' },
        { key: '火山', label: '火山', color: '#AD1457' }
    ];

    var DISASTER_BOUNDS = [[138.86, 34.63], [138.99, 34.77]];

    /** 静岡県津波浸水想定（GSI ハザードマップタイル・下田市と同系統の県公表想定） */
    var TSUNAMI_TILE_URL =
        'https://disaportaldata.gsi.go.jp/raster/04_tsunami_newlegend_pref_data/22/{z}/{x}/{y}.png';
    var TSUNAMI_LEGEND = [
        { label: '0.3m未満', color: '#FFFFB3' },
        { label: '0.3〜0.5m', color: '#FFFF00' },
        { label: '0.5〜1m', color: '#BFFF00' },
        { label: '1〜3m', color: '#00FF00' },
        { label: '3〜5m', color: '#00BFFF' },
        { label: '5〜10m', color: '#0000FF' },
        { label: '10〜20m', color: '#FF00FF' },
        { label: '20m以上', color: '#800080' }
    ];

    var DisasterMode = {
        _deps: null,
        active: false,
        places: [],
        shelters: [],
        aed: [],
        _markers: [],
        _hazardFilter: null,
        _typeFilter: 'all',
        _tsunamiLayerOn: false,
        _savedLayers: null,
        _savedCamera: null,
        _illustrationPaused: false,
        _selectedId: null,
        _loadAttempted: false,

        init: function (deps) {
            this._deps = deps;
            this._injectUI();
            this._bindHooks();
            this._loadData();
            if (new URLSearchParams(location.search).get('disaster') === '1') {
                var self = this;
                var tries = 0;
                var wait = function () {
                    tries += 1;
                    if (self._deps.MapModule && self._deps.MapModule._map && self._deps.MapModule._loaded) {
                        self.enter();
                        return;
                    }
                    if (tries < 40) setTimeout(wait, 250);
                    else self.enter();
                };
                setTimeout(wait, 400);
            }
        },

        isActive: function () {
            return !!this.active;
        },

        toggle: function () {
            if (this.active) this.exit();
            else this.enter();
        },

        enter: function () {
            if (this.active) return;
            var deps = this._deps;
            if (!deps || !deps.MapModule || !deps.MapModule._map) {
                console.warn('[DisasterMode] map 未準備');
                return;
            }
            this.active = true;
            document.body.classList.add('disaster-mode');

            var LayerManager = deps.LayerManager;
            this._savedLayers = {};
            Object.keys(LayerManager.getDefs()).forEach(function (id) {
                this._savedLayers[id] = !!LayerManager.getDefs()[id].visible;
            }, this);

            ['spots', 'events', 'mikoshi', 'routes', 'areas'].forEach(function (id) {
                var def = LayerManager.getDefs()[id];
                if (def && def.visible) LayerManager.toggle(id);
            });

            this._pauseIllustrationAndShowBase();
            this._ensureTsunamiOverlay();
            this._expandMapForDisaster();
            this._renderAll();
            this._syncToggleUI();
            this._showBanner(true);
            this._syncTsunamiUI();
            var loading = document.getElementById('loading');
            if (loading) loading.style.display = 'none';
            try {
                if (typeof gtag === 'function') gtag('event', 'disaster_mode', { action: 'enter' });
            } catch (e) { /* ignore */ }
        },

        exit: function () {
            if (!this.active) return;
            var deps = this._deps;
            this.active = false;
            document.body.classList.remove('disaster-mode');
            this._setTsunamiLayerVisible(false);
            this._tsunamiLayerOn = false;
            this.closeTsunamiInfo(null, true);
            this._clearMarkers();
            this._selectedId = null;
            this._restoreMapFromDisaster();
            this._resumeIllustration();

            var LayerManager = deps.LayerManager;
            if (this._savedLayers) {
                Object.keys(this._savedLayers).forEach(function (id) {
                    var def = LayerManager.getDefs()[id];
                    if (!def) return;
                    if (def.visible !== this._savedLayers[id]) LayerManager.toggle(id);
                }, this);
            }
            this._savedLayers = null;

            this._showBanner(false);
            this._syncToggleUI();
            deps.App._refreshUI();
            try {
                if (typeof gtag === 'function') gtag('event', 'disaster_mode', { action: 'exit' });
            } catch (e) { /* ignore */ }
        },

        /** App._applyFilters の先頭で呼ぶ。true なら店舗描画をスキップ */
        interceptFilters: function () {
            if (!this.active) return false;
            this._renderAll();
            return true;
        },

        /** イラスト昼夜切替の上書きを抑制 */
        shouldSkipIllustrationPhase: function () {
            return this.active && this._illustrationPaused;
        },

        setTypeFilter: function (type) {
            this._typeFilter = type || 'all';
            this._renderAll();
            this._syncFilterChips();
        },

        setHazardFilter: function (key) {
            this._hazardFilter = key || null;
            if (this._hazardFilter === '津波') {
                this._setTsunamiLayerVisible(true);
            }
            this._renderAll();
            this._syncFilterChips();
            this._syncTsunamiUI();
        },

        toggleTsunamiLayer: function () {
            if (!this.active) return;
            this._setTsunamiLayerVisible(!this._tsunamiLayerOn);
        },

        openTsunamiInfo: function () {
            var overlay = document.getElementById('disaster-tsunami-info-overlay');
            if (overlay) overlay.classList.add('open');
        },

        closeTsunamiInfo: function (e, force) {
            if (e && e.target && e.target.id !== 'disaster-tsunami-info-overlay' && !force) return;
            var overlay = document.getElementById('disaster-tsunami-info-overlay');
            if (overlay) overlay.classList.remove('open');
        },

        selectFacility: function (fac) {
            if (!fac) return;
            var deps = this._deps;
            this._selectedId = fac.id;
            this._highlightCards();
            this._highlightMarkers();
            if (deps.UIModule && deps.UIModule.expandCardsSheetIfCollapsed) {
                deps.UIModule.expandCardsSheetIfCollapsed();
            }
            if (Number.isFinite(fac.lat) && Number.isFinite(fac.lng) && deps.MapModule._map) {
                deps.MapModule._map.flyTo({
                    center: [fac.lng, fac.lat],
                    zoom: Math.max(deps.MapModule._map.getZoom(), 15.2),
                    speed: 0.9,
                    essential: true
                });
            }
            this.openDetail(fac);
        },

        openDetail: function (fac) {
            var overlay = document.getElementById('disaster-detail-overlay');
            if (!overlay || !fac) return;
            var lang = (this._deps.State && this._deps.State.language) || 'ja';
            var isPlace = fac.kind === 'place';
            var isAed = fac.kind === 'aed';
            var kindLabel = isAed
                ? (lang === 'ja' ? 'AED設置場所' : 'AED')
                : isPlace
                    ? (lang === 'ja' ? '指定緊急避難場所' : 'Emergency Evacuation Site')
                    : (lang === 'ja' ? '指定避難所' : 'Evacuation Shelter');

            document.getElementById('disaster-detail-kind').textContent = kindLabel;
            document.getElementById('disaster-detail-kind').className =
                'disaster-detail-kind ' + (isAed ? 'is-aed' : (isPlace ? 'is-place' : 'is-shelter'));
            document.getElementById('disaster-detail-title').textContent = fac.name || '';
            document.getElementById('disaster-detail-address').textContent = fac.address || '—';

            var phoneEl = document.getElementById('disaster-detail-phone');
            var phoneWrap = document.getElementById('disaster-detail-phone-wrap');
            if (fac.phone) {
                phoneWrap.style.display = 'flex';
                phoneEl.textContent = fac.phone;
                var tel = String(fac.phone).replace(/[^\d+]/g, '');
                if (tel.length >= 8) {
                    phoneEl.href = 'tel:' + tel;
                    phoneEl.style.pointerEvents = 'auto';
                } else {
                    phoneEl.removeAttribute('href');
                    phoneEl.style.pointerEvents = 'none';
                }
            } else {
                phoneWrap.style.display = 'none';
            }

            var hazWrap = document.getElementById('disaster-detail-hazards');
            hazWrap.innerHTML = '';
            if (isPlace && fac.hazards && fac.hazards.length) {
                fac.hazards.forEach(function (h) {
                    var meta = HAZARD_META.find(function (m) { return m.key === h; });
                    var chip = document.createElement('span');
                    chip.className = 'disaster-hazard-chip';
                    chip.style.background = (meta && meta.color) || '#546E7A';
                    chip.textContent = h;
                    hazWrap.appendChild(chip);
                });
                hazWrap.style.display = 'flex';
            } else {
                hazWrap.style.display = 'none';
            }

            var notesEl = document.getElementById('disaster-detail-notes');
            var notes = isAed ? (fac.source || '') : (fac.notes || fac.capacity || '');
            if (isAed && fac.detailUrl) {
                notes = (notes ? notes + '\n' : '') + fac.detailUrl;
            }
            if (notes) {
                notesEl.style.display = 'block';
                if (isAed && fac.detailUrl) {
                    notesEl.innerHTML = (fac.source ? escapeText(fac.source) + '<br>' : '') +
                        '<a href="' + escapeText(fac.detailUrl) + '" target="_blank" rel="noopener">' +
                        escapeText(fac.detailUrl) + '</a>';
                } else {
                    notesEl.textContent = notes;
                }
            } else {
                notesEl.style.display = 'none';
            }

            var sourceEl = document.getElementById('disaster-detail-source');
            if (sourceEl) {
                sourceEl.textContent = isAed
                    ? (lang === 'ja' ? '出典: いつもNAVI（ゼンリンデータコム）' : 'Source: ZENRIN / its-mo.com')
                    : (lang === 'ja' ? '出典: 下田市 令和6年4月1日現在' : 'Source: Shimoda City (Apr 2024)');
            }

            var nav = document.getElementById('disaster-detail-nav');
            if (Number.isFinite(fac.lat) && Number.isFinite(fac.lng)) {
                nav.href = 'https://www.google.com/maps/dir/?api=1&destination=' +
                    encodeURIComponent(fac.lat + ',' + fac.lng);
                nav.style.display = 'flex';
            } else {
                nav.style.display = 'none';
            }

            overlay.classList.add('open');
        },

        closeDetail: function (e, force) {
            if (force || (e && e.target && e.target.id === 'disaster-detail-overlay')) {
                var overlay = document.getElementById('disaster-detail-overlay');
                if (overlay) overlay.classList.remove('open');
            }
        },

        // ---- data ----

        _loadData: function () {
            if (this._loadAttempted) return;
            this._loadAttempted = true;
            var self = this;
            this._fetchSheets()
                .then(function () {
                    var tasks = [];
                    if (self.places.length === 0 && self.shelters.length === 0) {
                        tasks.push(self._fetchLocalEvacJson());
                    }
                    if (self.aed.length === 0) {
                        tasks.push(self._fetchLocalAedJson());
                    }
                    if (!tasks.length) return null;
                    return Promise.all(tasks);
                })
                .catch(function () {
                    return Promise.all([
                        self._fetchLocalEvacJson(),
                        self._fetchLocalAedJson()
                    ]);
                })
                .then(function () {
                    if (self.active) self._renderAll();
                });
        },

        _fetchSheets: function () {
            var self = this;
            var CONFIG = this._deps.CONFIG;
            if (!CONFIG.SHEET_ID || /YOUR_GOOGLE_SHEET_ID/i.test(CONFIG.SHEET_ID)) {
                return Promise.resolve(false);
            }
            var placesName = CONFIG.EVAC_PLACES_SHEET || 'evacuation_places';
            var sheltersName = CONFIG.EVAC_SHELTERS_SHEET || 'evacuation_shelters';
            var aedName = CONFIG.AED_SHEET || 'aed_locations';

            return Promise.all([
                this._gvizSheet(placesName),
                this._gvizSheet(sheltersName),
                this._gvizSheet(aedName)
            ]).then(function (triple) {
                var placeRows = triple[0];
                var shelterRows = triple[1];
                var aedRows = triple[2];
                if (placeRows && self._isEvacPlacesTable(placeRows)) {
                    self.places = self._parsePlaceRows(placeRows);
                }
                if (shelterRows && self._isEvacSheltersTable(shelterRows)) {
                    self.shelters = self._parseShelterRows(shelterRows);
                }
                if (aedRows && self._isAedTable(aedRows)) {
                    self.aed = self._parseAedRows(aedRows);
                }
                return self.places.length > 0 || self.shelters.length > 0 || self.aed.length > 0;
            }).catch(function (err) {
                console.warn('[DisasterMode] sheets 取得失敗', err);
                return false;
            });
        },

        _colLabel: function (table, i) {
            var cols = table && table.cols;
            if (!cols || !cols[i]) return '';
            return String(cols[i].label || cols[i].id || '').trim().toLowerCase();
        },

        _isEvacPlacesTable: function (table) {
            // id, no, name, lat, lng ...（店舗マスタの _reserved/name と区別）
            var a = this._colLabel(table, 0);
            var c = this._colLabel(table, 2);
            var d = this._colLabel(table, 3);
            return a === 'id' && c === 'name' && (d === 'lat' || d === 'latitude');
        },

        _isEvacSheltersTable: function (table) {
            return this._isEvacPlacesTable(table);
        },

        _isAedTable: function (table) {
            var a = this._colLabel(table, 0);
            var c = this._colLabel(table, 2);
            var g = this._colLabel(table, 6);
            return a === 'id' && c === 'name' && g === 'category';
        },

        _gvizSheet: function (sheetName) {
            var CONFIG = this._deps.CONFIG;
            var cbName = '_gvizDisaster_' + sheetName.replace(/\W/g, '_');
            return new Promise(function (resolve) {
                var timeout = setTimeout(function () {
                    cleanup();
                    resolve(null);
                }, 12000);

                function cleanup() {
                    clearTimeout(timeout);
                    try { delete global[cbName]; } catch (e) { global[cbName] = undefined; }
                    var old = document.getElementById('gviz-disaster-' + sheetName);
                    if (old) old.remove();
                }

                global[cbName] = function (json) {
                    cleanup();
                    try {
                        var table = json && json.table;
                        resolve(table || null);
                    } catch (e) {
                        resolve(null);
                    }
                };

                var script = document.createElement('script');
                script.id = 'gviz-disaster-' + sheetName;
                script.src = 'https://docs.google.com/spreadsheets/d/' + CONFIG.SHEET_ID +
                    '/gviz/tq?tqx=responseHandler:' + cbName +
                    '&sheet=' + encodeURIComponent(sheetName) +
                    '&_=' + Date.now();
                script.onerror = function () {
                    cleanup();
                    resolve(null);
                };
                document.body.appendChild(script);
            });
        },

        _cell: function (row, i) {
            if (!row || !row.c || !row.c[i]) return '';
            var v = row.c[i].v;
            return v == null ? '' : v;
        },

        _parsePlaceRows: function (table) {
            var rows = table.rows || [];
            var out = [];
            var self = this;
            rows.forEach(function (row) {
                var id = String(self._cell(row, 0) || '').trim();
                var name = String(self._cell(row, 2) || '').trim();
                var lat = Number(self._cell(row, 3));
                var lng = Number(self._cell(row, 4));
                var hidden = self._cell(row, 10);
                if (hidden === false || hidden === 'FALSE' || hidden === 'false') return;
                if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
                var hazardsRaw = String(self._cell(row, 7) || '');
                var hazards = hazardsRaw.split(/[,、/|]/).map(function (s) { return s.trim(); }).filter(Boolean);
                out.push({
                    id: id || ('ep-' + out.length),
                    no: self._cell(row, 1),
                    name: name,
                    lat: lat,
                    lng: lng,
                    address: String(self._cell(row, 5) || ''),
                    phone: String(self._cell(row, 6) || ''),
                    hazards: hazards,
                    capacity: String(self._cell(row, 8) || ''),
                    notes: String(self._cell(row, 9) || ''),
                    kind: 'place'
                });
            });
            return out;
        },

        _parseShelterRows: function (table) {
            var rows = table.rows || [];
            var out = [];
            var self = this;
            rows.forEach(function (row) {
                var id = String(self._cell(row, 0) || '').trim();
                var name = String(self._cell(row, 2) || '').trim();
                var lat = Number(self._cell(row, 3));
                var lng = Number(self._cell(row, 4));
                var hidden = self._cell(row, 8);
                if (hidden === false || hidden === 'FALSE' || hidden === 'false') return;
                if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
                out.push({
                    id: id || ('es-' + out.length),
                    no: self._cell(row, 1),
                    name: name,
                    lat: lat,
                    lng: lng,
                    address: String(self._cell(row, 5) || ''),
                    phone: String(self._cell(row, 6) || ''),
                    notes: String(self._cell(row, 7) || ''),
                    hazards: [],
                    kind: 'shelter'
                });
            });
            return out;
        },

        _parseAedRows: function (table) {
            var rows = table.rows || [];
            var out = [];
            var self = this;
            rows.forEach(function (row) {
                var id = String(self._cell(row, 0) || '').trim();
                var name = String(self._cell(row, 2) || '').trim();
                var lat = Number(self._cell(row, 3));
                var lng = Number(self._cell(row, 4));
                var hidden = self._cell(row, 9);
                if (hidden === false || hidden === 'FALSE' || hidden === 'false') return;
                if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
                out.push({
                    id: id || ('aed-' + out.length),
                    no: self._cell(row, 1),
                    name: name,
                    lat: lat,
                    lng: lng,
                    address: String(self._cell(row, 5) || ''),
                    category: String(self._cell(row, 6) || 'AED設置場所'),
                    source: String(self._cell(row, 7) || ''),
                    detailUrl: String(self._cell(row, 8) || ''),
                    hazards: [],
                    kind: 'aed'
                });
            });
            return out;
        },

        _fetchLocalEvacJson: function () {
            var self = this;
            return fetch('public/data/disaster_evac.json?_=' + Date.now(), { cache: 'no-store' })
                .then(function (r) {
                    if (!r.ok) throw new Error('local json ' + r.status);
                    return r.json();
                })
                .then(function (data) {
                    self.places = (data.places || []).map(function (p) {
                        return Object.assign({}, p, { kind: 'place' });
                    });
                    self.shelters = (data.shelters || []).map(function (s) {
                        return Object.assign({}, s, { kind: 'shelter' });
                    });
                    return true;
                })
                .catch(function (err) {
                    console.warn('[DisasterMode] local evac JSON 失敗', err);
                    return false;
                });
        },

        _fetchLocalAedJson: function () {
            var self = this;
            if (self.aed.length > 0) return Promise.resolve(true);
            return fetch('public/data/disaster_aed.json?_=' + Date.now(), { cache: 'no-store' })
                .then(function (r) {
                    if (!r.ok) throw new Error('local aed json ' + r.status);
                    return r.json();
                })
                .then(function (data) {
                    self.aed = (data.aed || []).map(function (a) {
                        return Object.assign({}, a, { kind: 'aed' });
                    });
                    return self.aed.length > 0;
                })
                .catch(function (err) {
                    console.warn('[DisasterMode] local AED JSON 失敗', err);
                    return false;
                });
        },

        /** @deprecated 互換用 */
        _fetchLocalJson: function () {
            var self = this;
            return Promise.all([
                self._fetchLocalEvacJson(),
                self._fetchLocalAedJson()
            ]).then(function () { return true; });
        },

        // ---- map visuals ----

        _pauseIllustrationAndShowBase: function () {
            var map = this._deps.MapModule._map;
            var MapModule = this._deps.MapModule;
            var self = this;
            this._illustrationPaused = true;
            if (MapModule._illustrationTimer) {
                clearInterval(MapModule._illustrationTimer);
                MapModule._illustrationTimer = null;
            }

            // 国土地理院タイル（トークン不要・国内災害用途向き）。Mapbox ラスターは URL/権限差で落ちやすい。
            if (!map.getSource('disaster-basemap')) {
                try {
                    map.addSource('disaster-basemap', {
                        type: 'raster',
                        tiles: [
                            'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'
                        ],
                        tileSize: 256,
                        attribution: '© 国土地理院',
                        maxzoom: 18
                    });
                    map.addLayer({
                        id: 'disaster-basemap-layer',
                        type: 'raster',
                        source: 'disaster-basemap',
                        paint: { 'raster-opacity': 1 }
                    }, this._layerBeforeId());
                } catch (e) {
                    console.warn('[DisasterMode] basemap layer', e);
                }
            } else if (map.getLayer('disaster-basemap-layer')) {
                try {
                    map.setLayoutProperty('disaster-basemap-layer', 'visibility', 'visible');
                    map.setPaintProperty('disaster-basemap-layer', 'raster-opacity', 1);
                } catch (e) { /* ignore */ }
            }

            this._hideIllustrationLayers();
            try {
                if (map.getLayer('illustration-sky-bg')) {
                    map.setPaintProperty('illustration-sky-bg', 'background-color', '#E8EEF2');
                }
            } catch (e) { /* ignore */ }

            // イラストが遅延追加されても覆い隠さないよう再適用
            if (!this._basemapWatchBound) {
                this._basemapWatchBound = function () {
                    if (!self.active) return;
                    self._hideIllustrationLayers();
                    self._ensureBasemapOnBottom();
                };
                map.on('sourcedata', this._basemapWatchBound);
                map.on('styledata', this._basemapWatchBound);
            }
            setTimeout(function () {
                if (self.active) {
                    self._hideIllustrationLayers();
                    self._ensureDisasterRasterOrder();
                }
            }, 1200);
        },

        _ensureTsunamiOverlay: function () {
            var map = this._deps.MapModule._map;
            if (!map) return;
            try {
                if (!map.getSource('disaster-tsunami')) {
                    map.addSource('disaster-tsunami', {
                        type: 'raster',
                        tiles: [TSUNAMI_TILE_URL],
                        tileSize: 256,
                        attribution: '© 国土地理院 ハザードマップポータルサイト',
                        maxzoom: 17
                    });
                }
                if (!map.getLayer('disaster-tsunami-layer')) {
                    map.addLayer({
                        id: 'disaster-tsunami-layer',
                        type: 'raster',
                        source: 'disaster-tsunami',
                        paint: { 'raster-opacity': 0.58 },
                        layout: { visibility: 'none' }
                    });
                }
                this._ensureDisasterRasterOrder();
                this._setTsunamiLayerVisible(this._tsunamiLayerOn);
            } catch (e) {
                console.warn('[DisasterMode] tsunami overlay', e);
            }
        },

        _setTsunamiLayerVisible: function (visible) {
            var map = this._deps && this._deps.MapModule && this._deps.MapModule._map;
            if (!map || !map.getLayer('disaster-tsunami-layer')) {
                this._tsunamiLayerOn = !!visible;
                return;
            }
            this._tsunamiLayerOn = !!visible;
            try {
                map.setLayoutProperty(
                    'disaster-tsunami-layer',
                    'visibility',
                    this._tsunamiLayerOn ? 'visible' : 'none'
                );
            } catch (e) { /* ignore */ }
            this._syncTsunamiUI();
        },

        _syncTsunamiUI: function () {
            var btn = document.getElementById('disaster-tsunami-toggle');
            if (btn) {
                btn.classList.toggle('active', this._tsunamiLayerOn);
                btn.setAttribute('aria-pressed', this._tsunamiLayerOn ? 'true' : 'false');
                btn.title = this._tsunamiLayerOn ? '津波浸水域を非表示' : '津波浸水域を表示';
                btn.setAttribute('aria-label', btn.title);
            }
        },

        _layerBeforeId: function () {
            var map = this._deps.MapModule._map;
            var candidates = [
                'illustration-map-layer-day',
                'illustration-map-layer-sunset',
                'illustration-map-layer-night'
            ];
            for (var i = 0; i < candidates.length; i++) {
                if (map.getLayer(candidates[i])) return candidates[i];
            }
            return undefined;
        },

        _hideIllustrationLayers: function () {
            var map = this._deps.MapModule._map;
            if (!map) return;
            ['day', 'sunset', 'night'].forEach(function (key) {
                var lid = 'illustration-map-layer-' + key;
                if (!map.getLayer(lid)) return;
                try {
                    map.setPaintProperty(lid, 'raster-opacity', 0);
                    map.setLayoutProperty(lid, 'visibility', 'none');
                } catch (e) { /* ignore */ }
            });
        },

        _ensureDisasterRasterOrder: function () {
            var map = this._deps.MapModule._map;
            if (!map) return;
            try {
                if (map.getLayer('disaster-basemap-layer')) {
                    map.setLayoutProperty('disaster-basemap-layer', 'visibility', 'visible');
                    if (map.getLayer('illustration-sky-bg')) {
                        map.moveLayer('disaster-basemap-layer', this._layerBeforeId());
                    }
                }
                if (map.getLayer('disaster-basemap-layer') && map.getLayer('disaster-tsunami-layer')) {
                    map.moveLayer('disaster-basemap-layer', 'disaster-tsunami-layer');
                }
            } catch (e) { /* ignore */ }
        },

        /** @deprecated 互換用 */
        _ensureBasemapOnBottom: function () {
            this._ensureDisasterRasterOrder();
        },

        _resumeIllustration: function () {
            var map = this._deps.MapModule._map;
            var MapModule = this._deps.MapModule;
            this._illustrationPaused = false;

            if (this._basemapWatchBound && map) {
                try {
                    map.off('sourcedata', this._basemapWatchBound);
                    map.off('styledata', this._basemapWatchBound);
                } catch (e) { /* ignore */ }
                this._basemapWatchBound = null;
            }

            if (map.getLayer('disaster-basemap-layer')) {
                try { map.setLayoutProperty('disaster-basemap-layer', 'visibility', 'none'); } catch (e) { /* ignore */ }
            }
            if (map.getLayer('disaster-tsunami-layer')) {
                try { map.setLayoutProperty('disaster-tsunami-layer', 'visibility', 'none'); } catch (e) { /* ignore */ }
            }
            ['day', 'sunset', 'night'].forEach(function (key) {
                var lid = 'illustration-map-layer-' + key;
                if (!map.getLayer(lid)) return;
                try { map.setLayoutProperty(lid, 'visibility', 'visible'); } catch (e) { /* ignore */ }
            });
            try {
                if (map.getLayer('illustration-sky-bg')) {
                    map.setPaintProperty('illustration-sky-bg', 'background-color', '#A8D8E8');
                }
            } catch (e) { /* ignore */ }

            if (typeof MapModule._applyIllustrationTimePhase === 'function') {
                MapModule._applyIllustrationTimePhase();
            }
            if (!MapModule._illustrationTimer && typeof MapModule._scheduleIllustrationPhase === 'function') {
                MapModule._scheduleIllustrationPhase();
            }
        },

        _expandMapForDisaster: function () {
            var map = this._deps.MapModule._map;
            var cfg = this._deps.CONFIG.MAP_IMAGE || {};
            this._savedCamera = {
                center: map.getCenter().toArray(),
                zoom: map.getZoom(),
                bearing: map.getBearing(),
                pitch: map.getPitch(),
                maxBounds: cfg.maxBounds || null,
                minZoom: cfg.minZoom
            };
            try {
                map.setMaxBounds(null);
                map.setMinZoom(11);
                map.setMaxBounds(DISASTER_BOUNDS);
                map.easeTo({ bearing: 0, pitch: 0, duration: 600 });
            } catch (e) {
                console.warn('[DisasterMode] camera', e);
            }
        },

        _restoreMapFromDisaster: function () {
            var map = this._deps.MapModule._map;
            var cfg = this._deps.CONFIG.MAP_IMAGE || {};
            var saved = this._savedCamera;
            try {
                map.setMaxBounds(null);
                if (cfg.minZoom != null) map.setMinZoom(cfg.minZoom);
                if (cfg.maxBounds) map.setMaxBounds(cfg.maxBounds);
                if (saved) {
                    map.easeTo({
                        center: saved.center,
                        zoom: saved.zoom,
                        bearing: saved.bearing,
                        pitch: saved.pitch,
                        duration: 700
                    });
                }
            } catch (e) {
                console.warn('[DisasterMode] restore camera', e);
            }
            this._savedCamera = null;
        },

        // ---- render ----

        _filtered: function () {
            var self = this;
            var list = [];
            if (this._typeFilter === 'all' || this._typeFilter === 'place') {
                list = list.concat(this.places);
            }
            if (this._typeFilter === 'all' || this._typeFilter === 'shelter') {
                list = list.concat(this.shelters);
            }
            if (this._typeFilter === 'all' || this._typeFilter === 'aed') {
                list = list.concat(this.aed);
            }
            if (this._hazardFilter) {
                list = list.filter(function (f) {
                    if (f.kind === 'aed') return true;
                    if (f.kind === 'shelter') {
                        // 避難所は備考の「〜を除く」で除外判定
                        return !self._shelterExcludedFor(f, self._hazardFilter);
                    }
                    return (f.hazards || []).indexOf(self._hazardFilter) >= 0;
                });
            }
            return list;
        },

        _shelterExcludedFor: function (fac, hazardKey) {
            var notes = String(fac.notes || '');
            if (hazardKey === '津波' && /津波/.test(notes) && /除く/.test(notes)) return true;
            if (hazardKey === '洪水' && /洪水/.test(notes) && /除く/.test(notes)) return true;
            if (hazardKey === '土砂' && /土砂/.test(notes) && /除く/.test(notes)) return true;
            return false;
        },

        _renderAll: function () {
            if (!this.active) return;
            var list = this._filtered();
            this._renderMarkers(list);
            this._renderCards(list);
            this._syncFilterChips();
            var countEl = document.getElementById('disaster-count');
            if (countEl) {
                countEl.textContent = String(list.length);
            }
        },

        _clearMarkers: function () {
            this._markers.forEach(function (m) { try { m.remove(); } catch (e) { /* ignore */ } });
            this._markers = [];
        },

        _renderMarkers: function (list) {
            var self = this;
            var map = this._deps.MapModule._map;
            this._clearMarkers();
            if (!map || typeof mapboxgl === 'undefined') return;

            list.forEach(function (fac) {
                if (!Number.isFinite(fac.lat) || !Number.isFinite(fac.lng)) return;
                var kindClass = fac.kind === 'aed' ? ' is-aed'
                    : (fac.kind === 'place' ? ' is-place' : ' is-shelter');
                var iconHtml = fac.kind === 'aed'
                    ? '<i class="fas fa-heart-pulse"></i>'
                    : (fac.kind === 'place'
                        ? '<i class="fas fa-person-running"></i>'
                        : '<i class="fas fa-house-chimney"></i>');
                var el = document.createElement('div');
                el.className = 'disaster-marker' + kindClass +
                    (self._selectedId === fac.id ? ' active' : '');
                el.title = fac.name;
                el.innerHTML =
                    '<div class="disaster-marker-inner">' +
                    '<span class="disaster-marker-icon">' + iconHtml + '</span></div>';
                el.addEventListener('click', function (e) {
                    e.stopPropagation();
                    self.selectFacility(fac);
                });
                var marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
                    .setLngLat([fac.lng, fac.lat])
                    .addTo(map);
                marker.__facilityId = fac.id;
                self._markers.push(marker);
            });
        },

        _highlightMarkers: function () {
            var self = this;
            this._markers.forEach(function (m) {
                var el = m.getElement();
                if (!el) return;
                el.classList.toggle('active', m.__facilityId === self._selectedId);
            });
        },

        _renderCards: function (list) {
            var container = document.getElementById('slide-panel');
            if (!container) return;
            container.innerHTML = '';
            var lang = (this._deps.State && this._deps.State.language) || 'ja';

            if (!list.length) {
                container.innerHTML = '<div class="disaster-empty">' +
                    (lang === 'ja' ? '条件に合う施設がありません' : 'No matching facilities') +
                    '</div>';
                return;
            }

            var self = this;
            list.forEach(function (fac) {
                var card = document.createElement('div');
                var cardKindClass = fac.kind === 'aed' ? ' is-aed'
                    : (fac.kind === 'place' ? ' is-place' : ' is-shelter');
                card.className = 'slide-card disaster-card' + cardKindClass +
                    (self._selectedId === fac.id ? ' active' : '');
                card.id = 'card-' + fac.id;
                card.onclick = function () { self.selectFacility(fac); };

                var kind = fac.kind === 'aed'
                    ? 'AED'
                    : fac.kind === 'place'
                        ? (lang === 'ja' ? '緊急避難場所' : 'Evac. site')
                        : (lang === 'ja' ? '避難所' : 'Shelter');

                var chips = '';
                if (fac.kind === 'place' && fac.hazards && fac.hazards.length) {
                    chips = '<div class="disaster-card-hazards">' +
                        fac.hazards.slice(0, 4).map(function (h) {
                            var meta = HAZARD_META.find(function (m) { return m.key === h; });
                            var bg = (meta && meta.color) || '#546E7A';
                            return '<span class="disaster-hazard-chip" style="background:' + bg + '">' + h + '</span>';
                        }).join('') +
                        (fac.hazards.length > 4
                            ? '<span class="disaster-hazard-more">+' + (fac.hazards.length - 4) + '</span>'
                            : '') +
                        '</div>';
                } else if (fac.kind === 'aed' && fac.source) {
                    chips = '<div class="disaster-card-notes">' + escapeText(fac.source) + '</div>';
                } else if (fac.notes) {
                    chips = '<div class="disaster-card-notes">' + escapeText(fac.notes) + '</div>';
                }

                card.innerHTML =
                    '<div class="disaster-card-badge">' + kind + '</div>' +
                    '<div class="card-info disaster-card-info">' +
                    '<div class="card-title">' + escapeText(fac.name) + '</div>' +
                    '<div class="disaster-card-addr"><i class="fas fa-map-marker-alt"></i> ' +
                    escapeText(fac.address || '') + '</div>' +
                    chips +
                    '</div>';
                container.appendChild(card);
            });
        },

        _highlightCards: function () {
            document.querySelectorAll('#slide-panel .disaster-card').forEach(function (c) {
                c.classList.toggle('active', c.id === 'card-' + DisasterMode._selectedId);
            });
            var target = document.getElementById('card-' + this._selectedId);
            var container = document.getElementById('slide-panel');
            if (!target || !container) return;
            var isPC = this._deps.State && this._deps.State.isPC;
            if (isPC) {
                container.scrollTo({ top: target.offsetTop - container.offsetTop, behavior: 'smooth' });
            } else {
                container.scrollTo({
                    left: target.offsetLeft - (container.clientWidth / 2) + (target.offsetWidth / 2),
                    behavior: 'smooth'
                });
            }
        },

        // ---- UI chrome ----

        _injectUI: function () {
            if (document.getElementById('tab-disaster')) return;

            var controls = document.getElementById('controls-container');
            if (controls) {
                var btn = document.createElement('button');
                btn.className = 'ctrl-btn disaster-toggle';
                btn.id = 'tab-disaster';
                btn.type = 'button';
                btn.setAttribute('aria-pressed', 'false');
                btn.innerHTML = '<i class="fas fa-house-flood-water"></i> <span id="disaster-btn-text">' +
                    (window.innerWidth < 768 ? '災害' : '災害時') + '</span>';
                btn.onclick = function () { DisasterMode.toggle(); };
                // 言語ボタンの前へ
                var langBtn = document.getElementById('tab-lang');
                if (langBtn) controls.insertBefore(btn, langBtn);
                else controls.appendChild(btn);

                // モバイルで災害時に隠す補助タブ（:has 非依存）
                ['tab-filter', 'tab-layer'].forEach(function (id) {
                    var el = document.getElementById(id);
                    var wrap = el && el.closest ? el.closest('.ctrl-panel-wrapper') : null;
                    if (wrap) wrap.classList.add('disaster-aux-tab');
                });
            }

            var banner = document.createElement('div');
            banner.id = 'disaster-banner';
            banner.className = 'disaster-banner';
            banner.innerHTML =
                '<div class="disaster-banner-main">' +
                '<strong>災害時モード</strong>' +
                '<span class="disaster-banner-sub">店舗非表示 · 避難施設・AED · <span id="disaster-count">0</span>件</span>' +
                '</div>' +
                '<div class="disaster-filters" id="disaster-filters">' +
                '<div class="disaster-filter-row" id="disaster-type-filters"></div>' +
                '<div class="disaster-filter-row" id="disaster-hazard-filters"></div>' +
                '</div>';
            document.body.appendChild(banner);

            var mapControls = document.querySelector('.map-controls');
            if (mapControls && !document.getElementById('disaster-tsunami-toggle')) {
                var infoBtn = document.createElement('button');
                infoBtn.type = 'button';
                infoBtn.id = 'disaster-tsunami-info-btn';
                infoBtn.className = 'btn-control btn-tsunami-info disaster-map-btn';
                infoBtn.title = '津波浸水域の凡例・出典';
                infoBtn.setAttribute('aria-label', '津波浸水域の凡例・出典');
                infoBtn.innerHTML = '<i class="fas fa-circle-info"></i>';
                infoBtn.onclick = function () { DisasterMode.openTsunamiInfo(); };

                var tsunamiBtn = document.createElement('button');
                tsunamiBtn.type = 'button';
                tsunamiBtn.id = 'disaster-tsunami-toggle';
                tsunamiBtn.className = 'btn-control btn-tsunami disaster-map-btn';
                tsunamiBtn.setAttribute('aria-pressed', 'false');
                tsunamiBtn.title = '津波浸水域を表示';
                tsunamiBtn.setAttribute('aria-label', '津波浸水域を表示');
                tsunamiBtn.innerHTML = '<i class="fas fa-water"></i>';
                tsunamiBtn.onclick = function () { DisasterMode.toggleTsunamiLayer(); };

                mapControls.insertBefore(infoBtn, mapControls.firstChild);
                mapControls.insertBefore(tsunamiBtn, mapControls.firstChild);
            }

            if (!document.getElementById('disaster-tsunami-info-overlay')) {
                var infoOverlay = document.createElement('div');
                infoOverlay.className = 'modal-overlay';
                infoOverlay.id = 'disaster-tsunami-info-overlay';
                infoOverlay.onclick = function (e) { DisasterMode.closeTsunamiInfo(e); };
                infoOverlay.innerHTML =
                    '<div class="modal-content disaster-tsunami-info-card" onclick="event.stopPropagation()">' +
                    '<button class="modal-close-btn" type="button" id="disaster-tsunami-info-close">' +
                    '<i class="fas fa-times"></i></button>' +
                    '<h3>津波浸水域</h3>' +
                    '<p class="disaster-tsunami-note">' +
                    '静岡県津波浸水想定（平成27年8月公表）。下田市ハザードマップと同系統の県公表想定です。' +
                    '市配布のハザードマップは基準水位（せり上がり込み）表示のため、浸水深の色分けは一致しない場合があります。' +
                    '</p>' +
                    '<div class="disaster-tsunami-legend" id="disaster-tsunami-legend"></div>' +
                    '<p class="disaster-tsunami-source">' +
                    '<a href="https://www.city.shimoda.shizuoka.jp/category/010500bousai_tishiki/120138.html" ' +
                    'target="_blank" rel="noopener">下田市津波ハザードマップ</a>' +
                    ' · <a href="https://disaportal.gsi.go.jp/hazardmap/copyright/opendata.html" ' +
                    'target="_blank" rel="noopener">出典：ハザードマップポータルサイト</a>' +
                    '</p></div>';
                document.body.appendChild(infoOverlay);
                document.getElementById('disaster-tsunami-info-close').onclick = function () {
                    DisasterMode.closeTsunamiInfo(null, true);
                };
            }

            var legendEl = document.getElementById('disaster-tsunami-legend');
            if (legendEl && !legendEl.innerHTML) {
                legendEl.innerHTML = TSUNAMI_LEGEND.map(function (item) {
                    return '<span class="disaster-tsunami-legend-item">' +
                        '<span class="disaster-tsunami-swatch" style="background:' + item.color + '"></span>' +
                        escapeText(item.label) + '</span>';
                }).join('');
            }

            var typeRow = document.getElementById('disaster-type-filters');
            [
                { id: 'all', label: 'すべて' },
                { id: 'place', label: '緊急避難場所' },
                { id: 'shelter', label: '避難所' },
                { id: 'aed', label: 'AED' }
            ].forEach(function (t) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'disaster-chip';
                b.dataset.type = t.id;
                b.textContent = t.label;
                b.onclick = function () { DisasterMode.setTypeFilter(t.id); };
                typeRow.appendChild(b);
            });

            var hazRow = document.getElementById('disaster-hazard-filters');
            var allHaz = document.createElement('button');
            allHaz.type = 'button';
            allHaz.className = 'disaster-chip';
            allHaz.dataset.hazard = '';
            allHaz.textContent = '災害種:すべて';
            allHaz.onclick = function () { DisasterMode.setHazardFilter(null); };
            hazRow.appendChild(allHaz);
            HAZARD_META.forEach(function (h) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'disaster-chip hazard';
                b.dataset.hazard = h.key;
                b.style.setProperty('--haz', h.color);
                b.textContent = h.label;
                b.onclick = function () { DisasterMode.setHazardFilter(h.key); };
                hazRow.appendChild(b);
            });

            var detail = document.createElement('div');
            detail.className = 'modal-overlay';
            detail.id = 'disaster-detail-overlay';
            detail.onclick = function (e) { DisasterMode.closeDetail(e); };
            detail.innerHTML =
                '<div class="modal-content disaster-detail-card" onclick="event.stopPropagation()">' +
                '<button class="modal-close-btn" type="button" id="disaster-detail-close">' +
                '<i class="fas fa-times"></i></button>' +
                '<div class="disaster-detail-body">' +
                '<span id="disaster-detail-kind" class="disaster-detail-kind"></span>' +
                '<h2 id="disaster-detail-title" class="modal-title"></h2>' +
                '<div class="disaster-detail-hazards" id="disaster-detail-hazards"></div>' +
                '<p class="disaster-detail-line"><i class="fas fa-map-marker-alt"></i> ' +
                '<span id="disaster-detail-address"></span></p>' +
                '<p class="disaster-detail-line" id="disaster-detail-phone-wrap">' +
                '<i class="fas fa-phone"></i> <a id="disaster-detail-phone" href="#"></a></p>' +
                '<p class="disaster-detail-notes" id="disaster-detail-notes"></p>' +
                '<p class="disaster-detail-source" id="disaster-detail-source">出典: 下田市 令和6年4月1日現在</p>' +
                '<a id="disaster-detail-nav" class="btn-nav-large" target="_blank" rel="noopener">' +
                '<i class="fas fa-location-arrow"></i> Google Mapsで経路</a>' +
                '</div></div>';
            document.body.appendChild(detail);
            document.getElementById('disaster-detail-close').onclick = function () {
                DisasterMode.closeDetail(null, true);
            };

            this._syncFilterChips();
        },

        _showBanner: function (show) {
            var banner = document.getElementById('disaster-banner');
            if (!banner) return;
            banner.classList.toggle('open', !!show);
        },

        _syncToggleUI: function () {
            var btn = document.getElementById('tab-disaster');
            if (!btn) return;
            btn.classList.toggle('active', this.active);
            btn.classList.toggle('tab-active', this.active);
            btn.setAttribute('aria-pressed', this.active ? 'true' : 'false');
            var text = document.getElementById('disaster-btn-text');
            if (text) {
                var narrow = typeof window !== 'undefined' && window.innerWidth < 768;
                if (this.active) text.textContent = narrow ? '災害ON' : '災害ON';
                else text.textContent = narrow ? '災害' : '災害時';
            }
        },

        _syncFilterChips: function () {
            document.querySelectorAll('#disaster-type-filters .disaster-chip').forEach(function (b) {
                b.classList.toggle('active', b.dataset.type === DisasterMode._typeFilter);
            });
            document.querySelectorAll('#disaster-hazard-filters .disaster-chip').forEach(function (b) {
                var key = b.dataset.hazard || null;
                var active = (key === null || key === '')
                    ? !DisasterMode._hazardFilter
                    : DisasterMode._hazardFilter === key;
                b.classList.toggle('active', active);
            });
        },

        _bindHooks: function () {
            // fitBounds を災害時は避難施設に合わせる
            var MapModule = this._deps.MapModule;
            var self = this;
            if (MapModule && !MapModule._disasterFitPatched) {
                var origFit = MapModule.fitBounds.bind(MapModule);
                MapModule.fitBounds = function () {
                    if (self.active) {
                        var list = self._filtered().filter(function (f) {
                            return Number.isFinite(f.lat) && Number.isFinite(f.lng);
                        });
                        if (!list.length || !MapModule._map) return;
                        var bounds = new mapboxgl.LngLatBounds();
                        list.forEach(function (f) { bounds.extend([f.lng, f.lat]); });
                        var isPC = self._deps.State && self._deps.State.isPC;
                        var padding = isPC
                            ? { top: 120, bottom: 80, left: 50, right: 50 }
                            : { top: 160, bottom: 260, left: 30, right: 30 };
                        MapModule._map.fitBounds(bounds, { padding: padding, duration: 800, maxZoom: 14.5 });
                        return;
                    }
                    return origFit();
                };
                MapModule._disasterFitPatched = true;
            }
        }
    };

    function escapeText(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    global.DisasterMode = DisasterMode;
})(typeof window !== 'undefined' ? window : this);
