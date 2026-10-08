(function(){
'use strict';

var SUPABASE_URL = 'https://grrgwxcagvvafdmzsmro.supabase.co';
var SUPABASE_KEY = 'sb_publishable_oB4NBGpLlz7VPU2g7MhT0Q_Na7z5rO8';

if(!window.supabase){
  document.body.innerHTML = '<div style="padding:20px;color:#f88;background:#111;font-family:monospace;height:100vh"><h2>Erro</h2><pre>Biblioteca Supabase nao carregou. Verifique a internet e recarregue.</pre></div>';
  return;
}

var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true } });
var $ = function(id){ return document.getElementById(id); };

function esc(s){
  return String(s == null ? '' : s)
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split(String.fromCharCode(34)).join('&quot;')
    .split(String.fromCharCode(39)).join('&#39;');
}

function toast(m, cls){
  var t = $('toast');
  if(!t) return;
  t.textContent = m;
  t.className = 'toast on ' + (cls || '');
  clearTimeout(t._t);
  t._t = setTimeout(function(){ t.className = 'toast'; }, 2600);
}

function showMsg(id, txt, kind){
  var el = $(id);
  if(!el) return;
  el.className = 'msg ' + (kind || '');
  el.textContent = txt || '';
}

function closeModal(){ var m = $('modalBg'); if(m) m.classList.remove('on'); }
function openModal(html){ $('modalBox').innerHTML = html; $('modalBg').classList.add('on'); }
$('modalBg').addEventListener('click', function(e){ if(e.target === $('modalBg')) closeModal(); });

function traduzErro(m){
  if(!m) return 'Erro desconhecido.';
  var M = String(m).toLowerCase();
  if(M.indexOf('already registered') >= 0 || M.indexOf('user already') >= 0) return 'Usuário já existe.';
  if(M.indexOf('invalid login') >= 0) return 'Usuário ou senha inválidos.';
  if(M.indexOf('password') >= 0 && M.indexOf('6') >= 0) return 'Senha: mínimo 6 caracteres.';
  if(M.indexOf('rate limit') >= 0) return 'Muitas tentativas. Aguarde um minuto.';
  if(M.indexOf('network') >= 0 || M.indexOf('fetch') >= 0) return 'Sem conexão com o servidor.';
  return m;
}

var state = {
  user: null, profile: null, campaign: null, role: null,
  character: null, sheet: null, tokens: [], scene: null,
  combat: null, log: [], channel: null
};

function ensureProfile(userId, usernameHint){
  return sb.from('profiles').select('*').eq('id', userId).maybeSingle().then(function(r){
    if(r.data) return r.data;
    var base = String(usernameHint || 'user_' + userId.slice(0,8)).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
    if(base.length < 3) base = 'user_' + userId.slice(0, 8);
    return sb.from('profiles').insert({ id: userId, username: base }).select().single().then(function(r2){
      if(r2.error) throw new Error('Erro ao criar perfil: ' + r2.error.message);
      return r2.data;
    });
  });
}

function show(id){
  var screens = document.querySelectorAll('.screen');
  for(var i = 0; i < screens.length; i++) screens[i].classList.remove('on');
  $(id).classList.add('on');
}

var authTabs = document.querySelectorAll('.auth-tabs button');
for(var ti = 0; ti < authTabs.length; ti++){
  (function(b){
    b.onclick = function(){
      var all = document.querySelectorAll('.auth-tabs button');
      for(var j = 0; j < all.length; j++) all[j].classList.remove('on');
      b.classList.add('on');
      var w = b.getAttribute('data-auth');
      $('formLogin').classList.toggle('on', w === 'login');
      $('formSignup').classList.toggle('on', w === 'signup');
      showMsg('msgLogin', ''); showMsg('msgSignup', '');
    };
  })(authTabs[ti]);
}

$('btnLogin').onclick = function(){
  var u = $('loginUser').value.trim().toLowerCase();
  var p = $('loginPass').value;
  if(!u || !p){ showMsg('msgLogin', 'Preencha usuário e senha.', 'err'); return; }
  showMsg('msgLogin', 'Entrando...', '');
  $('btnLogin').disabled = true;
  sb.auth.signInWithPassword({ email: u + '@vinculo.local', password: p }).then(function(r){
    if(r.error){ showMsg('msgLogin', traduzErro(r.error.message), 'err'); $('btnLogin').disabled = false; return; }
    if(!r.data.session){ showMsg('msgLogin', 'Sessão não criada.', 'err'); $('btnLogin').disabled = false; return; }
  }).catch(function(e){ showMsg('msgLogin', traduzErro(e.message), 'err'); $('btnLogin').disabled = false; });
};
$('loginPass').addEventListener('keydown', function(e){ if(e.key === 'Enter') $('btnLogin').click(); });

$('btnSignup').onclick = function(){
  var u = $('signUser').value.trim().toLowerCase();
  var p = $('signPass').value;
  var p2 = $('signPass2').value;
  if(!/^[a-z0-9_]{3,20}$/.test(u)){ showMsg('msgSignup', 'Usuário: 3-20 caracteres, apenas letras minúsculas, números e _', 'err'); return; }
  if(p.length < 6){ showMsg('msgSignup', 'Senha: mínimo 6 caracteres', 'err'); return; }
  if(p !== p2){ showMsg('msgSignup', 'Senhas não conferem', 'err'); return; }
  showMsg('msgSignup', 'Criando...', '');
  $('btnSignup').disabled = true;
  sb.auth.signUp({
    email: u + '@vinculo.local',
    password: p,
    options: { data: { username: u } }
  }).then(function(r){
    if(r.error){ showMsg('msgSignup', traduzErro(r.error.message), 'err'); $('btnSignup').disabled = false; return; }
    if(!r.data.session){
      showMsg('msgSignup', 'Conta criada, mas falta confirmar e-mail. Desligue "Confirm email" no Supabase (Authentication -> Providers -> Email).', 'err');
      $('btnSignup').disabled = false;
      return;
    }
    ensureProfile(r.data.user.id, u).then(function(){
      showMsg('msgSignup', 'Bem-vindo!', 'ok');
    }).catch(function(e){
      showMsg('msgSignup', e.message, 'err');
      $('btnSignup').disabled = false;
    });
  }).catch(function(e){ showMsg('msgSignup', traduzErro(e.message), 'err'); $('btnSignup').disabled = false; });
};
$('signPass2').addEventListener('keydown', function(e){ if(e.key === 'Enter') $('btnSignup').click(); });

