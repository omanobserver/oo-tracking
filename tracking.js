/**
 * Observer Analytics — سكريبت التتبع
 * يُضاف قبل </body> في كل صفحة على omanobserver.om
 *
 * الحجم: ~3KB بعد الضغط
 * التأثير على الأداء: صفر (يعمل بعد تحميل الصفحة كاملاً)
 */
(function () {
  'use strict';

  // ── الإعدادات ───────────────────────────────────────────────
  var CFG = {
    endpoint: 'https://oo-tracking.vercel.app/api/collect',
    pingInterval: 60000,  // دقيقة كاملة
    idleTimeout:  60000,
    scrollThrottle: 250,
    debug: false,
};


  // ── بيانات الصفحة (تُجمع مرة واحدة عند التحميل) ────────────
  var PAGE = {
    url:          location.href,
    path:         location.pathname,
    title:        document.title,
    referrer:     document.referrer,
    articleId:    getMeta('Idkeywords') || getMeta('article-id') || getSlug(),
    section:      getMeta('article-section') || getSection(),
    author:       getMeta('author') || '',
    pageType:     getMeta('pageType') || 'unknown',
    datePublished:getMeta('datePublished') || '',
    keywords:     getMeta('keywords') || '',
    sessionId:    getOrCreate('sessionStorage', 'oa_sess', 'sess_'),
    visitorId:    getOrCreate('localStorage',   'oa_vis',  'vis_'),
    viewport:     { w: innerWidth, h: innerHeight },
  };

  // ── قياس Engaged Time ───────────────────────────────────────
  var ET = {
    total:       0,
    segStart:    null,
    active:      false,
    idleTimer:   null,

    engage: function () {
      var now = Date.now();
      if (!this.active) {
        this.active   = true;
        this.segStart = now;
      }
      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(function () { ET.idle(); }, CFG.idleTimeout);
    },

    idle: function () {
      if (this.active && this.segStart) {
        this.total += (Date.now() - this.segStart) / 1000;
        this.active   = false;
        this.segStart = null;
      }
    },

    get: function () {
      var t = this.total;
      if (this.active && this.segStart) {
        t += (Date.now() - this.segStart) / 1000;
      }
      return Math.round(t);
    },
  };

  // ── قياس Scroll Depth ───────────────────────────────────────
  var SD = {
    max:         0,
    lastScroll:  0,

    measure: function () {
      var now = Date.now();
      if (now - this.lastScroll < CFG.scrollThrottle) return;
      this.lastScroll = now;

      var scrollTop  = window.scrollY || document.documentElement.scrollTop;
      var docHeight  = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      var pct = Math.min(100, Math.round(
        ((scrollTop + innerHeight) / docHeight) * 100
      ));

      if (pct > this.max) {
        this.max = pct;
        log('Scroll depth:', pct + '%');
      }
      ET.engage();
    },
  };

  // ── إرسال النبضة ────────────────────────────────────────────
  function ping(isFinal) {
    var payload = JSON.stringify({
      sessionId:      PAGE.sessionId,
      visitorId:      PAGE.visitorId,
      url:            PAGE.url,
      path:           PAGE.path,
      title:          PAGE.title,
      articleId:      PAGE.articleId,
      section:        PAGE.section,
      author:         PAGE.author,
      pageType:       PAGE.pageType,
      datePublished:  PAGE.datePublished,
      keywords:       PAGE.keywords,
      referrer:       PAGE.referrer,
      engagedTime:    ET.get(),
      scrollDepth:    SD.max,
      isFinal:        Boolean(isFinal),
      connectionType: (navigator.connection && navigator.connection.effectiveType) || 'unknown',
      viewport:       PAGE.viewport,
    });

    log('Ping' + (isFinal ? ' [final]' : ''), JSON.parse(payload));

    if (navigator.sendBeacon) {
      navigator.sendBeacon(CFG.endpoint, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(CFG.endpoint, {
        method:    'POST',
        body:      payload,
        headers:   { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(function () {});
    }
  }

  // ── الوظائف المساعدة ─────────────────────────────────────────
  function getMeta(name) {
    var el = document.querySelector('meta[name="' + name + '"]');
    return el ? el.content : '';
  }

  function getSlug() {
    return location.pathname.split('/').filter(Boolean).pop() || 'home';
  }

  function getSection() {
    // يحاول استخراج القسم من أول جزء في المسار: /business/article → "business"
    var parts = location.pathname.split('/').filter(Boolean);
    return parts.length > 1 ? parts[0] : 'home';
  }

  function getOrCreate(storage, key, prefix) {
    try {
      var store = window[storage];
      var val   = store.getItem(key);
      if (!val) {
        val = prefix + Math.random().toString(36).slice(2, 9) + Date.now();
        store.setItem(key, val);
      }
      return val;
    } catch (e) {
      return prefix + Math.random().toString(36).slice(2, 9);
    }
  }

  function log() {
    if (CFG.debug) {
      console.log.apply(console, ['[OA]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ── التهيئة ──────────────────────────────────────────────────
  function init() {
    // نبضة فورية عند تحميل الصفحة — تسجل القارئ حتى لو لم يتفاعل
setTimeout(function () { ping(false); }, 1000);
    // أحداث التفاعل
    ['mousemove', 'keydown', 'touchstart', 'click'].forEach(function (ev) {
      document.addEventListener(ev, function () { ET.engage(); }, { passive: true });
    });

    // التمرير
    window.addEventListener('scroll', function () { SD.measure(); }, { passive: true });

    // تغيير التبويب
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { ET.idle(); } else { ET.engage(); }
    });

 // قياس التمرير الأولي
SD.measure();
ET.engage();

// نبضة فورية عند تحميل الصفحة (تسجل القارئ حتى لو لم يتفاعل بعد)
setTimeout(function () { ping(false); }, 1000);

// نبضة ثانية بعد 3 ثوان للتأكيد
setTimeout(function () { ping(false); }, 3000);

    // نبضات دورية
    var timer = setInterval(function () { ping(false); }, CFG.pingInterval);

    // نبضة أخيرة عند المغادرة
    window.addEventListener('beforeunload', function () {
      clearInterval(timer);
      ET.idle();
      ping(true);
    });

    log('Observer Analytics initialized', PAGE);
  }

  // تشغيل بعد اكتمال تحميل الصفحة — لا يؤثر على الـ LCP
  if (document.readyState === 'complete') {
    window.requestIdleCallback ? requestIdleCallback(init) : setTimeout(init, 200);
  } else {
    window.addEventListener('load', function () {
      window.requestIdleCallback ? requestIdleCallback(init) : setTimeout(init, 200);
    });
  }

})();
