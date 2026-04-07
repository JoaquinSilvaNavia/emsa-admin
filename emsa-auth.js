/**
 * emsa-auth.js v3 — Autenticacion y permisos EMSA
 * Sheet: 1dwkZj1-FH3IfVAeHh70R45FgkKPWykruEFqUwQTH-z0
 *
 * ESTRUCTURA PERMISOS (tab "permisos", una fila por usuario):
 *   USUARIO | emsa-proveedores | emsa-proveedores:buscar | emsa-proveedores:resumen | ...
 *   SI = acceso permitido, NO = bloqueado, vacio = permitido por defecto
 *
 * Sesion: 7 dias en localStorage
 */
(function () {
  var AK = 'AIzaSyCXaM0fXC-6H-Pz22uRTv52uMe3xtIoLkU';
  var SID = '1dwkZj1-FH3IfVAeHh70R45FgkKPWykruEFqUwQTH-z0';
  var DBID = window.EMSA_DASHBOARD_ID || 'emsa-unknown';
  var SK = 'emsa_s_' + DBID;
  var SESS_TTL = 7 * 24 * 3600 * 1000;

  var LABELS = {
    'emsa-proveedores': 'Proveedores x Pagar',
    'emsa-clientes': 'Clientes x Cobrar',
    'emsa-ventas': 'Ventas & Produccion',
    'emsa-stock': 'Stock de Inventario',
    'emsa-home': 'Dashboard Ejecutivo'
  };

  // --- Restaurar sesion guardada
  var _user = null, _perms = null;
  try {
    var saved = JSON.parse(localStorage.getItem(SK) || 'null');
    if (saved && saved.expires > Date.now()) {
      _user = saved.user;
      _perms = saved.perms;
    }
  } catch (e) { localStorage.removeItem(SK); }

  if (_user) {
    document.addEventListener('DOMContentLoaded', function () { _callOk(); });
    return;
  }

  // --- Inyectar pantalla de login
  document.addEventListener('DOMContentLoaded', function () {
    var css = [
      '<style>',
      '#_ea_wall{position:fixed;inset:0;background:#080b12;display:flex;align-items:center;justify-content:center;z-index:99999;font-family:system-ui,sans-serif;}',
      '._ea_box{background:#111827;border:1px solid #1f2937;border-radius:12px;padding:40px 36px;width:340px;text-align:center;}',
      '._ea_logo{color:#60a5fa;font-size:22px;font-weight:700;letter-spacing:2px;margin-bottom:4px;}',
      '._ea_sub{color:#6b7280;font-size:13px;margin-bottom:28px;}',
      '._ea_lbl{display:block;text-align:left;color:#9ca3af;font-size:12px;margin-bottom:5px;}',
      '._ea_inp{width:100%;box-sizing:border-box;background:#1f2937;border:1px solid #374151;color:#f9fafb;padding:10px 12px;border-radius:8px;font-size:14px;margin-bottom:16px;}',
      '._ea_inp:focus{outline:none;border-color:#3b82f6;}',
      '._ea_btn{width:100%;background:#2563eb;color:#fff;border:none;padding:11px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px;}',
      '._ea_btn:hover{background:#1d4ed8;}',
      '._ea_btn:disabled{opacity:.5;cursor:default;}',
      '._ea_err{color:#f87171;font-size:13px;margin-top:12px;min-height:20px;}',
      '._ea_dbname{color:#374151;font-size:11px;margin-top:18px;}',
      '</style>'
    ].join('');

    var html = [
      '<div class="_ea_box">',
      '<div class="_ea_logo">EMSA</div>',
      '<div class="_ea_sub">' + (LABELS[DBID] || DBID) + '</div>',
      '<label class="_ea_lbl">Usuario</label>',
      '<input id="_ea_u" class="_ea_inp" type="text" autocomplete="username" placeholder="tu usuario"/>',
      '<label class="_ea_lbl">Clave</label>',
      '<input id="_ea_p" class="_ea_inp" type="password" autocomplete="current-password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"/>',
      '<button id="_ea_btn" class="_ea_btn" onclick="_eaLogin()">Ingresar</button>',
      '<div id="_ea_err" class="_ea_err"></div>',
      '<div class="_ea_dbname">' + DBID + '</div>',
      '</div>'
    ].join('');

    var div = document.createElement('div');
    div.id = '_ea_wall';
    div.innerHTML = css + html;
    document.body.appendChild(div);
    document.getElementById('_ea_u').focus();
    document.getElementById('_ea_p').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') window._eaLogin();
    });
  });

  // --- Login
  window._eaLogin = function () {
    var u = (document.getElementById('_ea_u').value || '').trim().toLowerCase();
    var p = (document.getElementById('_ea_p').value || '').trim();
    var btn = document.getElementById('_ea_btn');
    var err = document.getElementById('_ea_err');
    if (!u || !p) { err.textContent = 'Ingresa usuario y clave'; return; }
    btn.textContent = 'Verificando...'; btn.disabled = true; err.textContent = '';

    Promise.all([_fetch('usuarios'), _fetch('permisos')])
      .then(function (res) {
        var users = res[0], permsAll = res[1];

        // Validar usuario — ACTIVO insensible a mayusculas y espacios
        var found = users.filter(function (r) {
          return r.USUARIO && r.USUARIO.trim().toLowerCase() === u
            && r.CLAVE && r.CLAVE.trim() === p
            && r.ACTIVO && r.ACTIVO.trim().toUpperCase() === 'SI';
        })[0];

        if (!found) {
          err.textContent = 'Usuario o clave incorrectos';
          btn.textContent = 'Ingresar'; btn.disabled = false;
          return;
        }

        // Buscar fila de permisos (una sola fila por Usuario — formato matriz)
        var myPerms = permsAll.filter(function (r) {
          return r.USUARIO && r.USUARIO.trim().toLowerCase() === u;
        })[0];

        if (!myPerms) {
          err.textContent = 'Sin permisos configurados. Contactar administrador.';
          btn.textContent = 'Ingresar'; btn.disabled = false;
          return;
        }

        // Verificar acceso al dashboard actual
        var dashVal = (myPerms[DBID] || '').trim().toUpperCase();
        if (dashVal !== 'SI') {
          err.textContent = 'Sin acceso a este modulo. Contactar administrador.';
          btn.textContent = 'Ingresar'; btn.disabled = false;
          return;
        }

        _saveSession(found, myPerms);
      })
      .catch(function (e) {
        // Fallback admin de emergencia (solo si Sheets no responde)
        if (p === 'LuisSilvaEMSA') {
          var adminPerms = { USUARIO: u };
          adminPerms[DBID] = 'SI';
          _saveSession({ USUARIO: u, NOMBRE: 'Admin', ACTIVO: 'SI' }, adminPerms);
        } else {
          err.textContent = 'Error de conexion: ' + e.message;
          btn.textContent = 'Ingresar'; btn.disabled = false;
        }
      });
  };

  function _saveSession(user, perms) {
    _user = user; _perms = perms;
    try {
      localStorage.setItem(SK, JSON.stringify({
        user: user, perms: perms, expires: Date.now() + SESS_TTL
      }));
    } catch (e) {}
    var wall = document.getElementById('_ea_wall');
    if (wall) wall.remove();
    _callOk();
  }

  // Fetch de Sheets — rango amplio A:AZ para no truncar columnas
  function _fetch(tab) {
    return fetch('https://sheets.googleapis.com/v4/spreadsheets/' + SID
      + '/values/' + tab + '!A:AZ?key=' + AK)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        var rows = d.values || [];
        if (rows.length < 2) return [];
        var h = rows[0];
        return rows.slice(1).map(function (row) {
          var o = {};
          h.forEach(function (k, i) {
            o[k] = row[i] !== undefined ? String(row[i]).trim() : '';
          });
          return o;
        });
      });
  }

  function _callOk() {
    if (typeof window.onEmsaAuthOk === 'function')
      window.onEmsaAuthOk(_user, _perms);
  }

  // --- API publica

  /**
   * Verifica si el usuario puede ver un tab en el dashboard actual.
   * Logica: columna "DBID:tabName" en permisos.
   *   SI  → permitido
   *   NO  → bloqueado
   *   (vacio o columna inexistente) → permitido por defecto
   */
  window.emsaCanViewTab = function (tabName) {
    if (!_perms) return false;
    var key = DBID + ':' + tabName;
    var val = (_perms[key] || '').trim().toUpperCase();
    if (val === '') return true;
    return val === 'SI';
  };

  /**
   * Verifica si el usuario tiene acceso a cualquier otro dashboard.
   * Util para mostrar/ocultar links de navegacion entre modulos.
   */
  window.emsaCanAccessDashboard = function (dashId) {
    if (!_perms) return false;
    return (_perms[dashId] || '').trim().toUpperCase() === 'SI';
  };

  /** Datos del usuario logueado */
  window.emsaCurrentUser = function () { return _user; };

  /** Cerrar sesion */
  window.emsaLogout = function () {
    localStorage.removeItem(SK);
    location.reload();
  };
})();
