/*
 * Virtual time for recording the show frame by frame (injected into the page by scripts/demo/record.mjs (`npm run demo:record`) before
 * any of the site's code runs). The page's clock (timers, requestAnimationFrame, performance.now, Date, CSS and
 * Web Animations, smooth scrolling) only moves when the recorder calls `__vt.step(ms)`, once per video frame.
 * However slow the computer is, every frame is exactly 1/60 s apart in the video, and time spent waiting for
 * the network never shows up. Plain browser JavaScript, no build step; tests run it on a fake window.
 */
(function installVirtualTime(w) {
  if (!w || w.__vt) return;
  var realSetTimeout = w.setTimeout.bind(w);
  var RealDate = w.Date;
  var perf = w.performance;
  var startPerf = perf.now();
  var startEpoch = RealDate.now();
  var now = startPerf;
  var seq = 0;
  var timers = new Map();
  var rafs = new Map();

  w.setTimeout = function (fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2);
    var id = ++seq;
    timers.set(id, { at: now + Math.max(0, Number(ms) || 0), fn: fn, args: args, every: 0 });
    return id;
  };
  w.setInterval = function (fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2);
    var id = ++seq;
    var every = Math.max(1, Number(ms) || 0);
    timers.set(id, { at: now + every, fn: fn, args: args, every: every });
    return id;
  };
  w.clearTimeout = w.clearInterval = function (id) {
    timers.delete(id);
  };
  w.requestAnimationFrame = function (fn) {
    var id = ++seq;
    rafs.set(id, fn);
    return id;
  };
  w.cancelAnimationFrame = function (id) {
    rafs.delete(id);
  };
  perf.now = function () {
    return now;
  };
  var VDate = function (a, b, c, d, e, f, g) {
    var n = arguments.length;
    if (!(this instanceof VDate)) return new RealDate(startEpoch + (now - startPerf)).toString();
    if (n === 0) return new RealDate(startEpoch + (now - startPerf));
    if (n === 1) return new RealDate(a);
    return new RealDate(a, b, c === undefined ? 1 : c, d || 0, e || 0, f || 0, g || 0);
  };
  VDate.prototype = RealDate.prototype;
  VDate.now = function () {
    return startEpoch + (now - startPerf);
  };
  VDate.parse = RealDate.parse;
  VDate.UTC = RealDate.UTC;
  w.Date = VDate;

  // Smooth scrolling is done by the browser in real time: replay it on the virtual clock instead.
  var scrollAnims = new WeakMap();
  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function animateScroll(el, left, top) {
    var fromL = el.scrollLeft;
    var fromT = el.scrollTop;
    var dist = Math.max(Math.abs(left - fromL), Math.abs(top - fromT));
    if (dist < 1) return;
    var ms = Math.min(850, Math.max(320, 260 + dist * 0.4));
    var t0 = now;
    var token = {};
    scrollAnims.set(el, token);
    function frame() {
      if (scrollAnims.get(el) !== token) return;
      var k = Math.min(1, (now - t0) / ms);
      el.scrollLeft = fromL + (left - fromL) * ease(k);
      el.scrollTop = fromT + (top - fromT) * ease(k);
      if (k < 1) w.requestAnimationFrame(frame);
    }
    w.requestAnimationFrame(frame);
  }
  var doc = w.document;
  var El = w.Element;
  if (El && doc) {
    var origScrollTo = El.prototype.scrollTo;
    var origIntoView = El.prototype.scrollIntoView;
    var root = function () {
      return doc.scrollingElement || doc.documentElement;
    };
    El.prototype.scrollTo = function (a, b) {
      if (a && typeof a === "object" && a.behavior === "smooth") {
        return animateScroll(this, a.left == null ? this.scrollLeft : a.left, a.top == null ? this.scrollTop : a.top);
      }
      return origScrollTo.apply(this, arguments);
    };
    var origWinScrollTo = w.scrollTo;
    w.scrollTo = function (a, b) {
      if (a && typeof a === "object" && a.behavior === "smooth") {
        var r = root();
        return animateScroll(r, a.left == null ? r.scrollLeft : a.left, a.top == null ? r.scrollTop : a.top);
      }
      return origWinScrollTo.apply(w, arguments);
    };
    El.prototype.scrollIntoView = function (arg) {
      if (arg && typeof arg === "object" && arg.behavior === "smooth") {
        // let the browser work out where everything ends up, put it back, then glide there on our clock
        var chain = [];
        for (var p = this.parentElement; p; p = p.parentElement) {
          if (p.scrollHeight > p.clientHeight || p.scrollWidth > p.clientWidth) chain.push(p);
        }
        var r = root();
        if (chain.indexOf(r) < 0) chain.push(r);
        var before = chain.map(function (e) {
          return [e.scrollLeft, e.scrollTop];
        });
        origIntoView.call(this, Object.assign({}, arg, { behavior: "instant" }));
        var after = chain.map(function (e) {
          return [e.scrollLeft, e.scrollTop];
        });
        chain.forEach(function (e, i) {
          e.scrollLeft = before[i][0];
          e.scrollTop = before[i][1];
        });
        chain.forEach(function (e, i) {
          animateScroll(e, after[i][0], after[i][1]);
        });
        return;
      }
      return origIntoView.apply(this, arguments);
    };
  }

  // CSS animations, transitions and Web Animations: paused and moved by hand, frame by frame.
  var known = new Map();
  var lastSweep = null;
  function sweep(dt) {
    if (!doc || typeof doc.getAnimations !== "function") return;
    var list = doc.getAnimations();
    var live = new Set(list);
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      var state = a.playState;
      if (state === "finished" || state === "idle") {
        known.delete(a);
        continue;
      }
      var ct;
      if (!known.has(a)) {
        // paused by the page itself: leave it alone
        if (state === "paused") continue;
        var fresh = a.startTime == null || lastSweep == null || a.startTime >= lastSweep - 1;
        ct = fresh ? 0 : Number(a.currentTime) || 0;
      } else {
        ct = known.get(a) + dt * (a.playbackRate || 0);
      }
      var timing = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      var end = timing && typeof timing.endTime === "number" ? timing.endTime : Infinity;
      var rate = a.playbackRate;
      if (isFinite(end) && ((rate >= 0 && ct >= end) || (rate < 0 && ct <= 0))) {
        try {
          a.finish();
        } catch (err) {
          /* cannot finish: leave it */
        }
        known.delete(a);
        continue;
      }
      if (state !== "paused") a.pause();
      a.currentTime = ct;
      known.set(a, ct);
    }
    known.forEach(function (_, a) {
      if (!live.has(a)) known.delete(a);
    });
    lastSweep = doc.timeline ? doc.timeline.currentTime : null;
  }

  function flush() {
    // let promise chains settle (a timer resolves a sleep, its continuation sets the next timer)
    var p = Promise.resolve();
    for (var i = 0; i < 8; i++) p = p.then(function () {});
    return p;
  }

  async function step(dt) {
    var target = now + dt;
    sweep(dt);
    for (var guard = 0; guard < 5000; guard++) {
      var nextId = null;
      var next = null;
      timers.forEach(function (t, id) {
        if (t.at <= target && (!next || t.at < next.at || (t.at === next.at && id < nextId))) {
          next = t;
          nextId = id;
        }
      });
      if (!next) break;
      now = Math.max(now, next.at);
      if (next.every) next.at += next.every;
      else timers.delete(nextId);
      try {
        if (typeof next.fn === "function") next.fn.apply(w, next.args);
      } catch (err) {
        if (w.console) w.console.error(err);
      }
      await flush();
    }
    now = target;
    var cbs = rafs;
    rafs = new Map();
    cbs.forEach(function (fn) {
      try {
        fn(now);
      } catch (err) {
        if (w.console) w.console.error(err);
      }
    });
    await flush();
    // a real moment for the page to render what changed (React commits in its own task)
    await new Promise(function (r) {
      realSetTimeout(r, 0);
    });
    sweep(0);
  }

  w.__vt = {
    step: step,
    now: function () {
      return now;
    },
    timers: function () {
      return timers.size;
    },
  };
})(typeof window !== "undefined" ? window : globalThis.__vtTarget);
