// SOMA hero scene lifecycle, around the untouched LiveKit factories (pattern from the library's
// HAI recorder example interaction.js). 30fps cap on requestAnimationFrame, pause on parent request,
// hidden tab, or offscreen; reduced motion freezes everything.
(function(){
  var nRAF=window.requestAnimationFrame.bind(window),nCancel=window.cancelAnimationFrame.bind(window),nInterval=window.setInterval.bind(window);
  var queue=new Map(),seq=0,last=0,ticking=0,paused=false,parentPaused=false,parentVisible=true;
  var FRAME=1000/30,rm=matchMedia('(prefers-reduced-motion: reduce)');
  function pump(t){ticking=0;if(paused)return;if(t-last<FRAME-1){ticking=nRAF(pump);return;}last=t;var cbs=Array.from(queue.values());queue.clear();cbs.forEach(function(cb){try{cb(t);}catch(e){setTimeout(function(){throw e;});}});if(queue.size&&!ticking)ticking=nRAF(pump);}
  window.requestAnimationFrame=function(cb){var id=++seq;queue.set(id,cb);if(!ticking&&!paused)ticking=nRAF(pump);return id;};
  window.cancelAnimationFrame=function(id){queue.delete(id);};
  window.setInterval=function(cb,ms){var a=[].slice.call(arguments,2);return nInterval(function(){if(!paused)cb.apply(null,a);},ms);};
  function sync(){var next=parentPaused||!parentVisible||document.hidden||rm.matches;if(next===paused)return;paused=next;document.body&&(document.body.dataset.paused=String(paused));
    document.querySelectorAll('svg').forEach(function(s){try{paused?s.pauseAnimations():s.unpauseAnimations();}catch(e){}});
    if(!paused&&queue.size&&!ticking)ticking=nRAF(pump);
    try{parent.postMessage({type:'soma-hero-state',paused:paused},location.origin==='null'?'*':location.origin);}catch(e){}}
  addEventListener('message',function(ev){if(ev.source!==parent||!ev.data||ev.data.type!=='soma-hero-motion')return;parentPaused=ev.data.paused===true;parentVisible=ev.data.visible!==false;sync();});
  document.addEventListener('visibilitychange',sync);
  function fit(){var w=innerWidth,h=innerHeight;document.documentElement.style.setProperty('--fit',Math.min(w/1280,h/760));}
  addEventListener('resize',fit);
  document.addEventListener('DOMContentLoaded',function(){fit();sync();
    // report first paint so the host can swap poster -> live scene
    var t0=performance.now();(function wait(){if(window.__somaSceneMounted&&document.querySelector('.lkStage img')){parent.postMessage({type:'soma-hero-ready'},location.origin==='null'?'*':location.origin);return;}if(performance.now()-t0<8000)setTimeout(wait,120);})();
  });
})();
