/* SOMA dashboard sign-in gate: decrypts data.enc.js, then loads app.js. */
(function () {
  var E = window.SOMA_ENC, S = window.crypto && window.crypto.subtle;
  var form = document.querySelector('#gate form'), err = document.querySelector('#gate .err');
  var btn = form.querySelector('button'), KEY = 'soma_k_v1';
  function ub(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function bu(u) { var s = ''; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function run(code) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      s.onload = res; s.onerror = rej; document.body.appendChild(s);
    });
  }
  function loadApp() {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'app.js'; s.onload = res; s.onerror = rej; document.body.appendChild(s);
    });
  }
  function open(K) {
    return S.importKey('raw', K, 'AES-GCM', false, ['decrypt'])
      .then(function (k) { return S.decrypt({ name: 'AES-GCM', iv: ub(E.iv) }, k, ub(E.ct)); })
      .then(function (pt) {
        document.body.classList.remove('is-locked');
        return run(new TextDecoder().decode(pt));
      })
      .then(function () { try { sessionStorage.setItem(KEY, bu(K)); } catch (e) {} });
  }
  function unwrap(u, p) {
    var a = E.users[u]; if (!a) return Promise.reject(new Error('bad'));
    return S.importKey('raw', new TextEncoder().encode(u + ':' + p), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) { return S.deriveKey({ name: 'PBKDF2', salt: ub(a.salt), iterations: E.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']); })
      .then(function (kek) { return S.decrypt({ name: 'AES-GCM', iv: ub(a.iv) }, kek, ub(a.wk)); })
      .then(function (K) { return new Uint8Array(K); });
  }
  if (!E || !S) { err.textContent = 'This browser cannot open the dashboard. Try Safari or Chrome.'; return; }
  var saved = null; try { saved = sessionStorage.getItem(KEY); } catch (e) {}
  if (saved) open(ub(saved)).catch(function () { try { sessionStorage.removeItem(KEY); } catch (e) {} document.body.classList.add('is-locked'); });
  else setTimeout(function () { document.getElementById('gate-u').focus(); }, 50);
  form.addEventListener('submit', function (ev) {
    ev.preventDefault(); err.textContent = ''; btn.disabled = true; btn.textContent = 'Checking…';
    var u = document.getElementById('gate-u').value.trim().toLowerCase(), p = document.getElementById('gate-p').value;
    unwrap(u, p).then(open).catch(function () {
      btn.disabled = false; btn.textContent = 'View dashboard';
      err.textContent = 'That username and password don\u2019t match.';
      document.getElementById('gate-p').select();
    });
  });
})();
