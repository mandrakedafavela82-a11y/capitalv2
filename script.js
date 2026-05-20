const SUPA_URL = 'https://yxxcxkvnuorjnsmjytxd.supabase.co';
const SUPA_KEY = 'sb_publishable_rYrRYYu_AlWEwmsarx9bxw_PHCC4VjQ';

const { createClient } = supabase;
const db = createClient(SUPA_URL, SUPA_KEY);

/* ── Estado global ─────────────────────────────────────────── */
let CU = null, US = [], CL = [], LS = [], CM = [], APR = [], VD = [], CAP = [];
let _dashView = 'geral'; // 'geral' | 'pessoal' — toggle do admin
let chatCx = [], chatSt = [];
let _realtimeCh = null;
let _replyCtx = null;      // { id, nome, texto } da msg sendo respondida
let _pendingImg = null;    // { url, canal } da foto prestes a enviar

/* ── Tema (persiste no localStorage) ───────────────────────── */
(function(){
  const t = localStorage.getItem('ccTheme');
  if (t === 'light') document.body.classList.add('light');
  if (t === 'sepia') document.body.classList.add('sepia');
})();

/* ── Escapa strings para prevenir XSS ──────────────────────── */
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

/* ── Tema ───────────────────────────────────────────────────── */
function toggleTheme() {
  const wasLight = document.body.classList.contains('light');
  const wasSepia = document.body.classList.contains('sepia');
  document.body.classList.remove('light', 'sepia');

  // cicla: escuro → claro → sépia → escuro
  let next = 'dark';
  if (!wasLight && !wasSepia) next = 'light';
  else if (wasLight)          next = 'sepia';
  else                        next = 'dark';

  if (next !== 'dark') document.body.classList.add(next);
  localStorage.setItem('ccTheme', next);
  _updThemeBtn();
}

function _updThemeBtn() {
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  const cl = document.body.classList;
  btn.innerHTML = cl.contains('sepia') ? '<i class="fas fa-coffee"></i>'
                : cl.contains('light') ? '<i class="fas fa-sun"></i>'
                : '<i class="fas fa-moon"></i>';
  btn.title = cl.contains('sepia') ? 'Modo Sépia ativo'
            : cl.contains('light') ? 'Modo Claro ativo'
            : 'Modo Escuro ativo';
}

/* ── Loading screen ─────────────────────────────────────────── */
function killLd() {
  const ld = document.getElementById('ldScreen');
  if (ld) { ld.classList.add('gone'); setTimeout(() => ld.style.display = 'none', 500); }
}
window.addEventListener('load', () => setTimeout(killLd, 600));
setTimeout(killLd, 3000);

/* ── Toast ──────────────────────────────────────────────────── */
function toast(tp, t, m) {
  const b   = document.getElementById('tBox');
  if (!b) return;
  const cls = { s: 'ts', e: 'te', i2: 'ti2', w: 'tw' };
  const ics = { s: 'fa-check', e: 'fa-times', i2: 'fa-info', w: 'fa-exclamation' };
  const d   = document.createElement('div');
  d.className = 'tst';
  d.innerHTML = `<div class="ti ${cls[tp]}"><i class="fas ${ics[tp]}"></i></div><div class="tc"><div class="tt"></div><div class="tm"></div></div>`;
  d.querySelector('.tt').textContent = t;
  d.querySelector('.tm').textContent = m;
  b.appendChild(d);
  setTimeout(() => { d.classList.add('rm'); setTimeout(() => d.remove(), 300); }, 3500);
}

/* ── Helpers gerais ─────────────────────────────────────────── */
const isAdmin        = () => CU?.role === 'admin';
const isAuxiliar     = () => CU?.role === 'operacional';
const canManage      = () => isAdmin() || isAuxiliar(); // vê tudo, operacional só lê
const getConsultores = () => US.filter(u => u.role === 'consultor');
const myClients      = () => isAdmin() ? CL : isAuxiliar() ? [] : CL.filter(c => c.consultor_id === CU.id);
const fmtCur = v => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => { if (!d) return '-'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };
const todayStr   = () => new Date().toISOString().slice(0, 10);
const getConsName = id => US.find(x => x.id === id)?.nome ?? '-';

function emptyHTML(icon, title, desc) {
  return `<div class="empty-st"><i class="fas fa-${icon}"></i><h4>${esc(title)}</h4><p>${esc(desc)}</p></div>`;
}

function populateConsSel(selId) {
  const sel = document.getElementById(selId);
  if (!sel || !CU) return;
  if (isAdmin()) {
    sel.innerHTML = getConsultores().map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('');
    sel.disabled  = false;
  } else {
    sel.innerHTML = `<option value="${esc(CU.id)}">${esc(CU.nome)}</option>`;
    sel.disabled  = true;
  }
}

function calcPS(inputId, outId) {
  const v  = parseFloat(document.getElementById(inputId).value) || 0;
  const el = document.getElementById(outId);
  el.innerHTML = v > 0
    ? `<div class="ps-calc"><div class="ps-l">PS 37% calculado automaticamente</div><div class="ps-v">${fmtCur(v * 0.37)}</div></div>`
    : '';
}

/* ================================================================
   AUTH — Login / Registro / Google / Logout
================================================================ */
function swTab(i) {
  document.querySelectorAll('.ltab').forEach((b, idx) => b.classList.toggle('on', idx === i));
  document.getElementById('loginForm').style.display = i === 0 ? 'block' : 'none';
  document.getElementById('regForm').style.display   = i === 0 ? 'none'  : 'block';
}

async function doLogin() {
  const em = document.getElementById('lEm').value.trim();
  const pw = document.getElementById('lPw').value.trim();
  if (!em || !pw) { toast('e', 'Erro', 'Preencha e-mail e senha'); return; }

  const { data, error } = await db.auth.signInWithPassword({ email: em, password: pw });
  if (error) { toast('e', 'Erro', error.message); return; }

  await loadProfile(data.user.id);
  if (!CU) {
    await db.auth.signOut();
    toast('e', 'Perfil não encontrado', 'Execute o supabase_schema.sql e tente novamente');
    return;
  }
  goApp();
  toast('s', 'Bem-vindo', 'Olá, ' + CU.nome + '!');
}

async function doReg() {
  const nm = document.getElementById('rNm').value.trim();
  const em = document.getElementById('rEm').value.trim();
  const pw = document.getElementById('rPw').value.trim();
  const rl = document.getElementById('rRl').value;
  if (!nm || !em || !pw) { toast('e', 'Erro', 'Preencha todos os campos'); return; }
  if (pw.length < 6)     { toast('e', 'Erro', 'Senha: mínimo 6 caracteres'); return; }

  const { data, error } = await db.auth.signUp({
    email: em, password: pw,
    options: { data: { nome: nm, role: rl } }
  });
  if (error) { toast('e', 'Erro', error.message); return; }

  await new Promise(r => setTimeout(r, 800));
  await loadProfile(data.user.id);
  if (!CU) {
    await db.auth.signOut();
    toast('e', 'Perfil não criado', 'Execute o supabase_schema.sql e tente novamente');
    return;
  }
  goApp();
  toast('s', 'Conta criada', 'Bem-vindo, ' + nm + '!');
}

/* Login com Google — requer e-mail pré-aprovado pelo admin */
async function doGoogleLogin() {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) toast('e', 'Erro', error.message);
}

async function doLogout() {
  if (_realtimeCh) db.removeChannel(_realtimeCh);
  await db.auth.signOut();
  CU = null; US = []; CL = []; LS = []; CM = []; APR = []; chatCx = []; chatSt = [];
  document.getElementById('appScreen').style.display   = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  toast('i2', 'Sessão encerrada', 'Você saiu do sistema');
}