$('btnLogout').onclick = function(){
  if(state.channel) sb.removeChannel(state.channel);
  sb.auth.signOut().then(function(){ location.reload(); });
};

sb.auth.onAuthStateChange(function(ev, session){
  if(session && session.user){
    state.user = session.user;
    if(ev === 'TOKEN_REFRESHED' || ev === 'USER_UPDATED') return;
    if(state.profile && state.profile.id === session.user.id) return; // já logado: não derrubar da mesa
    setTimeout(function(){ // chamadas ao Supabase fora do callback (evita deadlock do supabase-js v2)
      ensureProfile(session.user.id, session.user.user_metadata && session.user.user_metadata.username)
        .then(function(prof){ state.profile = prof; enterLobby(); })
        .catch(function(e){ toast(e.message, 'err'); });
    }, 0);
  } else {
    state.user = null; state.profile = null;
    show('screenAuth');
  }
});

function applyRoleUI(){ document.body.classList.toggle('is-gm', state.role === 'GM'); }

function enterLobby(){
  document.body.classList.remove('is-gm');
  show('screenLobby');
  $('lobbyUser').textContent = (state.profile && state.profile.username) || '—';
  loadRooms();
}

function loadRooms(){
  sb.rpc('lobby_list').then(function(r){
    var box = $('roomsList');
    if(r.error){ box.innerHTML = '<div class="empty">Erro: ' + esc(r.error.message) + '</div>'; return; }
    var minhas = (r.data || []).filter(function(x){ return x.meu_papel; });
    if(!minhas.length){ box.innerHTML = '<div class="empty">Nenhuma mesa ainda.</div>'; return; }
    box.innerHTML = minhas.map(function(x){
      var gm = String(x.meu_papel || '').toUpperCase() === 'GM';
      var n = Number(x.participantes) || 0;
      return '<div class="room-item' + (gm ? ' is-gm' : '') + '">' +
        '<div class="v-seal" aria-hidden="true"><span>' + esc(x.id) + '</span></div>' +
        '<div class="info"><div class="room-name">' + esc(x.name) + '</div>' +
        '<div class="meta">' + n + ' participante' + (n === 1 ? '' : 's') + ' · ' + (gm ? 'Mestre' : 'Jogador') + '</div></div>' +
        '<button class="v-btn v-btn--ink v-btn--small" data-enter="' + esc(x.id) + '">Entrar</button></div>';
    }).join('');
    var btns = box.querySelectorAll('[data-enter]');
    for(var i = 0; i < btns.length; i++){
      (function(b){ b.onclick = function(){ openCampaign(b.getAttribute('data-enter')); }; })(btns[i]);
    }
  });
}

$('btnCreate').onclick = function(){
  var nome = $('newName').value.trim();
  var code = $('newCode').value.trim();
  if(nome.length < 2){ showMsg('msgCreate', 'Nome muito curto', 'err'); return; }
  if(!/^\d{4}$/.test(code)){ showMsg('msgCreate', 'Código de 4 dígitos', 'err'); return; }
  showMsg('msgCreate', 'Criando...', '');
  $('btnCreate').disabled = true;
  sb.rpc('create_campaign', { p_name: nome, p_code: code, p_location: null }).then(function(r){
    $('btnCreate').disabled = false;
    if(r.error){ showMsg('msgCreate', traduzErro(r.error.message), 'err'); return; }
    if(!r.data.ok){ showMsg('msgCreate', r.data.erro, 'err'); return; }
    showMsg('msgCreate', 'Mesa criada!', 'ok');
    setTimeout(function(){ openCampaign(r.data.id); }, 600);
  });
};

$('btnJoin').onclick = function(){
  var code = $('joinCode').value.trim();
  if(!/^\d{4}$/.test(code)){ showMsg('msgJoin', 'Código de 4 dígitos', 'err'); return; }
  showMsg('msgJoin', 'Entrando...', '');
  $('btnJoin').disabled = true;
  sb.rpc('join_campaign', { p_code: code }).then(function(r){
    $('btnJoin').disabled = false;
    if(r.error){ showMsg('msgJoin', traduzErro(r.error.message), 'err'); return; }
    if(!r.data.ok){ showMsg('msgJoin', r.data.erro, 'err'); return; }
    showMsg('msgJoin', 'Conectado!', 'ok');
    setTimeout(function(){ openCampaign(r.data.id); }, 600);
  });
};

function openCampaign(id){
  sb.from('campaigns').select('*').eq('id', id).single().then(function(rc){
    if(!rc.data){ throw new Error('Mesa não encontrada'); }
    state.campaign = rc.data;
    return sb.from('members').select('role').eq('campaign_id', id).eq('user_id', state.user.id).single();
  }).then(function(rm){
    state.role = (rm && rm.data && rm.data.role) || 'PLAYER';
    applyRoleUI();
    return sb.from('characters').select('*').eq('campaign_id', id).eq('user_id', state.user.id).limit(1);
  }).then(function(rch){
    state.character = (rch.data && rch.data[0]) || null;
    if(!state.character && state.role === 'PLAYER'){
      return sb.rpc('create_character', { cid: id, p_nome: state.profile.username }).then(function(rr){
        if(rr.error){ toast('Erro: ' + rr.error.message, 'err'); return; }
        return sb.from('characters').select('*').eq('id', rr.data).single().then(function(rc2){
          state.character = rc2.data;
        });
      });
    }
  }).then(function(){
    show('screenMesa');
    $('mesaNome').textContent = state.campaign.name;
    $('mesaCode').textContent = '#' + id;
    $('mesaRole').textContent = state.role;
    return refreshScene().then(refreshTokens).then(refreshCombat).then(refreshLog).then(function(){
      if(state.character) return refreshSheet();
    }).then(refreshAbilitiesAndSpells).then(function(){
      subscribeRealtime();
      setTimeout(resizeCanvas, 100);
    });
  }).catch(function(e){ toast('Erro: ' + e.message, 'err'); });
}

