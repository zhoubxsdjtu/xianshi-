
// main.js — 初始化 Cesium 并加载子目录 date/MySchool 中的 text1.glb
// 注意：为了本地测试你已提供 token（短期测试可放在此处，生产请用后端注入）
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0ODJlN2U2Mi05YzAzLTQ0YmQtYTJlNC05ZWI0ZjZmYTM3ODUiLCJpZCI6MzczMzQ2LCJpYXQiOjE3NjY5Nzk1NDB9.9046gchfT7XtrNrYkufmoG6g7DAdCfuGNdOPz3Owy5Q';

const viewer = new Cesium.Viewer('cesiumContainer', {
  baseLayerPicker: false,
  infoBox: false,
  selectionIndicator: false,
  shouldAnimate: true,
  timeline: false,
  animation: false,
});

viewer.cesiumWidget.creditContainer.style.display = 'none';

// 全局按键调试（用于确认浏览器是否向页面分发键盘事件）
document.addEventListener('keydown', function (e) {
  try {
    console.log('[GLOBAL keydown]', e.type, e.code || e.key, 'active=', document.activeElement && document.activeElement.tagName);
  } catch (e) {}
}, false);

// 相机与模型位置信息（示例坐标：可替换为真实经纬度）
const longitude = 116.788242;
const latitude = 36.538108;
const height = 133.3099999997426;
const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);

// 支持两种加载方式：
// 1) 通过 Cesium ion 托管的 asset（需上传到 ion 并替换 assetId）
// 2) 本地 glb 文件（请把 存放到 date/MySchool/ 下，示例文件名：校园数据1.glb）
// 注意：路径中含中文或空格时使用 encodeURI 确保浏览器请求正确
const localModelUrl = encodeURI('date/MySchool/终+max.glb');

// 如果你已在 ion 上传模型，请把 assetId 设置为数字，例如: const assetId = 12345;
// 否则保持为 null，代码将回退到本地 glb 加载。
const assetId = null;

// 运行时模型切换支持：跟踪当前加载的实体或 tileset
let currentModelEntity = null;
let currentTileset = null;
let currentBlobUrl = null; // 若通过 blob 加载需在替换时 revoke

function clearCurrentModel() {
  try {
    if (currentTileset) {
      viewer.scene.primitives.remove(currentTileset);
      currentTileset = null;
    }
    if (currentModelEntity) {
      viewer.entities.remove(currentModelEntity);
      currentModelEntity = null;
    }
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
  } catch (e) {
    console.warn('clearCurrentModel error', e);
  }
}
window.clearCurrentModel = clearCurrentModel;
Object.defineProperty(window, 'currentModelEntity', { get: function () { return currentModelEntity; } });
Object.defineProperty(window, 'currentTileset', { get: function () { return currentTileset; } });

function loadTilesetUrl(tilesetUrl) {
  clearCurrentModel();
  const loadStart = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  currentTileset = new Cesium.Cesium3DTileset({ url: tilesetUrl });
  viewer.scene.primitives.add(currentTileset);
  currentTileset.readyPromise.then(() => {
    viewer.zoomTo(currentTileset);
    const loadTime = ((typeof performance !== 'undefined') ? performance.now() : Date.now()) - loadStart;
    try { updateLoadTime(loadTime); } catch (e) {}
    console.log('Tileset 加载完成:', tilesetUrl, 'loadTime=', loadTime);
  }).otherwise((err) => {
    console.error('Tileset 加载失败', err);
    alert('3D Tiles 加载失败，请检查 URL 与 CORS 设置');
  });
}
window.loadTilesetUrl = loadTilesetUrl;

function loadIonAsset(id) {
  clearCurrentModel();
  try {
    const loadStart = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    const resource = Cesium.IonResource.fromAssetId(id);
    currentTileset = new Cesium.Cesium3DTileset({ url: resource });
    viewer.scene.primitives.add(currentTileset);
    currentTileset.readyPromise.then(() => {
      viewer.zoomTo(currentTileset);
      const loadTime = ((typeof performance !== 'undefined') ? performance.now() : Date.now()) - loadStart;
      try { updateLoadTime(loadTime); } catch (e) {}
      console.log('从 Cesium ion 加载 asset 完成，assetId=', id, 'loadTime=', loadTime);
    }).otherwise((err) => {
      console.error('从 ion 加载 asset 失败', err);
      alert('从 Cesium ion 加载模型失败，请检查 assetId 与 token');
    });
  } catch (e) {
    console.error('loadIonAsset error', e);
  }
}
window.loadIonAsset = loadIonAsset;