/* ── Sessão persistida pelo Supabase Auth ───────────────────── */
(async () => {
  const { data } = await db.auth.getSession();
  if (!data.session) return;

  const user      = data.session.user;
  const providers = user.app_metadata?.providers || [];
  const isGoogle  = providers.includes('google') || user.app_metadata?.provider === 'google';

  /* Qualquer login Google precisa estar na lista de aprovados */
  if (isGoogle) {
    const { data: approved, error: aprErr } = await db
      .from('approved_emails')
      .select('id, role')
      .eq('email', user.email)
      .maybeSingle();

    if (aprErr || !approved) {
      await db.auth.signOut();
      killLd();
      toast('e', 'Acesso negado', 'Seu e-mail não foi autorizado pelo administrador');
      return;
    }
  }

  await loadProfile(user.id);
  if (!CU) { killLd(); return; }
  goApp();
})();

async function loadProfile(userId) {
  const [{ data: prof }, { data: all }] = await Promise.all([
    db.from('profiles').select('*').eq('id', userId).maybeSingle(), // maybeSingle evita 406 se perfil não existe
    db.from('profiles').select('*')
  ]);
  if (prof) CU = prof;
  if (all)  US = all;
}

/* ================================================================
   APP INIT
================================================================ */
function goApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display   = 'block';
  killLd(); updUI(); initAll();
}

function updUI() {
  if (!CU) return;
  const av = CU.avatar || CU.nome[0].toUpperCase();
  const roleLabel = isAdmin() ? 'Administrador' : isOperacional() ? 'Operacional' : 'Consultor';

  document.getElementById('sbAv').textContent  = av;
  document.getElementById('cfAv').textContent  = av;
  document.getElementById('sbNm').textContent  = CU.nome;
  document.getElementById('sbRl').textContent  = roleLabel;
  document.getElementById('cfNm').textContent  = CU.nome;
  document.getElementById('cfEm').textContent  = CU.email;
  document.getElementById('cfNi').value        = CU.nome;
  document.getElementById('cfEi').value        = CU.email;
  document.getElementById('dashGreet').textContent = 'Olá, ' + CU.nome;

  /* Painel de acessos Google — só para admin */
  const aprBlock = document.getElementById('cfAprBlock');
  if (aprBlock) aprBlock.style.display = isAdmin() ? 'block' : 'none';

  /* Auxiliar só vê dashboard e chats */
  if (isAuxiliar()) {
    const allowed = new Set(['dashboard','chatcaixa','chatsantander','config']);
    document.querySelectorAll('.ni[data-p]').forEach(el => {
      el.style.display = allowed.has(el.dataset.p) ? '' : 'none';
    });
    document.querySelectorAll('.ns').forEach(el => el.style.display = 'none');
  } else {
    /* Comissões e Vendas — só admin e consultor */
    const canSeePay = isAdmin() || CU?.role === 'consultor';
    document.querySelectorAll('[data-p="comissoes"],[data-p="vendas"]')
      .forEach(el => el.style.display = canSeePay ? '' : 'none');
  }

  /* Toggle visão geral/pessoal — só admin */
  const dtb = document.getElementById('dashToggleBtn');
  if (dtb) dtb.style.display = isAdmin() ? '' : 'none';

  /* Tema: ajusta ícone do botão */
  _updThemeBtn();

  /* Atualiza fotos de avatar se existirem */
  _applyAvatarURL(CU.avatar_url);
}

function _applyAvatarURL(url) {
  /* Sidebar */
  const sbAv  = document.getElementById('sbAv');
  const sbImg = document.getElementById('sbAvImg');
  if (sbImg) {
    if (url) { sbImg.src = url; sbImg.style.display = 'block'; sbAv.style.display = 'none'; }
    else     { sbImg.style.display = 'none'; sbAv.style.display = ''; }
  }
  /* Config */
  const cfWrap = document.getElementById('cfAvWrap');
  const cfImg  = document.getElementById('cfAvImg');
  const cfAv   = document.getElementById('cfAv');
  if (cfImg) {
    if (url) { cfImg.src = url; cfImg.style.display = 'block'; cfAv.style.display = 'none'; }
    else     { cfImg.style.display = 'none'; cfAv.style.display = ''; }
  }
}

async function initAll() {
  await Promise.all([
    loadClientes(), loadListas(), loadComissoes(), loadVendas(), loadCaptacao(),
    loadMensagens('Caixa'), loadMensagens('Santander')
  ]);
  rDash(); rCl();
  rBank('Caixa', 'cxContent'); rBank('Santander', 'stContent');
  rChat('Caixa'); rChat('Santander');
  rRk(); rCm(); rLs(); updBadges();
  initRealtime();
}

/* ================================================================
   CARREGAMENTO DE DADOS
================================================================ */
async function loadClientes() {
  const { data } = await db.from('clientes').select('*').order('created_at', { ascending: false });
  if (data) CL = data;
}
async function loadListas() {
  const { data } = await db.from('listas').select('*').order('created_at', { ascending: false });
  if (data) LS = data;
}
async function loadComissoes() {
  const { data } = await db.from('comissoes').select('*');
  if (data) CM = data;
}
async function loadVendas() {
  const { data } = await db.from('vendas').select('*').order('created_at', { ascending: false });
  if (data) VD = data;
}
async function loadCaptacao() {
  const { data } = await db.from('captacao').select('*').order('created_at', { ascending: false });
  if (data) CAP = data;
}
async function loadMensagens(canal) {
  const { data } = await db.from('mensagens').select('*').eq('canal', canal).order('created_at', { ascending: true });
  if (canal === 'Caixa') chatCx = data || [];
  else                   chatSt = data || [];
}

async function refreshAll() {
  await Promise.all([loadClientes(), loadListas(), loadComissoes(), loadVendas(), loadCaptacao()]);
  rDash(); rCl();
  rBank('Caixa', 'cxContent'); rBank('Santander', 'stContent');
  rRk(); rCm(); rVd(); rCap(); rLs(); updBadges();
}

/* ================================================================
   REALTIME — chat em tempo real
================================================================ */
function initRealtime() {
  if (_realtimeCh) db.removeChannel(_realtimeCh);
  _realtimeCh = db.channel('capitalcred-chat')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mensagens' },
      ({ new: m }) => {
        if (m.canal === 'Caixa') { chatCx.push(m); rChat('Caixa'); }
        else                     { chatSt.push(m); rChat('Santander'); }
        updBadges();
      })
    .subscribe();
}

/* ================================================================
   NAV
================================================================ */
const PAGE_TITLES = {
  dashboard: 'Dashboard', clientes: 'Clientes', vendas: 'Vendas', comissoes: 'Comissões',
  ranking: 'Ranking', crm: 'CRM', captacao: 'Captação',
  caixa: 'Caixa', santander: 'Santander',
  chatcaixa: 'Chat Caixa', chatsantander: 'Chat Santander',
  listas: 'Listas', config: 'Configurações'
};

const REFRESH_MAP = {
  dashboard:     () => rDash(),
  clientes:      () => rCl(),
  vendas:        () => rVd(),
  comissoes:     () => rCm(),
  ranking:       () => rRk(),
  crm:           () => rCRM(),
  captacao:      () => rCap(),
  caixa:         () => rBank('Caixa', 'cxContent'),
  santander:     () => rBank('Santander', 'stContent'),
  chatcaixa:     () => rChat('Caixa'),
  chatsantander: () => rChat('Santander'),
  listas:        () => rLs(),
  config:        () => rConfig(),
};

function navTo(p) {
  if (isAuxiliar() && !['dashboard','chatcaixa','chatsantander','config'].includes(p)) return;
  document.querySelectorAll('.ps').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('on'));
  document.getElementById('pg-' + p)?.classList.add('on');
  document.querySelector(`.ni[data-p="${p}"]`)?.classList.add('on');
  const title = PAGE_TITLES[p] || p;
  document.getElementById('pgT').textContent = title;
  document.getElementById('pgB').textContent = 'CapitalCred / ' + title;
  closeSB();
  REFRESH_MAP[p]?.();
}

const togSB  = () => { document.getElementById('sidebar').classList.toggle('opn'); document.getElementById('sbOv').classList.toggle('on'); };
const closeSB = () => { document.getElementById('sidebar').classList.remove('opn'); document.getElementById('sbOv').classList.remove('on'); };
const togFS   = () => document.fullscreenElement ? document.exitFullscreen().catch(() => {}) : document.documentElement.requestFullscreen().catch(() => {});