function refreshCampaign(){
  if(!state.campaign) return Promise.resolve();
  return sb.from('campaigns').select('*').eq('id', state.campaign.id).single().then(function(r){
    if(r.data){ state.campaign = r.data; updateCampaignStateUI(); }
    return refreshScene();
  });
}
function refreshScene(){
  return sb.from('scenes').select('*').eq('campaign_id', state.campaign.id).single().then(function(r){ state.scene = r.data; });
}
function refreshTokens(){
  return sb.from('tokens').select('*').eq('campaign_id', state.campaign.id).then(function(r){
    state.tokens = r.data || [];
    drawGrid(); renderTokensList(); updateCampaignStateUI();
  });
}
function refreshCombat(){
  return sb.from('combat_state').select('*').eq('campaign_id', state.campaign.id).maybeSingle().then(function(r){
    state.combat = r.data;
    renderInit(); updateCampaignStateUI();
  });
}
function refreshLog(){
  return sb.from('campaign_log').select('*').eq('campaign_id', state.campaign.id).order('ts', { ascending: false }).limit(100).then(function(r){
    state.log = (r.data || []).slice().reverse();
    renderLog();
  });
}
function refreshSheet(){
  if(!state.character) return Promise.resolve();
  return sb.rpc('calc_sheet', { p_char: state.character.id }).then(function(r){
    if(!r.error){ state.sheet = r.data; renderSheet(); }
  });
}
function refreshAbilitiesAndSpells(){
  if(!state.character) return Promise.resolve();
  return sb.from('character_abilities').select('ability_id, abilities(nome,nivel,tipo,recurso,efeito,limite)').eq('character_id', state.character.id).order('ability_id').then(function(r){
    var box = $('abilitiesList');
    var abs = r.data || [];
    box.innerHTML = (!abs.length) ? '<div class="empty">Nenhuma.</div>' : abs.map(function(a){
      var ab = a.abilities || {};
      return '<div style="padding:6px;border-left:3px solid var(--gold);background:var(--card);border-radius:0 6px 6px 0;margin-bottom:5px">' +
        '<div style="font-size:12px;font-weight:700">' + esc(ab.nome) + ' <span style="color:var(--muted);font-size:10px">N' + ab.nivel + ' · ' + esc(ab.recurso || '') + '</span></div>' +
        '<div style="font-size:11px;color:var(--muted);margin-top:3px">' + esc(ab.efeito || '') + '</div></div>';
    }).join('');
    return sb.from('character_spells').select('spell_id, spells(nome,circulo,pm,tipo,efeito)').eq('character_id', state.character.id).order('spell_id');
  }).then(function(r){
    var sbox = $('spellsList');
    var sps = r.data || [];
    sbox.innerHTML = (!sps.length) ? '<div class="empty">Nenhuma.</div>' : sps.map(function(s){
      var sp = s.spells || {};
      return '<div style="padding:6px;border-left:3px solid #8a5ac9;background:var(--card);border-radius:0 6px 6px 0;margin-bottom:5px">' +
        '<div style="font-size:12px;font-weight:700">' + esc(sp.nome) + ' <span style="color:var(--muted);font-size:10px">C' + sp.circulo + ' · ' + sp.pm + ' PM</span></div>' +
        '<div style="font-size:11px;color:var(--muted);margin-top:3px">' + esc(sp.efeito || '') + '</div></div>';
    }).join('');
  });
}

var canvas = $('grid');
var ctx = canvas.getContext('2d');
var HEX = 24, OFF_X = 20, OFF_Y = 20;
var DPR = window.devicePixelRatio || 1;

