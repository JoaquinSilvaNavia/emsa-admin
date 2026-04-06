/**
 * emsa-auth.js v2 — Autenticacion y permisos EMSA
 * Sheet usuarios: 1dwkZj1-FH3IfVAeHh70R45FgkKPWykruEFqUwQTH-z0
 * Sesion: 7 dias
 */
(function(){
  var AK   = 'AIzaSyCXaM0fXC-6H-Pz22uRTv52uMe3xtIoLkU';
  var SID  = '1dwkZj1-FH3IfVAeHh70R45FgkKPWykruEFqUwQTH-z0';
  var DBID = window.EMSA_DASHBOARD_ID || 'emsa-unknown';
  var SK   = 'emsa_s_' + DBID;
  var SESS_TTL = 7 * 24 * 3600 * 1000; // 7 dias

  var LABELS = {
    'emsa-proveedores':'Proveedores x Pagar',
    'emsa-clientes':'Clientes x Cobrar',
    'emsa-ventas':'Ventas & Produccion',
    'emsa-stock':'Stock de Inventario',
    'emsa-home':'Dashboard Ejecutivo'
  };

  // --- Verificar sesion guardada ----------------------------------
  var _user = null, _perms = null;
  try {
    var saved = JSON.parse(localStorage.getItem(SK) || 'null');
    if (saved && saved.expires > Date.now()) {
      _user = saved.user;
      _perms = saved.perms;
    }
  } catch(e) { localStorage.removeItem(SK); }

  if (_user) {
    document.addEventListener('DOMContentLoaded', function() { _callOk(); });
    return;
  }

  // --- Inyectar pantalla de login ---------------------------------
  var CSS = '<style>' +
    '#_ea_wall{position:fixed;inset:0;background:#080b12;display:flex;align-items:center;justify-content:center;z-index:9999;font-family:DM Sans,system-ui,sans-serif}' +
    '._ea_box{background:#111827;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:36px 44px;width:320px;text-align:center}' +
    '._ea_logo{font-size:28px;font-weight:700;color:#e8eaf0;margin-bottom:4px}' +
    '._ea_sub{font-size:12px;color:#7a7f94;margin-bottom:22px}' +
    '._ea_box input{width:100%;padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#e8eaf0;font-size:14px;outline:none;margin-bottom:8px;box-sizing:border-box;text-align:center;font-family:inherit}' +
    '._ea_box input:focus{border-color:#2e74b5}' +
    '._ea_pwd{letter-spacing:2px}' +
    '._ea_btn{width:100%;padding:11px;border-radius:8px;background:#2e74b5;color:#fff;font-size:14px;font-weight:600;border:none;cursor:pointer;font-family:inherit}' +
    '._ea_btn:hover{background:#2563a0}' +
    '._ea_btn:disabled{opacity:.6;cursor:not-allowed}' +
    '._ea_err{font-size:12px;color:#e05a5a;margin-top:8px;min-height:16px}' +
  '</style>';

  document.addEventListener('DOMContentLoaded', function() {
    var div = document.createElement('div');
    div.id = '_ea_wall';
    div.innerHTML = CSS +
      '<div class="_ea_box">' +
        '<div class="_ea_logo">EMSA</div>' +
        '<div class="_ea_sub" id="_ea_lbl">' + (LABELS[DBID] || DBID) + '</div>' +
        '<input type="text" id="_ea_u" placeholder="Usuario" autocomplete="username">' +
        '<input type="password" id="_ea_p" placeholder="Clave" class="_ea_pwd">' +
        '<button class="_ea_btn" id="_ea_btn" onclick="_eaLogin()">Ingresar</button>' +
        '<div class="_ea_err" id="_ea_err"></div>' +
      '</div>';
    document.body.appendChild(div);
    document.getElementById('_ea_u').focus();
    document.getElementById('_ea_p').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') _eaLogin();
    });
  });

  // --- Login ------------------------------------------------------
  window._eaLogin = function() {
    var u = (document.getElementById('_ea_u').value || '').trim().toLowerCase();
    var p = document.getElementById('_ea_p').value || '';
    var btn = document.getElementById('_ea_btn');
    var err = document.getElementById('_ea_err');
    if (!u || !p) { err.textContent = 'Ingresa usuario y clave'; return; }
    btn.textContent = 'Verificando...'; btn.disabled = true; err.textContent = '';

    Promise.all([_fetch('usuarios'), _fetch('permisos')])
      .then(function(res) {
        var users = res[0], permsAll = res[1];
        var found = users.filter(function(r) {
          return r.USUARIO && r.USUARIO.trim().toLowerCase() === u &&
                 r.CLAVE && r.CLAVE.trim() === p &&
                 r.ACTIVO === 'SI';
        })[0];
        if (!found) {
          err.textContent = 'Usuario o clave incorrectos';
          btn.textContent = 'Ingresar'; btn.disabled = false; return;
        }
        var myPerms = permsAll.filter(function(r) {
          return r.USUARIO && r.USUARIO.trim().toLowerCase() === u &&
                 (r.DASHBOARD === DBID || r.DASHBOARD === '*');
        });
        if (!myPerms.length) {
          err.textContent = 'Sin acceso a este modulo. Contactar administrador.';
          btn.textContent = 'Ingresar'; btn.disabled = false; return;
        }
        _saveSession(found, myPerms);
      })
      .catch(function(e) {
        // Fallback: clave maestra mientras no haya Sheet configurado
        if (p === 'LuisSilvaEMSA') {
          _saveSession({USUARIO:u,NOMBRE:'Admin',ACTIVO:'SI'},
                       [{USUARIO:u,DASHBOARD:DBID,PESTANAS:'*'}]);
        } else {
          err.textContent = 'Error: ' + e.message;
          btn.textContent = 'Ingresar'; btn.disabled = false;
        }
      });
  };

  function _saveSession(user, perms) {
    _user = user; _perms = perms;
    try {
      localStorage.setItem(SK, JSON.stringify({
        user: user, perms: perms,
        expires: Date.now() + SESS_TTL
      }));
    } catch(e) {}
    var wall = document.getElementById('_ea_wall');
    if (wall) wall.remove();
    _callOk();
  }

  function _fetch(tab) {
    return fetch('https://sheets.googleapis.com/v4/spreadsheets/' + SID +
                 '/values/' + tab + '!A:Z?key=' + AK)
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(d) {
        var rows = d.values || [];
        if (rows.length < 2) return [];
        var h = rows[0];
        return rows.slice(1).map(function(row) {
          var o = {};
          h.forEach(function(k, i) { o[k] = row[i] !== undefined ? String(row[i]).trim() : ''; });
          return o;
        });
      });
  }

  function _callOk() {
    if (typeof window.onEmsaAuthOk === 'function') window.onEmsaAuthOk(_user, _perms);
  }

  // --- API publica ------------------------------------------------
  window.emsaCanViewTab = function(tabName) {
    if (!_perms || !_perms.length) return false;
    var p = _perms.filter(function(x) {
      return x.DASHBOARD === DBID || x.DASHBOARD === '*';
    })[0];
    if (!p) return false;
    if (!p.PESTANAS || p.PESTANAS === '*') return true;
    return p.PESTANAS.split(',').map(function(x) { return x.trim(); }).indexOf(tabName) >= 0;
  };

  window.emsaCurrentUser = function() { return _user; };

  window.emsaLogout = function() {
    localStorage.removeItem(SK);
    location.reload();
  };
})();
