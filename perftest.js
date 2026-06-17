


// perftest.js - 校园实景三维模型可视化平台 性能测试脚本
// 在浏览器控制台执行 runPerfTest() 启动测试

(function () {
  'use strict';

  var MODEL_PATH = 'date/MySchool/' + encodeURIComponent('终+max.glb');
  var MODEL_SIZE_MB = 97.5;
  var TEST_ROUNDS = 3;
  var FPS_SAMPLE_SEC = 5;
  var INTERACTION_STEPS = 60;

  function now() { return performance.now(); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function getMemoryMB() {
    if (performance.memory) {
      return {
        usedHeap: +(performance.memory.usedJSHeapSize / 1048576).toFixed(2),
        totalHeap: +(performance.memory.totalJSHeapSize / 1048576).toFixed(2),
        limit: +(performance.memory.jsHeapSizeLimit / 1048576).toFixed(2)
      };
    }
    return null;
  }

  function sampleFPS(seconds) {
    return new Promise(function (resolve) {
      var samples = [];
      var frames = 0;
      var last = now();
      var end = now() + seconds * 1000;
      function tick() {
        frames++;
        var t = now();
        if (t - last >= 1000) {
          samples.push(+(frames * 1000 / (t - last)).toFixed(1));
          frames = 0;
          last = t;
        }
        if (t < end) { requestAnimationFrame(tick); }
        else { resolve(samples); }
      }
      requestAnimationFrame(tick);
    });
  }

  function stats(arr) {
    if (!arr || arr.length === 0) return { avg: 0, min: 0, max: 0 };
    var sum = arr.reduce(function (a, b) { return a + b; }, 0);
    return {
      avg: +(sum / arr.length).toFixed(2),
      min: +Math.min.apply(null, arr).toFixed(2),
      max: +Math.max.apply(null, arr).toFixed(2)
    };
  }

  function waitModelReady(timeoutMs) {
    return new Promise(function (resolve, reject) {
      var bs = new Cesium.BoundingSphere();
      var deadline = now() + (timeoutMs || 120000);
      function poll() {
        var entity = window.currentModelEntity;
        var tileset = window.currentTileset;
        if (tileset) {
          try { if (tileset.ready) { resolve(); return; } } catch (e) {}
        }
        if (entity) {
          try {
            var state = viewer.dataSourceDisplay.getBoundingSphere(entity, bs);
            if (state === Cesium.BoundingSphereState.DONE) { resolve(); return; }
          } catch (e) {}
        }
        if (now() > deadline) { reject(new Error('模型加载超时')); return; }
        setTimeout(poll, 200);
      }
      setTimeout(poll, 500);
    });
  }

  function simulateOrbit(steps) {
    return new Promise(function (resolve) {
      var lon = 116.788242, lat = 36.538158;
      var i = 0;
      function step() {
        var angle = (i / steps) * Math.PI * 2;
        var r = 0.003;
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(
            lon + r * Math.cos(angle),
            lat + r * Math.sin(angle),
            300
          ),
          orientation: {
            heading: Cesium.Math.toRadians(-Cesium.Math.toDegrees(angle) + 90),
            pitch: Cesium.Math.toRadians(-30),
            roll: 0
          }
        });
        i++;
        if (i <= steps) { requestAnimationFrame(step); }
        else { resolve(); }
      }
      requestAnimationFrame(step);
    });
  }

  function getNetworkStats() {
    var entries = performance.getEntriesByType('resource');
    var totalCount = entries.length, totalSize = 0;
    var tileCount = 0, tileSize = 0;
    var modelCount = 0, modelSize = 0;
    entries.forEach(function (e) {
      var size = e.transferSize || e.encodedBodySize || 0;
      totalSize += size;
      if (e.name.match(/\.(png|jpg|jpeg|webp)/) && (e.name.includes('tile') || e.name.includes('arcgis') || e.name.includes('openstreetmap'))) {
        tileCount++; tileSize += size;
      }
      if (e.name.match(/\.(glb|gltf|b3dm|json)/i)) {
        modelCount++; modelSize += size;
      }
    });
    return {
      total: { count: totalCount, sizeMB: +(totalSize / 1048576).toFixed(2) },
      tiles: { count: tileCount, sizeMB: +(tileSize / 1048576).toFixed(2) },
      model: { count: modelCount, sizeMB: +(modelSize / 1048576).toFixed(2) }
    };
  }

  async function runPerfTest() {
    var report = {
      testTime: new Date().toLocaleString('zh-CN'),
      modelFile: '终+max.glb',
      modelSizeMB: MODEL_SIZE_MB,
      loadTests: [],
      fps: {},
      memory: {},
      network: {}
    };

    console.log('[性能测试] 开始');

    report.memory.initial = getMemoryMB();
    console.log('[性能测试] 初始内存:', report.memory.initial);

    console.log('[性能测试] 模型加载测试 (' + TEST_ROUNDS + ' 轮)');
    for (var r = 0; r < TEST_ROUNDS; r++) {
      console.log('  第 ' + (r + 1) + ' 轮');
      if (window.clearCurrentModel) window.clearCurrentModel();
      await sleep(500);
      var t0 = now();
      window.loadGlbUrl(MODEL_PATH);
      try { await waitModelReady(120000); }
      catch (e) { console.warn('  加载失败:', e.message); }
      var elapsed = +((now() - t0) / 1000).toFixed(3);
      report.loadTests.push(elapsed);
      console.log('  第 ' + (r + 1) + ' 轮加载时间: ' + elapsed + ' s');
      await sleep(1000);
    }
    var loadS = stats(report.loadTests);
    report.loadAvg = loadS.avg;
    report.loadMin = loadS.min;
    report.loadMax = loadS.max;
    console.log('[性能测试] 加载时间: 平均=' + loadS.avg + 's 最小=' + loadS.min + 's 最大=' + loadS.max + 's');

    console.log('[性能测试] 等待 20 秒场景稳定');
    await sleep(20000);

    report.memory.afterLoad = getMemoryMB();
    console.log('[性能测试] 加载后内存:', report.memory.afterLoad);

    console.log('[性能测试] 静止 FPS 采样 (' + FPS_SAMPLE_SEC + 's)');
    if (window.flyToDefaultView) window.flyToDefaultView();
    await sleep(3000);
    var staticSamples = await sampleFPS(FPS_SAMPLE_SEC);
    report.fps.static = stats(staticSamples);
    console.log('[性能测试] 静止 FPS:', report.fps.static);

    console.log('[性能测试] 交互 FPS 采样');
    var interactPromise = sampleFPS(FPS_SAMPLE_SEC);
    simulateOrbit(INTERACTION_STEPS);
    var interactSamples = await interactPromise;
    report.fps.interact = stats(interactSamples);
    console.log('[性能测试] 交互 FPS:', report.fps.interact);

    var viewTests = [
      { name: '顶部俯瞰', fn: 'flyToTopView' },
      { name: '近景视角', fn: 'flyToCloseView' },
      { name: '东侧视角', fn: 'flyToEastView' }
    ];
    report.fps.views = {};
    for (var vi = 0; vi < viewTests.length; vi++) {
      var v = viewTests[vi];
      if (window[v.fn]) {
        window[v.fn]();
        await sleep(3000);
        var vs = await sampleFPS(3);
        report.fps.views[v.name] = stats(vs);
        console.log('[性能测试] ' + v.name + ' FPS:', report.fps.views[v.name]);
      }
    }

    report.memory.peak = getMemoryMB();
    console.log('[性能测试] 峰值内存:', report.memory.peak);

    report.network = getNetworkStats();
    console.log('[性能测试] 网络资源:', report.network);

    if (window.clearCurrentModel) {
      window.clearCurrentModel();
      await sleep(2000);
      report.memory.afterClear = getMemoryMB();
      console.log('[性能测试] 释放后内存:', report.memory.afterClear);
      window.loadGlbUrl(MODEL_PATH);
      try { await waitModelReady(120000); } catch (e) {}
    }

    console.log('========== 性能测试报告 ==========');
    console.log('测试时间: ' + report.testTime);
    console.log('模型文件: ' + report.modelFile);
    console.log('模型大小: ' + report.modelSizeMB + ' MB');
    console.log('加载时间(平均): ' + report.loadAvg + ' s');
    console.log('加载时间(最小): ' + report.loadMin + ' s');
    console.log('加载时间(最大): ' + report.loadMax + ' s');
    console.log('静止FPS: 平均=' + report.fps.static.avg + ' 范围=' + report.fps.static.min + '~' + report.fps.static.max);
    console.log('交互FPS: 平均=' + report.fps.interact.avg + ' 范围=' + report.fps.interact.min + '~' + report.fps.interact.max);
    for (var name in report.fps.views) {
      var d = report.fps.views[name];
      console.log(name + ' FPS: 平均=' + d.avg + ' 范围=' + d.min + '~' + d.max);
    }
    if (report.memory.initial) {
      console.log('初始内存: ' + report.memory.initial.usedHeap + ' MB');
      console.log('加载后内存: ' + (report.memory.afterLoad || {}).usedHeap + ' MB');
      console.log('峰值内存: ' + (report.memory.peak || {}).usedHeap + ' MB');
      if (report.memory.afterClear) {
        console.log('释放后内存: ' + report.memory.afterClear.usedHeap + ' MB');
      }
    }
    console.log('网络请求: ' + (report.network.total ? report.network.total.count + ' 个, ' + report.network.total.sizeMB + ' MB' : '-'));
    console.log('底图瓦片: ' + (report.network.tiles ? report.network.tiles.count + ' 个, ' + report.network.tiles.sizeMB + ' MB' : '-'));
    console.log('===================================');

    window.__perfReport = report;
    console.log('完整数据已存入 window.__perfReport');

    return report;
  }

  window.runPerfTest = runPerfTest;
  console.log('[性能测试] 脚本已加载，输入 runPerfTest() 开始测试');
})();