function resizeCanvas(){
  var wrap = canvas.parentElement;
  if(!wrap) return;
  var w = wrap.clientWidth, h = wrap.clientHeight;
  canvas.width = w * DPR; canvas.height = h * DPR;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  fitHexes(); drawGrid();
}
function fitHexes(){
  var cols = Math.min((state.scene && state.scene.cols) || 20, 30);
  var rows = Math.min((state.scene && state.scene.rows) || 20, 20);
  var w = canvas.clientWidth, h = canvas.clientHeight;
  var hx = Math.max(14, Math.min(40, Math.floor(w / (1.5 * cols + 0.5))));
  var hy = Math.max(14, Math.min(40, Math.floor(h / (Math.sqrt(3) * (rows + 0.5)))));
  HEX = Math.min(hx, hy);
  OFF_X = (w - (1.5 * HEX * (cols - 1) + 2 * HEX)) / 2 + HEX;
  OFF_Y = (h - (Math.sqrt(3) * HEX * (rows - 1) + Math.sqrt(3) * HEX)) / 2 + Math.sqrt(3) * HEX / 2;
}
function hexCenter(col, row){
  return { x: OFF_X + 1.5 * HEX * col, y: OFF_Y + Math.sqrt(3) * HEX * (row + 0.5 * (col & 1)) };
}
function drawHex(cx, cy, fill, stroke){
  ctx.beginPath();
  for(var i = 0; i < 6; i++){
    var a = Math.PI / 180 * 60 * i;
    var x = cx + HEX * Math.cos(a), y = cy + HEX * Math.sin(a);
    if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if(fill){ ctx.fillStyle = fill; ctx.fill(); }
  if(stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function drawGrid(){
  if(!canvas.width) return;
  var w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#060503'; ctx.fillRect(0, 0, w, h);
  var cols = Math.min((state.scene && state.scene.cols) || 20, 30);
  var rows = Math.min((state.scene && state.scene.rows) || 20, 20);
  for(var c = 0; c < cols; c++) for(var r = 0; r < rows; r++){
    var p = hexCenter(c, r);
    drawHex(p.x, p.y, (c + r) % 2 ? '#0b0906' : '#0d0a05', '#2a2012');
  }
  state.tokens.forEach(function(t){
    var p = hexCenter(t.x, t.y);
    var cor = t.kind === 'MONSTRO' ? '#7a2020' : t.kind === 'NPC' ? '#7a5a20' : '#3a5a8a';
    var vivo = t.pv > 0;
    ctx.beginPath(); ctx.arc(p.x, p.y, HEX * 0.55, 0, 2 * Math.PI);
    ctx.fillStyle = vivo ? cor : '#333'; ctx.fill();
    ctx.strokeStyle = vivo ? '#e8cd7a' : '#555'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.max(9, HEX * 0.42) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((t.nome || '?').substring(0, 3).toUpperCase(), p.x, p.y);
    if(vivo && t.pv_max > 0){
      var pct = t.pv / t.pv_max, bw = HEX * 1.0, bx = p.x - bw / 2, by = p.y + HEX * 0.7;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(bx, by, bw, 3);
      ctx.fillStyle = pct > .5 ? '#5a8a4a' : pct > .25 ? '#c9a44c' : '#b83a3a';
      ctx.fillRect(bx, by, bw * pct, 3);
    }
  });
}
canvas.addEventListener('pointerdown', function(ev){
  var r = canvas.getBoundingClientRect();
  var mx = ev.clientX - r.left, my = ev.clientY - r.top;
  var cols = Math.min((state.scene && state.scene.cols) || 20, 30);
  var rows = Math.min((state.scene && state.scene.rows) || 20, 20);
  var best = null, bd = HEX;
  for(var c = 0; c < cols; c++) for(var rr = 0; rr < rows; rr++){
    var p = hexCenter(c, rr);
    var d = Math.hypot(mx - p.x, my - p.y);
    if(d < bd){ bd = d; best = { c: c, r: rr }; }
  }
  if(!best) return;
  var tok = null;
  for(var i = 0; i < state.tokens.length; i++){
    var t = state.tokens[i];
    if(t.x === best.c && t.y === best.r){ tok = t; break; }
  }
  if(tok){
    if(state.role === 'GM') editToken(tok);
    else if(tok.owner_id === state.user.id) moveToken(tok, best.c, best.r);
    else toast('Nao e seu token', 'err');
    return;
  }
  var meu = null;
  for(var j = 0; j < state.tokens.length; j++){
    var tj = state.tokens[j];
    if(tj.owner_id === state.user.id && tj.kind === 'PLAYER'){ meu = tj; break; }
  }
  if(meu) moveToken(meu, best.c, best.r);
});
function moveToken(tok, x, y){
  sb.rpc('move_token', { p_token: tok.id, p_x: x, p_y: y }).then(function(r){
    if(r.error) toast(r.error.message, 'err');
  });
}

function subscribeRealtime(){
  if(state.channel) sb.removeChannel(state.channel);
  var cid = state.campaign.id;
  state.channel = sb.channel('mesa-' + cid)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens', filter: 'campaign_id=eq.' + cid }, refreshTokens)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_state', filter: 'campaign_id=eq.' + cid }, refreshCombat)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_log', filter: 'campaign_id=eq.' + cid }, refreshLog)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns', filter: 'id=eq.' + cid }, refreshCampaign)
    .subscribe();
}

var CLASSES_UI = ['escudeiro','berserk','cavaleiro','samurai','ranger','ladino','monge','mago','bardo','construtor','druida','feiticeiro','sacerdote','santo','juiz','nobre'];
var CULTURAS_UI = [{id:'altherra',nome:'Central'},{id:'nippujin',nome:'Oriental'},{id:'joldeheim',nome:'Neves'},{id:'sahdir',nome:'Sadir'},{id:'sahan',nome:'Sahan'}];