function loadGlbUrl(url) {
  clearCurrentModel();
  const loadStart = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  currentModelEntity = viewer.entities.add({
    name: '校园模型',
    position: position,
    // 使模型顺时针旋转 90°（绕垂直轴），如需反向请改为 -90 或调整为变量
    orientation: Cesium.Transforms.headingPitchRollQuaternion(position, new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(90), 0, 0)),
    model: {
      uri: url,
      minimumPixelSize: 64,
      maximumScale: 20000,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    }
  });

  // 某些 Cesium 发行版或环境中 entity.model.readyPromise 可能不存在。
  // 为避免脚本因未捕获的 TypeError 中断，先做存在性检查并提供降级处理。
  try {
    const model = currentModelEntity && currentModelEntity.model;
    const readyPromise = model && (model.readyPromise || model.ready);
    if (readyPromise && typeof readyPromise.then === 'function') {
      // 支持 when.js 风格的 otherwise 或 Promise.prototype.catch
      const onLoaded = function () {
        try {
          if (viewer && typeof viewer.flyTo === 'function') {
            viewer.flyTo(currentModelEntity).then(() => console.log('模型加载并定位完成'));
          } else {
            console.log('模型已加载，但 viewer.flyTo 无法调用');
          }
        } catch (e) { console.warn('flyTo failed', e); }
        try { const loadTime = ((typeof performance !== 'undefined') ? performance.now() : Date.now()) - loadStart; updateLoadTime(loadTime); } catch (e) {}
      };
      const onFailed = function (err) {
        console.error('模型加载失败', err);
        try { alert('模型加载失败，请检查控制台与模型路径'); } catch (e) {}
      };
      if (typeof readyPromise.otherwise === 'function') {
        readyPromise.then(onLoaded).otherwise(onFailed);
      } else if (typeof readyPromise.catch === 'function') {
        readyPromise.then(onLoaded).catch(onFailed);
      } else {
        // 最小处理：直接 then
        readyPromise.then(onLoaded);
      }
    } else {
      // 降级：没有 readyPromise，轮询包围球判断模型是否真正加载并渲染完成
      const entity = currentModelEntity;
      const bsScratch = new Cesium.BoundingSphere();
      let pollCount = 0;
      const maxPoll = 600; // 最多轮询约 60 秒（每次 ~100ms）
      function pollModelReady() {
        pollCount++;
        try {
          const state = viewer.dataSourceDisplay.getBoundingSphere(entity, bsScratch);
          if (state === Cesium.BoundingSphereState.DONE) {
            const loadTime = ((typeof performance !== 'undefined') ? performance.now() : Date.now()) - loadStart;
            updateLoadTime(loadTime);
            console.log('模型渲染完成（轮询包围球），loadTime=', loadTime);
            viewer.flyTo(entity).then(() => console.log('模型定位完成'));
            return;
          }
        } catch (e) {}
        if (pollCount < maxPoll) {
          setTimeout(pollModelReady, 100);
        } else {
          console.warn('模型加载超时，未能获取包围球');
          try { viewer.flyTo(entity); } catch (e) {}
        }
      }
      pollModelReady();
    }
  } catch (e) {
    console.error('loadGlbUrl 内部错误', e);
  }

  if (url && url.startsWith('blob:')) {
    currentBlobUrl = url;
  }
}
window.loadGlbUrl = loadGlbUrl;

function loadModelFromUrl(url) {
  if (!url) return;
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.json') || clean.includes('tileset')) {
    loadTilesetUrl(url);
  } else {
    // 默认按 glb/gltf 处理
    loadGlbUrl(url);
  }
}
window.loadModelFromUrl = loadModelFromUrl;

// 页面初始加载逻辑：优先 ion assetId，其次本地 localModelUrl
if (assetId) {
  loadIonAsset(assetId);
} else if (localModelUrl) {
  loadGlbUrl(localModelUrl);
}

