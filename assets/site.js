(function(){
  if('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* Pin the base to the folder this page was loaded from. Without it, every relative link and
     every image the script swaps in later would resolve against whatever address the router
     last wrote into the bar, so links would stack up (/history/reviews/) and images would 404. */
  (function(){
    if(document.querySelector('base')) return;
    var dir = location.href.split(/[?#]/)[0].replace(/[^/]*$/, '');
    var tag = document.createElement('base');
    tag.href = dir;
    document.head.insertBefore(tag, document.head.firstChild);
  })();

  var SV = window.SILTVALE || {};
  var views = document.querySelectorAll('.view');
  var links = document.querySelectorAll('.file[data-view]');
  var pages = {};
  views.forEach(function(v){ pages[v.id.slice(2)] = v; });

  /* Every page ships every view; these are the real URLs behind them. */
  var ROUTES = SV.routes || {};
  var TITLES = SV.titles || {};
  var byPath = {};
  function normPath(p){
    p = String(p == null ? '/' : p).replace(/index\.html?$/i, '');
    if(p.charAt(p.length - 1) !== '/') p += '/';
    return p;
  }
  Object.keys(ROUTES).forEach(function(id){
    try { byPath[normPath(new URL(ROUTES[id], location.href).pathname)] = id; } catch(e){}
  });
  function viewAt(path){ return byPath[normPath(path)]; }
  function fromHash(hash){
    var h = String(hash || '').replace(/^#/, '');
    if(!h) return null;
    if(pages[h]) return { view: h, anchor: '' };
    var el = document.getElementById(h);
    var owner = el && el.closest && el.closest('.view');
    if(owner) return { view: owner.id.slice(2), anchor: h };
    return null;
  }

  var canonical = document.querySelector('link[rel="canonical"]');
  var routedOnce = false;
  function route(target, anchorId){
    if(!pages[target]) target = pages[SV.page] ? SV.page : 'home';
    if(routedOnce) slamShut();
    routedOnce = true;
    var anchor = anchorId ? document.getElementById(anchorId) : null;
    views.forEach(function(v){ v.classList.toggle('active', v.id === 'v-' + target); });
    links.forEach(function(a){
      if(a.getAttribute('data-view') === target) a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
    if(anchor){
      var toAnchor = function(){ anchor.scrollIntoView({block:'start'}); };
      toAnchor();
      if(document.body.classList.contains('burning')){   /* the intro locks scrolling; retry once it lifts */
        var tries = 0, iv = setInterval(function(){
          if(!document.body.classList.contains('burning')){ clearInterval(iv); toAnchor(); }
          else if(++tries > 40) clearInterval(iv);
        }, 120);
      }
    }
    else window.scrollTo(0,0);
    document.title = TITLES[target] || ('Siltvale SMP — ' + target.replace(/-/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();}));
    if(canonical && ROUTES[target]){ try { canonical.href = new URL(ROUTES[target], location.href).href; } catch(e){} }
    var fresh = pages[target];
    refit(fresh);
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ writeIn(fresh); });
    else writeIn(fresh);
  }
  /* Scopes measure themselves against their box, which is zero while the page is hidden.
     ResizeObserver is not fired by a display:none -> block change, so re-fit on the way in. */
  function refit(view){
    if(!view) return;
    var run = function(){
      view.querySelectorAll('.scope').forEach(function(s){ if(s._fit) s._fit(); });
    };
    run();
    requestAnimationFrame(run);
    setTimeout(run, 400);
  }
  function go(view, anchorId, url){
    if(url && url !== location.href){
      try { history.pushState({ v: view, a: anchorId || '' }, '', url); } catch(e){}
    }
    route(view, anchorId);
  }
  window.addEventListener('popstate', function(){
    var h = fromHash(location.hash);
    route(viewAt(location.pathname) || (h && h.view) || SV.page || 'home', h ? h.anchor : '');
  });
  window.addEventListener('hashchange', function(){
    var h = fromHash(location.hash);
    if(h) route(h.view, h.anchor);
  });
  /* any other internal link (explore index, legend, footer) routes without a reload */
  document.addEventListener('click', function(e){
    if(e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if(!a || a.target || a.hasAttribute('download') || a.classList.contains('file')) return;
    if(a.origin !== location.origin) return;
    var id = viewAt(a.pathname);
    if(!id) return;
    e.preventDefault();
    go(id, a.hash ? a.hash.slice(1) : '', a.href);
  });

  document.querySelectorAll('.file[target]').forEach(function(a){
    a.addEventListener('click', function(e){ if(e.detail) a.blur(); });
  });

  function burnAway(){
    if(reduced) return;
    var cv = document.createElement('canvas');
    cv.className = 'burn'; cv.setAttribute('aria-hidden','true');
    document.body.appendChild(cv); document.body.classList.add('burning');
    var ctx = cv.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W, H, sw, sh, noise, mc, mctx, ec, ectx;
    var paper = new Image(); var paperOk = false;
    paper.onload = function(){ paperOk = true; }; paper.src = (SV.assets || 'assets/') + 'paper.jpg';

    function field(){
      sw = Math.max(90, Math.round(window.innerWidth / 5));
      sh = Math.max(70, Math.round(window.innerHeight / 5));
      noise = new Float32Array(sw * sh);
      var oct = [5, 13, 31], amp = [0.52, 0.3, 0.18];
      for(var o = 0; o < 3; o++){
        var gw = oct[o], gh = Math.max(3, Math.round(oct[o] * sh / sw)) + 2;
        var g = new Float32Array(gw * gh);
        for(var i = 0; i < g.length; i++) g[i] = Math.random();
        for(var y = 0; y < sh; y++){
          var fy = y / sh * (gh - 1), y0 = fy | 0, y1 = Math.min(gh - 1, y0 + 1), ty = fy - y0;
          ty = ty * ty * (3 - 2 * ty);
          for(var x = 0; x < sw; x++){
            var fx = x / sw * (gw - 1), x0 = fx | 0, x1 = Math.min(gw - 1, x0 + 1), tx = fx - x0;
            tx = tx * tx * (3 - 2 * tx);
            var a = g[y0*gw+x0], b = g[y0*gw+x1], c = g[y1*gw+x0], d = g[y1*gw+x1];
            var top = a + (b - a) * tx, bot = c + (d - c) * tx;
            noise[y*sw+x] += amp[o] * (top + (bot - top) * ty);
          }
        }
      }

      var seeds = [], n = 3;
      for(var k = 0; k < n; k++) seeds.push([ (0.15 + 0.35 * k + Math.random() * 0.2) * sw, sh * (0.94 + Math.random() * 0.1) ]);
      var maxd = Math.sqrt(sw*sw + sh*sh), mn = 1e9, mx = -1e9;
      for(var y = 0; y < sh; y++) for(var x = 0; x < sw; x++){
        var best = 1e9;
        for(var k = 0; k < seeds.length; k++){
          var dx = x - seeds[k][0], dy = (y - seeds[k][1]) * 0.82;
          var d = Math.sqrt(dx*dx + dy*dy); if(d < best) best = d;
        }
        var i = y*sw + x;
        noise[i] = noise[i] * 0.42 + (best / maxd) * 1.25;
        if(noise[i] < mn) mn = noise[i]; if(noise[i] > mx) mx = noise[i];
      }
      var range = (mx - mn) || 1;
      for(var i = 0; i < noise.length; i++) noise[i] = (noise[i] - mn) / range;
      mc = document.createElement('canvas'); mc.width = sw; mc.height = sh; mctx = mc.getContext('2d');
      ec = document.createElement('canvas'); ec.width = sw; ec.height = sh; ectx = ec.getContext('2d');
    }
    function size(){
      W = cv.width = Math.round(window.innerWidth * dpr);
      H = cv.height = Math.round(window.innerHeight * dpr);
      cv.style.width = window.innerWidth + 'px'; cv.style.height = window.innerHeight + 'px';
      field();
    }
    size();
    window.addEventListener('resize', size);

    var EAT = 0.030, RIM = 0.028, CHAR = 0.055;
    var t0 = null, DUR = 4200;
    function frame(ts){
      if(t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / DUR);
      var p = -0.04 + (k * k * (3 - 2 * k)) * 1.16;

      ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,W,H);

      if(paperOk){
        var r = Math.max(W / paper.width, H / paper.height);
        var pw = paper.width * r, ph = paper.height * r;
        ctx.drawImage(paper, (W - pw) / 2, 0, pw, ph);
        ctx.fillStyle = 'rgba(216,205,178,.35)'; ctx.fillRect(0,0,W,H);
      } else {
        ctx.fillStyle = '#d9cdb0'; ctx.fillRect(0,0,W,H);
      }

      var md = mctx.createImageData(sw, sh), m = md.data;
      var ed = ectx.createImageData(sw, sh), e = ed.data;
      for(var i = 0, j = 0; i < noise.length; i++, j += 4){
        var n = noise[i], dn = n - p;
        if(dn < -EAT){ m[j+3] = 255; }
        else if(dn < 0){
          m[j+3] = Math.round(255 * (1 - (-dn) / EAT));
        }
        if(dn > -EAT * 0.6 && dn < RIM){
          var q = 1 - Math.abs(dn) / RIM;
          e[j]   = 255;
          e[j+1] = Math.round(90 + 120 * q);
          e[j+2] = Math.round(20 + 40 * q);
          e[j+3] = Math.round(235 * Math.max(0, q));
        } else if(dn >= RIM && dn < RIM + CHAR){
          var c = 1 - (dn - RIM) / CHAR;
          e[j] = 58; e[j+1] = 42; e[j+2] = 26;
          e[j+3] = Math.round(200 * c * c);
        }
      }
      mctx.putImageData(md, 0, 0); ectx.putImageData(ed, 0, 0);

      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(ec, 0, 0, W, H);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(mc, 0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';

      if(k < 1) requestAnimationFrame(frame);
      else {
        cv.classList.add('gone'); document.body.classList.remove('burning');
        setTimeout(function(){ cv.remove(); window.removeEventListener('resize', size); }, 600);
      }
    }
    requestAnimationFrame(frame);
  }

  var Pencil = (function(){
    var ctx = null, master = null, noiseBuf = null, armed = false;
    function ensure(){
      if(ctx) return true;
      var AC = window.AudioContext || window.webkitAudioContext; if(!AC) return false;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination);
      var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for(var i=0;i<len;i++) d[i] = (Math.random()*2-1) * (0.6 + 0.4*Math.random());
      noiseBuf = buf; return true;
    }
    function arm(){ if(!ensure()) return; if(ctx.state !== 'running') ctx.resume(); armed = true; }
    ['pointerdown','keydown','touchstart'].forEach(function(ev){ window.addEventListener(ev, arm, {passive:true}); });
    function live(){ return armed && ctx && ctx.state === 'running'; }

    function shade(dur){
      if(!live()) return;
      var t = ctx.currentTime;
      var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      var lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value = 1400;
      var bp = ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value = 700; bp.Q.value = .6;
      var g = ctx.createGain(); g.gain.setValueAtTime(0,t);
      var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 9 + Math.random()*5; lg.gain.value = .12;
      lfo.connect(lg); lg.connect(g.gain);
      g.gain.linearRampToValueAtTime(.28, t+.05);
      g.gain.setValueAtTime(.28, t+dur-.12);
      g.gain.exponentialRampToValueAtTime(.001, t+dur);
      src.connect(lp); lp.connect(bp); bp.connect(g); g.connect(master);
      src.start(t); lfo.start(t); src.stop(t+dur+.05); lfo.stop(t+dur+.05);
    }

    function turn(){
      if(!live()) return;
      var t = ctx.currentTime, dur=.32;
      var src = ctx.createBufferSource(); src.buffer = noiseBuf;
      var lp = ctx.createBiquadFilter(); lp.type='lowpass';
      lp.frequency.setValueAtTime(600,t); lp.frequency.exponentialRampToValueAtTime(3200,t+dur*.5); lp.frequency.exponentialRampToValueAtTime(400,t+dur);
      var g = ctx.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.5,t+.04); g.gain.exponentialRampToValueAtTime(.001,t+dur);
      src.connect(lp); lp.connect(g); g.connect(master); src.start(t); src.stop(t+dur);
    }
    return {shade:shade, turn:turn, live:live};
  })();

  var writeTimers = [], writeGen = 0, hint = document.querySelector('.hint-skip');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function prep(view){
    if(view.dataset.prepped) return; view.dataset.prepped = '1';
    var walker = document.createTreeWalker(view, NodeFilter.SHOW_TEXT, {
      acceptNode: function(n){
        if(!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        if(p.closest('script,style,.frame .hud,.w,.no-write')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }});
    var nodes = []; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(n){
      var parts = n.nodeValue.split(/(\s+)/), frag = document.createDocumentFragment();
      parts.forEach(function(part){
        if(!part) return;
        if(/^\s+$/.test(part)){ frag.appendChild(document.createTextNode(part)); return; }
        var sp = document.createElement('span'); sp.className = 'w'; sp.textContent = part; frag.appendChild(sp);
      });
      n.parentNode.replaceChild(frag, n);
    });
    view.querySelectorAll('figure.plate, .frame, .banner-draw').forEach(function(el){ el.classList.add('dr'); });
  }
  function cancelWrite(){ writeTimers.forEach(clearTimeout); writeTimers = []; writeGen++; hint.classList.remove('show'); }
  function finishWrite(view){
    cancelWrite();
    view.querySelectorAll('.w,.dr,.rl').forEach(function(el){ el.classList.add('on'); });
    document.body.classList.remove('writing');
  }
  function writeIn(view){
    cancelWrite();
    prep(view);
    var banner = document.querySelector('.banner');
    var items = [];

    var seq = document.createTreeWalker(view, NodeFilter.SHOW_ELEMENT, { acceptNode: function(el){
      if(el.classList.contains('w') || el.classList.contains('dr')) return NodeFilter.FILTER_ACCEPT;
      if(el.classList.contains('head')) return NodeFilter.FILTER_ACCEPT;
      return NodeFilter.FILTER_SKIP; }});
    while(seq.nextNode()) items.push(seq.currentNode);
    var words = items.filter(function(e){ return e.classList.contains('w'); }).length;
    if(reduced || words === 0){ finishWrite(view); return; }
    var per = Math.max(5, Math.min(26, 3000 / words));
    var gen = ++writeGen, t = 0;
    document.body.classList.add('writing');
    view.querySelectorAll('.w,.dr,.rl').forEach(function(el){ el.classList.remove('on'); });
    banner.classList.remove('on');

    view.querySelectorAll('.head').forEach(function(h){ h.classList.add('rl'); });

    banner.classList.add('dr');
    writeTimers.push(setTimeout(function(){ if(gen!==writeGen) return; banner.classList.add('on'); Pencil.shade(.9); }, 60));
    t = 380;
    var hidden = function(el){ return !el.offsetParent && getComputedStyle(el).position !== 'fixed'; };
    items.forEach(function(el){
      if(hidden(el)){ el.classList.add('on'); return; }
      var delay = t;
      if(el.classList.contains('w')){
        var len = el.textContent.length;
        writeTimers.push(setTimeout(function(){ if(gen!==writeGen) return; el.classList.add('on'); }, delay));
        t += per + (len > 7 ? per*.5 : 0) + (/[.!?]$/.test(el.textContent) ? per*2 : 0);
      } else if(el.classList.contains('dr')){
        writeTimers.push(setTimeout(function(){ if(gen!==writeGen) return; el.classList.add('on'); Pencil.shade(.85); }, delay));
        t += 420;
      } else {
        writeTimers.push(setTimeout(function(){ if(gen!==writeGen) return; el.classList.add('on'); Pencil.shade(.45); }, delay));
        t += 260;
      }
    });
    writeTimers.push(setTimeout(function(){ if(gen===writeGen){ document.body.classList.remove('writing'); hint.classList.remove('show'); } }, t + 200));
    writeTimers.push(setTimeout(function(){ if(gen===writeGen) hint.classList.add('show'); }, 900));
  }

  document.querySelector('.sheet').addEventListener('click', function(e){
    if(document.body.classList.contains('writing') && !e.target.closest('a,button,summary')){
      finishWrite(document.querySelector('.view.active'));
    }
  });

  var cab = document.querySelector('.cabinet');
  var closeTimer = null, forceShut = false, lastPt = {x:-1, y:-1};

  function inReach(x, y){
    var m = document.querySelector('.cabinet .masthead');
    if(!m) return false;
    var r = m.getBoundingClientRect();
    if(x <= r.right + 18 && x >= r.left - 4 && y >= r.top && y <= r.bottom) return true;
    if(cab.classList.contains('open')){
      var slots = document.querySelectorAll('.slot');
      if(slots.length){
        var a = slots[0].getBoundingClientRect(), z = slots[slots.length - 1].getBoundingClientRect();
        var right = Math.max(z.right, a.right);
        if(x >= r.left && x <= right + 10 && y >= a.top - 14 && y <= a.bottom + 14) return true;
      }
    }
    return false;
  }
  function openDrawer(){
    if(forceShut) return;
    clearTimeout(closeTimer); closeTimer = null;
    cab.classList.add('open');
  }
  function closeDrawer(grace){
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function(){ cab.classList.remove('open'); closeTimer = null; },
                            grace === undefined ? 140 : grace);
  }
  document.addEventListener('pointermove', function(e){
    lastPt.x = e.clientX; lastPt.y = e.clientY;
    if(document.body.classList.contains('burning')) return;
    var inside = inReach(e.clientX, e.clientY);
    if(forceShut){ if(!inside) releaseHold(); return; }
    if(inside) openDrawer(); else if(cab.classList.contains('open')) closeDrawer();
  }, {passive:true});

  cab.addEventListener('pointerenter', function(){ openDrawer(); });
  cab.addEventListener('pointerdown', function(){ openDrawer(); });
  window.addEventListener('blur', function(){ cab.classList.remove('open'); });

  var releaseTimer = null;
  function releaseHold(){
    forceShut = false;
    cab.classList.remove('forceshut');
    clearTimeout(releaseTimer); releaseTimer = null;

    if(inReach(lastPt.x, lastPt.y)) openDrawer();
  }
  function slamShut(){
    forceShut = true;
    clearTimeout(closeTimer); closeTimer = null;
    cab.classList.remove('open');
    cab.classList.add('forceshut');

    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(releaseHold, 1100);

    if(document.activeElement && document.activeElement.closest &&
       document.activeElement.closest('.cabinet')) document.activeElement.blur();
  }

  var opening = false;

  function layDown(a){
    var shot = a.querySelector('.shot'), img = shot && shot.querySelector('img');
    if(!img || reduced) return 0;
    var r = img.getBoundingClientRect();
    if(!r.width || !r.height) return 0;

    var aspect = (img.naturalWidth || 460) / (img.naturalHeight || 920);
    var w0 = r.width, h0 = w0 / aspect;
    var x0 = r.left, y0 = r.top + (r.height - h0) / 2;

    var sheet = document.querySelector('.sheet').getBoundingClientRect();
    var H = Math.min(window.innerHeight * 0.84, 860);
    var W = H * aspect;
    if(W > sheet.width * 0.8){ W = sheet.width * 0.8; H = W / aspect; }
    var scale = W / w0;
    var tx = sheet.left + (sheet.width - W) / 2;
    var ty = (window.innerHeight - H) / 2;

    var el = document.createElement('div'); el.className = 'laid';
    el.style.left = x0 + 'px'; el.style.top = y0 + 'px';
    el.style.width = w0 + 'px'; el.style.height = h0 + 'px';
    var im = document.createElement('img'); im.src = img.currentSrc || img.src;
    el.appendChild(im); document.body.appendChild(el);
    shot.classList.add('emptied');

    requestAnimationFrame(function(){

      el.style.transform = 'translate3d(20px,-16px,0) scale(1.05) rotate(-1.1deg)';
      setTimeout(function(){
        el.style.transform = 'translate3d(' + (tx - x0) + 'px,' + (ty - y0) + 'px,0) scale(' +
                             scale + ') rotate(0deg)';
      }, 150);
    });
    setTimeout(function(){ el.classList.add('fade'); }, 780);
    setTimeout(function(){ el.remove(); shot.classList.remove('emptied'); }, 1200);
    return 620;
  }

  document.querySelectorAll('.file[data-view]').forEach(function(a){
    a.addEventListener('click', function(e){
      var id = a.getAttribute('data-view');
      if(opening) return;
      var cur = document.querySelector('.view.active');
      if(cur && cur.id === 'v-' + id){ e.preventDefault(); slamShut(); return; }
      e.preventDefault(); opening = true;
      a.parentNode.classList.add('opening'); Pencil.turn();
      if(cur) cur.classList.add('leaving');
      cancelWrite();
      var hold = layDown(a);
      slamShut();
      setTimeout(function(){
        a.parentNode.classList.remove('opening'); a.blur();
        if(cur) cur.classList.remove('leaving');
        opening = false;
        go(id, '', a.href);
      }, hold || 360);
    });
  });

  var plates = document.querySelectorAll('.banner .plates img');
  if(plates.length > 1){
    var i = Math.floor(Math.random() * plates.length);
    plates[i].classList.add('on');
    setInterval(function(){
      var prev = i; i = (i + 1) % plates.length;
      plates[i].classList.add('on');
      setTimeout(function(){ plates[prev].classList.remove('on'); }, 6000);
    }, 26000);
  }

  var tc = document.getElementById('tc'), t = 0;
  if(tc) setInterval(function(){
    t++; var pad = function(n){ return String(n).padStart(2,'0'); };
    tc.textContent = pad(Math.floor(t/3600))+':'+pad(Math.floor(t/60)%60)+':'+pad(t%60);
  }, 1000);

  var VIEWS = (window.SILTVALE && SILTVALE.views) || [];

  function makeScope(box){
    var img = box.querySelector('img');
    var zoom = parseFloat(box.getAttribute('data-zoom')) || 2;
    var wrap = box.parentNode;
    var cap = wrap.querySelector('[data-cap]');
    var idx = VIEWS.findIndex(function(v){ return img.getAttribute('src') === v[0]; });
    if(idx < 0) idx = 0;
    var x = 0, y = 0, maxX = 0, maxY = 0, dragging = false, px = 0, py = 0, drift = null, placed = false;

    function clamp(){
      if(x > 0) x = 0; if(y > 0) y = 0;
      if(x < maxX) x = maxX; if(y < maxY) y = maxY;
    }
    function place(){ img.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'; }
    function fit(){
      var bw = box.clientWidth, bh = box.clientHeight;
      if(!bw || !bh || !img.naturalWidth) return;

      var base = Math.max(bw / img.naturalWidth, bh / img.naturalHeight);
      var w = img.naturalWidth * base * zoom, h = img.naturalHeight * base * zoom;
      img.style.width = w + 'px'; img.style.height = h + 'px';
      maxX = bw - w; maxY = bh - h;

      if(!placed && !dragging){ x = maxX / 2; y = maxY / 2; placed = (maxX !== 0 || maxY !== 0); }
      clamp(); place();
    }
    img.addEventListener('load', fit);
    if(img.complete) fit();
    box._fit = fit;   /* a hidden page has no size to measure; the router calls this when it opens */
    window.addEventListener('resize', fit);

    if(window.ResizeObserver){ new ResizeObserver(fit).observe(box); }
    else { var poll = setInterval(function(){ if(box.clientWidth){ fit(); clearInterval(poll); } }, 200); }

    box.addEventListener('pointerdown', function(e){
      dragging = true; px = e.clientX; py = e.clientY;
      box.classList.add('drag','touched');
      box.setPointerCapture && box.setPointerCapture(e.pointerId);
      clearInterval(drift); drift = null;
    });
    box.addEventListener('pointermove', function(e){
      if(!dragging) return;
      x += e.clientX - px; y += e.clientY - py;
      px = e.clientX; py = e.clientY;
      clamp(); place();
    });
    function release(e){
      if(!dragging) return;
      dragging = false; box.classList.remove('drag');
      try{ box.releasePointerCapture && box.releasePointerCapture(e.pointerId); }catch(err){}
    }
    box.addEventListener('pointerup', release);
    box.addEventListener('pointercancel', release);
    box.addEventListener('pointerleave', release);

    box.setAttribute('tabindex','0');
    box.addEventListener('keydown', function(e){
      var d = 40, used = true;
      if(e.key === 'ArrowLeft') x += d; else if(e.key === 'ArrowRight') x -= d;
      else if(e.key === 'ArrowUp') y += d; else if(e.key === 'ArrowDown') y -= d;
      else used = false;
      if(used){ e.preventDefault(); box.classList.add('touched'); clamp(); place(); }
    });

    function show(n){
      idx = (n + VIEWS.length) % VIEWS.length;
      img.src = VIEWS[idx][0];
      placed = false;
      if(cap) cap.textContent = VIEWS[idx][1];
      box.classList.add('touched');
    }
    wrap.querySelectorAll('[data-step]').forEach(function(b){
      b.addEventListener('click', function(){ show(idx + parseInt(b.getAttribute('data-step'), 10)); });
    });
    if(cap && cap.hasAttribute('data-cap')) cap.textContent = VIEWS[idx][1];
  }
  document.querySelectorAll('.scope').forEach(makeScope);

  // recurring weekly events (0 = Sunday) and one-off dated events, injected by the builder
  var WEEKLY = (window.SILTVALE && SILTVALE.weekly) || {};
  var DATED = (window.SILTVALE && SILTVALE.events) || [];
  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

  function esc(t){ return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  (function desk(){
    var calBody = document.querySelector('#cal tbody');
    if(!calBody) return;
    var view = new Date(), today = new Date();

    function drawCal(){
      var y = view.getFullYear(), m = view.getMonth();
      document.getElementById('cal-title').textContent = MONTHS[m] + ' ' + y;
      var first = new Date(y, m, 1).getDay();
      var days = new Date(y, m + 1, 0).getDate();
      var prevDays = new Date(y, m, 0).getDate();
      var evDays = {}, byWeekday = {}, dated = [];
      for(var dn = 1; dn <= days; dn++){
        var wd = new Date(y, m, dn).getDay();
        if(WEEKLY[wd]){
          evDays[dn] = WEEKLY[wd][0];
          (byWeekday[wd] = byWeekday[wd] || []).push(dn);
        }
      }
      var mk = y + '-' + String(m + 1).padStart(2, '0') + '-';
      DATED.forEach(function(ev){
        if(!ev || !ev.date || String(ev.date).slice(0, 8) !== mk) return;
        var dd = parseInt(String(ev.date).slice(8, 10), 10);
        if(!(dd >= 1 && dd <= days)) return;
        evDays[dd] = ev.color || 'ev-a';
        dated.push([dd, ev]);
      });
      dated.sort(function(a, b){ return a[0] - b[0]; });
      var html = '', cell = 0;
      for(var w = 0; w < 6; w++){
        html += '<tr>';
        for(var d = 0; d < 7; d++, cell++){
          var n = cell - first + 1, cls = [], label = n;
          if(n < 1){ cls.push('out'); label = prevDays + n; }
          else if(n > days){ cls.push('out'); label = n - days; }
          else {
            if(evDays[n]){ cls.push('ev'); cls.push(evDays[n]); }
            if(n === today.getDate() && m === today.getMonth() && y === today.getFullYear()) cls.push('today');
          }
          html += '<td class="' + cls.join(' ') + '">' + label + '</td>';
        }
        html += '</tr>';
        if(cell - first + 1 > days) break;
      }
      calBody.innerHTML = html;

      var DAYNAME = ['Every Sunday','Every Monday','Every Tuesday','Every Wednesday',
                     'Every Thursday','Every Friday','Every Saturday'];
      var list = document.getElementById('cal-events');
      var out = Object.keys(byWeekday).map(Number).sort(function(a,b){ return a - b; }).map(function(wd){
        return '<li><b>' + DAYNAME[wd] + ' &middot; ' + esc(WEEKLY[wd][1]) + '</b>' + esc(WEEKLY[wd][2])
             + '<span class="ev-dates">' + MONTHS[m].slice(0,3) + ' ' + byWeekday[wd].join(', ') + '</span></li>';
      });
      dated.forEach(function(d){
        var ev = d[1];
        out.push('<li><b>' + MONTHS[m].slice(0,3) + ' ' + d[0] + ' &middot; ' + esc(ev.label || 'Event') + '</b>' + esc(ev.desc || '')
             + (ev.time ? '<span class="ev-dates">' + esc(ev.time) + '</span>' : '') + '</li>');
      });
      list.innerHTML = out.length ? out.join('') : '<li class="none">Nothing marked this month.</li>';
    }
    document.getElementById('cal-prev').addEventListener('click', function(){
      view = new Date(view.getFullYear(), view.getMonth() - 1, 1); drawCal();
    });
    document.getElementById('cal-next').addEventListener('click', function(){
      view = new Date(view.getFullYear(), view.getMonth() + 1, 1); drawCal();
    });
    drawCal();

    var ART = (window.SILTVALE && SILTVALE.art && SILTVALE.art.length) ? SILTVALE.art : [[(SV.assets || 'assets/') + 'dither/carta-marina-p.png','Untitled','unattributed']];
    var ai = Math.floor(Math.random() * ART.length);
    var aImg = document.getElementById('art-img'), aCap = document.getElementById('art-cap'), aBy = document.getElementById('art-by');
    function drawArt(){ aImg.src = ART[ai][0]; aCap.textContent = ART[ai][1]; aBy.textContent = '— ' + ART[ai][2]; }
    function step(n){ ai = (ai + n + ART.length) % ART.length; drawArt(); }
    document.getElementById('art-prev').addEventListener('click', function(){ step(-1); });
    document.getElementById('art-next').addEventListener('click', function(){ step(1); });
    drawArt();
    setInterval(function(){ step(1); }, 14000);

    var LINES = (window.SILTVALE && SILTVALE.quotes && SILTVALE.quotes.length) ? SILTVALE.quotes : ['Never turn your back.'];
    var qEl = document.getElementById('quote'), qi = Math.floor(Math.random() * LINES.length);
    function drawQuote(){
      qEl.textContent = '“' + LINES[qi] + '”';
      qEl.classList.remove('flick'); void qEl.offsetWidth; qEl.classList.add('flick');
    }
    drawQuote();
    setInterval(function(){ qi = (qi + 1 + Math.floor(Math.random() * (LINES.length - 1))) % LINES.length; drawQuote(); }, 7000);

    var hits = document.getElementById('hits');
    var hr = (window.SILTVALE && SILTVALE.hits) || {min:1400, max:2000};
    var n = hr.min + Math.floor(Math.random() * Math.max(1, hr.max - hr.min));
    hits.textContent = String(n).padStart(7, '0');

    var TRACKS = (window.SILTVALE && SILTVALE.tracks && SILTVALE.tracks.length) ? SILTVALE.tracks : [{name:'Silt Wind', base:64, wind:.30, creak:0, len:210}];

    var tape = new Audio(); tape.preload = 'none'; tape.volume = .85;
    tape.addEventListener('ended', function(){ next(); });
    var ti = 0, actx = null, nodes = null, playing = false, pos = 0, tick = null;
    var btn = document.getElementById('pl-btn'), fill = document.getElementById('pl-fill');
    var tName = document.getElementById('pl-track'), tTime = document.getElementById('pl-time');

    function fmt(s){ var m = Math.floor(s / 60); return m + ':' + String(Math.floor(s % 60)).padStart(2,'0'); }
    function stop(){
      playing = false; btn.innerHTML = '&#9654;'; btn.setAttribute('aria-label','Play');
      clearInterval(tick); tick = null;
      try{ tape.pause(); }catch(e){}
      if(nodes){ try{ nodes.gain.gain.setTargetAtTime(0, actx.currentTime, .3);
        var kill = nodes; setTimeout(function(){ kill.srcs.forEach(function(s){ try{ s.stop(); }catch(e){} }); }, 900);
      }catch(e){} nodes = null; }
    }
    function playing_ui(){
      playing = true; btn.innerHTML = '&#9646;&#9646;'; btn.setAttribute('aria-label','Pause');
    }
    function start(){
      var t0 = TRACKS[ti];
      if(t0.file){
        if(tape.getAttribute('src') !== t0.file){ tape.src = t0.file; tape.currentTime = 0; }
        var pr = tape.play();
        if(pr && pr.catch) pr.catch(function(){ stop(); });
        playing_ui();
        clearInterval(tick);
        tick = setInterval(function(){
          var dur = tape.duration || t0.len;
          pos = tape.currentTime;
          fill.style.width = (pos / dur * 100) + '%';
          tTime.textContent = fmt(pos);
        }, 250);
        return;
      }
      var AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
      if(!actx) actx = new AC();
      if(actx.state !== 'running') actx.resume();
      var t = TRACKS[ti], now = actx.currentTime;
      var gain = actx.createGain(); gain.gain.value = 0; gain.connect(actx.destination);
      gain.gain.setTargetAtTime(.22, now, .8);
      var srcs = [];

      [0, 7].forEach(function(semi, k){
        var o = actx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = t.base * Math.pow(2, semi / 12);
        var lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320 + k * 90; lp.Q.value = 6;
        var g = actx.createGain(); g.gain.value = k ? .16 : .26;
        var lfo = actx.createOscillator(); lfo.frequency.value = .05 + k * .03;
        var lg = actx.createGain(); lg.gain.value = 70;
        lfo.connect(lg); lg.connect(lp.frequency);
        o.connect(lp); lp.connect(g); g.connect(gain);
        o.start(now); lfo.start(now); srcs.push(o, lfo);
      });

      var len = actx.sampleRate * 3, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
      for(var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var nz = actx.createBufferSource(); nz.buffer = buf; nz.loop = true;
      var bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = .7;
      var ng = actx.createGain(); ng.gain.value = t.wind * .5;
      var nl = actx.createOscillator(); nl.frequency.value = .07;
      var nlg = actx.createGain(); nlg.gain.value = t.wind * .34;
      nl.connect(nlg); nlg.connect(ng.gain);
      nz.connect(bp); bp.connect(ng); ng.connect(gain);
      nz.start(now); nl.start(now); srcs.push(nz, nl);

      if(t.creak){
        var cr = actx.createOscillator(); cr.type = 'triangle'; cr.frequency.value = t.base / 2;
        var cg = actx.createGain(); cg.gain.value = 0;
        var cl = actx.createOscillator(); cl.type = 'sine'; cl.frequency.value = .11;
        var clg = actx.createGain(); clg.gain.value = t.creak * .07;
        cl.connect(clg); clg.connect(cg.gain);
        cr.connect(cg); cg.connect(gain);
        cr.start(now); cl.start(now); srcs.push(cr, cl);
      }
      nodes = {gain:gain, srcs:srcs};
      playing_ui();
      clearInterval(tick);
      tick = setInterval(function(){
        pos += 1;
        if(pos >= TRACKS[ti].len){ pos = 0; next(); return; }
        fill.style.width = (pos / TRACKS[ti].len * 100) + '%';
        tTime.textContent = fmt(pos);
      }, 1000);
    }
    function next(){
      var was = playing; stop();
      ti = (ti + 1) % TRACKS.length; pos = 0;
      tName.textContent = TRACKS[ti].name; fill.style.width = '0%'; tTime.textContent = '0:00';
      if(was) start();
    }
    btn.addEventListener('click', function(){ playing ? stop() : start(); });
    var skip = document.getElementById('pl-next');
    skip.addEventListener('click', next);
    skip.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' ') next(); });
    tName.textContent = TRACKS[0].name;
  })();

  var START = fromHash(location.hash) || { view: viewAt(location.pathname) || SV.page || 'home', anchor: '' };
  route(START.view, START.anchor);
  burnAway();

  var saved;
  document.addEventListener('visibilitychange', function(){
    if(document.hidden){ saved = document.title; document.title = (window.SILTVALE && SILTVALE.hiddenTitle) || "Don't look away."; }
    else if(saved){ document.title = saved; }
  });
})();


/* ── in the vale: tap to reveal theme on touch devices ── */
(function(){
  var holds = document.querySelectorAll('.holds .hold');
  if(!holds.length) return;
  Array.prototype.forEach.call(holds, function(btn){
    btn.addEventListener('click', function(){
      var open = btn.classList.contains('on');
      Array.prototype.forEach.call(holds, function(b){ b.classList.remove('on'); });
      if(!open) btn.classList.add('on');
    });
  });
})();


/* ── pixel tavern: sizing + hover/pin reader ── */
(function(){
  var room = document.getElementById('notice-room');
  if(!room) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch   = window.matchMedia('(hover:none)').matches;
  var narrow  = window.matchMedia('(max-width:820px)');

  function size(){ var w = room.getBoundingClientRect().width; if(w) room.style.setProperty('--rw', Math.round(w)); }
  if('ResizeObserver' in window) new ResizeObserver(size).observe(room);
  window.addEventListener('resize', size);
  window.addEventListener('hashchange', function(){ setTimeout(size, 50); });
  size();

  var sheet   = room.querySelector('.wsheet');
  var stext   = room.querySelector('.wsheet .rtext');
  var reader  = room.parentNode.querySelector('.room-reader');
  var posters = Array.prototype.slice.call(room.querySelectorAll('.wp'));
  var emptyHTML = stext.innerHTML;
  var pinned = null;

  function card(p){
    var art = p.closest('.wp-item');
    var ack = art ? art.querySelector('.p-ack') : null;
    var nm  = p.querySelector('.pname').cloneNode(true);
    var al  = nm.querySelector('i'); var alTxt = al ? al.textContent.trim() : '';
    if(al) al.parentNode.removeChild(al);
    var role = p.getAttribute('data-role') || '';
    var no   = p.getAttribute('data-no') || '';
    var pend = p.classList.contains('pending');
    return '<div class="rcard">'
      + '<div class="rhead"><span>Notice \u2116 ' + no + '</span><b>' + (pend ? 'Pending' : 'Acknowledged') + '</b></div>'
      + '<h3>' + nm.textContent.trim() + (alTxt ? ' <i>' + alTxt + '</i>' : '') + '</h3>'
      + (role && role !== 'Not yet recorded' ? '<div class="rrole">' + role + '</div>' : '')
      + '<div class="rbody">' + (ack ? ack.innerHTML : '') + '</div>'
      + '<div class="rfoot">' + (pinned === p ? (touch ? 'Pinned \u2014 tap again to release' : 'Pinned \u2014 click again or press Esc to release')
                                              : (touch ? 'Tap again to pin this notice' : 'Click to pin this notice')) + '</div>'
      + '</div>';
  }
  function render(p){
    var html = p ? card(p) : emptyHTML;
    var pend = !!(p && p.classList.contains('pending'));
    stext.innerHTML = html; reader.innerHTML = html;
    stext.classList.toggle('is-pending', pend); reader.classList.toggle('is-pending', pend);
    sheet.classList.toggle('fwd', !!p);
  }
  function unpin(){ if(!pinned) return; pinned.classList.remove('on'); pinned.setAttribute('aria-pressed','false'); pinned = null; }

  posters.forEach(function(p){
    p.addEventListener('pointerenter', function(){ if(!pinned) render(p); });
    p.addEventListener('pointerleave', function(){ if(!pinned) render(null); });
    p.addEventListener('focus', function(){ if(!pinned) render(p); });
    p.addEventListener('blur',  function(){ if(!pinned) render(null); });
    p.addEventListener('click', function(){
      if(pinned === p){ unpin(); render(null); return; }
      unpin(); pinned = p; p.classList.add('on'); p.setAttribute('aria-pressed','true'); render(p);
      if(narrow.matches) reader.scrollIntoView({ block:'nearest', behavior: reduced ? 'auto' : 'smooth' });
    });
  });
  room.addEventListener('click', function(e){ if(pinned && !e.target.closest('.wp')){ unpin(); render(null); } });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && pinned){ var was = pinned; unpin(); render(null); was.focus(); }
  });
})();