function initSheetSelects(){
  var cs = $('sClasse'), cu = $('sCultura');
  if(cs.options.length) return;
  var opts = '<option value="">— escolher —</option>';
  for(var i = 0; i < CLASSES_UI.length; i++){
    var c = CLASSES_UI[i];
    opts += '<option value="' + c + '">' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>';
  }
  cs.innerHTML = opts;
  var oc = '<option value="">— escolher —</option>';
  for(var j = 0; j < CULTURAS_UI.length; j++){
    var ct = CULTURAS_UI[j];
    oc += '<option value="' + ct.id + '">' + ct.nome + '</option>';
  }
  cu.innerHTML = oc;
}
function renderSheet(){
  initSheetSelects();
  var s = state.sheet;
  if(!s || s.sem_ficha) return;
  $('sNome').value = s.nome || '';
  $('sClasse').value = s.classe || '';
  $('sCultura').value = s.cultura || '';
  var d = s.derivados || {};
  $('stCA').textContent = d.ca != null ? d.ca : '—';
  $('stRM').textContent = d.rm != null ? d.rm : '—';
  $('stINI').textContent = d.ini != null ? d.ini : '—';
  $('stDESL').textContent = (d.desl != null ? d.desl : '—') + 'm';
  $('stPVM').textContent = d.pv_max != null ? d.pv_max : '—';
  $('stPMM').textContent = d.pm_max != null ? d.pm_max : '—';
  $('lblPv').textContent = (s.pv_atual != null ? s.pv_atual : 0) + ' / ' + (d.pv_max != null ? d.pv_max : 0);
  $('lblPm').textContent = (s.pm_atual != null ? s.pm_atual : 0) + ' / ' + (d.pm_max != null ? d.pm_max : 0);
  $('barPv').style.width = d.pv_max ? Math.min(100, (s.pv_atual / d.pv_max) * 100) + '%' : '0%';
  $('barPm').style.width = d.pm_max ? Math.min(100, (s.pm_atual / d.pm_max) * 100) + '%' : '0%';
  var a = s.atributos || {};
  var locked = s.ready && state.role !== 'GM';
  var attrs = ['FOR','DES','CON','INT','SAB','CAR'];
  var html = '';
  for(var i = 0; i < attrs.length; i++){
    var k = attrs[i];
    html += '<div class="attr"><span class="nm">' + k + '</span>' +
      '<div class="ctl">' +
      '<button data-attr="' + k + '" data-delta="-1"' + (locked ? ' disabled' : '') + '>−</button>' +
      '<span class="vl">' + (a[k] != null ? a[k] : 1) + '</span>' +
      '<button data-attr="' + k + '" data-delta="1"' + (locked ? ' disabled' : '') + '>+</button>' +
      '</div></div>';
  }
  $('attrBox').innerHTML = html;
  var buttons = $('attrBox').querySelectorAll('button');
  for(var b = 0; b < buttons.length; b++){
    (function(btn){
      btn.onclick = function(){ changeAttr(btn.getAttribute('data-attr'), parseInt(btn.getAttribute('data-delta'), 10)); };
    })(buttons[b]);
  }
  var p = s.pontos;
  if(p) $('pontosInfo').textContent = p.distribuidos + ' / ' + (p.total - 6) + ' distribuidos · max: ' + p.max_atributo;
}
function changeAttr(attr, delta){
  if(!state.sheet) return;
  var a = {};
  for(var k in state.sheet.atributos) a[k] = state.sheet.atributos[k];
  a[attr] = Math.max(1, (a[attr] || 1) + delta);
  sb.rpc('save_sheet', { p_char: state.character.id, p_dados: { classe: state.sheet.classe, cultura: state.sheet.cultura, atributos: a }, p_motivo: null }).then(function(r){
    if(r.error) return toast(r.error.message, 'err');
    return refreshSheet();
  });
}
$('btnSaveSheet').onclick = function(){
  var dados = { classe: $('sClasse').value || null, cultura: $('sCultura').value || null };
  sb.rpc('save_sheet', { p_char: state.character.id, p_dados: dados, p_motivo: null }).then(function(r){
    if(r.error) return showMsg('msgSheet', r.error.message, 'err');
    showMsg('msgSheet', 'Salvo.', 'ok');
    refreshSheet();
  });
};
$('btnConfirmSheet').onclick = function(){
  sb.rpc('confirm_sheet', { p_char: state.character.id }).then(function(r){
    if(r.error) return showMsg('msgSheet', r.error.message, 'err');
    showMsg('msgSheet', 'Ficha confirmada.', 'ok');
    refreshSheet();
  });
};
$('btnShort').onclick = function(){ sb.rpc('short_rest', { p_char: state.character.id }).then(function(r){ if(r.error) return toast(r.error.message,'err'); toast('+PM','ok'); refreshSheet(); }); };
$('btnLong').onclick = function(){ sb.rpc('long_rest', { p_char: state.character.id }).then(function(r){ if(r.error) return toast(r.error.message,'err'); toast('Descanso longo','ok'); refreshSheet(); }); };