// 初始视角：等模型开始加载后设置默认俯瞰视角
setTimeout(function () {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(longitude - 0.003, latitude - 0.002, 350),
    orientation: {
      heading: Cesium.Math.toRadians(30.0),
      pitch: Cesium.Math.toRadians(-35.0),
      roll: 0.0,
    },
    duration: 2.0,
  });
}, 500);

// 简单点击查询示例：点击模型显示名称
viewer.screenSpaceEventHandler.setInputAction(function onLeftClick(movement) {
  const picked = viewer.scene.pick(movement.position);
  if (Cesium.defined(picked) && picked.id) {
    alert('选中: ' + (picked.id.name || '模型'));
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// 视角快捷函数
function flyToTopView() {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, 500),
    orientation: {
      heading: Cesium.Math.toRadians(0.0),
      pitch: Cesium.Math.toRadians(-90.0),
      roll: 0.0,
    }
  });
}

// 默认全景视角（45° 俯瞰）
function flyToDefaultView() {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(longitude - 0.003, latitude - 0.002, 350),
    orientation: {
      heading: Cesium.Math.toRadians(30.0),
      pitch: Cesium.Math.toRadians(-35.0),
      roll: 0.0,
    }
  });
}
window.flyToDefaultView = flyToDefaultView;

// 南侧视角
function flyToSouthView() {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(longitude, latitude - 0.004, 250),
    orientation: {
      heading: Cesium.Math.toRadians(0.0),
      pitch: Cesium.Math.toRadians(-25.0),
      roll: 0.0,
    }
  });
}
window.flyToSouthView = flyToSouthView;

// 东侧视角
function flyToEastView() {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(longitude + 0.004, latitude, 250),
    orientation: {
      heading: Cesium.Math.toRadians(-90.0),
      pitch: Cesium.Math.toRadians(-25.0),
      roll: 0.0,
    }
  });
}
window.flyToEastView = flyToEastView;

// 近景视角
function flyToCloseView() {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(longitude - 0.001, latitude - 0.001, 180),
    orientation: {
      heading: Cesium.Math.toRadians(45.0),
      pitch: Cesium.Math.toRadians(-20.0),
      roll: 0.0,
    }
  });
}
window.flyToCloseView = flyToCloseView;

// 底图切换函数（全局可调用）
function setBaseMap(type) {
  // 移除现有底图
  viewer.imageryLayers.removeAll();
  let provider = null;
  if (type === 'OpenStreetMap') {
    provider = new Cesium.UrlTemplateImageryProvider({
      url: 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
      credit: '© OpenStreetMap contributors'
    });
  } else if (type === 'Esri') {
    provider = new Cesium.UrlTemplateImageryProvider({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      credit: 'Esri'
    });
  } else if (type === 'StamenToner') {
    provider = new Cesium.UrlTemplateImageryProvider({
      url: 'https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png',
      credit: 'Stamen'
    });
  } else if (type === 'None') {
    // 白色单色底图
    provider = new Cesium.SingleTileImageryProvider({
      url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12P4////DwAJBgMC1ALTAQAAAABJRU5ErkJggg==',
      rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90)
    });
  }

  if (provider) {
    viewer.imageryLayers.addImageryProvider(provider);
  }
}

// 页面初始化时默认加载地图贴图
setBaseMap('Esri');

// ---------------- 性能、位置与测量工具支持 ----------------
// 更新加载时间显示（秒）
function updateLoadTime(ms) {
  try {
    const el = document.getElementById('loadTime');
    if (el) el.textContent = (ms && !isNaN(ms)) ? (ms / 1000).toFixed(2) + ' s' : '-';
  } catch (e) {}
}

// FPS 统计（简单实现）
function updateFPS(now) {
  try {
    const el = document.getElementById('fps');
    if (!el) return;
    el.textContent = (now && !isNaN(now)) ? now.toFixed(1) : '-';
  } catch (e) {}
}