/* ================================================================
   MODAL
================================================================ */
function openM(id) {
  if (id === 'mCl')  _initClientModal();
  if (id === 'mLs')  _initListaModal();
  if (id === 'mVd')  _initVdModal();
  if (id === 'mCap') _initCapModal();
  document.getElementById(id).classList.add('on');
}
function closeM(id) { document.getElementById(id).classList.remove('on'); }

function _initClientModal(banco = null) {
  const ncBc   = document.getElementById('ncBc');
  ncBc.disabled = banco !== null;
  if (banco) ncBc.value = banco;
  populateConsSel('ncCo');
  document.getElementById('ncConsFG').style.display = isAdmin() ? 'block' : 'none';
  ['ncN', 'ncC', 'ncCi', 'ncVl'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('ncPs').innerHTML = '';
}

function _initListaModal() {
  populateConsSel('lsCo');
  document.getElementById('lsN').value = '';
}

/* ================================================================
   DASHBOARD
================================================================ */
function _statCard(icCls, icon, label, value) {
  return `<div class="sc"><div class="si ${icCls}"><i class="fas fa-${icon}"></i></div><div class="sl">${label}</div><div class="sv">${value}</div></div>`;
}

function togDashView() {
  _dashView = _dashView === 'geral' ? 'pessoal' : 'geral';
  const btn = document.getElementById('dashToggleBtn');
  if (btn) btn.textContent = _dashView === 'geral' ? '👤 Meus dados' : '🌐 Visão geral';
  rDash();
}

function rDash() {
  const mc   = (isAdmin() && _dashView === 'pessoal')
    ? CL.filter(c => c.consultor_id === CU.id)
    : myClients();
  const cxC  = mc.filter(c => c.banco === 'Caixa').length;
  const stC  = mc.filter(c => c.banco === 'Santander').length;
  const paid = CM.filter(c => c.status === 'Pago').reduce((a, c) => a + Number(c.ps), 0);

  document.getElementById('dashStats').innerHTML =
    _statCard('icg',  'users',        'Total de Clientes',  mc.length)  +
    _statCard('iccx', 'university',   'Clientes Caixa',     cxC)        +
    _statCard('icst', 'university',   'Clientes Santander', stC)        +
    _statCard('icgr', 'check-double', 'Comissão Paga',      fmtCur(paid));

  const rk = getRankingData();
  document.getElementById('dashRank').innerHTML = rk.length > 0
    ? _renderPodium(rk.slice(0, 3))
    : emptyHTML('trophy', 'Sem dados', 'Nenhum cliente cadastrado ainda');

  const recent = mc.slice(0, 5);
  document.getElementById('dashRecent').innerHTML = recent.length > 0
    ? recent.map(c => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(55,75,120,.06)">
          <div style="width:28px;height:28px;border-radius:7px;background:${c.banco === 'Caixa' ? 'var(--caixa-bg)' : 'var(--sant-bg)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="fas fa-university" style="font-size:10px;color:${c.banco === 'Caixa' ? 'var(--caixa-l)' : 'var(--sant-l)'}"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.nome)}</div>
            <div style="font-size:9px;color:var(--t3)">${esc(c.banco)} &middot; ${fmtCur(c.valor)}</div>
          </div>
          <div style="font-size:9px;color:var(--t3)">${fmtDate(c.data)}</div>
        </div>`).join('')
    : emptyHTML('clock', 'Nenhum cliente', 'Cadastre clientes para ver aqui');
}

/* ================================================================
   CLIENTES
================================================================ */
function rCl(list) {
  /* Filtro de consultor — só visível para admin */
  const coF = document.getElementById('clCoF');
  if (coF && isAdmin()) {
    coF.style.display = 'block';
    const cur = coF.value;
    coF.innerHTML = '<option value="">Todos consultores</option>' +
      getConsultores().map(c => `<option value="${esc(c.id)}"${cur === c.id ? ' selected' : ''}>${esc(c.nome)}</option>`).join('');
  }

  const data = list || myClients();
  const bankBadge = b => b === 'Caixa' ? 'bcx' : 'bst';
  document.getElementById('clTb').innerHTML = data.length === 0
    ? `<tr><td colspan="9">${emptyHTML('users', 'Nenhum cliente cadastrado', 'Clique em Novo Cliente para começar')}</td></tr>`
    : data.map(c => `<tr>
        <td style="font-weight:600;color:var(--t1)">${esc(c.nome)}</td>
        <td>${esc(c.cpf)}</td>
        <td>${esc(c.cidade)}</td>
        <td><span class="badge ${bankBadge(c.banco)}">${esc(c.banco)}</span></td>
        <td style="font-weight:600;color:var(--gold)">${fmtCur(c.valor)}</td>
        <td style="color:var(--grn)">${fmtCur(c.ps)}</td>
        <td>${esc(getConsName(c.consultor_id))}</td>
        <td>${fmtDate(c.data)}</td>
        <td><div style="display:flex;gap:3px">
          <button class="btng btnic btnsm" onclick="editCl('${esc(c.id)}')"><i class="fas fa-edit"></i></button>
          <button class="btng btnic btnsm" style="color:var(--red)" onclick="delCl('${esc(c.id)}')"><i class="fas fa-trash"></i></button>
        </div></td>
      </tr>`).join('');
}

function filtCl() {
  const s  = document.getElementById('clSrch').value.toLowerCase();
  const bc = document.getElementById('clBcF').value;
  const co = document.getElementById('clCoF')?.value || '';
  rCl(myClients().filter(c =>
    (!s  || c.nome.toLowerCase().includes(s) || c.cpf.includes(s)) &&
    (!bc || c.banco === bc) &&
    (!co || c.consultor_id === co)
  ));
}

function openMCx() { _initClientModal('Caixa');     openM('mCl'); }
function openMSt() { _initClientModal('Santander'); openM('mCl'); }

async function addCl() {
  const nm = document.getElementById('ncN').value.trim();
  if (!nm) { toast('e', 'Erro', 'Nome é obrigatório'); return; }

  const vl  = parseFloat(document.getElementById('ncVl').value) || 0;
  let   cid = document.getElementById('ncCo').value;
  if (!cid && isAdmin()) { toast('e', 'Erro', 'Selecione um consultor'); return; }
  if (!cid) cid = CU.id;

  const { error } = await db.from('clientes').insert({
    nome:         nm,
    cpf:          document.getElementById('ncC').value  || '-',
    cidade:       document.getElementById('ncCi').value || '-',
    banco:        document.getElementById('ncBc').value,
    valor:        vl,
    ps:           parseFloat((vl * 0.37).toFixed(2)),
    consultor_id: cid,
    data:         todayStr()
  });
  if (error) { toast('e', 'Erro', error.message); return; }

  closeM('mCl');
  await refreshAll();
  toast('s', 'Cliente cadastrado', nm + ' — ' + fmtCur(vl));
}

function editCl(id) {
  const c = CL.find(x => x.id === id);
  if (c) toast('i2', 'Editar', c.nome + ' (em breve)');
}

async function delCl(id) {
  const c = CL.find(x => x.id === id);
  if (!c || !confirm(`Remover cliente "${c.nome}"?`)) return;
  const { error } = await db.from('clientes').delete().eq('id', id);
  if (error) { toast('e', 'Erro', error.message); return; }
  await refreshAll();
  toast('w', 'Removido', c.nome);
}

/* ================================================================
   CAIXA / SANTANDER
================================================================ */
function rBank(banco, elId) {
  const clients = myClients().filter(c => c.banco === banco);
  const el      = document.getElementById(elId);
  if (!clients.length) {
    el.innerHTML = emptyHTML('university', 'Nenhum cliente ' + banco, 'Cadastre clientes para visualizar');
    return;
  }

  const total = clients.reduce((a, c) => a + Number(c.valor), 0);
  const psT   = clients.reduce((a, c) => a + Number(c.ps), 0);

  el.innerHTML = `
    <div class="sg" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
      <div class="sc"><div class="sl">Clientes</div><div class="sv">${clients.length}</div></div>
      <div class="sc"><div class="sl">Volume Total</div><div class="sv" style="color:var(--gold)">${fmtCur(total)}</div></div>
      <div class="sc"><div class="sl">PS 37%</div><div class="sv" style="color:var(--grn)">${fmtCur(psT)}</div></div>
    </div>
    <div class="cd"><div class="tw"><table><thead><tr>
      <th>Nome</th><th>CPF</th><th>Cidade</th><th>Valor Liberado</th><th>PS 37%</th><th>Consultor</th><th>Data</th>
    </tr></thead><tbody>
      ${clients.map(c => `<tr>
        <td style="font-weight:600;color:var(--t1)">${esc(c.nome)}</td>
        <td>${esc(c.cpf)}</td><td>${esc(c.cidade)}</td>
        <td style="font-weight:600;color:var(--gold)">${fmtCur(c.valor)}</td>
        <td style="color:var(--grn)">${fmtCur(c.ps)}</td>
        <td>${esc(getConsName(c.consultor_id))}</td>
        <td>${fmtDate(c.data)}</td>
      </tr>`).join('')}
    </tbody></table></div></div>`;
}

/* ================================================================
   CHAT (unificado)
================================================================ */
const CHAT_CFG = {
  Caixa:     { msgs: () => chatCx, elId: 'cxMsgs', inId: 'cxIn' },
  Santander: { msgs: () => chatSt, elId: 'stMsgs', inId: 'stIn' },
};

function rChat(canal) {
  const { msgs, elId } = CHAT_CFG[canal];
  const el   = document.getElementById(elId);
  const list = msgs();
  if (!list.length) {
    el.innerHTML = emptyHTML('comment-dots', 'Nenhuma mensagem', `Inicie uma conversa no Chat ${canal}`);
    return;
  }
  el.innerHTML = list.map(m => {
    const mine  = m.user_id === CU.id;
    const time  = new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const quote = m.reply_to_id
      ? `<div class="msg-reply" onclick="scrollToMsg('${esc(m.reply_to_id)}')">
           <span class="msg-reply-nm">${esc(m.reply_to_nome || '')}</span>
           <span class="msg-reply-tx">${esc((m.reply_to_texto || '📷 Foto').slice(0, 80))}</span>
         </div>` : '';
    const photo = m.image_url
      ? `<img src="${esc(m.image_url)}" class="msg-img" onclick="window.open('${esc(m.image_url)}','_blank')" loading="lazy">` : '';
    const body  = m.texto ? esc(m.texto) : '';

    return `<div class="chmsg ${mine ? 'snt' : 'rcv'}" id="msg-${esc(m.id)}">
      ${!mine ? `<div class="ma">${esc(m.user_nome)}</div>` : ''}
      ${quote}${photo}${body}
      <div class="msg-actions">
        <button class="msg-reply-btn" onclick="setReply('${canal}','${esc(m.id)}')">↩ Responder</button>
        ${m.texto ? `<button class="msg-reply-btn" onclick="copyMsg('${esc(m.id)}','${canal}')">📋 Copiar</button>` : ''}
      </div>
      <div class="mt">${time}</div>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

const rChatCx = () => rChat('Caixa');
const rChatSt = () => rChat('Santander');

async function sndChat(canal) {
  if (!CU) return;
  const inp = document.getElementById(CHAT_CFG[canal].inId);
  const txt = inp.value.trim();
  const img = _pendingImg?.canal === canal ? _pendingImg.url : null;
  if (!txt && !img) return;

  inp.value = '';
  const reply = _replyCtx;
  _replyCtx  = null;
  _pendingImg = null;
  cancelReply(canal);
  cancelChatImg(canal);

  const { error } = await db.from('mensagens').insert({
    canal,
    user_id:        CU.id,
    user_nome:      CU.nome,
    texto:          txt || null,
    image_url:      img || null,
    reply_to_id:    reply?.id   || null,
    reply_to_nome:  reply?.nome || null,
    reply_to_texto: reply?.texto || null,
  });
  if (error) toast('e', 'Erro', error.message);
}

const sndCx = () => sndChat('Caixa');
const sndSt = () => sndChat('Santander');

function updBadges() {
  if (!CU) return;
  const setB = (id, count) => {
    const el = document.getElementById(id);
    el.textContent   = count;
    el.style.display = count > 0 ? 'inline' : 'none';
  };
  setB('nbCx', chatCx.filter(m => m.user_id !== CU.id).length);
  setB('nbSt', chatSt.filter(m => m.user_id !== CU.id).length);
}

/* ================================================================
   RANKING
================================================================ */
function getRankingData() {
  return getConsultores().map(c => {
    const cls = CL.filter(cl => cl.consultor_id === c.id);
    const vol = cls.reduce((a, cl) => a + Number(cl.valor), 0);
    const ps  = cls.reduce((a, cl) => a + Number(cl.ps),    0);
    return { id: c.id, nome: c.nome, av: c.avatar, ct: cls.length, vol, ps };
  }).filter(r => r.ct > 0).sort((a, b) => b.vol - a.vol);
}

function _renderPodium(top3) {
  const ord = [top3[1] || top3[0], top3[0], top3[2] || top3[0]];
  const hs = [90, 130, 65], ms = ['m2', 'm1', 'm3'], mn = ['2', '1', '3'];
  return `<div class="pod">${ord.map((r, i) => r ? `
    <div class="podi">
      <div class="poda" style="background:linear-gradient(135deg,var(--gold),var(--goldd))">${esc(r.av || r.nome[0])}
        <div class="mdl ${ms[i]}">${mn[i]}</div>
      </div>
      <div class="podn">${esc(r.nome)}</div>
      <div class="podv">${fmtCur(r.vol)}</div>
      <div class="podb" style="height:${hs[i]}px"></div>
    </div>` : '').join('')}</div>`;
}

function rRk() {
  const rk = getRankingData();
  document.getElementById('rkPeriod').textContent = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  if (rk.length >= 3) {
    document.getElementById('podD').innerHTML = _renderPodium(rk.slice(0, 3));
  } else if (rk.length > 0) {
    document.getElementById('podD').innerHTML = `<div class="pod">${rk.map(r => `
      <div class="podi">
        <div class="poda" style="background:linear-gradient(135deg,var(--gold),var(--goldd))">${esc(r.av || r.nome[0])}</div>
        <div class="podn">${esc(r.nome)}</div>
        <div class="podv">${fmtCur(r.vol)}</div>
        <div class="podb" style="height:80px"></div>
      </div>`).join('')}</div>`;
  } else {
    document.getElementById('podD').innerHTML = emptyHTML('trophy', 'Sem ranking', 'Nenhum consultor com clientes ainda');
  }

  document.getElementById('rkTb').innerHTML = rk.length > 0
    ? rk.map((r, i) => `<tr>
        <td><span style="color:${i < 3 ? 'var(--gold)' : 'var(--t3)'};font-weight:${i < 3 ? '800' : '400'}">${i + 1}</span></td>
        <td style="font-weight:600;color:var(--t1)">${esc(r.nome)}</td>
        <td>${r.ct}</td>
        <td style="font-weight:600;color:var(--gold)">${fmtCur(r.vol)}</td>
        <td style="color:var(--grn)">${fmtCur(r.ps)}</td>
      </tr>`).join('')
    : `<tr><td colspan="5">${emptyHTML('list', 'Sem dados', '')}</td></tr>`;
}

/* ================================================================
   COMISSÕES
================================================================ */
function rCm() {
  const mes   = document.getElementById('cmMes')?.value || '';
  // Comissões são estritamente privadas: só admin vê todas, consultor vê as suas
  const base  = isAdmin() ? CL : CL.filter(c => c.consultor_id === CU.id);
  const mc    = base.filter(c => !mes || (c.data || '').startsWith(mes));
  const allCm = mc.map(c => {
    const cm = CM.find(m => m.cliente_id === c.id);
    return { dt: c.data, cl: c.nome, bc: c.banco, vl: c.valor, ps: c.ps, id: c.id, st: cm?.status ?? 'Pendente' };
  });

  const totalPs = allCm.reduce((a, c) => a + Number(c.ps), 0);
  const pend    = allCm.filter(c => c.st !== 'Pago');
  const pagas   = allCm.filter(c => c.st === 'Pago');

  document.getElementById('cmStats').innerHTML =
    `<div class="sc" style="text-align:center"><div class="si icg" style="margin:0 auto 10px"><i class="fas fa-coins"></i></div><div class="sl">Total de Comissões</div><div class="sv" style="color:var(--gold)">${fmtCur(totalPs)}</div></div>` +
    `<div class="sc" style="text-align:center"><div class="si ico" style="margin:0 auto 10px"><i class="fas fa-hourglass-half"></i></div><div class="sl">Pendentes</div><div class="sv" style="color:var(--org)">${fmtCur(pend.reduce((a,c)=>a+Number(c.ps),0))}</div><div style="font-size:10px;color:var(--t3);margin-top:4px">${pend.length} vendas</div></div>` +
    `<div class="sc" style="text-align:center"><div class="si icgr" style="margin:0 auto 10px"><i class="fas fa-check-circle"></i></div><div class="sl">Pagas</div><div class="sv" style="color:var(--grn)">${fmtCur(pagas.reduce((a,c)=>a+Number(c.ps),0))}</div><div style="font-size:10px;color:var(--t3);margin-top:4px">${pagas.length} vendas</div></div>`;

  const rowFn = c => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(55,75,120,.06)">
    <div>
      <div style="font-size:12px;font-weight:600;color:var(--t1)">${esc(c.cl)}</div>
      <div style="font-size:10px;color:var(--t3)">${esc(c.bc)} · ${fmtDate(c.dt)}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:13px;font-weight:700;color:var(--gold)">${fmtCur(c.ps)}</div>
      <div style="font-size:10px;color:var(--t3)">${fmtCur(c.vl)} liberado</div>
    </div>
  </div>`;

  document.getElementById('cmPend').innerHTML = pend.length
    ? pend.map(rowFn).join('') : `<p style="font-size:11px;color:var(--t3);text-align:center;padding:16px">Nenhuma comissão pendente</p>`;
  document.getElementById('cmPago').innerHTML = pagas.length
    ? pagas.map(rowFn).join('') : `<p style="font-size:11px;color:var(--t3);text-align:center;padding:16px">Nenhuma comissão paga</p>`;
}

/* ================================================================
   VENDAS
================================================================ */
function _myVendas() {
  return isAdmin() ? VD : VD.filter(v => v.consultor_id === CU.id);
}

function rVd() {
  const srch = (document.getElementById('vdSrch')?.value || '').toLowerCase();
  const mes  = document.getElementById('vdMes')?.value || '';
  const stF  = document.getElementById('vdStF')?.value || '';

  const list = _myVendas().filter(v =>
    (!srch || v.cliente_nome.toLowerCase().includes(srch)) &&
    (!mes  || (v.data || '').startsWith(mes)) &&
    (!stF  || v.status === stF)
  );

  const stBadge = s => ({ pendente: 'bor', concluida: 'bgr', cancelada: 'brd' }[s] || 'bor');
  const stLabel = s => ({ pendente: 'Pendente', concluida: 'Concluída', cancelada: 'Cancelada' }[s] || s);

  document.getElementById('vdList').innerHTML = list.length === 0
    ? `<div class="cd">${emptyHTML('dollar-sign', 'Nenhuma venda encontrada', 'Clique em Nova Venda para registrar')}</div>`
    : `<div class="cd"><div class="tw"><table><thead><tr>
        <th>Cliente</th><th>Banco</th><th>Valor</th><th>PS 37%</th><th>Status</th><th>Consultor</th><th>Data</th><th>Ações</th>
      </tr></thead><tbody>${list.map(v => `<tr>
        <td style="font-weight:600;color:var(--t1)">${esc(v.cliente_nome)}</td>
        <td><span class="badge ${v.banco === 'Caixa' ? 'bcx' : 'bst'}">${esc(v.banco || '-')}</span></td>
        <td style="color:var(--gold);font-weight:600">${fmtCur(v.valor)}</td>
        <td style="color:var(--grn)">${fmtCur(v.ps)}</td>
        <td><span class="badge ${stBadge(v.status)}">${stLabel(v.status)}</span></td>
        <td>${esc(getConsName(v.consultor_id))}</td>
        <td>${fmtDate(v.data)}</td>
        <td><button class="btng btnic btnsm" style="color:var(--red)" onclick="delVd('${esc(v.id)}')"><i class="fas fa-trash"></i></button></td>
      </tr>`).join('')}</tbody></table></div></div>`;
}

function _initVdModal() {
  populateConsSel('vdCo');
  document.getElementById('vdConsFG').style.display = isAdmin() ? 'block' : 'none';
  ['vdNm','vdVl'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('vdPs').innerHTML = '';
}

async function addVd() {
  const nm = document.getElementById('vdNm').value.trim();
  if (!nm) { toast('e', 'Erro', 'Nome é obrigatório'); return; }
  const vl  = parseFloat(document.getElementById('vdVl').value) || 0;
  let   cid = document.getElementById('vdCo').value || CU.id;

  const { error } = await db.from('vendas').insert({
    cliente_nome: nm,
    banco:        document.getElementById('vdBc').value,
    valor:        vl,
    ps:           parseFloat((vl * 0.37).toFixed(2)),
    status:       document.getElementById('vdSt').value,
    consultor_id: cid,
    data:         todayStr()
  });
  if (error) { toast('e', 'Erro', error.message); return; }
  closeM('mVd');
  await loadVendas(); rVd();
  toast('s', 'Venda registrada', nm + ' — ' + fmtCur(vl));
}

async function delVd(id) {
  const v = VD.find(x => x.id === id);
  if (!v || !confirm(`Remover venda de "${v.cliente_nome}"?`)) return;
  const { error } = await db.from('vendas').delete().eq('id', id);
  if (error) { toast('e', 'Erro', error.message); return; }
  await loadVendas(); rVd();
  toast('w', 'Venda removida', v.cliente_nome);
}

/* ================================================================
   CAPTAÇÃO
================================================================ */
const CAP_ST = { novo: { label: 'Novo', cls: 'bcx' }, contato: { label: 'Em Contato', cls: 'bor' }, qualificado: { label: 'Qualificado', cls: 'bgr' }, perdido: { label: 'Perdido', cls: 'brd' } };

function _myCap() {
  return isAdmin() || isAuxiliar() ? CAP : CAP.filter(c => c.consultor_id === CU.id);
}

function rCap() {
  const srch = (document.getElementById('capSrch')?.value || '').toLowerCase();
  const stF  = document.getElementById('capStF')?.value || '';
  const list = _myCap().filter(c =>
    (!srch || c.nome.toLowerCase().includes(srch) || (c.telefone || '').includes(srch)) &&
    (!stF  || c.status === stF)
  );

  const counts = Object.fromEntries(Object.keys(CAP_ST).map(k => [k, _myCap().filter(c => c.status === k).length]));
  document.getElementById('capStats').innerHTML =
    Object.entries(CAP_ST).map(([k, v]) =>
      `<div class="sc" style="text-align:center"><div class="sl">${v.label}</div><div class="sv">${counts[k]}</div></div>`
    ).join('');

  document.getElementById('capTb').innerHTML = list.length === 0
    ? `<tr><td colspan="8">${emptyHTML('magnet', 'Nenhum lead', 'Clique em Novo Lead para começar')}</td></tr>`
    : list.map(c => {
        const st = CAP_ST[c.status] || { label: c.status, cls: 'bor' };
        return `<tr>
          <td style="font-weight:600;color:var(--t1)">${esc(c.nome)}</td>
          <td>${esc(c.telefone || '-')}</td>
          <td>${c.banco ? `<span class="badge ${c.banco==='Caixa'?'bcx':'bst'}">${esc(c.banco)}</span>` : '-'}</td>
          <td>${esc(c.origem || '-')}</td>
          <td><span class="badge ${st.cls}">${st.label}</span></td>
          <td>${esc(getConsName(c.consultor_id))}</td>
          <td>${fmtDate(c.data)}</td>
          <td><div style="display:flex;gap:3px">
            <select onchange="updCapSt('${esc(c.id)}',this.value)" style="padding:3px 6px;background:rgba(15,23,42,.6);border:1px solid var(--bdr);border-radius:6px;color:var(--t1);font-family:Poppins;font-size:9px;outline:0">
              ${Object.entries(CAP_ST).map(([k,v])=>`<option value="${k}"${k===c.status?' selected':''}>${v.label}</option>`).join('')}
            </select>
            <button class="btng btnic btnsm" style="color:var(--red)" onclick="delCap('${esc(c.id)}')"><i class="fas fa-trash"></i></button>
          </div></td>
        </tr>`;
      }).join('');
}

function _initCapModal() {
  populateConsSel('capCo');
  document.getElementById('capConsFG').style.display = isAdmin() ? 'block' : 'none';
  ['capNm','capTel','capOr','capObs'].forEach(id => document.getElementById(id).value = '');
}

async function addCap() {
  const nm = document.getElementById('capNm').value.trim();
  if (!nm) { toast('e', 'Erro', 'Nome é obrigatório'); return; }
  const cid = document.getElementById('capCo').value || CU.id;
  const { error } = await db.from('captacao').insert({
    nome:         nm,
    telefone:     document.getElementById('capTel').value || null,
    banco:        document.getElementById('capBc').value  || null,
    origem:       document.getElementById('capOr').value  || null,
    status:       document.getElementById('capSt').value,
    obs:          document.getElementById('capObs').value || null,
    consultor_id: cid,
    data:         todayStr()
  });
  if (error) { toast('e', 'Erro', error.message); return; }
  closeM('mCap');
  await loadCaptacao(); rCap();
  toast('s', 'Lead adicionado', nm);
}

async function updCapSt(id, status) {
  const { error } = await db.from('captacao').update({ status }).eq('id', id);
  if (error) { toast('e', 'Erro', error.message); return; }
  const c = CAP.find(x => x.id === id);
  if (c) c.status = status;
  rCap();
}

async function delCap(id) {
  const c = CAP.find(x => x.id === id);
  if (!c || !confirm(`Remover lead "${c.nome}"?`)) return;
  const { error } = await db.from('captacao').delete().eq('id', id);
  if (error) { toast('e', 'Erro', error.message); return; }
  await loadCaptacao(); rCap();
  toast('w', 'Lead removido', c.nome);
}

/* ================================================================
   LISTAS
================================================================ */
function rLs() {
  const list = isAdmin() ? LS : LS.filter(l => l.consultor_id === CU.id);
  const empty = isAdmin()
    ? emptyHTML('list', 'Nenhuma lista criada', 'Crie listas e distribua para os consultores')
    : emptyHTML('list', 'Nenhuma lista recebida', 'O administrador enviará listas para você');
  document.getElementById('lsGrid').innerHTML = list.length === 0 ? empty : list.map(renderLsCard).join('');
}

function renderLsCard(l) {
  const cls     = CL.filter(c => c.lista_id === l.id);
  const bcBadge = l.banco === 'Caixa' ? 'bcx' : 'bst';
  return `<div class="lscd">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h4 style="font-size:13px;font-weight:700">${esc(l.nome)}</h4>
      <span class="badge ${bcBadge}">${esc(l.banco)}</span>
    </div>
    <div style="font-size:10px;color:var(--t3);margin-bottom:4px"><i class="fas fa-user" style="margin-right:3px"></i>Consultor: ${esc(getConsName(l.consultor_id))}</div>
    <div style="font-size:10px;color:var(--t3);margin-bottom:8px"><i class="fas fa-users" style="margin-right:3px"></i>${cls.length} cliente(s) &middot; ${fmtDate(l.data)}</div>
    ${cls.length > 0 ? `<div style="max-height:120px;overflow-y:auto;margin-bottom:10px">${cls.map(c =>
      `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(55,75,120,.06)">
        <span style="font-size:10px;color:var(--t2)">${esc(c.nome)}</span>
        <span style="font-size:10px;color:var(--gold)">${fmtCur(c.valor)}</span>
      </div>`).join('')}</div>` : ''}
    ${isAdmin() ? `<div style="display:flex;gap:4px;flex-wrap:wrap">
      <button class="btn btns btnsm" onclick="mgLs('${esc(l.id)}')"><i class="fas fa-cog"></i> Gerenciar</button>
      <button class="btn btns btnsm" onclick="openImportModal('${esc(l.id)}')"><i class="fas fa-file-import"></i> Importar</button>
      <button class="btn btnd btnsm" onclick="delLs('${esc(l.id)}')"><i class="fas fa-trash"></i> Excluir</button>
    </div>` : ''}
  </div>`;
}

async function addLs() {
  const nm = document.getElementById('lsN').value.trim();
  if (!nm) { toast('e', 'Erro', 'Nome obrigatório'); return; }
  const co = document.getElementById('lsCo').value;
  const { error } = await db.from('listas').insert({
    nome:         nm,
    banco:        document.getElementById('lsBc').value,
    consultor_id: co || null,
    data:         todayStr()
  });
  if (error) { toast('e', 'Erro', error.message); return; }
  closeM('mLs');
  await loadListas(); rLs();
  toast('s', 'Lista criada', nm + (co ? ' — enviada para ' + getConsName(co) : ''));
}

async function delLs(id) {
  const l = LS.find(x => x.id === id);
  if (!l || !confirm(`Excluir lista "${l.nome}"?`)) return;
  const { error } = await db.from('listas').delete().eq('id', id);
  if (error) { toast('e', 'Erro', error.message); return; }
  await loadListas(); rLs();
  toast('w', 'Lista removida', l.nome);
}

async function mgLs(id) {
  const l = LS.find(x => x.id === id);
  if (!l) return;
  const cls   = CL.filter(c => c.lista_id === l.id);
  const avail = CL.filter(c => c.lista_id !== l.id);
  const cs    = getConsultores();

  document.getElementById('mLsMgT').textContent = 'Gerenciar: ' + l.nome;

  const consOpts = `<option value="">Sem consultor</option>` +
    cs.map(c => `<option value="${esc(c.id)}"${l.consultor_id === c.id ? ' selected' : ''}>${esc(c.nome)}</option>`).join('');

  let html = `<div class="fg"><label>Consultor Responsável</label>
    <select id="mgLsCo" onchange="chgLsCons('${esc(l.id)}',this.value)">${consOpts}</select></div>`;

  html += `<h4 style="font-size:12px;font-weight:700;margin:14px 0 8px">Clientes na Lista (${cls.length})</h4>`;

  if (cls.length > 0) {
    html += `<div style="max-height:200px;overflow-y:auto">${cls.map(c => {
      const coOpts = `<option value="">Mover para...</option>` +
        cs.map(co => `<option value="${esc(co.id)}"${c.consultor_id === co.id ? ' selected' : ''}>${esc(co.nome)}</option>`).join('');
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:rgba(15,23,42,.4);border-radius:8px;margin-bottom:4px">
        <div>
          <span style="font-size:11px;font-weight:600;color:var(--t1)">${esc(c.nome)}</span>
          <span style="font-size:9px;color:var(--t3);margin-left:6px">${esc(c.banco)} &middot; ${fmtCur(c.valor)}</span>
        </div>
        <div style="display:flex;gap:4px">
          <select onchange="mvClCons('${esc(c.id)}',this.value)" style="padding:4px 6px;background:rgba(15,23,42,.6);border:1px solid var(--bdr);border-radius:6px;color:var(--t1);font-family:Poppins;font-size:9px;outline:0">${coOpts}</select>
          <button class="btng btnic btnsm" style="color:var(--red)" onclick="rmClFromLs('${esc(c.id)}','${esc(l.id)}')"><i class="fas fa-times"></i></button>
        </div>
      </div>`;
    }).join('')}</div>`;
  } else {
    html += `<p style="font-size:11px;color:var(--t3)">Nenhum cliente nesta lista</p>`;
  }

  if (avail.length > 0) {
    html += `<h4 style="font-size:12px;font-weight:700;margin:14px 0 8px">Adicionar Clientes</h4>
      <div style="max-height:150px;overflow-y:auto">${avail.map(c =>
        `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:rgba(15,23,42,.3);border-radius:6px;margin-bottom:3px">
          <span style="font-size:10px;color:var(--t2)">${esc(c.nome)} (${esc(c.banco)})</span>
          <button class="btn btns btnsm" onclick="addClToLs('${esc(c.id)}','${esc(l.id)}')"><i class="fas fa-plus"></i></button>
        </div>`).join('')}</div>`;
  }

  document.getElementById('mLsMgB').innerHTML = html;
  document.getElementById('mLsMg').classList.add('on');
}

async function chgLsCons(lsId, coId) {
  const { error } = await db.from('listas').update({ consultor_id: coId || null }).eq('id', lsId);
  if (error) { toast('e', 'Erro', error.message); return; }
  await loadListas(); rLs();
  toast('s', 'Atualizado', 'Consultor alterado');
}

async function mvClCons(clId, coId) {
  const { error } = await db.from('clientes').update({ consultor_id: coId || null }).eq('id', clId);
  if (error) { toast('e', 'Erro', error.message); return; }
  const c = CL.find(x => x.id === clId);
  await refreshAll();
  toast('s', 'Movido', 'Cliente transferido');
  if (c?.lista_id) mgLs(c.lista_id);
}

async function addClToLs(clId, lsId) {
  const { error } = await db.from('clientes').update({ lista_id: lsId }).eq('id', clId);
  if (error) { toast('e', 'Erro', error.message); return; }
  const c = CL.find(x => x.id === clId);
  await refreshAll();
  if (c) toast('s', 'Adicionado', c.nome);
  mgLs(lsId);
}

async function rmClFromLs(clId, lsId) {
  const { error } = await db.from('clientes').update({ lista_id: null }).eq('id', clId);
  if (error) { toast('e', 'Erro', error.message); return; }
  const c = CL.find(x => x.id === clId);
  await refreshAll();
  if (c) toast('w', 'Removido da lista', c.nome);
  mgLs(lsId);
}

/* ================================================================
   CRM — Funil de Vendas (Kanban)
================================================================ */
const CRM_COLS = [
  { id: 'negociando', label: 'Negociando',        color: '#3b82f6' },
  { id: 'documentos', label: 'Pegando Documentos', color: '#f59e0b' },
  { id: 'fechado',    label: 'Cliente Fechado',    color: '#8b5cf6' },
  { id: 'pago',       label: 'Cliente Pago',       color: '#10b981' },
  { id: 'ps_pago',    label: 'Cliente Pagou PS',   color: '#06b6d4' },
  { id: 'desistiu',   label: 'Cliente Desistiu',   color: '#ef4444' },
];

let _crmView = 'funil'; // 'funil' | 'acomp'
let _dragId   = null;

function swCrmTab(view, btn) {
  _crmView = view;
  document.querySelectorAll('.crm-tab').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  rCRM();
}

function rCRM() {
  const srch = (document.getElementById('crmSrch')?.value || '').toLowerCase();
  const clients = myClients().filter(c =>
    !srch || c.nome.toLowerCase().includes(srch) || (c.cpf || '').includes(srch)
  );

  if (_crmView === 'acomp') {
    _rCRMAcomp(clients);
    return;
  }

  const board = document.getElementById('crmBoard');
  board.innerHTML = `<div class="crm-board">${CRM_COLS.map(col => {
    const cards = clients.filter(c => (c.crm_status || 'negociando') === col.id);
    return `<div class="crm-col" id="col-${col.id}"
        ondragover="event.preventDefault();document.getElementById('col-${col.id}').classList.add('drag-over')"
        ondragleave="document.getElementById('col-${col.id}').classList.remove('drag-over')"
        ondrop="dropCard(event,'${col.id}')">
      <div class="crm-col-hd" style="background:${col.color}">
        <span>${col.label}</span>
        <div class="crm-col-ct">${cards.length}</div>
      </div>
      <div class="crm-cards" id="cards-${col.id}">
        ${cards.length
          ? cards.map(c => _crmCard(c)).join('')
          : `<div class="crm-empty">Nenhum cliente</div>`}
      </div>
    </div>`;
  }).join('')}</div>`;
}

function _crmCard(c) {
  return `<div class="crm-card" id="card-${c.id}" draggable="true"
      ondragstart="dragCard(event,'${c.id}')"
      ondragend="document.querySelectorAll('.crm-col').forEach(el=>el.classList.remove('drag-over'))"
      onclick="openCrmCard('${c.id}')">
    <div class="crm-card-nm">${esc(c.nome)}</div>
    <div class="crm-card-sub">${esc(c.cpf !== '-' ? c.cpf : c.cidade !== '-' ? c.cidade : c.banco)}</div>
    ${c.valor > 0 ? `<div class="crm-card-val">${fmtCur(c.valor)}</div>` : ''}
  </div>`;
}

function dragCard(e, id) {
  _dragId = id;
  setTimeout(() => document.getElementById('card-' + id)?.classList.add('dragging'), 0);
}

async function dropCard(e, status) {
  e.preventDefault();
  document.querySelectorAll('.crm-col').forEach(el => el.classList.remove('drag-over'));
  if (!_dragId) return;
  const id = _dragId; _dragId = null;
  document.getElementById('card-' + id)?.classList.remove('dragging');

  const c = CL.find(x => x.id === id);
  if (!c || c.crm_status === status) return;

  const { error } = await db.from('clientes').update({ crm_status: status }).eq('id', id);
  if (error) { toast('e', 'Erro', error.message); return; }
  c.crm_status = status;
  rCRM();
  const col = CRM_COLS.find(x => x.id === status);
  toast('s', c.nome, '→ ' + (col?.label || status));
}

function openCrmCard(id) {
  const c = CL.find(x => x.id === id);
  if (!c) return;
  const cur = CRM_COLS.find(x => x.id === (c.crm_status || 'negociando'));
  const opts = CRM_COLS.map(col =>
    `<option value="${col.id}"${col.id === c.crm_status ? ' selected' : ''}>${col.label}</option>`
  ).join('');

  document.getElementById('crmCardNm').textContent  = c.nome;
  document.getElementById('crmCardSub').textContent = `${c.banco} · ${fmtCur(c.valor)} · ${fmtDate(c.data)}`;
  document.getElementById('crmCardSt').innerHTML    = opts;
  document.getElementById('crmCardId').value        = id;
  document.getElementById('mCrmCard').classList.add('on');
}

async function saveCrmCard() {
  const id     = document.getElementById('crmCardId').value;
  const status = document.getElementById('crmCardSt').value;
  const { error } = await db.from('clientes').update({ crm_status: status }).eq('id', id);
  if (error) { toast('e', 'Erro', error.message); return; }
  const c = CL.find(x => x.id === id);
  if (c) c.crm_status = status;
  closeM('mCrmCard');
  rCRM();
  toast('s', 'Atualizado', CRM_COLS.find(x => x.id === status)?.label);
}

function _rCRMAcomp(clients) {
  const board = document.getElementById('crmBoard');
  if (!clients.length) { board.innerHTML = emptyHTML('columns','Nenhum cliente','Cadastre clientes para ver aqui'); return; }
  board.innerHTML = `<div class="cd"><div class="tw"><table>
    <thead><tr><th>Nome</th><th>Banco</th><th>Valor</th><th>Status</th><th>Consultor</th><th>Data</th><th></th></tr></thead>
    <tbody>${clients.map(c => {
      const col = CRM_COLS.find(x => x.id === (c.crm_status || 'negociando'));
      return `<tr>
        <td style="font-weight:600;color:var(--t1)">${esc(c.nome)}</td>
        <td><span class="badge ${c.banco==='Caixa'?'bcx':'bst'}">${esc(c.banco)}</span></td>
        <td style="color:var(--gold);font-weight:600">${fmtCur(c.valor)}</td>
        <td><span class="badge" style="background:${col?.color}22;color:${col?.color}">${col?.label||'-'}</span></td>
        <td>${esc(getConsName(c.consultor_id))}</td>
        <td>${fmtDate(c.data)}</td>
        <td><button class="btng btnic btnsm" onclick="openCrmCard('${esc(c.id)}')"><i class="fas fa-edit"></i></button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div></div>`;
}

/* ================================================================
   CONFIG — Perfil + Acessos Google (admin)
================================================================ */
function rConfig() {
  if (isAdmin()) rApprovedEmails();
}

async function rApprovedEmails() {
  const el = document.getElementById('aprList');
  if (!el) return;

  const { data } = await db.from('approved_emails').select('*').order('created_at', { ascending: true });
  APR = data || [];

  if (!APR.length) {
    el.innerHTML = `<p style="font-size:11px;color:var(--t3);text-align:center;padding:16px 0">Nenhum e-mail autorizado ainda.</p>`;
    return;
  }

  el.innerHTML = `<div class="tw"><table><thead><tr>
    <th>E-mail</th><th>Cargo</th><th style="width:40px"></th>
  </tr></thead><tbody>${APR.map(a => `<tr>
    <td style="color:var(--t1)">${esc(a.email)}</td>
    <td><span class="badge ${a.role === 'admin' ? 'bgl' : 'bcx'}">${esc(a.role)}</span></td>
    <td><button class="btng btnic btnsm" style="color:var(--red)" onclick="delApprovedEmail('${esc(a.id)}')"><i class="fas fa-trash"></i></button></td>
  </tr>`).join('')}</tbody></table></div>`;
}

async function addApprovedEmail() {
  const email = document.getElementById('aprEm').value.trim().toLowerCase();
  const role  = document.getElementById('aprRl').value;
  if (!email) { toast('e', 'Erro', 'E-mail obrigatório'); return; }

  const { error } = await db.from('approved_emails').insert({ email, role });
  if (error) { toast('e', 'Erro', error.message); return; }

  document.getElementById('aprEm').value = '';
  toast('s', 'Autorizado', email + ' pode entrar com Google');
  rApprovedEmails();
}

async function delApprovedEmail(id) {
  const a = APR.find(x => x.id === id);
  if (!a || !confirm(`Remover acesso de ${a.email}?`)) return;
  const { error } = await db.from('approved_emails').delete().eq('id', id);
  if (error) { toast('e', 'Erro', error.message); return; }
  toast('w', 'Removido', a.email);
  rApprovedEmails();
}

/* ================================================================
   PERFIL — salvar nome, foto
================================================================ */
async function saveProfile() {
  const nm = document.getElementById('cfNi').value.trim();
  if (!nm) { toast('e', 'Erro', 'Nome não pode ser vazio'); return; }
  const { error } = await db.from('profiles').update({ nome: nm }).eq('id', CU.id);
  if (error) { toast('e', 'Erro', error.message); return; }
  CU.nome = nm;
  updUI();
  toast('s', 'Perfil', 'Nome atualizado!');
}

function triggerAvatarUpload() {
  document.getElementById('avatarFileIn').click();
}

async function handleAvatarFile(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('e', 'Erro', 'Foto muito grande (máx 5MB)'); return; }

  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.src = e.target.result;
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 200;
      const ctx = canvas.getContext('2d');
      const size = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 200, 200);
      const b64 = canvas.toDataURL('image/jpeg', 0.75);

      const { error } = await db.from('profiles').update({ avatar_url: b64 }).eq('id', CU.id);
      if (error) { toast('e', 'Erro ao salvar foto', error.message); return; }
      CU.avatar_url = b64;
      _applyAvatarURL(b64);
      toast('s', 'Foto', 'Foto de perfil atualizada!');
    };
  };
  reader.readAsDataURL(file);
}

/* ================================================================
   LISTA — importar clientes de texto colado
================================================================ */
function openImportModal(lsId) {
  document.getElementById('lsImportId').value = lsId;
  document.getElementById('lsImportTxt').value = '';
  document.getElementById('lsImportInfo').textContent = '';
  document.getElementById('mLsImport').classList.add('on');
}

async function importFromText() {
  const lsId = document.getElementById('lsImportId').value;
  const raw  = document.getElementById('lsImportTxt').value;
  if (!lsId || !raw.trim()) { toast('e', 'Erro', 'Cole os nomes e selecione uma lista'); return; }

  const ls    = LS.find(x => x.id === lsId);
  const names = raw.split('\n').map(s => s.trim()).filter(Boolean);
  if (!names.length) return;

  const cid  = ls?.consultor_id || CU.id;
  const rows = names.map(nome => ({
    nome, cpf: '-', cidade: '-',
    banco:        ls?.banco || 'Caixa',
    valor:        0, ps: 0,
    consultor_id: cid,
    lista_id:     lsId,
    data:         todayStr()
  }));

  const { error } = await db.from('clientes').insert(rows);
  if (error) { toast('e', 'Erro', error.message); return; }
  document.getElementById('lsImportTxt').value = '';
  closeM('mLsImport');
  await refreshAll();
  toast('s', 'Importado', names.length + ' cliente(s) adicionado(s) à lista');
}

/* ================================================================
   CHAT — responder mensagem
================================================================ */
function setReply(canal, msgId) {
  const msgs = canal === 'Caixa' ? chatCx : chatSt;
  const m    = msgs.find(x => x.id === msgId);
  if (!m) return;
  _replyCtx = { id: m.id, nome: m.user_nome, texto: m.texto || '📷 Foto' };
  const prefix = canal === 'Caixa' ? 'cx' : 'st';
  const bar = document.getElementById(prefix + 'ReplyBar');
  if (bar) {
    bar.classList.add('show');
    document.getElementById(prefix + 'ReplyNm').textContent = m.user_nome;
    document.getElementById(prefix + 'ReplyTx').textContent = (m.texto || '📷 Foto').slice(0, 70);
    document.getElementById(CHAT_CFG[canal].inId).focus();
  }
}

function cancelReply(canal) {
  _replyCtx = null;
  const prefix = canal === 'Caixa' ? 'cx' : 'st';
  document.getElementById(prefix + 'ReplyBar')?.classList.remove('show');
}

/* ================================================================
   CHAT — enviar foto
================================================================ */
function triggerChatPhoto(canal) {
  document.getElementById(canal === 'Caixa' ? 'cxFileIn' : 'stFileIn').click();
}

async function handleChatPhoto(canal, input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) { toast('e', 'Erro', 'Foto muito grande (máx 8MB)'); return; }

  toast('i2', 'Enviando foto...', 'Aguarde');
  const ext  = file.name.split('.').pop().toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: upErr } = await db.storage.from('chat-media').upload(path, file, { upsert: false });
  if (upErr) { toast('e', 'Erro no upload', upErr.message); return; }

  const { data } = db.storage.from('chat-media').getPublicUrl(path);
  _pendingImg = { url: data.publicUrl, canal };

  const prefix  = canal === 'Caixa' ? 'cx' : 'st';
  const preview = document.getElementById(prefix + 'ImgPreview');
  const thumb   = document.getElementById(prefix + 'ImgThumb');
  if (preview && thumb) {
    thumb.src = data.publicUrl;
    preview.style.display = 'flex';
  }
  input.value = '';
}

function cancelChatImg(canal) {
  _pendingImg = null;
  const prefix  = canal === 'Caixa' ? 'cx' : 'st';
  const preview = document.getElementById(prefix + 'ImgPreview');
  if (preview) preview.style.display = 'none';
}

function copyMsg(id, canal) {
  const msgs = canal === 'Caixa' ? chatCx : chatSt;
  const m = msgs.find(x => x.id === id);
  if (!m?.texto) return;
  navigator.clipboard.writeText(m.texto).then(() => toast('s', 'Copiado', m.texto.slice(0, 40) + (m.texto.length > 40 ? '…' : '')));
}

function scrollToMsg(id) {
  const el = document.getElementById('msg-' + id);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.outline = '2px solid var(--blue)'; setTimeout(() => el.style.outline = '', 1200); }
}

/* ── Enter no login ─────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const lf = document.getElementById('loginForm');
  if (lf?.style.display !== 'none' && document.getElementById('loginScreen')?.style.display !== 'none') doLogin();
});