function renderInit(){
  var box = $('initList');
  var c = state.combat;
  if(!c || !c.ativo || !c.ordem || !c.ordem.length){ box.innerHTML = '<div class="empty">Fora de combate.</div>'; return; }
  box.innerHTML = c.ordem.map(function(id, idx){
    var t = null;
    for(var i = 0; i < state.tokens.length; i++) if(String(state.tokens[i].id) === String(id)){ t = state.tokens[i]; break; }
    if(!t) return '';
    var on = idx === c.turno_index, dead = t.pv <= 0;
    return '<div class="init-card ' + (on?'now':'') + ' ' + (dead?'dead':'') + '"><span>' + (on?'⚡ ':'') + esc(t.nome) + '</span><b>' + (10 + (t.des||0)) + '</b></div>';
  }).join('');
}
function renderTokensList(){
  var box = $('tokensList');
  if(!state.tokens.length){ box.innerHTML = '<div class="empty">Nenhum token.</div>'; return; }
  box.innerHTML = state.tokens.map(function(t){
    return '<div class="init-card ' + (t.pv<=0?'dead':'') + '">' +
      '<span>' + esc(t.nome) + ' <span style="color:var(--muted);font-size:10px">' + t.kind + '</span></span>' +
      '<span style="font-size:11px">PV ' + t.pv + '/' + t.pv_max + ' · CA ' + t.ca + '</span></div>';
  }).join('');
}
function updateCampaignStateUI(){
  var st = (state.campaign && state.campaign.state) || 'EXPLORACAO';
  var el = $('mesaState');
  el.className = 'state state-' + st;
  el.textContent = st;
  var ativo = state.combat && state.combat.ativo;
  $('banner').classList.toggle('on', !!ativo);
  if(ativo && state.combat.ordem){
    var curId = state.combat.ordem[state.combat.turno_index];
    var t = null;
    for(var i = 0; i < state.tokens.length; i++) if(String(state.tokens[i].id) === String(curId)){ t = state.tokens[i]; break; }
    $('bannerWho').textContent = t ? t.nome : '—';
  }
}
function renderLog(){
  var box = $('logBox');
  if(!state.log.length){ box.innerHTML = ''; return; }
  box.innerHTML = state.log.map(function(e){
    var tipo = (e.type || '').toUpperCase();
    var cls = '';
    if(tipo === 'ROLL' || tipo === 'DADO') cls = 'ROLL';
    else if(tipo === 'SYSTEM' || tipo === 'SISTEMA') cls = 'SYSTEM';
    else if(tipo === 'DANO' || tipo === 'DAMAGE') cls = 'DANO';
    else if(tipo === 'GM_ACTION') cls = 'GM';
    var d = e.data || {};
    var txt = '';
    if(tipo === 'CHAT') txt = '<b>' + esc(d.nome||'?') + ':</b> ' + esc(d.texto||'');
    else if(tipo === 'ROLL') txt = '<b>' + esc(d.nome||'?') + '</b> rolou ' + esc(d.expressao||'') + ' → <b>' + ((d.resultado && d.resultado.total) != null ? d.resultado.total : '?') + '</b>';
    else if(tipo === 'COMBATE_INICIADO') txt = 'Combate iniciado.';
    else if(tipo === 'TURNO_AVANCOU') txt = 'Turno avancou (rodada ' + (d.rodada||'?') + ').';
    else txt = esc(JSON.stringify(d).substring(0, 140));
    var hora = new Date(e.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return '<div class="entry ' + cls + '"><div class="meta"><span>' + esc(e.type) + '</span><span>' + hora + '</span></div><div>' + txt + '</div></div>';
  }).join('');
  box.scrollTop = box.scrollHeight;
}

var diceButtons = document.querySelectorAll('[data-die]');
for(var di = 0; di < diceButtons.length; di++){
  (function(b){
    b.onclick = function(){
      var d = b.getAttribute('data-die');
      sb.rpc('roll_dice', { p_expr: d, p_visibilidade: 'PUBLIC' }).then(function(r){
        if(r.error) return toast(r.error.message, 'err');
        var data = r.data;
        openModal('<h3>' + esc(d) + '</h3>' +
          '<div class="result"><div class="num">' + data.total + '</div>' +
          '<div class="det">[' + data.rolls.join(', ') + ']</div></div>' +
          '<button class="btn" onclick="window.__closeModal()">Fechar</button>');
      });
    };
  })(diceButtons[di]);
}

$('btnCustomRoll').onclick = function(){
  openModal('<h3>Formula</h3>' +
    '<div class="field"><label>Ex: 2d6+3</label><input id="customExpr" value="1d20"></div>' +
    '<div class="row"><button class="btn" onclick="window.__closeModal()">Cancelar</button>' +
    '<button class="btn primary" id="customGo">Rolar</button></div>');
  $('customGo').onclick = function(){
    var expr = $('customExpr').value.trim();
    sb.rpc('roll_dice', { p_expr: expr, p_visibilidade: 'PUBLIC' }).then(function(r){
      if(r.error) return toast(r.error.message, 'err');
      closeModal();
      openModal('<h3>' + esc(expr) + '</h3>' +
        '<div class="result"><div class="num">' + r.data.total + '</div>' +
        '<div class="det">[' + r.data.rolls.join(', ') + ']</div></div>' +
        '<button class="btn" onclick="window.__closeModal()">Fechar</button>');
    });
  };
};

$('btnAttack').onclick = function(){
  var meu = null;
  for(var i = 0; i < state.tokens.length; i++) if(state.tokens[i].owner_id === state.user.id){ meu = state.tokens[i]; break; }
  if(!meu) return toast('Voce nao tem token na mesa', 'err');
  var outros = state.tokens.filter(function(t){ return t.id !== meu.id && t.pv > 0; });
  if(!outros.length) return toast('Nenhum alvo', 'err');
  openModal('<h3>Atacar</h3>' +
    outros.map(function(t){
      return '<button class="btn" data-atk="' + t.id + '" style="text-align:left;margin-bottom:6px">' + esc(t.nome) + ' · PV ' + t.pv + '/' + t.pv_max + ' · CA ' + t.ca + '</button>';
    }).join('') +
    '<button class="btn" onclick="window.__closeModal()">Cancelar</button>');
  var btns = document.querySelectorAll('[data-atk]');
  for(var k = 0; k < btns.length; k++){
    (function(b){ b.onclick = function(){ chooseAttackType(meu, parseInt(b.getAttribute('data-atk'), 10)); }; })(btns[k]);
  }
};
function chooseAttackType(atk, alvoId){
  openModal('<h3>Escolher ataque</h3>' +
    '<button class="btn" data-t="corporal">Corporal (FOR vs CA)</button>' +
    '<button class="btn" data-t="precisao">Precisao (DES vs CA)</button>' +
    '<button class="btn" data-t="magico">Magico (INT vs RM)</button>' +
    '<button class="btn" onclick="window.__closeModal()">Cancelar</button>');
  var bs = document.querySelectorAll('[data-t]');
  for(var i = 0; i < bs.length; i++){
    (function(b){ b.onclick = function(){ doAttack(atk.id, alvoId, b.getAttribute('data-t')); }; })(bs[i]);
  }
}
function doAttack(atkId, alvoId, tipo){
  sb.rpc('attack', { p_atk: atkId, p_alvo: alvoId, p_tipo: tipo }).then(function(r){
    if(r.error) return toast(r.error.message, 'err');
    var res = r.data;
    var danoPromise = Promise.resolve(null);
    if(res.acertou){
      var dano = rollExprClient(res.dano_dice || '1d6', res.critico);
      danoPromise = sb.rpc('apply_damage', { p_alvo: alvoId, p_qtd: dano.total, p_tipo: 'Fisico' }).then(function(){ return dano; });
    }
    return danoPromise.then(function(dano){
      var danoHtml = dano ? '<div class="detail" style="margin-top:8px;color:#9c9">Dano: ' + dano.total + ' (' + dano.det + ')</div>' : '';
      openModal('<h3>Resultado</h3>' +
        '<div class="result">' +
        '<div class="num ' + (res.critico ? 'crit' : (res.falha ? 'fail' : '')) + '">' + res.total + '</div>' +
        '<div class="det">d20 (' + res.d20 + ') + ' + res.mod + ' = ' + res.total + ' vs ' + res.defesa_tipo + ' ' + res.defesa + '</div>' +
        '<div class="det" style="color:' + (res.acertou ? '#9c9' : '#e88') + '">' + (res.critico ? 'CRITICO!' : res.falha ? 'FALHA!' : res.acertou ? 'ACERTO' : 'ERRO') + '</div>' +
        '</div>' + danoHtml +
        '<button class="btn" onclick="window.__closeModal()">Fechar</button>');
      refreshTokens();
    });
  });
}
function rollExprClient(expr, crit){
  var m = expr.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if(!m) return { total: 0, det: expr };
  var n = parseInt(m[1], 10), s = parseInt(m[2], 10), mod = m[3] ? parseInt(m[3], 10) : 0;
  if(crit) n *= 2;
  var rolls = [], total = 0;
  for(var i = 0; i < n; i++){ var r = 1 + Math.floor(Math.random() * s); rolls.push(r); total += r; }
  total += mod;
  return { total: total, det: n + 'd' + s + (mod ? (mod > 0 ? '+' + mod : mod) : '') + ' [' + rolls.join(',') + ']' };
}

$('btnStartCombat').onclick = function(){
  sb.rpc('start_combat', { cid: state.campaign.id }).then(function(r){
    if(r.error) return toast(r.error.message, 'err');
    sb.from('campaigns').update({ state: 'COMBATE' }).eq('id', state.campaign.id).then(function(){
      state.campaign.state = 'COMBATE';
      toast('Combate iniciado', 'ok');
      refreshCombat();
    });
  });
};
$('btnEndCombat').onclick = endCombatConfirm;
$('btnEndCombat2').onclick = endCombatConfirm;
function endCombatConfirm(){
  if(!confirm('Encerrar o combate?')) return;
  sb.rpc('end_combat', { cid: state.campaign.id }).then(function(r){
    if(r.error) return toast(r.error.message, 'err');
    sb.from('campaigns').update({ state: 'EXPLORACAO' }).eq('id', state.campaign.id).then(function(){
      state.campaign.state = 'EXPLORACAO';
      updateCampaignStateUI();
      refreshCombat();
    });
  });
}
$('btnEndTurn').onclick = function(){
  if(!state.combat || !state.combat.ordem) return;
  var cur = state.combat.ordem[state.combat.turno_index];
  if(!cur) return;
  sb.rpc('end_turn', { p_token: parseInt(cur, 10) }).then(function(r){
    if(r.error) return toast(r.error.message, 'err');
    refreshCombat();
  });
};

$('btnAddMonster').onclick = function(){
  sb.from('monsters').select('id,nome,dificuldade,nivel').order('nome').then(function(r){
    if(r.error) return toast(r.error.message, 'err');
    var mons = r.data || [];
    openModal('<h3>Monstro</h3>' +
      '<div class="field"><label>Filtrar</label><input id="fMon"></div>' +
      '<div style="max-height:50vh;overflow-y:auto" id="monList">' +
      mons.map(function(m){
        return '<button class="btn" data-m="' + m.id + '" style="text-align:left;margin-bottom:4px">' + esc(m.nome) + ' <span style="color:var(--muted);font-size:10px">N' + m.nivel + '</span></button>';
      }).join('') +
      '</div><button class="btn" onclick="window.__closeModal()">Cancelar</button>');
    $('fMon').oninput = function(){
      var q = $('fMon').value.toLowerCase();
      var bs = document.querySelectorAll('#monList [data-m]');
      for(var i = 0; i < bs.length; i++) bs[i].style.display = bs[i].textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
    };
    var bs = document.querySelectorAll('#monList [data-m]');
    for(var i = 0; i < bs.length; i++){
      (function(b){
        b.onclick = function(){
          var pos = findFreeHex();
          sb.rpc('add_monster_to_scene', { cid: state.campaign.id, p_monster: b.getAttribute('data-m'), p_x: pos.c, p_y: pos.r }).then(function(r2){
            if(r2.error) return toast(r2.error.message, 'err');
            closeModal(); refreshTokens();
          });
        };
      })(bs[i]);
    }
  });
};
$('btnAddNPC').onclick = function(){
  openModal('<h3>NPC</h3>' +
    '<div class="field"><label>Nome</label><input id="npcNome" maxlength="30"></div>' +
    '<div class="field"><label>PV</label><input id="npcPv" type="number" value="10"></div>' +
    '<div class="field"><label>CA</label><input id="npcCa" type="number" value="12"></div>' +
    '<div class="field"><label>DES</label><input id="npcDes" type="number" value="1"></div>' +
    '<div class="row"><button class="btn" onclick="window.__closeModal()">Cancelar</button>' +
    '<button class="btn primary" id="npcSave">Adicionar</button></div>');
  $('npcSave').onclick = function(){
    var nome = $('npcNome').value.trim();
    if(!nome) return toast('Nome obrigatorio', 'err');
    var pos = findFreeHex();
    sb.from('tokens').insert({
      campaign_id: state.campaign.id, nome: nome, kind: 'NPC', x: pos.c, y: pos.r,
      pv: +$('npcPv').value, pv_max: +$('npcPv').value, ca: +$('npcCa').value, des: +$('npcDes').value
    }).then(function(r){
      if(r.error) return toast(r.error.message, 'err');
      closeModal(); refreshTokens();
    });
  };
};
$('btnAddPlayer').onclick = function(){
  sb.from('members').select('user_id, profiles(username)').eq('campaign_id', state.campaign.id).then(function(r){
    if(r.error) return toast(r.error.message, 'err');
    var mem = r.data || [];
    var cands = mem.filter(function(m){ return m.user_id !== state.user.id; });
    if(!cands.length) return toast('Nenhum outro jogador', 'err');
    openModal('<h3>Jogador</h3>' +
      cands.map(function(c){
        return '<button class="btn" data-p="' + c.user_id + '" style="text-align:left;margin-bottom:6px">' + esc((c.profiles && c.profiles.username) || '?') + '</button>';
      }).join('') +
      '<button class="btn" onclick="window.__closeModal()">Cancelar</button>');
    var bs = document.querySelectorAll('[data-p]');
    for(var i = 0; i < bs.length; i++){
      (function(b){
        b.onclick = function(){
          var uid = b.getAttribute('data-p');
          sb.from('characters').select('id,nome').eq('campaign_id', state.campaign.id).eq('user_id', uid).maybeSingle().then(function(r2){
            if(!r2.data) return toast('Sem personagem', 'err');
            var ch = r2.data;
            return sb.rpc('calc_sheet', { p_char: ch.id }).then(function(r3){
              var d = (r3.data && r3.data.derivados) || {};
              var pos = findFreeHex();
              return sb.from('tokens').insert({
                campaign_id: state.campaign.id, nome: ch.nome, kind: 'PLAYER', character_id: ch.id, owner_id: uid,
                x: pos.c, y: pos.r, pv: d.pv_max || 10, pv_max: d.pv_max || 10, ca: d.ca || 10, rm: d.rm || 10, des: (r3.data && r3.data.atributos && r3.data.atributos.DES) || 1
              }).then(function(r4){
                if(r4.error) return toast(r4.error.message, 'err');
                closeModal(); refreshTokens();
              });
            });
          });
        };
      })(bs[i]);
    }
  });
};
$('btnAskRoll').onclick = function(){
  sb.from('members').select('user_id, profiles(username)').eq('campaign_id', state.campaign.id).neq('user_id', state.user.id).then(function(r){
    if(r.error) return toast(r.error.message, 'err');
    var mem = r.data || [];
    if(!mem.length) return toast('Nenhum outro membro', 'err');
    openModal('<h3>Pedir rolagem</h3>' +
      '<div class="field"><label>Alvo</label><select id="arTo">' +
      mem.map(function(m){ return '<option value="' + m.user_id + '">' + esc((m.profiles && m.profiles.username) || '?') + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label>Rotulo</label><input id="arLbl" maxlength="60"></div>' +
      '<div class="field"><label>Atributo</label><select id="arAt">' +
      '<option value="FOR">FOR</option><option value="DES">DES</option><option value="CON">CON</option>' +
      '<option value="INT">INT</option><option value="SAB" selected>SAB</option><option value="CAR">CAR</option>' +
      '</select></div>' +
      '<div class="field"><label>CD</label><input id="arCd" type="number" value="15"></div>' +
      '<button class="btn primary" id="arGo">Enviar</button>' +
      '<button class="btn" onclick="window.__closeModal()">Cancelar</button>');
    $('arGo').onclick = function(){
      sb.rpc('ask_roll', {
        cid: state.campaign.id, p_to: $('arTo').value, p_kind: 'PERICIA',
        p_label: $('arLbl').value.trim() || 'Rolagem',
        p_atributo: $('arAt').value, p_cd: parseInt($('arCd').value, 10) || 15, p_motivo: null
      }).then(function(r2){
        if(r2.error) return toast(r2.error.message, 'err');
        closeModal(); toast('Pedido enviado', 'ok');
      });
    };
  });
};
function editToken(tok){
  openModal('<h3>Editar token</h3>' +
    '<div class="field"><label>Nome</label><input id="tkN" value="' + esc(tok.nome) + '" maxlength="30"></div>' +
    '<div class="field"><label>PV atual</label><input id="tkPv" type="number" value="' + tok.pv + '" min="0"></div>' +
    '<div class="field"><label>PV max</label><input id="tkPvM" type="number" value="' + tok.pv_max + '" min="1"></div>' +
    '<div class="field"><label>CA</label><input id="tkCa" type="number" value="' + tok.ca + '"></div>' +
    '<div class="field"><label>DES</label><input id="tkDes" type="number" value="' + tok.des + '"></div>' +
    '<div class="row"><button class="btn danger" id="tkDel">Remover</button>' +
    '<button class="btn primary" id="tkSave">Salvar</button></div>' +
    '<button class="btn" onclick="window.__closeModal()" style="margin-top:6px">Cancelar</button>');
  $('tkSave').onclick = function(){
    sb.from('tokens').update({
      nome: $('tkN').value.trim(),
      pv: Math.max(0, Math.min(+$('tkPvM').value, +$('tkPv').value)),
      pv_max: Math.max(1, +$('tkPvM').value),
      ca: +$('tkCa').value, des: +$('tkDes').value
    }).eq('id', tok.id).then(function(r){
      if(r.error) return toast(r.error.message, 'err');
      closeModal(); refreshTokens();
    });
  };
  $('tkDel').onclick = function(){
    if(!confirm('Remover ' + tok.nome + '?')) return;
    sb.from('tokens').delete().eq('id', tok.id).then(function(r){
      if(r.error) return toast(r.error.message, 'err');
      closeModal(); refreshTokens();
    });
  };
}
function findFreeHex(){
  var cols = Math.min((state.scene && state.scene.cols) || 20, 30), rows = Math.min((state.scene && state.scene.rows) || 20, 20);
  for(var c = 0; c < cols; c++) for(var r = 0; r < rows; r++){
    var ocupado = false;
    for(var i = 0; i < state.tokens.length; i++) if(state.tokens[i].x === c && state.tokens[i].y === r){ ocupado = true; break; }
    if(!ocupado) return { c: c, r: r };
  }
  return { c: 0, r: 0 };
}

var tabs = document.querySelectorAll('.tabs button');
for(var ti2 = 0; ti2 < tabs.length; ti2++){
  (function(b){
    b.onclick = function(){
      var all = document.querySelectorAll('.tabs button');
      for(var j = 0; j < all.length; j++) all[j].classList.remove('on');
      b.classList.add('on');
      var t = b.getAttribute('data-tab');
      var keys = ['acao','ficha','combate','log'];
      for(var k = 0; k < keys.length; k++){
        var pane = $('pane' + keys[k].charAt(0).toUpperCase() + keys[k].slice(1));
        if(pane) pane.classList.toggle('on', keys[k] === t);
      }
      if(t === 'ficha') refreshSheet();
    };
  })(tabs[ti2]);
}

$('btnSend').onclick = function(){
  var txt = $('chatInput').value.trim();
  if(!txt) return;
  $('chatInput').value = '';
  sb.rpc('send_chat', { cid: state.campaign.id, p_texto: txt, p_visibilidade: 'PUBLIC' }).then(function(r){
    if(r.error) toast(r.error.message, 'err');
  });
};
$('chatInput').addEventListener('keydown', function(e){ if(e.key === 'Enter') $('btnSend').click(); });

$('btnLeaveMesa').onclick = function(){
  if(!confirm('Sair da mesa?')) return;
  if(state.role === 'GM'){ toast('Mestre nao pode sair sem transferir.', 'err'); return; }
  sb.rpc('leave_campaign', { cid: state.campaign.id }).then(function(r){
    if(r.error) return toast(r.error.message, 'err');
    if(state.channel) sb.removeChannel(state.channel);
    state.campaign = null; state.channel = null;
    enterLobby();
  });
};

window.addEventListener('resize', resizeCanvas);
window.__closeModal = closeModal;
setTimeout(resizeCanvas, 200);

})();