// 启动 FPS 计数器
(function startFPSMonitor() {
  let last = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  let frames = 0;
  function tick(now) {
    frames++;
    now = now || ((typeof performance !== 'undefined') ? performance.now() : Date.now());
    if (now - last >= 1000) {
      const fps = (frames * 1000) / (now - last);
      updateFPS(fps);
      frames = 0;
      last = now;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

// 鼠标位置（经纬度、海拔）实时显示
try {
  const moveHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
  moveHandler.setInputAction(function (movement) {
    try {
      let cartesian = null;
      if (viewer.scene.pickPositionSupported) {
        cartesian = viewer.scene.pickPosition(movement.endPosition);
      }
      if (!cartesian) {
        cartesian = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid);
      }
      if (cartesian) {
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(carto.longitude);
        const lat = Cesium.Math.toDegrees(carto.latitude);
        const h = (typeof carto.height === 'number') ? carto.height : 0;
        const lonEl = document.getElementById('lon');
        const latEl = document.getElementById('lat');
        const altEl = document.getElementById('alt');
        if (lonEl) lonEl.textContent = lon.toFixed(6);
        if (latEl) latEl.textContent = lat.toFixed(6);
        if (altEl) altEl.textContent = h.toFixed(2) + ' m';
      } else {
        const lonEl = document.getElementById('lon');
        const latEl = document.getElementById('lat');
        const altEl = document.getElementById('alt');
        if (lonEl) lonEl.textContent = '-';
        if (latEl) latEl.textContent = '-';
        if (altEl) altEl.textContent = '-';
      }
    } catch (e) {}
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
} catch (e) { console.warn('鼠标位置监听初始化失败', e); }

// 测量工具（测距/测面/剖面）
let _measureHandler = null;
let _measureEntities = [];
let _measurePoints = [];

function _clearMeasureEntities() {
  try {
    _measureEntities.forEach(ent => { try { viewer.entities.remove(ent); } catch (e) {} });
    _measureEntities = [];
  } catch (e) {}
}

function clearMeasurements() {
  try {
    if (_measureHandler) { _measureHandler.destroy(); _measureHandler = null; }
    _measurePoints = [];
    _clearMeasureEntities();
    const res = document.getElementById('measureResult'); if (res) { res.innerHTML = ''; res.style.display = 'none'; }
    const canvas = document.getElementById('profileCanvas'); if (canvas) { canvas.style.display = 'none'; }
  } catch (e) { console.warn(e); }
}
window.clearMeasurements = clearMeasurements;

function _pickPosition(screenPos) {
  try {
    let cart = null;
    if (viewer.scene.pickPositionSupported) cart = viewer.scene.pickPosition(screenPos);
    if (!cart) cart = viewer.camera.pickEllipsoid(screenPos, viewer.scene.globe.ellipsoid);
    return cart;
  } catch (e) { return null; }
}

function _geodesicDistance(a, b) {
  try {
    const c1 = Cesium.Cartographic.fromCartesian(a);
    const c2 = Cesium.Cartographic.fromCartesian(b);
    const geo = new Cesium.EllipsoidGeodesic(c1, c2);
    if (typeof geo.surfaceDistance === 'number') return geo.surfaceDistance;
  } catch (e) {}
  return Cesium.Cartesian3.distance(a, b);
}

function _polygonArea(positions) {
  if (!positions || positions.length < 3) return 0;
  const origin = positions[0];
  const transform = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
  const inv = Cesium.Matrix4.inverse(transform, new Cesium.Matrix4());
  const pts = positions.map(p => {
    const local = Cesium.Matrix4.multiplyByPoint(inv, p, new Cesium.Cartesian3());
    return { x: local.x, y: local.y };
  });
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area2 += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area2) * 0.5;
}

function _renderMeasurementPreview(mode, previewPos) {
  _clearMeasureEntities();
  const pts = _measurePoints.slice();
  if (previewPos) pts.push(previewPos);
  if (pts.length === 0) return;

  // 点实体
  pts.forEach((p, idx) => {
    const pointEntity = viewer.entities.add({
      position: p,
      point: { pixelSize: 8, color: Cesium.Color.YELLOW }
    });
    _measureEntities.push(pointEntity);
  });

  if (mode === 'distance' || mode === 'profile') {
    const poly = viewer.entities.add({
      polyline: {
        positions: pts,
        width: 3,
        material: Cesium.Color.ORANGE
      }
    });
    _measureEntities.push(poly);
  } else if (mode === 'area' && pts.length >= 3) {
    const poly = viewer.entities.add({
      polygon: {
        hierarchy: pts,
        material: Cesium.Color.fromAlpha(Cesium.Color.CYAN, 0.25),
        outline: true,
        outlineColor: Cesium.Color.CYAN
      }
    });
    _measureEntities.push(poly);
  }

  // 计算并展示结果
  const resEl = document.getElementById('measureResult');
  if (!resEl) return;
  if (mode === 'distance') {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += _geodesicDistance(pts[i - 1], pts[i]);
    resEl.innerHTML = '<div>总距离：<strong>' + (total >= 1000 ? (total/1000).toFixed(3) + ' km' : total.toFixed(2) + ' m') + '</strong></div>';
  } else if (mode === 'area') {
    const area = _polygonArea(pts);
    resEl.innerHTML = '<div>面积：<strong>' + (area >= 1000000 ? (area/1000000).toFixed(3) + ' km²' : area.toFixed(2) + ' m²') + '</strong></div>';
  } else if (mode === 'profile') {
    // 显示测量结果面板
    const resEl2 = document.getElementById('measureResult');
    
    // 点信息文字
    if (resEl2 && pts.length >= 1) {
      const cc = pts.map((p,i) => {
        const c = Cesium.Cartographic.fromCartesian(p);
        return { idx:i, lon:Cesium.Math.toDegrees(c.longitude), lat:Cesium.Math.toDegrees(c.latitude), h: c.height||0 };
      });
      let dist = 0;
      for (let i=1; i<pts.length; i++) dist += Cesium.Cartesian3.distance(pts[i-1], pts[i]);
      let txt = '<div>点数：' + pts.length + ' | 直线总长：' + (dist>=1000?(dist/1000).toFixed(3)+' km':dist.toFixed(2)+' m') + '</div>';
      cc.forEach(c => { txt += '<div style=\"font-size:11px\">P'+(c.idx+1)+': '+c.lon.toFixed(5)+', '+c.lat.toFixed(5)+' | 高程 '+c.h.toFixed(2)+' m</div>'; });
      resEl2.innerHTML = txt;
    }

    // 需要至少2个点才能画剖面图，鼠标移动预览跳过射线检测
    if (pts.length < 2) return;
    if (previewPos) return; // 鼠标移动时不做昂贵的射线检测

    // 沿路径每1米采样，射线检测模型表面真实高程
    const samplePositions = [];
    for (let i = 1; i < pts.length; i++) {
      const d = Cesium.Cartesian3.distance(pts[i-1], pts[i]);
      const steps = Math.max(2, Math.ceil(d / 1.0));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const interp = new Cesium.Cartesian3();
        Cesium.Cartesian3.lerp(pts[i-1], pts[i], t, interp);

        // 射线检测：从高空向下打，找模型表面
        const carto = Cesium.Cartographic.fromCartesian(interp);
        const origin = Cesium.Cartesian3.fromDegrees(
          Cesium.Math.toDegrees(carto.longitude),
          Cesium.Math.toDegrees(carto.latitude),
          carto.height + 500
        );
        const target = Cesium.Cartesian3.fromDegrees(
          Cesium.Math.toDegrees(carto.longitude),
          Cesium.Math.toDegrees(carto.latitude),
          carto.height - 200
        );
        const dir = Cesium.Cartesian3.normalize(
          Cesium.Cartesian3.subtract(target, origin, new Cesium.Cartesian3()),
          new Cesium.Cartesian3()
        );
        const hit = viewer.scene.pickFromRay(new Cesium.Ray(origin, dir));
        if (Cesium.defined(hit) && hit.position) {
          samplePositions.push(Cesium.Cartographic.fromCartesian(hit.position));
        } else {
          samplePositions.push(carto); // 降级：用插值点
        }
      }
    }

    drawProfileChart(samplePositions, pts);
  }
}

// 绘制剖面图
function drawProfileChart(sampled, clickedPts) {
  const canvas = document.getElementById('profileCanvas');
  if (!canvas) return;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pad = { top: 30, right: 30, bottom: 40, left: 60 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  // 将 Cartographic 转回 Cartesian3 算距离
  const pts3D = sampled.map(s => Cesium.Cartesian3.fromRadians(s.longitude, s.latitude, s.height));
  const cumDist = [0];
  for (let i = 1; i < pts3D.length; i++) {
    cumDist.push(cumDist[i-1] + Cesium.Cartesian3.distance(pts3D[i-1], pts3D[i]));
  }
  const totalDist = cumDist[cumDist.length - 1] || 1;

  // 高程范围
  let minH = Infinity, maxH = -Infinity;
  sampled.forEach(s => { if (s.height < minH) minH = s.height; if (s.height > maxH) maxH = s.height; });
  const range = maxH - minH || 1;

  // 用户标记点
  const markers = [];
  let mDist = 0;
  clickedPts.forEach((p, i) => {
    if (i > 0) mDist += Cesium.Cartesian3.distance(clickedPts[i-1], clickedPts[i]);
    const c = Cesium.Cartographic.fromCartesian(p);
    markers.push({ index: i, dist: mDist, height: c.height || 0 });
  });

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(8,18,28,0.95)';
  ctx.fillRect(0, 0, W, H);

  // 网格
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (ph*i/4);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W-pad.right, y); ctx.stroke();
  }

  // 坐标轴
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, H-pad.bottom); ctx.lineTo(W-pad.right, H-pad.bottom); ctx.stroke();

  // 标签
  ctx.fillStyle = '#aaa'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('距离 →', W/2, H-5);
  ctx.save(); ctx.translate(14, H/2); ctx.rotate(-Math.PI/2); ctx.fillText('高程 (m)', 0, 0); ctx.restore();

  // Y刻度
  ctx.textAlign = 'right';
  for (let i=0; i<=4; i++) {
    const v = minH + (range*i/4);
    ctx.fillText(v.toFixed(1), pad.left-8, H-pad.bottom-(ph*i/4)+4);
  }

  // 填充区域
  ctx.globalAlpha = 0.15; ctx.fillStyle = '#0ea5ff';
  ctx.beginPath();
  sampled.forEach((s, i) => {
    const x = pad.left + (cumDist[i]/totalDist)*pw;
    const y = H-pad.bottom - ((s.height-minH)/range)*ph;
    if (i===0) { ctx.moveTo(x, H-pad.bottom); ctx.lineTo(x, y); }
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(pad.left+pw, H-pad.bottom); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;

  // 折线
  ctx.strokeStyle = '#0ea5ff'; ctx.lineWidth = 2; ctx.beginPath();
  sampled.forEach((s, i) => {
    const x = pad.left + (cumDist[i]/totalDist)*pw;
    const y = H-pad.bottom - ((s.height-minH)/range)*ph;
    if (i===0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // 标记点
  markers.forEach(m => {
    const x = pad.left + (m.dist/totalDist)*pw;
    const y = H-pad.bottom - ((m.height-minH)/range)*ph;
    ctx.fillStyle = '#ffdd44'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(m.height.toFixed(1), x, y-12);
  });
}

function startMeasure(mode) {
  clearMeasurements();
  if (!mode) return;
  // 显示测量结果面板
  const resEl = document.getElementById('measureResult');
  if (resEl) resEl.style.display = 'block';
  // 剖面模式显示canvas，其他模式隐藏
  const canvas = document.getElementById('profileCanvas');
  if (canvas) canvas.style.display = (mode === 'profile') ? 'block' : 'none';
  _measureHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

  // 点击添加点
  _measureHandler.setInputAction(function (click) {
    const pos = _pickPosition(click.position);
    if (!pos) return;
    _measurePoints.push(pos);
    _renderMeasurementPreview(mode);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // 鼠标移动时预览
  _measureHandler.setInputAction(function (movement) {
    try {
      const pos = _pickPosition(movement.endPosition);
      _renderMeasurementPreview(mode, pos);
    } catch (e) {}
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // 右键结束（结束后保留结果，需手动清除）
  _measureHandler.setInputAction(function () {
    if (_measureHandler) { _measureHandler.destroy(); _measureHandler = null; }
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

window.startDistanceMeasure = function () { startMeasure('distance'); };
window.startAreaMeasure = function () { startMeasure('area'); };
window.startProfileMeasure = function () { startMeasure('profile'); };

// 页面加载时尝试将加载时间置为未知
try { updateLoadTime(null); } catch (e) {}



