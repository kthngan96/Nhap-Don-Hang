(function(){
  "use strict";

  // ---------- SẢN PHẨM ----------
  const PRODUCTS = [
    {id:'pho_bo',          name:'Phở Bò',                          shortLabel:'Phở Bò',                  price:6667,  cat:'mi',     caseSize:30},
    {id:'pho_ga',          name:'Phở Gà',                          shortLabel:'Phở Gà',                  price:6667,  cat:'mi',     caseSize:30},
    {id:'hu_tieu_nv',      name:'Hủ Tiếu Nam Vang',                shortLabel:'Hủ tiếu Nam Vang',        price:7667,  cat:'mi',     caseSize:30},
    {id:'hu_tieu_sh',      name:'Hủ Tiếu Sườn Heo',                shortLabel:'Hủ tiếu sườn heo',        price:7667,  cat:'mi',     caseSize:30},
    {id:'pho_chay',        name:'Phở Chay',                        shortLabel:'Phở Chay',                price:7667,  cat:'mi',     caseSize:30},
    {id:'hu_tieu_chay',    name:'Hủ Tiếu Chay',                    shortLabel:'Hủ Tiếu Chay',            price:7667,  cat:'mi',     caseSize:30},
    {id:'bun_bo_hue',      name:'Bún Bò Huế',                      shortLabel:'Bún Bò Huế',              price:7667,  cat:'mi',     caseSize:30},
    {id:'bun_gio_heo',     name:'Bún Giò Heo',                     shortLabel:'Bún Giò Heo',             price:7667,  cat:'mi',     caseSize:30},
    {id:'bot_ngot',        name:'Bột Ngọt Thuần Việt',             shortLabel:'Bột Ngọt',                price:23000, cat:'gia_vi', caseSize:30},
    {id:'tieu_den',        name:'Tiêu đen xay',                    shortLabel:'Tiêu đen xay',            price:14000, cat:'gia_vi', caseSize:50},
    {id:'muoi_cham',       name:'Muối Chấm Tôm Chua Cay',          shortLabel:'Muối Chấm Tôm Chua Cay',  price:10000, cat:'gia_vi', caseSize:50},
    {id:'bot_canh_tom',    name:'Bột Canh Tôm',                    shortLabel:'Bột Canh Tôm',            price:4600,  cat:'gia_vi', caseSize:50},
    {id:'bot_canh_nam',    name:'Bột Canh Nấm',                    shortLabel:'Bột Canh Nấm',            price:4600,  cat:'gia_vi', caseSize:50},
  ];
  const DISTRICTS = [
    'Huyện Càng Long',
    'Huyện Cầu Kè',
    'Huyện Tiểu Cần',
    'Huyện Châu Thành',
    'Huyện Cầu Ngang',
    'Huyện Trà Cú',
    'Huyện Duyên Hải',
    'Thành phố Trà Vinh'
  ];
  const HISTORY_PAGE_SIZE = 30;
  const AVATAR_BUCKET = 'avatars';
  const AVATAR_MAX_SOURCE_BYTES = 10 * 1024 * 1024;
  const AVATAR_SIZE = 512;
  const AVATAR_QUALITY = .82;
  const AVATAR_TYPES = new Set(['image/jpeg','image/png','image/webp']);

  const DEFAULT_SETTINGS = {
    npp:'Thuận Lợi - Trà Vinh',
    nvbh:'Hữu Thi',
    avatarPath:null,
    targetDaily:3426000,
    targetMonthly:90000000,
    targetASO:50,
    targetGiaVi:20000000,
    workDays:26,
    prices:{}
  };

  const config = window.APP_CONFIG || {};
  let authLinkModePending = /(?:[?#&])type=(?:recovery|invite)(?:&|$)/.test(location.href);
  const configReady =
    /^https:\/\/.+\.supabase\.co$/.test(config.SUPABASE_URL || '') &&
    config.SUPABASE_ANON_KEY &&
    config.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
  const client = configReady && window.supabase
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
        auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
      })
    : null;
  const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

  let recoveryMode = false;
  let bootingForUser = null;
  function createHistoryState(){
    return {
      initialized:false,
      dirty:true,
      loading:false,
      requestId:0,
      rows:[],
      cursor:null,
      hasMore:false,
      filters:{
        mode:'single',
        singleDate:'',
        dateFrom:'',
        dateTo:'',
        customer:'',
        productId:'',
        district:''
      }
    };
  }
  let state = {
    date: todayStr(),
    settings: Object.assign({}, DEFAULT_SETTINGS),
    orders: [],
    session: null,
    user: null,
    pendingLocation: null,
    editingOrderId: null,
    orderDraftBeforeEdit: null,
    avatarUrl: '',
    avatarBusy: false,
    history:createHistoryState()
  };

  // ---------- HELPERS ----------
  function datePartsInVietnam(date){
    const parts=new Intl.DateTimeFormat('en-CA',{
      timeZone:VIETNAM_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(date);
    return Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  }
  function todayStr(){
    const parts=datePartsInVietnam(new Date());
    return parts.year+'-'+parts.month+'-'+parts.day;
  }
  function pad(n){return n<10?'0'+n:''+n;}
  function fmtVND(n){ n = Math.round(n||0); return n.toLocaleString('vi-VN'); }
  function fmtDateVN(iso){ const [y,m,d]=iso.split('-'); return d+'/'+m+'/'+y; }
  function profileInitials(){
    const metadata=state.user && state.user.user_metadata || {};
    const source=(state.settings && state.settings.nvbh) || metadata.display_name || metadata.username ||
      (state.user && state.user.email && state.user.email.split('@')[0]) || 'NV';
    const words=String(source).trim().split(/\s+/).filter(Boolean);
    if(!words.length) return 'NV';
    return (words.length===1 ? words[0].slice(0,2) : words[0][0]+words[words.length-1][0]).toUpperCase();
  }
  function renderAvatarPair(imageId,initialsId){
    const image=document.getElementById(imageId);
    const initials=document.getElementById(initialsId);
    initials.textContent=profileInitials();
    if(state.avatarUrl){
      image.src=state.avatarUrl;
      image.hidden=false;
      initials.hidden=true;
    }else{
      image.removeAttribute('src');
      image.hidden=true;
      initials.hidden=false;
    }
  }
  function renderProfile(){
    const settings=state.settings || DEFAULT_SETTINGS;
    const nvbh=settings.nvbh || DEFAULT_SETTINGS.nvbh;
    const npp=settings.npp || DEFAULT_SETTINGS.npp;
    document.getElementById('navbarNvbh').textContent=nvbh;
    document.getElementById('navbarNpp').textContent=npp;
    document.getElementById('accountMenuName').textContent=nvbh;
    document.getElementById('settingsProfileName').textContent=nvbh;
    document.getElementById('settingsProfileNpp').textContent=npp;
    renderAvatarPair('navbarAvatarImage','navbarAvatarInitials');
    renderAvatarPair('settingsAvatarImage','settingsAvatarInitials');
    document.getElementById('btnRemoveAvatar').disabled=state.avatarBusy || !settings.avatarPath;
  }
  function renderSelectedDate(){
    document.getElementById('dateDisplay').textContent=fmtDateVN(state.date);
    const todayDateLabel=document.getElementById('todayDateLabel');
    if(todayDateLabel) todayDateLabel.textContent=fmtDateVN(state.date);
  }
  function renderCurrentDateTimeVN(){
    const parts=Object.fromEntries(
      new Intl.DateTimeFormat('vi-VN',{
        timeZone:VIETNAM_TIME_ZONE,weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',
        hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
      }).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value])
    );
    document.getElementById('currentDateTimeVN').textContent=
      'Giờ Việt Nam: '+parts.weekday+', '+parts.day+'/'+parts.month+'/'+parts.year+
      ' · '+parts.hour+':'+parts.minute+':'+parts.second+' GMT+7';
  }
  function monthKey(iso){ return iso.slice(0,7); }
  function safeDiv(a,b){ return b>0 ? (a/b*100) : 0; }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function priceOf(pid){
    const product = PRODUCTS.find(p=>p.id===pid);
    const ov = state.settings && state.settings.prices && state.settings.prices[pid];
    if(ov!==undefined && ov!==null && ov!=='') return Number(ov);
    return product ? product.price : 0;
  }
  function caseSizeOf(pid){
    const product = PRODUCTS.find(p=>p.id===pid);
    return product && Number(product.caseSize) ? Number(product.caseSize) : 1;
  }
  function itemSoldQty(item){
    return Number(item && item.ban || 0);
  }
  function formatSoldQuantity(item){
    if(!item) return '';
    const hasCaseBreakdown = item.thung!==undefined || item.le!==undefined;
    const thung = Number(item.thung || 0);
    const le = Number(item.le || 0);
    if(hasCaseBreakdown){
      const parts = [];
      if(thung>0) parts.push(thung+' thùng');
      if(le>0) parts.push(le+' gói');
      return parts.length ? parts.join(' + ') : '0 gói';
    }
    return itemSoldQty(item)+' gói';
  }
  function formatItemQuantity(item){
    if(!item || (!itemSoldQty(item) && !Number(item.tang||0))) return '';
    let text = formatSoldQuantity(item);
    if(Number(item.tang||0)>0) text += ' tặng '+Number(item.tang)+' gói';
    return text;
  }
  function showToast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(()=>t.classList.remove('show'), 2600);
  }
  function setAuthMessage(message, type, targetId){
    const el = document.getElementById(targetId || 'authMessage');
    el.textContent = message || '';
    el.className = 'auth-message'+(type ? ' '+type : '');
  }
  function requireOnline(){
    if(!navigator.onLine){
      syncOnlineState();
      showToast('Không có kết nối mạng.');
      return false;
    }
    if(!state.user || !client){
      showToast('Phiên đăng nhập không hợp lệ.');
      return false;
    }
    return true;
  }
  function dbError(error, fallback){
    console.error(error);
    if(error && (error.status===401 || error.status===403)) return new Error('Phiên đăng nhập đã hết hạn.');
    return new Error(fallback || 'Không thể đồng bộ dữ liệu. Vui lòng thử lại.');
  }
  function throwQueryError(error, fallback){
    if(error) throw dbError(error, fallback);
  }
  async function runButtonAction(button, busyLabel, action){
    if(button.disabled) return;
    const label = button.querySelector('[data-button-label]');
    const oldText = label ? label.textContent : button.textContent;
    button.disabled = true;
    if(label) label.textContent = busyLabel;
    else button.textContent = busyLabel;
    try{ return await action(); }
    finally{
      button.disabled = false;
      if(label){
        if(label.textContent===busyLabel) label.textContent = oldText;
      }else button.textContent = oldText;
      syncOnlineState();
    }
  }
  function makeId(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'o'+Date.now()+Math.floor(Math.random()*1000000);
  }
  function buildMapUrl(location){
    return 'https://www.google.com/maps?q='+encodeURIComponent(location.latitude+','+location.longitude);
  }
  function normalizePlace(value){
    return String(value||'')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu,'')
      .replace(/đ/g,'d')
      .replace(/Đ/g,'D')
      .replace(/[.]/g,'')
      .replace(/\s+/g,' ')
      .trim()
      .toLowerCase();
  }
  function districtFromAddress(value){
    const normalized=normalizePlace(value);
    return DISTRICTS.find(district=>{
      const canonical=normalizePlace(district);
      const shortName=canonical.replace(/^huyen /,'').replace(/^thanh pho /,'');
      if(district==='Thành phố Trà Vinh'){
        return normalized.includes(canonical) || normalized.includes('tp tra vinh');
      }
      return normalized.includes(canonical) || normalized.includes(shortName);
    }) || '';
  }
  function orderMetadata(order){
    const values=[];
    if(order.district && districtFromAddress(order.diaChi)!==order.district) values.push(order.district);
    if(order.diaChi) values.push(order.diaChi);
    if(order.sdt) values.push(order.sdt);
    return values.map(esc).join(' · ');
  }
  function normalizeUsername(value){
    return String(value||'').trim().toLowerCase();
  }
  function isUsername(value){
    return /^[a-z0-9._-]{3,32}$/.test(value);
  }
  async function sha256Hex(value){
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  async function authCredentials(identifier,password){
    const normalized = normalizeUsername(identifier);
    if(identifier.includes('@')) return {email:normalized,password};
    if(!isUsername(normalized)) throw new Error('INVALID_USERNAME');
    return {
      email:normalized+'@nhap-don-hang.local',
      password:await sha256Hex('nhap-don-hang:v1:'+normalized+':'+password)
    };
  }

  // ---------- AUTH / ONLINE GATE ----------
  function showAuth(){
    document.getElementById('authShell').hidden = false;
    document.getElementById('app').hidden = true;
    document.getElementById('loginForm').hidden = recoveryMode;
    document.getElementById('resetForm').hidden = !recoveryMode;
  }
  function showApp(){
    document.getElementById('authShell').hidden = true;
    document.getElementById('app').hidden = false;
    const metadata = state.user && state.user.user_metadata || {};
    document.getElementById('accountEmail').textContent = metadata.username || (state.user && state.user.email) || '';
    renderProfile();
    requestAnimationFrame(syncTabbarVisual);
  }
  function clearAccountState(){
    bootingForUser = null;
    state.session = null;
    state.user = null;
    state.settings = Object.assign({}, DEFAULT_SETTINGS, {prices:{}});
    state.avatarUrl = '';
    state.avatarBusy = false;
    state.orders = [];
    state.pendingLocation = null;
    state.editingOrderId = null;
    state.orderDraftBeforeEdit = null;
    state.history = createHistoryState();
    resetOrderForm();
    syncOrderFormMode();
    renderToday();
    renderHistory();
  }
  function syncOnlineState(){
    const offline = !navigator.onLine;
    document.getElementById('offlineGate').hidden = !offline;
    document.querySelectorAll('#app button,#app input,#app textarea,#app select').forEach(el=>{
      if(offline){
        if(!Object.prototype.hasOwnProperty.call(el.dataset,'offlineDisabled')){
          el.dataset.offlineDisabled = el.disabled ? '0' : '1';
        }
        el.disabled = true;
      }else if(Object.prototype.hasOwnProperty.call(el.dataset,'offlineDisabled')){
        if(el.dataset.offlineDisabled==='1') el.disabled = false;
        delete el.dataset.offlineDisabled;
      }
    });
  }
  async function handleSession(session){
    state.session = session || null;
    state.user = session && session.user || null;
    if(!state.user){
      clearAccountState();
      showAuth();
      return;
    }
    if(recoveryMode){
      showAuth();
      return;
    }
    showApp();
    syncOnlineState();
    if(navigator.onLine) await bootstrapAccount();
  }
  async function bootstrapAccount(){
    if(!state.user || !client || !navigator.onLine) return;
    if(bootingForUser === state.user.id) return;
    bootingForUser = state.user.id;
    try{
      document.getElementById('dateInput').value = state.date;
      renderSelectedDate();
      await maybeImportLegacyData();
      await Promise.all([loadSettings(), loadOrdersForDate(state.date)]);
      renderProductRows();
      renderToday();
      renderSettingsForm();
      await renderReportTab();
    }catch(error){
      bootingForUser = null;
      console.error(error);
      showToast(error.message || 'Không thể tải dữ liệu tài khoản.');
    }
  }

  async function login(event){
    event.preventDefault();
    if(!client){
      setAuthMessage('Chưa cấu hình Supabase. Xem file SUPABASE_SETUP.md.', 'error');
      return;
    }
    if(!navigator.onLine){ syncOnlineState(); return; }
    const button = document.getElementById('btnLogin');
    await runButtonAction(button, 'Đang đăng nhập…', async ()=>{
      setAuthMessage('');
      const identifier = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      let credentials;
      try{
        credentials = await authCredentials(identifier,password);
      }catch(error){
        setAuthMessage('Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm, gạch ngang hoặc gạch dưới (3–32 ký tự).','error');
        return;
      }
      const {error} = await client.auth.signInWithPassword(credentials);
      if(error){
        setAuthMessage(
          error.message && error.message.toLowerCase().includes('invalid')
            ? 'Tên đăng nhập/email hoặc mật khẩu không đúng.'
            : 'Không thể đăng nhập. Vui lòng thử lại.',
          'error'
        );
      }
    });
  }
  async function sendPasswordReset(){
    if(!client){
      setAuthMessage('Chưa cấu hình Supabase. Xem file SUPABASE_SETUP.md.', 'error');
      return;
    }
    const email = document.getElementById('authEmail').value.trim().toLowerCase();
    if(!email){
      setAuthMessage('Nhập email để nhận liên kết đặt lại mật khẩu.', 'error');
      document.getElementById('authEmail').focus();
      return;
    }
    if(!email.includes('@')){
      setAuthMessage('Tài khoản dùng tên đăng nhập cần liên hệ quản trị viên để đặt lại mật khẩu.', 'error');
      return;
    }
    const button = document.getElementById('btnForgotPassword');
    await runButtonAction(button, 'Đang gửi…', async ()=>{
      const redirectTo = location.origin === 'null'
        ? location.href.split('#')[0]
        : location.origin + location.pathname;
      const {error} = await client.auth.resetPasswordForEmail(email,{redirectTo});
      if(error) setAuthMessage('Không thể gửi email. Vui lòng kiểm tra lại.', 'error');
      else setAuthMessage('Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi.', 'success');
    });
  }
  async function updatePassword(event){
    event.preventDefault();
    const password = document.getElementById('newPassword').value;
    const confirmation = document.getElementById('confirmPassword').value;
    if(password.length<8){
      setAuthMessage('Mật khẩu phải có ít nhất 8 ký tự.', 'error', 'resetMessage');
      return;
    }
    if(password!==confirmation){
      setAuthMessage('Hai mật khẩu chưa khớp.', 'error', 'resetMessage');
      return;
    }
    const button = document.getElementById('btnUpdatePassword');
    await runButtonAction(button, 'Đang cập nhật…', async ()=>{
      const {error} = await client.auth.updateUser({password});
      if(error){
        setAuthMessage('Không thể cập nhật mật khẩu. Liên kết có thể đã hết hạn.', 'error', 'resetMessage');
        return;
      }
      recoveryMode = false;
      setAuthMessage('', '', 'resetMessage');
      showToast('Đã cập nhật mật khẩu.');
      await handleSession(state.session);
    });
  }
  async function signOut(){
    if(!client) return;
    const button = document.getElementById('btnSignOut');
    await runButtonAction(button, 'Đang thoát…', async ()=>{
      await client.auth.signOut();
      clearAccountState();
      showAuth();
    });
  }

  // ---------- LEGACY STORAGE MIGRATION ----------
  async function legacyGet(key, fallback){
    try{
      let raw = null;
      if(window.storage && typeof window.storage.get==='function'){
        const result = await window.storage.get(key);
        raw = result && result.value;
      }else{
        raw = localStorage.getItem(key);
      }
      if(raw===undefined || raw===null) return fallback;
      return JSON.parse(raw);
    }catch(error){ return fallback; }
  }
  async function legacySet(key, value){
    const raw = JSON.stringify(value);
    if(window.storage && typeof window.storage.set==='function') await window.storage.set(key,raw);
    else localStorage.setItem(key,raw);
  }
  async function legacyKeys(prefix){
    try{
      if(window.storage && typeof window.storage.list==='function'){
        const result = await window.storage.list(prefix);
        return result && result.keys || [];
      }
      const keys = [];
      for(let i=0;i<localStorage.length;i++){
        const key = localStorage.key(i);
        if(key && key.startsWith(prefix)) keys.push(key);
      }
      return keys;
    }catch(error){ return []; }
  }
  function askLegacyImport(){
    return new Promise(resolve=>{
      const prompt = document.getElementById('migrationPrompt');
      prompt.hidden = false;
      document.getElementById('btnSkipMigration').onclick = ()=>{
        prompt.hidden = true;
        resolve(false);
      };
      document.getElementById('btnImportLegacy').onclick = ()=>{
        prompt.hidden = true;
        resolve(true);
      };
    });
  }
  function settingsToRow(settings){
    return {
      user_id:state.user.id,
      npp:settings.npp || '',
      nvbh:settings.nvbh || '',
      avatar_path:settings.avatarPath || null,
      target_daily:Number(settings.targetDaily)||0,
      target_monthly:Number(settings.targetMonthly)||0,
      target_aso:Number(settings.targetASO)||0,
      target_gia_vi:Number(settings.targetGiaVi)||0,
      work_days:Number(settings.workDays)||0,
      prices:settings.prices || {}
    };
  }
  function orderToRow(order,date){
    const location = order.location || null;
    return {
      user_id:state.user.id,
      id:String(order.id || makeId()),
      work_date:date,
      customer_name:order.kh || '',
      address:order.diaChi || '',
      district:order.district || districtFromAddress(order.diaChi) || null,
      phone:order.sdt || '',
      is_new:Boolean(order.isNew),
      note:order.ghiChu || '',
      items:order.items || {},
      latitude:location ? Number(location.latitude) : null,
      longitude:location ? Number(location.longitude) : null,
      location_accuracy:location && Number.isFinite(Number(location.accuracy)) ? Number(location.accuracy) : null,
      location_captured_at:location && location.capturedAt || null,
      created_at:order.createdAt || new Date().toISOString()
    };
  }
  function reportToRow(report){
    return {
      user_id:state.user.id,
      work_date:report.date,
      revenue:Number(report.revenue)||0,
      gia_vi:Number(report.giaVi)||0,
      order_count:Number(report.orderCount)||0,
      new_customers:report.newCustomers || [],
      achieved:Boolean(report.dat),
      finalized_at:report.finalizedAt || new Date().toISOString()
    };
  }
  async function maybeImportLegacyData(){
    const marker = await legacyGet('legacy:migratedTo', null);
    if(marker) return;
    const [legacySettings, orderKeys, reportKeys] = await Promise.all([
      legacyGet('settings',null),
      legacyKeys('orders:'),
      legacyKeys('dayreport:')
    ]);
    if(!legacySettings && !orderKeys.length && !reportKeys.length) return;
    if(!await askLegacyImport()) return;

    const button = document.getElementById('btnImportLegacy');
    button.disabled = true;
    try{
      if(legacySettings){
        const {error} = await client.from('user_settings').upsert(settingsToRow(legacySettings));
        throwQueryError(error,'Không thể nhập cấu hình cũ.');
      }
      for(const key of orderKeys){
        const date = key.slice('orders:'.length);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const orders = await legacyGet(key,[]);
        if(!Array.isArray(orders) || !orders.length) continue;
        const rows = orders.map(order=>orderToRow(order,date));
        const {error} = await client.from('orders').upsert(rows,{onConflict:'user_id,id'});
        throwQueryError(error,'Không thể nhập đơn hàng cũ.');
      }
      for(const key of reportKeys){
        const report = await legacyGet(key,null);
        if(!report || !report.date) continue;
        const {error} = await client.from('daily_reports').upsert(reportToRow(report),{onConflict:'user_id,work_date'});
        throwQueryError(error,'Không thể nhập báo cáo cũ.');
      }
      await legacySet('legacy:migratedTo',state.user.id);
      invalidateHistory();
      showToast('Đã nhập dữ liệu cũ vào tài khoản.');
    }catch(error){
      console.error(error);
      showToast(error.message || 'Nhập dữ liệu chưa hoàn tất. Bạn có thể thử lại.');
      throw error;
    }finally{
      button.disabled = false;
    }
  }

  // ---------- SALESPERSON PROFILE / AVATAR ----------
  async function refreshAvatarUrl(){
    state.avatarUrl='';
    const path=state.settings && state.settings.avatarPath;
    if(!path || !client || !state.user) return;
    const {data,error}=await client.storage.from(AVATAR_BUCKET).createSignedUrl(path,60*60);
    if(error){
      console.error('Avatar signed URL failed',error);
      return;
    }
    state.avatarUrl=data && data.signedUrl
      ? data.signedUrl+(data.signedUrl.includes('?')?'&':'?')+'v='+Date.now()
      : '';
  }
  function setAvatarBusy(busy){
    state.avatarBusy=busy;
    const input=document.getElementById('avatarInput');
    const camera=document.getElementById('btnAvatarCamera');
    const remove=document.getElementById('btnRemoveAvatar');
    const change=document.querySelector('.btn-avatar-change');
    const status=document.getElementById('avatarStatus');
    input.disabled=busy;
    camera.disabled=busy;
    remove.disabled=busy || !(state.settings && state.settings.avatarPath);
    change.classList.toggle('is-disabled',busy);
    status.hidden=!busy;
    status.classList.remove('error');
  }
  function decodeAvatarSource(file){
    if(window.createImageBitmap){
      const wrapBitmap=bitmap=>({
        source:bitmap,
        width:bitmap.width,
        height:bitmap.height,
        cleanup:()=>bitmap.close()
      });
      return createImageBitmap(file,{imageOrientation:'from-image'})
        .catch(()=>createImageBitmap(file))
        .then(wrapBitmap)
        .catch(()=>decodeAvatarWithImage(file));
    }
    return decodeAvatarWithImage(file);
  }
  function decodeAvatarWithImage(file){
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file);
      const image=new Image();
      image.onload=()=>resolve({
        source:image,
        width:image.naturalWidth,
        height:image.naturalHeight,
        cleanup:()=>URL.revokeObjectURL(url)
      });
      image.onerror=()=>{
        URL.revokeObjectURL(url);
        reject(new Error('Không thể đọc ảnh đã chọn.'));
      };
      image.src=url;
    });
  }
  async function cropAvatarFile(file){
    if(!AVATAR_TYPES.has(file.type)) throw new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
    if(file.size>AVATAR_MAX_SOURCE_BYTES) throw new Error('Ảnh đại diện không được vượt quá 10MB.');
    const decoded=await decodeAvatarSource(file);
    try{
      if(!decoded.width || !decoded.height) throw new Error('Kích thước ảnh không hợp lệ.');
      const crop=Math.min(decoded.width,decoded.height);
      const sx=(decoded.width-crop)/2;
      const sy=(decoded.height-crop)/2;
      const target=Math.min(AVATAR_SIZE,crop);
      const canvas=document.createElement('canvas');
      canvas.width=target;
      canvas.height=target;
      const context=canvas.getContext('2d',{alpha:false});
      if(!context) throw new Error('Trình duyệt không thể xử lý ảnh.');
      context.imageSmoothingEnabled=true;
      context.imageSmoothingQuality='high';
      context.drawImage(decoded.source,sx,sy,crop,crop,0,0,target,target);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',AVATAR_QUALITY));
      if(!blob || blob.type!=='image/webp') throw new Error('Trình duyệt không hỗ trợ nén ảnh WebP.');
      if(blob.size>2*1024*1024) throw new Error('Ảnh sau xử lý vẫn vượt quá 2MB.');
      return blob;
    }finally{
      decoded.cleanup();
    }
  }
  async function updateAvatarPath(path){
    const {data,error}=await client.from('user_settings')
      .upsert(settingsToRow(Object.assign({},state.settings,{avatarPath:path})))
      .select('avatar_path')
      .maybeSingle();
    throwQueryError(error,'Không thể lưu ảnh đại diện.');
    if(!data) throw new Error('Không thể xác nhận ảnh đại diện đã lưu.');
  }
  async function uploadAvatar(file){
    if(!requireOnline() || !file || state.avatarBusy) return;
    setAvatarBusy(true);
    const previousPath=state.settings.avatarPath;
    const path=state.user.id+'/avatar.webp';
    try{
      const blob=await cropAvatarFile(file);
      const {error:uploadError}=await client.storage.from(AVATAR_BUCKET).upload(path,blob,{
        contentType:'image/webp',
        cacheControl:'3600',
        upsert:true
      });
      throwQueryError(uploadError,'Không thể tải ảnh đại diện lên.');
      try{
        await updateAvatarPath(path);
      }catch(error){
        if(!previousPath) await client.storage.from(AVATAR_BUCKET).remove([path]);
        throw error;
      }
      state.settings.avatarPath=path;
      await refreshAvatarUrl();
      renderProfile();
      showToast('Đã cập nhật ảnh đại diện');
    }catch(error){
      console.error(error);
      showToast(error.message || 'Không thể cập nhật ảnh đại diện.');
    }finally{
      document.getElementById('avatarInput').value='';
      setAvatarBusy(false);
    }
  }
  async function removeAvatar(){
    if(!requireOnline() || state.avatarBusy || !state.settings.avatarPath) return;
    if(!confirm('Xóa ảnh đại diện hiện tại?')) return;
    setAvatarBusy(true);
    const path=state.settings.avatarPath;
    try{
      const {error:removeError}=await client.storage.from(AVATAR_BUCKET).remove([path]);
      throwQueryError(removeError,'Không thể xóa ảnh đại diện.');
      await updateAvatarPath(null);
      state.settings.avatarPath=null;
      state.avatarUrl='';
      renderProfile();
      showToast('Đã xóa ảnh đại diện');
    }catch(error){
      console.error(error);
      try{
        await loadSettings();
        renderProfile();
      }catch(refreshError){
        console.error(refreshError);
      }
      showToast(error.message || 'Không thể xóa ảnh đại diện.');
    }finally{
      setAvatarBusy(false);
    }
  }
  function setAccountMenu(open){
    const trigger=document.getElementById('btnAccountMenu');
    const menu=document.getElementById('accountMenu');
    trigger.setAttribute('aria-expanded',String(open));
    menu.hidden=!open;
  }
  function toggleAccountMenu(){
    setAccountMenu(document.getElementById('btnAccountMenu').getAttribute('aria-expanded')!=='true');
  }

  // ---------- DATABASE LOAD / SAVE ----------
  function rowToSettings(row){
    if(!row) return Object.assign({},DEFAULT_SETTINGS,{prices:{}});
    return {
      npp:row.npp || DEFAULT_SETTINGS.npp,
      nvbh:row.nvbh || DEFAULT_SETTINGS.nvbh,
      avatarPath:row.avatar_path || null,
      targetDaily:Number(row.target_daily)||0,
      targetMonthly:Number(row.target_monthly)||0,
      targetASO:Number(row.target_aso)||0,
      targetGiaVi:Number(row.target_gia_vi)||0,
      workDays:Number(row.work_days)||0,
      prices:row.prices || {}
    };
  }
  function rowToOrder(row,index){
    return {
      id:row.id,
      stt:index+1,
      workDate:row.work_date,
      kh:row.customer_name,
      diaChi:row.address || '',
      district:row.district || '',
      sdt:row.phone || '',
      isNew:Boolean(row.is_new),
      ghiChu:row.note || '',
      items:row.items || {},
      location:row.latitude!==null && row.longitude!==null ? {
        latitude:Number(row.latitude),
        longitude:Number(row.longitude),
        accuracy:row.location_accuracy===null ? null : Number(row.location_accuracy),
        capturedAt:row.location_captured_at
      } : null,
      createdAt:row.created_at
    };
  }
  function rowToReport(row){
    return {
      date:row.work_date,
      revenue:Number(row.revenue)||0,
      giaVi:Number(row.gia_vi)||0,
      orderCount:Number(row.order_count)||0,
      newCustomers:row.new_customers || [],
      dat:Boolean(row.achieved),
      finalizedAt:row.finalized_at
    };
  }
  function rowToReportOpening(row){
    if(!row) return null;
    return {
      monthStart:row.month_start,
      periodStart:row.period_start,
      periodEnd:row.period_end,
      revenue:Number(row.revenue)||0,
      giaVi:Number(row.gia_vi)||0,
      asoCount:Number(row.aso_count)||0,
      sourceOrderCount:Number(row.source_order_count)||0,
      sourceDayASO:Number(row.source_day_aso)||0
    };
  }
  async function loadSettings(){
    const {data,error} = await client.from('user_settings')
      .select('*').eq('user_id',state.user.id).maybeSingle();
    throwQueryError(error,'Không thể tải cấu hình.');
    state.settings = rowToSettings(data);
    await refreshAvatarUrl();
  }
  async function loadOrdersForDate(date){
    const {data,error} = await client.from('orders')
      .select('*').eq('user_id',state.user.id).eq('work_date',date)
      .order('created_at',{ascending:true});
    throwQueryError(error,'Không thể tải đơn hàng.');
    state.orders = (data||[]).map(rowToOrder);
  }

  // ---------- CALCUL ----------
  function orderRevenue(o){
    let s=0;
    Object.keys(o.items||{}).forEach(pid=>{
      const it = o.items[pid];
      s += itemSoldQty(it) * priceOf(pid);
    });
    return s;
  }
  function orderGiaVi(o){
    let s=0;
    Object.keys(o.items||{}).forEach(pid=>{
      const p = PRODUCTS.find(p=>p.id===pid);
      if(p && p.cat==='gia_vi'){
        const it = o.items[pid];
        s += itemSoldQty(it) * priceOf(pid);
      }
    });
    return s;
  }

  // ---------- RENDER: PRODUCT ROWS (order form) ----------
  function renderProductRows(){
    const miWrap = document.getElementById('prodGroupMi');
    const gvWrap = document.getElementById('prodGroupGiaVi');
    miWrap.innerHTML = '';
    gvWrap.innerHTML = '';
    PRODUCTS.forEach(p=>{
      const row = document.createElement('div');
      row.className = 'prod-row';
      row.innerHTML =
        '<div class="pname">'+p.name+'<span class="pprice">'+fmtVND(priceOf(p.id))+'đ/gói · '+p.caseSize+' gói/thùng</span></div>'+
        '<input type="number" min="0" inputmode="numeric" id="thung_'+p.id+'" placeholder="0">'+
        '<input type="number" min="0" inputmode="numeric" id="le_'+p.id+'" placeholder="0">'+
        '<input type="number" min="0" inputmode="numeric" id="tang_'+p.id+'" placeholder="0">';
      (p.cat==='mi'?miWrap:gvWrap).appendChild(row);
    });
  }
  function renderFilterOptions(){
    const districtOptions=DISTRICTS.map(d=>'<option value="'+esc(d)+'">'+esc(d)+'</option>').join('');
    document.getElementById('f_district').insertAdjacentHTML('beforeend',districtOptions);
    document.getElementById('historyDistrict').insertAdjacentHTML('beforeend',districtOptions);
    document.getElementById('historyProduct').insertAdjacentHTML(
      'beforeend',
      PRODUCTS.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('')
    );
  }

  function copyLocation(location){
    if(!location) return null;
    return {
      latitude:Number(location.latitude),
      longitude:Number(location.longitude),
      accuracy:location.accuracy===null || location.accuracy===undefined ? null : Number(location.accuracy),
      capturedAt:location.capturedAt || null
    };
  }
  function captureOrderFormDraft(){
    const quantities={};
    PRODUCTS.forEach(product=>{
      quantities[product.id]={
        thung:document.getElementById('thung_'+product.id)?.value || '',
        le:document.getElementById('le_'+product.id)?.value || '',
        tang:document.getElementById('tang_'+product.id)?.value || ''
      };
    });
    return {
      kh:document.getElementById('f_kh').value,
      diaChi:document.getElementById('f_diachi').value,
      district:document.getElementById('f_district').value,
      sdt:document.getElementById('f_sdt').value,
      isNew:document.getElementById('f_isnew').checked,
      ghiChu:document.getElementById('f_ghichu').value,
      quantities,
      location:copyLocation(state.pendingLocation)
    };
  }
  function applyOrderFormDraft(draft){
    const value=draft || {};
    document.getElementById('f_kh').value=value.kh || '';
    document.getElementById('f_diachi').value=value.diaChi || '';
    document.getElementById('f_district').value=value.district || '';
    document.getElementById('f_sdt').value=value.sdt || '';
    document.getElementById('f_isnew').checked=Boolean(value.isNew);
    document.getElementById('f_ghichu').value=value.ghiChu || '';
    state.pendingLocation=copyLocation(value.location);
    setLocationStatus(
      state.pendingLocation ? 'success' : '',
      state.pendingLocation ? 'Đang dùng vị trí đã lưu.' : '',
      state.pendingLocation
    );
    PRODUCTS.forEach(product=>{
      const quantities=value.quantities && value.quantities[product.id] || {};
      const cases=document.getElementById('thung_'+product.id);
      const loose=document.getElementById('le_'+product.id);
      const gifted=document.getElementById('tang_'+product.id);
      if(cases) cases.value=quantities.thung ?? '';
      if(loose) loose.value=quantities.le ?? '';
      if(gifted) gifted.value=quantities.tang ?? '';
    });
  }
  function orderToFormDraft(order){
    const quantities={};
    PRODUCTS.forEach(product=>{
      const item=order.items && order.items[product.id] || {};
      const sold=itemSoldQty(item);
      const hasBreakdown=item.thung!==undefined || item.le!==undefined;
      quantities[product.id]={
        thung:hasBreakdown ? Number(item.thung||0) : Math.floor(sold/caseSizeOf(product.id)),
        le:hasBreakdown ? Number(item.le||0) : sold%caseSizeOf(product.id),
        tang:Number(item.tang||0)
      };
    });
    return {
      kh:order.kh,
      diaChi:order.diaChi,
      district:order.district,
      sdt:order.sdt,
      isNew:order.isNew,
      ghiChu:order.ghiChu,
      quantities,
      location:copyLocation(order.location)
    };
  }
  function syncOrderFormMode(){
    const editing=Boolean(state.editingOrderId);
    const order=editing ? state.orders.find(item=>item.id===state.editingOrderId) : null;
    document.getElementById('tab-order').classList.toggle('is-editing',editing);
    document.getElementById('orderFormTitle').textContent=editing
      ? 'Sửa đơn'+(order ? ' #'+order.stt : '')
      : 'Nhập đơn';
    document.querySelector('#btnAddOrder [data-button-label]').textContent=editing ? 'Lưu thay đổi' : 'Thêm đơn';
    document.getElementById('btnAddOrderIcon').hidden=editing;
    document.getElementById('btnEditOrderIcon').hidden=!editing;
    document.getElementById('btnCancelOrderEdit').hidden=!editing;
  }
  function resetOrderForm(){
    applyOrderFormDraft(null);
    syncOrderFormMode();
  }
  function readOrderForm(){
    const kh = document.getElementById('f_kh').value.trim();
    if(!kh){
      showToast('Vui lòng nhập tên khách hàng');
      document.getElementById('f_kh').focus();
      return null;
    }
    const district = document.getElementById('f_district').value;
    if(!DISTRICTS.includes(district)){
      showToast('Vui lòng chọn huyện');
      document.getElementById('f_district').focus();
      return null;
    }
    const items = {};
    PRODUCTS.forEach(p=>{
      const thung = Number(document.getElementById('thung_'+p.id).value)||0;
      const le = Number(document.getElementById('le_'+p.id).value)||0;
      const tang = Number(document.getElementById('tang_'+p.id).value)||0;
      const ban = thung * caseSizeOf(p.id) + le;
      if(ban>0 || tang>0) items[p.id] = {ban, tang};
      if(items[p.id]){
        items[p.id].thung = thung;
        items[p.id].le = le;
      }
    });
    return {
      kh,
      diaChi: document.getElementById('f_diachi').value.trim(),
      district,
      sdt: document.getElementById('f_sdt').value.trim(),
      isNew: document.getElementById('f_isnew').checked,
      ghiChu: document.getElementById('f_ghichu').value.trim(),
      items,
      location:copyLocation(state.pendingLocation)
    };
  }
  function scrollOrderFormIntoView(){
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(()=>{
      window.scrollTo({top:0,behavior:reduced ? 'auto' : 'smooth'});
    });
  }
  function beginEditOrder(id){
    const order=state.orders.find(item=>item.id===id);
    if(!order){
      showToast('Không tìm thấy đơn hàng cần sửa.');
      return;
    }
    if(state.editingOrderId===id){
      switchTab('order');
      scrollOrderFormIntoView();
      return;
    }
    if(state.editingOrderId && !confirm('Bỏ thay đổi đang sửa để chuyển sang đơn khác?')) return;
    if(!state.editingOrderId) state.orderDraftBeforeEdit=captureOrderFormDraft();
    state.editingOrderId=id;
    applyOrderFormDraft(orderToFormDraft(order));
    syncOrderFormMode();
    switchTab('order');
    scrollOrderFormIntoView();
  }
  function finishOrderEdit(switchToToday){
    const draft=state.orderDraftBeforeEdit;
    state.editingOrderId=null;
    state.orderDraftBeforeEdit=null;
    applyOrderFormDraft(draft);
    syncOrderFormMode();
    if(switchToToday!==false){
      switchTab('today');
      scrollOrderFormIntoView();
    }
  }
  function cancelOrderEdit(){
    if(!state.editingOrderId) return;
    finishOrderEdit(true);
    showToast('Đã hủy sửa đơn');
  }
  async function addOrder(){
    if(!requireOnline()) return;
    const values=readOrderForm();
    if(!values) return;
    const order = Object.assign({},values,{
      id: makeId(),
      stt: state.orders.length+1,
      workDate: state.date,
      createdAt: new Date().toISOString()
    });
    const button = document.getElementById('btnAddOrder');
    await runButtonAction(button,'Đang lưu…',async ()=>{
      const {error} = await client.from('orders').insert(orderToRow(order,state.date));
      if(error){ showToast(dbError(error,'Không thể lưu đơn hàng.').message); return; }
      state.orders.push(order);
      invalidateHistory();
      resetOrderForm();
      renderToday();
      switchTab('today');
      showToast('Đã thêm đơn #'+order.stt);
    });
  }
  async function updateOrder(){
    if(!requireOnline()) return;
    const index=state.orders.findIndex(item=>item.id===state.editingOrderId);
    if(index<0){
      showToast('Đơn hàng không còn tồn tại.');
      finishOrderEdit(true);
      return;
    }
    const values=readOrderForm();
    if(!values) return;
    const current=state.orders[index];
    const updated=Object.assign({},current,values,{
      id:current.id,
      stt:current.stt,
      workDate:current.workDate,
      createdAt:current.createdAt
    });
    const row=orderToRow(updated,current.workDate || state.date);
    delete row.user_id;
    delete row.id;
    delete row.work_date;
    delete row.created_at;
    const button=document.getElementById('btnAddOrder');
    await runButtonAction(button,'Đang cập nhật…',async ()=>{
      const {data,error}=await client.from('orders').update(row)
        .eq('user_id',state.user.id).eq('id',current.id)
        .select('id').maybeSingle();
      if(error){
        showToast(dbError(error,'Không thể cập nhật đơn hàng.').message);
        return;
      }
      if(!data){
        showToast('Không tìm thấy đơn hàng để cập nhật.');
        return;
      }
      state.orders[index]=updated;
      invalidateHistory();
      const orderNumber=updated.stt;
      finishOrderEdit(true);
      showToast('Đã cập nhật đơn #'+orderNumber);
    });
  }
  function submitOrderForm(){
    return state.editingOrderId ? updateOrder() : addOrder();
  }

  async function deleteOrder(id){
    if(!requireOnline()) return;
    if(state.deletingIds && state.deletingIds.has(id)) return;
    if(!confirm('Xóa đơn hàng này?')) return;
    if(!state.deletingIds) state.deletingIds=new Set();
    state.deletingIds.add(id);
    try{
      const {error} = await client.from('orders').delete()
        .eq('user_id',state.user.id).eq('id',id);
      if(error){ showToast(dbError(error,'Không thể xóa đơn hàng.').message); return; }
      state.orders = state.orders.filter(o=>o.id!==id);
      state.orders.forEach((o,idx)=>o.stt=idx+1);
      if(state.editingOrderId===id) finishOrderEdit(false);
      invalidateHistory();
      renderToday();
    }finally{
      state.deletingIds.delete(id);
    }
  }

  // ---------- RENDER: TODAY TAB ----------
  function closeOrderMenus(exceptMenu){
    document.querySelectorAll('.order-menu').forEach(menu=>{
      if(menu!==exceptMenu && menu.open) menu.open=false;
      const summary=menu.querySelector('summary');
      if(summary) summary.setAttribute('aria-expanded',String(menu.open));
    });
  }
  function renderToday(){
    const list = document.getElementById('todayList');
    const revenue = state.orders.reduce((s,o)=>s+orderRevenue(o),0);
    const giaVi = state.orders.reduce((s,o)=>s+orderGiaVi(o),0);
    document.getElementById('sumOrderCount').textContent = state.orders.length;
    document.getElementById('sumRevenue').textContent = fmtVND(revenue);
    document.getElementById('sumGiaVi').textContent = fmtVND(giaVi);

    if(state.orders.length===0){
      list.innerHTML = '<div class="empty">Chưa có đơn hàng nào cho ngày '+fmtDateVN(state.date)+'.<br>Vào tab "Nhập đơn" để thêm đơn.</div>';
      return;
    }
    list.innerHTML = state.orders.map(o=>{
      const itemRows = Object.keys(o.items||{}).map(pid=>{
        const p = PRODUCTS.find(p=>p.id===pid);
        const it = o.items[pid];
        const thung=Number(it.thung||0);
        const le=Number(it.le ?? it.qty ?? 0);
        const tang=Number(it.tang||0);
        return '<div class="order-item-row"><span class="item-name">'+esc(p ? p.name : pid)+'</span>'+
          '<span><b>'+thung+'</b></span><span><b>'+le+'</b></span><span><b>'+tang+'</b></span></div>';
      }).join('');
      return '<div class="order-card">'+
        '<div class="order-card-main">'+
          '<div class="row1">'+
            '<div class="order-identity"><span class="order-index">'+o.stt+'</span><div><div class="kh">'+esc(o.kh)+'</div>'+
            '<div class="meta">'+orderMetadata(o)+'</div></div></div>'+
            (o.isNew?'<span class="badge-new">Khách mới</span>':'')+
            '<details class="order-menu"><summary aria-label="Thao tác khác cho đơn '+o.stt+'" aria-haspopup="menu" aria-expanded="false"><svg class="ui-icon" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg></summary>'+
              '<div class="order-menu-popover" role="menu">'+
                '<button role="menuitem" data-order-action="edit" data-order-id="'+esc(o.id)+'">Sửa đơn</button>'+
                '<button role="menuitem" data-order-action="delete" data-order-id="'+esc(o.id)+'">Xóa đơn</button>'+
              '</div></details>'+
          '</div>'+
          '<div class="items">'+
            (itemRows?'<div class="order-item-head"><span>Sản phẩm</span><span>Thùng</span><span>Lẻ</span><span>Tặng</span></div>'+itemRows:'<i>Không có sản phẩm</i>')+
          '</div>'+
          (o.ghiChu?'<div class="meta" style="margin-top:7px;">Ghi chú: '+esc(o.ghiChu)+'</div>':'')+
          (o.location?'<div class="meta" style="margin-top:7px;"><a class="map-link" href="'+buildMapUrl(o.location)+'" target="_blank" rel="noopener noreferrer">Mở trên bản đồ</a></div>':'')+
          '<div class="revenue"><span>Doanh số</span><strong>'+fmtVND(orderRevenue(o))+' đ</strong></div>'+
        '</div>'+
        '<div class="order-actions">'+
          '<button class="btn-mini btn-mini-outline" data-order-action="copy" data-order-id="'+esc(o.id)+'">Sao chép mẫu</button>'+
          '<button class="btn-mini btn-mini-solid" data-order-action="share" data-order-id="'+esc(o.id)+'">Gửi Zalo</button>'+
        '</div>'+
      '</div>';
    }).join('');
  }

  // ---------- LOCATION ----------
  function setLocationStatus(mode,message,location){
    const button = document.getElementById('btnLocation');
    const result = document.getElementById('locationResult');
    button.classList.remove('loading','success','error');
    if(mode) button.classList.add(mode);
    button.disabled = mode==='loading';
    button.setAttribute('aria-label',
      mode==='loading' ? 'Đang lấy vị trí' :
      mode==='success' ? 'Đã lấy vị trí, bấm để cập nhật' :
      mode==='error' ? 'Lấy vị trí thất bại, bấm để thử lại' : 'Lấy vị trí hiện tại'
    );
    result.textContent='';
    if(message){
      const span=document.createElement('span');
      span.textContent=message;
      result.appendChild(span);
    }
    if(location){
      const link=document.createElement('a');
      link.href=buildMapUrl(location);
      link.target='_blank';
      link.rel='noopener noreferrer';
      link.textContent='Mở bản đồ';
      result.appendChild(link);
    }
  }
  function getBrowserPosition(){
    return new Promise((resolve,reject)=>{
      navigator.geolocation.getCurrentPosition(resolve,reject,{
        enableHighAccuracy:true,
        timeout:12000,
        maximumAge:0
      });
    });
  }
  function geolocationErrorMessage(error){
    if(error && error.code===1) return 'Bạn đã từ chối quyền vị trí.';
    if(error && error.code===2) return 'Thiết bị chưa xác định được vị trí.';
    if(error && error.code===3) return 'Hết thời gian chờ GPS.';
    return 'Không thể lấy vị trí hiện tại.';
  }
  async function captureLocation(){
    if(!requireOnline()) return;
    if(!navigator.geolocation){
      setLocationStatus('error','Trình duyệt không hỗ trợ định vị.');
      return;
    }
    const addButton=document.getElementById('btnAddOrder');
    const previousLocation=copyLocation(state.pendingLocation);
    addButton.disabled=true;
    setLocationStatus('loading','Đang xác định vị trí…');
    try{
      const position = await getBrowserPosition();
      const locationData = {
        latitude:position.coords.latitude,
        longitude:position.coords.longitude,
        accuracy:position.coords.accuracy,
        capturedAt:new Date(position.timestamp || Date.now()).toISOString()
      };
      state.pendingLocation=locationData;
      setLocationStatus('loading','Đang tìm địa chỉ…',locationData);
      const {data,error} = await client.functions.invoke('reverse-geocode',{
        body:{latitude:locationData.latitude,longitude:locationData.longitude}
      });
      if(error || !data || !data.address){
        setLocationStatus('error',
          data && data.error==='ADDRESS_NOT_FOUND'
            ? 'Không tìm thấy địa chỉ; tọa độ vẫn được lưu.'
            : 'Toạ độ đã được lưu.',
          locationData
        );
        return;
      }
      document.getElementById('f_diachi').value=data.address;
      if(data.district && DISTRICTS.includes(data.district)){
        document.getElementById('f_district').value=data.district;
      }
      setLocationStatus('success','Đã điền địa chỉ từ GPS.',locationData);
    }catch(error){
      console.error(error);
      state.pendingLocation=previousLocation;
      setLocationStatus('error',geolocationErrorMessage(error),previousLocation);
    }finally{
      addButton.disabled=false;
      syncOnlineState();
    }
  }

  // ---------- COPY / SHARE (dùng chung) ----------
  async function copyText(text, label){
    try{
      await navigator.clipboard.writeText(text);
      showToast(label || 'Đã sao chép');
    }catch(e){
      try{
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        showToast(label || 'Đã sao chép');
      }catch(e2){ showToast('Không thể sao chép, vui lòng chọn thủ công'); }
    }
  }
  async function shareText(title, text){
    if(navigator.share){
      try{ await navigator.share({title, text}); }
      catch(e){ /* người dùng hủy chia sẻ */ }
    } else {
      showToast('Thiết bị không hỗ trợ chia sẻ, hãy dùng nút Sao chép');
    }
  }

  // ---------- MẪU TIN NHẮN ZALO CHO TỪNG ĐƠN ----------
  function itemLine(it){
    return formatItemQuantity(it);
  }
  function buildOrderMessage(o){
    const lines = [];
    lines.push('Đơn '+o.stt);
    if(o.ghiChu) lines.push('Ghi chú: '+o.ghiChu);
    lines.push('KH: '+o.kh);
    lines.push('Địa chỉ: '+(o.diaChi||''));
    lines.push('Huyện: '+(o.district||'Chưa xác định'));
    lines.push('SĐT: '+(o.sdt||''));
    PRODUCTS.forEach(p=>{
      lines.push('+ '+p.shortLabel+': '+itemLine(o.items[p.id]));
    });
    if(o.location) lines.push('Vị trí: '+buildMapUrl(o.location));
    return lines.join('\n');
  }
  function buildOrderMessageHtml(o){
    const lines = [];
    lines.push(esc('Đơn '+o.stt));
    if(o.ghiChu){
      lines.push('<strong style="color:#B3432B;">Ghi chú: '+esc(o.ghiChu)+'</strong>');
    }
    lines.push(esc('KH: '+o.kh));
    lines.push(esc('Địa chỉ: '+(o.diaChi||'')));
    lines.push(esc('Huyện: '+(o.district||'Chưa xác định')));
    lines.push(esc('SĐT: '+(o.sdt||'')));
    PRODUCTS.forEach(p=>{
      lines.push(esc('+ '+p.shortLabel+': '+itemLine(o.items[p.id])));
    });
    if(o.location){
      lines.push(esc('Vị trí: '+buildMapUrl(o.location)));
    }
    return lines.join('<br>');
  }
  async function copyRichText(plainText, htmlText, label){
    if(navigator.clipboard && window.ClipboardItem){
      try{
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([htmlText], {type:'text/html'}),
            'text/plain': new Blob([plainText], {type:'text/plain'})
          })
        ]);
        showToast(label || 'Đã sao chép');
        return true;
      }catch(error){
        console.warn('Rich clipboard copy failed; falling back to plain text.', error);
      }
    }
    return false;
  }
  async function shareOrderToZalo(order){
    const text = buildOrderMessage(order);
    const title = 'Đơn hàng '+(order.stt || '')+' - '+order.kh;
    if(navigator.share){
      try{
        await navigator.share({title, text});
        return;
      }catch(error){
        console.warn('Share sheet unavailable or canceled; copying order instead.', error);
      }
    }
    await copyText(text, order.location
      ? 'Không mở được Zalo, đã sao chép đơn kèm vị trí'
      : 'Không mở được Zalo, đã sao chép đơn'
    );
  }
  function copyOrderMessage(id){
    const o = state.orders.find(x=>x.id===id);
    if(!o) return;
    const plainText = buildOrderMessage(o);
    const htmlText = buildOrderMessageHtml(o);
    copyRichText(plainText, htmlText, 'Đã sao chép mẫu đơn '+o.stt)
      .then(copied=>{
        if(!copied) copyText(plainText, 'Đã sao chép mẫu đơn '+o.stt);
      });
  }
  function shareOrderMessage(id){
    const o = state.orders.find(x=>x.id===id);
    if(o) shareOrderToZalo(o);
  }

  // ---------- ORDER HISTORY ----------
  let historyRequestSerial=0;
  let historyCustomerTimer=null;
  function isHistoryTabActive(){
    return document.getElementById('tab-history').classList.contains('active');
  }
  function invalidateHistory(){
    state.history.dirty=true;
    historyRequestSerial++;
  }
  function historyDates(){
    const filters=state.history.filters;
    if(filters.mode==='single'){
      return {from:filters.singleDate,to:filters.singleDate};
    }
    return {from:filters.dateFrom,to:filters.dateTo};
  }
  function syncHistoryControls(){
    const filters=state.history.filters;
    document.querySelectorAll('[data-history-mode]').forEach(button=>{
      const active=button.dataset.historyMode===filters.mode;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    document.getElementById('historySingleDateWrap').hidden=filters.mode!=='single';
    document.getElementById('historyDateRangeWrap').hidden=filters.mode!=='range';
    document.getElementById('historySingleDate').value=filters.singleDate;
    document.getElementById('historyDateFrom').value=filters.dateFrom;
    document.getElementById('historyDateTo').value=filters.dateTo;
    document.getElementById('historySingleDateDisplay').textContent=fmtDateVN(filters.singleDate);
    document.getElementById('historyDateFromDisplay').textContent=fmtDateVN(filters.dateFrom);
    document.getElementById('historyDateToDisplay').textContent=fmtDateVN(filters.dateTo);
    document.getElementById('historyCustomer').value=filters.customer;
    document.getElementById('historyProduct').value=filters.productId;
    document.getElementById('historyDistrict').value=filters.district;
  }
  function initializeHistoryFilters(){
    const filters=state.history.filters;
    if(!filters.singleDate){
      filters.singleDate=state.date;
      filters.dateFrom=state.date;
      filters.dateTo=state.date;
    }
    syncHistoryControls();
  }
  function readHistoryFilters(){
    const filters=state.history.filters;
    filters.singleDate=document.getElementById('historySingleDate').value || state.date;
    filters.dateFrom=document.getElementById('historyDateFrom').value || state.date;
    filters.dateTo=document.getElementById('historyDateTo').value || state.date;
    filters.customer=document.getElementById('historyCustomer').value.trim();
    filters.productId=document.getElementById('historyProduct').value;
    filters.district=document.getElementById('historyDistrict').value;
  }
  function historyItemsHtml(order){
    return Object.keys(order.items||{}).map(pid=>{
      const product=PRODUCTS.find(p=>p.id===pid);
      const quantities=order.items[pid] || {};
      return esc(product ? product.name : pid)+': <b>'+esc(formatSoldQuantity(quantities))+'</b>'+
        (Number(quantities.tang||0)>0 ? ' (tặng '+Number(quantities.tang)+' gói)' : '');
    }).join('<br>');
  }
  function renderHistory(){
    const history=state.history;
    const results=document.getElementById('historyResults');
    const status=document.getElementById('historyStatus');
    const loadMore=document.getElementById('btnLoadMoreHistory');
    results.setAttribute('aria-busy',String(history.loading));
    loadMore.hidden=!history.hasMore || history.loading;
    loadMore.disabled=history.loading;

    if(history.loading && !history.rows.length){
      status.className='history-status';
      status.textContent='Đang tải lịch sử…';
      results.innerHTML='<div class="history-skeleton"></div><div class="history-skeleton"></div><div class="history-skeleton"></div>';
      return;
    }
    if(!history.rows.length){
      status.className='history-status';
      status.textContent=history.initialized ? '0 đơn phù hợp' : '';
      results.innerHTML=history.initialized
        ? '<div class="empty">Không tìm thấy đơn hàng phù hợp với bộ lọc.</div>'
        : '';
      return;
    }

    status.className='history-status';
    status.textContent=history.loading
      ? 'Đang tải dữ liệu mới…'
      : 'Đã tải '+history.rows.length+' đơn'+(history.hasMore?' · còn dữ liệu':'');
    let currentDate='';
    results.innerHTML=history.rows.map(order=>{
      const dateHeading=order.workDate!==currentDate
        ? (currentDate=order.workDate,'<div class="history-day">'+fmtDateVN(order.workDate)+'</div>')
        : '';
      const metadata=order.district
        ? orderMetadata(order)
        : ['Chưa xác định',order.diaChi,order.sdt].filter(Boolean).map(esc).join(' · ');
      return dateHeading+
        '<details class="history-order">'+
          '<summary><div class="history-order-head">'+
            '<div><div class="history-order-name">'+esc(order.kh)+'</div>'+
            '<div class="meta">'+metadata+'</div></div>'+
            '<div class="history-order-revenue">'+fmtVND(orderRevenue(order))+'đ</div>'+
          '</div></summary>'+
          '<div class="history-order-body">'+
            '<div class="items">'+(historyItemsHtml(order)||'<i>Không có sản phẩm</i>')+'</div>'+
            (order.ghiChu?'<div class="meta" style="margin-top:7px;">Ghi chú: '+esc(order.ghiChu)+'</div>':'')+
            (order.location?'<div class="meta" style="margin-top:7px;"><a class="map-link" href="'+buildMapUrl(order.location)+'" target="_blank" rel="noopener noreferrer">Mở trên bản đồ</a></div>':'')+
            '<div class="order-actions">'+
              '<button class="btn-mini btn-mini-outline" data-history-action="copy" data-order-id="'+esc(order.id)+'">Sao chép</button>'+
              '<button class="btn-mini btn-mini-solid" data-history-action="share" data-order-id="'+esc(order.id)+'">Gửi Zalo</button>'+
            '</div>'+
          '</div>'+
        '</details>';
    }).join('');
  }
  function renderHistoryError(message){
    const status=document.getElementById('historyStatus');
    status.className='history-status error';
    status.textContent=message;
    state.history.loading=false;
    document.getElementById('historyResults').setAttribute('aria-busy','false');
    document.getElementById('btnLoadMoreHistory').disabled=false;
    if(!state.history.rows.length){
      document.getElementById('historyResults').innerHTML=
        '<div class="empty">Không thể tải lịch sử.<br><button class="btn-mini btn-mini-outline" data-history-action="retry">Thử lại</button></div>';
    }
  }
  async function loadHistory(append){
    if(!requireOnline()) return;
    const dates=historyDates();
    if(!dates.from || !dates.to || dates.from>dates.to){
      renderHistoryError('Khoảng ngày không hợp lệ.');
      return;
    }
    const history=state.history;
    if(history.loading && append) return;
    const requestId=++historyRequestSerial;
    const userId=state.user.id;
    history.loading=true;
    if(!append) history.hasMore=false;
    renderHistory();

    const cursor=append ? history.cursor : null;
    const {data,error}=await client.rpc('search_order_history',{
      p_date_from:dates.from,
      p_date_to:dates.to,
      p_customer:history.filters.customer || null,
      p_product_id:history.filters.productId || null,
      p_district:history.filters.district || null,
      p_cursor_work_date:cursor && cursor.workDate || null,
      p_cursor_created_at:cursor && cursor.createdAt || null,
      p_cursor_id:cursor && cursor.id || null,
      p_page_size:HISTORY_PAGE_SIZE
    });
    if(requestId!==historyRequestSerial || !state.user || state.user.id!==userId) return;
    if(error){
      console.error(error);
      renderHistoryError(dbError(error,'Không thể tải lịch sử đơn hàng.').message);
      return;
    }

    const page=(data||[]);
    const visible=page.slice(0,HISTORY_PAGE_SIZE).map((row,index)=>
      rowToOrder(row,(append ? history.rows.length : 0)+index)
    );
    history.rows=append
      ? history.rows.concat(visible.filter(order=>!history.rows.some(existing=>existing.id===order.id)))
      : visible;
    history.hasMore=page.length>HISTORY_PAGE_SIZE;
    const last=visible[visible.length-1];
    history.cursor=last ? {workDate:last.workDate,createdAt:last.createdAt,id:last.id} : history.cursor;
    history.initialized=true;
    history.dirty=false;
    history.loading=false;
    renderHistory();
  }
  function reloadHistory(){
    readHistoryFilters();
    syncHistoryControls();
    state.history.cursor=null;
    state.history.dirty=true;
    loadHistory(false).catch(error=>renderHistoryError(error.message));
  }
  function scheduleHistoryReload(){
    clearTimeout(historyCustomerTimer);
    historyCustomerTimer=setTimeout(reloadHistory,350);
  }
  function resetHistoryFilters(){
    state.history.filters={
      mode:'single',
      singleDate:state.date,
      dateFrom:state.date,
      dateTo:state.date,
      customer:'',
      productId:'',
      district:''
    };
    syncHistoryControls();
    reloadHistory();
  }
  function copyHistoryOrder(id){
    const order=state.history.rows.find(item=>item.id===id);
    if(order) copyText(buildOrderMessage(order),'Đã sao chép đơn của '+order.kh);
  }
  function shareHistoryOrder(id){
    const order=state.history.rows.find(item=>item.id===id);
    if(order) shareOrderToZalo(order);
  }

  // ---------- FINALIZE / REPORT ----------
  async function finalizeDay(){
    if(!requireOnline()) return;
    const revenue = state.orders.reduce((s,o)=>s+orderRevenue(o),0);
    const giaVi = state.orders.reduce((s,o)=>s+orderGiaVi(o),0);
    const newMap = new Map();
    state.orders.forEach(o=>{
      if(o.isNew){
        const key = (o.sdt||o.kh||'').trim().toLowerCase();
        if(key && !newMap.has(key)) newMap.set(key, {name:o.kh, phone:o.sdt});
      }
    });
    const report = {
      date: state.date,
      revenue,
      giaVi,
      orderCount: state.orders.length,
      newCustomers: Array.from(newMap.values()),
      dat: revenue >= (state.settings.targetDaily||0),
      finalizedAt: new Date().toISOString()
    };
    const button=document.getElementById('btnFinalize');
    await runButtonAction(button,'Đang chốt…',async ()=>{
      const {error}=await client.from('daily_reports')
        .upsert(reportToRow(report),{onConflict:'user_id,work_date'});
      if(error){ showToast(dbError(error,'Không thể chốt báo cáo.').message); return; }
      showToast('Đã chốt ngày '+fmtDateVN(state.date));
      await renderReportTab();
    });
  }
  async function deleteFinalizedReport(){
    if(!requireOnline()) return;
    const date=state.date;
    const userId=state.user.id;
    const confirmed=confirm(
      'Xóa chốt báo cáo ngày '+fmtDateVN(date)+'?\n\n'+
      'Đơn hàng của ngày này sẽ không bị xóa và bạn có thể chốt lại sau.'
    );
    if(!confirmed) return;

    const button=document.getElementById('btnDeleteReport');
    await runButtonAction(button,'Đang xóa…',async ()=>{
      const {data,error}=await client.from('daily_reports')
        .delete()
        .eq('user_id',userId)
        .eq('work_date',date)
        .select('work_date');
      if(error){
        showToast(dbError(error,'Không thể xóa chốt báo cáo.').message);
        return;
      }
      await renderReportTab();
      showToast(
        data && data.length
          ? 'Đã xóa chốt ngày '+fmtDateVN(date)
          : 'Báo cáo ngày '+fmtDateVN(date)+' không còn tồn tại.'
      );
    });
  }

  async function getMonthReports(mKey,throughDate){
    const [year,month]=mKey.split('-').map(Number);
    const nextMonth = month===12 ? (year+1)+'-01-01' : year+'-'+pad(month+1)+'-01';
    let query=client.from('daily_reports').select('*')
      .eq('user_id',state.user.id)
      .gte('work_date',mKey+'-01').lt('work_date',nextMonth)
      .order('work_date',{ascending:true});
    if(throughDate) query=query.lte('work_date',throughDate);
    const {data,error}=await query;
    throwQueryError(error,'Không thể tải lịch sử báo cáo.');
    return (data||[]).map(rowToReport);
  }
  async function getMonthReportOpening(mKey){
    const {data,error}=await client.from('monthly_report_openings').select('*')
      .eq('user_id',state.user.id)
      .eq('month_start',mKey+'-01')
      .maybeSingle();
    throwQueryError(error,'Không thể tải số dư báo cáo.');
    return rowToReportOpening(data);
  }

  async function renderReportTab(){
    if(!state.user || !navigator.onLine) return;
    const currentRevenue=state.orders.reduce((sum,order)=>sum+orderRevenue(order),0);
    const currentGiaVi=state.orders.reduce((sum,order)=>sum+orderGiaVi(order),0);
    document.getElementById('reportOrderCount').textContent=state.orders.length;
    document.getElementById('reportRevenue').textContent=fmtVND(currentRevenue)+' đ';
    document.getElementById('reportGiaVi').textContent=fmtVND(currentGiaVi)+' đ';
    document.getElementById('reportAverage').textContent=fmtVND(state.orders.length?currentRevenue/state.orders.length:0)+' đ';
    const mKey = monthKey(state.date);
    const [reports,opening] = await Promise.all([
      getMonthReports(mKey,state.date),
      getMonthReportOpening(mKey)
    ]);
    const todayReport = reports.find(r=>r.date===state.date);

    // Lịch sử
    const historyCard = document.getElementById('historyCard');
    const historyBody = document.getElementById('historyBody');
    if(reports.length){
      historyCard.style.display='';
      historyBody.innerHTML = reports.map(r=>
        '<tr><td>'+fmtDateVN(r.date)+'</td>'+
        '<td class="num">'+fmtVND(r.revenue)+'</td>'+
        '<td class="num">'+r.orderCount+'</td>'+
        '<td><span class="ok-dot '+(r.dat?'yes':'no')+'"></span></td></tr>'
      ).join('');
    } else {
      historyCard.style.display='none';
    }

    const reportCard = document.getElementById('reportCard');
    if(!todayReport){
      reportCard.style.display='none';
      return;
    }
    reportCard.style.display='';

    const openingApplies=Boolean(opening && state.date>opening.periodEnd);
    let cdRevenue=openingApplies ? opening.revenue : 0;
    let cdGiaVi=openingApplies ? opening.giaVi : 0;
    const phoneSet = new Set();
    reports.forEach(r=>{
      cdRevenue += r.revenue;
      cdGiaVi += r.giaVi;
      (r.newCustomers||[]).forEach(c=>{
        const key = (c.phone||c.name||'').trim().toLowerCase();
        if(key) phoneSet.add(key);
      });
    });
    const monthASO=(openingApplies ? opening.asoCount : 0)+phoneSet.size;
    const s = state.settings;

    const pctNgay   = safeDiv(todayReport.revenue, s.targetDaily);
    const pctThang  = safeDiv(cdRevenue, s.targetMonthly);
    const pctASO    = safeDiv(monthASO, s.targetASO);
    const pctGiaVi  = safeDiv(cdGiaVi, s.targetGiaVi);

    const text =
`Báo cáo ngày : ${fmtDateVN(state.date)}
- Npp: ${s.npp}
- NVBH: ${s.nvbh}
- Tiến độ thời gian:
1. Doanh số thực hiện (ĐVT: đ)
- TH/CT ngày: ${fmtVND(todayReport.revenue)}/${fmtVND(s.targetDaily)}/${pctNgay.toFixed(1)}%
- CD/CT tháng: ${fmtVND(cdRevenue)}/${fmtVND(s.targetMonthly)}/${pctThang.toFixed(0)}%
2. Đơn hàng thành công: ${todayReport.orderCount}đh
3. KPI
- KPI 1 - ASO : ${todayReport.newCustomers.length}/${monthASO}/${s.targetASO}/${pctASO.toFixed(0)}%
- KPI 2 - CT ngày: Số ngày đạt
- KPI 3 - Gia vị: ${fmtVND(todayReport.giaVi)}/${fmtVND(cdGiaVi)}/${fmtVND(s.targetGiaVi)}/${pctGiaVi.toFixed(1)}%`;

    document.getElementById('reportText').textContent = text;
  }

  document.getElementById('btnCopy').addEventListener('click', ()=>{
    copyText(document.getElementById('reportText').textContent, 'Đã sao chép báo cáo');
  });
  document.getElementById('btnShare').addEventListener('click', ()=>{
    shareText('Báo cáo ngày', document.getElementById('reportText').textContent);
  });
  document.getElementById('btnDeleteReport').addEventListener('click',deleteFinalizedReport);

  // ---------- SETTINGS TAB ----------
  function renderSettingsForm(){
    const s = state.settings;
    document.getElementById('s_npp').value = s.npp;
    document.getElementById('s_nvbh').value = s.nvbh;
    document.getElementById('s_targetDaily').value = s.targetDaily;
    document.getElementById('s_targetMonthly').value = s.targetMonthly;
    document.getElementById('s_targetASO').value = s.targetASO;
    document.getElementById('s_targetGiaVi').value = s.targetGiaVi;
    document.getElementById('s_workDays').value = s.workDays;

    const priceWrap = document.getElementById('priceEditList');
    priceWrap.innerHTML = PRODUCTS.map(p=>
      '<div class="field"><label>'+p.name+' (mặc định '+fmtVND(p.price)+'đ)</label>'+
      '<input type="number" inputmode="numeric" id="price_'+p.id+'" value="'+priceOf(p.id)+'"></div>'
    ).join('');

    document.getElementById('hdrNppNvbh').textContent = 'Npp: '+s.npp+' · NVBH: '+s.nvbh;
    document.getElementById('workContextCopy').innerHTML =
      '<strong>Npp:</strong> '+esc(s.npp)+'<br><strong>NVBH:</strong> '+esc(s.nvbh);
    renderProfile();
  }

  async function saveSettingsForm(){
    if(!requireOnline()) return;
    const s = Object.assign({},state.settings);
    s.npp = document.getElementById('s_npp').value.trim() || DEFAULT_SETTINGS.npp;
    s.nvbh = document.getElementById('s_nvbh').value.trim() || DEFAULT_SETTINGS.nvbh;
    s.targetDaily = Number(document.getElementById('s_targetDaily').value)||0;
    s.targetMonthly = Number(document.getElementById('s_targetMonthly').value)||0;
    s.targetASO = Number(document.getElementById('s_targetASO').value)||0;
    s.targetGiaVi = Number(document.getElementById('s_targetGiaVi').value)||0;
    s.workDays = Number(document.getElementById('s_workDays').value)||0;
    const prices = {};
    PRODUCTS.forEach(p=>{
      const v = document.getElementById('price_'+p.id).value;
      if(v!=='') prices[p.id]=Number(v);
    });
    s.prices = prices;
    const button=document.getElementById('btnSaveSettings');
    await runButtonAction(button,'Đang lưu…',async ()=>{
      const {error}=await client.from('user_settings').upsert(settingsToRow(s));
      if(error){ showToast(dbError(error,'Không thể lưu cấu hình.').message); return; }
      state.settings=s;
      renderProductRows();
      renderSettingsForm();
      showToast('Đã lưu cấu hình');
      await renderReportTab();
    });
  }

  // ---------- TABS ----------
  let tabbarVisualTimer=null;
  function tabbarCenter(button,tabbar){
    const tabbarRect=tabbar.getBoundingClientRect();
    const buttonRect=button.getBoundingClientRect();
    return buttonRect.left-tabbarRect.left+buttonRect.width/2;
  }
  function tabbarNotchScale(tabbar){
    return tabbar.offsetWidth<=360 ? .83 : 1;
  }
  function tabbarNotchTransform(center,tabbar){
    return 'translate('+center+'px,0px) scaleX('+tabbarNotchScale(tabbar)+')';
  }
  function syncTabbarSurfaceGeometry(tabbar){
    const width=tabbar.clientWidth;
    const height=tabbar.clientHeight;
    if(!width || !height) return;
    const surface=tabbar.querySelector('.tabbar-surface');
    const mask=surface.querySelector('#tabbarSurfaceMask');
    const maskBase=surface.querySelector('.tabbar-mask-base');
    const surfaceFill=surface.querySelector('.tabbar-surface-fill');
    surface.setAttribute('viewBox','0 0 '+width+' '+height);
    mask.setAttribute('x','0');
    mask.setAttribute('y','0');
    mask.setAttribute('width',String(width));
    mask.setAttribute('height',String(height));
    maskBase.setAttribute('width',String(width));
    maskBase.setAttribute('height',String(height));
    surfaceFill.setAttribute('width',String(width));
    surfaceFill.setAttribute('height',String(height));
  }
  function placeTabbarVisual(button){
    const tabbar=document.querySelector('nav.tabbar');
    const crown=tabbar.querySelector('.tabbar-crown');
    const notch=tabbar.querySelector('.tabbar-notch');
    const wash=tabbar.querySelector('.tabbar-wash');
    if(!button || !tabbar.offsetWidth) return;
    syncTabbarSurfaceGeometry(tabbar);
    const center=tabbarCenter(button,tabbar);
    crown.style.transform='translate3d('+(center-crown.offsetWidth/2)+'px,0,0)';
    notch.style.transform=tabbarNotchTransform(center,tabbar);
    wash.style.left=center+'px';
  }
  function animateTabbar(nextButton){
    const tabbar=document.querySelector('nav.tabbar');
    const crown=tabbar.querySelector('.tabbar-crown');
    const notch=tabbar.querySelector('.tabbar-notch');
    const wash=tabbar.querySelector('.tabbar-wash');
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tabbarRect=tabbar.getBoundingClientRect();
    const crownRect=crown.getBoundingClientRect();
    const currentCenter=crownRect.left-tabbarRect.left+crownRect.width/2;
    clearTimeout(tabbarVisualTimer);
    tabbar.querySelectorAll('button[data-tab]').forEach(button=>{
      button.classList.remove('visual-active','visual-arriving');
    });
    crown.getAnimations().forEach(animation=>animation.cancel());
    notch.getAnimations().forEach(animation=>animation.cancel());
    wash.getAnimations().forEach(animation=>animation.cancel());
    crown.style.transform='translate3d('+(currentCenter-crown.offsetWidth/2)+'px,0,0)';
    notch.style.transform=tabbarNotchTransform(currentCenter,tabbar);
    if(reduced){
      nextButton.classList.add('visual-active');
      placeTabbarVisual(nextButton);
      return;
    }
    const destinationCenter=tabbarCenter(nextButton,tabbar);
    const destinationX=destinationCenter-crown.offsetWidth/2;
    wash.style.left=destinationCenter+'px';
    nextButton.classList.add('visual-arriving');
    const motionOptions={
      duration:590,
      easing:'cubic-bezier(.65,-.12,.25,1.16)',
      fill:'forwards'
    };
    const crownAnimation=crown.animate([
      {transform:'translate3d('+(currentCenter-crown.offsetWidth/2)+'px,0,0)'},
      {transform:'translate3d('+destinationX+'px,0,0)'}
    ],motionOptions);
    const notchAnimation=notch.animate([
      {transform:tabbarNotchTransform(currentCenter,tabbar)},
      {transform:tabbarNotchTransform(destinationCenter,tabbar)}
    ],motionOptions);
    wash.animate([
      {opacity:0,transform:'translate(-50%,-50%) scale(.15)',offset:0},
      {opacity:.88,transform:'translate(-50%,-50%) scale(1.06)',offset:.44},
      {opacity:0,transform:'translate(-50%,-50%) scale(1.32)',offset:1}
    ],{duration:590,easing:'ease-out'});
    tabbarVisualTimer=setTimeout(()=>{
      nextButton.classList.remove('visual-arriving');
      nextButton.classList.add('visual-active');
    },390);
    crownAnimation.onfinish=()=>{
      crown.style.transform='translate3d('+destinationX+'px,0,0)';
      notch.style.transform=tabbarNotchTransform(destinationCenter,tabbar);
      crownAnimation.cancel();
      notchAnimation.cancel();
    };
  }
  function syncTabbarVisual(){
    const tabbar=document.querySelector('nav.tabbar');
    if(!tabbar) return;
    const active=tabbar.querySelector('button.visual-active,button.visual-arriving,button.active');
    tabbar.querySelector('.tabbar-crown').getAnimations().forEach(animation=>animation.cancel());
    tabbar.querySelector('.tabbar-notch').getAnimations().forEach(animation=>animation.cancel());
    tabbar.querySelector('.tabbar-wash').getAnimations().forEach(animation=>animation.cancel());
    placeTabbarVisual(active);
  }
  let tabPageTransitionId=0;
  function captureTabPageVisual(tab){
    if(!tab) return {opacity:1,rect:null};
    const style=getComputedStyle(tab);
    const opacity=Number.parseFloat(style.opacity);
    const rect=tab.getBoundingClientRect();
    return {
      opacity:Number.isFinite(opacity) ? opacity : 1,
      rect:{top:rect.top,left:rect.left,width:rect.width}
    };
  }
  function clearTabPageTransitionStyles(tab){
    ['position','top','left','right','width','z-index'].forEach(property=>{
      tab.style.removeProperty(property);
    });
  }
  function resetTabPageTransitions(){
    const runId=++tabPageTransitionId;
    document.querySelectorAll('.tab').forEach(tab=>{
      tab.getAnimations().forEach(animation=>animation.cancel());
      tab.classList.remove('tab-leaving','tab-entering');
      clearTabPageTransitionStyles(tab);
    });
    return runId;
  }
  function animateTabPage(previousTab,nextTab,direction,previousVisual,runId){
    if(!previousTab || !nextTab || previousTab===nextTab) return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    previousTab.classList.add('tab-leaving');
    nextTab.classList.add('tab-entering');
    if(previousVisual.rect){
      previousTab.style.position='fixed';
      previousTab.style.top=previousVisual.rect.top+'px';
      previousTab.style.left=previousVisual.rect.left+'px';
      previousTab.style.right='auto';
      previousTab.style.width=previousVisual.rect.width+'px';
      previousTab.style.zIndex='4';
    }
    const outgoing=previousTab.animate([
      {opacity:previousVisual.opacity,transform:'translate3d(0,0,0)',offset:0},
      {opacity:previousVisual.opacity,transform:'translate3d(0,0,0)',offset:.12},
      {opacity:0,transform:'translate3d('+(-direction*24)+'px,0,0)'}
    ],{
      duration:360,
      easing:'cubic-bezier(.4,0,.6,1)',
      fill:'forwards'
    });
    const incoming=nextTab.animate([
      {opacity:0,transform:'translate3d('+(direction*26)+'px,0,0)',offset:0},
      {opacity:0,transform:'translate3d('+(direction*20)+'px,0,0)',offset:.14},
      {opacity:1,transform:'translate3d(0,0,0)'}
    ],{
      duration:520,
      delay:70,
      easing:'cubic-bezier(.22,.8,.2,1)',
      fill:'both'
    });
    Promise.allSettled([outgoing.finished,incoming.finished]).then(()=>{
      if(runId!==tabPageTransitionId) return;
      previousTab.classList.remove('tab-leaving');
      nextTab.classList.remove('tab-entering');
      clearTabPageTransitionStyles(previousTab);
      clearTabPageTransitionStyles(nextTab);
      outgoing.cancel();
      incoming.cancel();
    });
  }
  function switchTab(name){
    closeOrderMenus();
    const previousButton=document.querySelector('nav.tabbar button.active');
    const nextButton=document.querySelector('nav.tabbar button[data-tab="'+name+'"]');
    if(!nextButton) return;
    const previousTab=previousButton ? document.getElementById('tab-'+previousButton.dataset.tab) : null;
    const nextTab=document.getElementById('tab-'+name);
    const previousVisual=captureTabPageVisual(previousTab);
    const buttons=[...document.querySelectorAll('nav.tabbar button[data-tab]')];
    const previousIndex=buttons.indexOf(previousButton);
    const nextIndex=buttons.indexOf(nextButton);
    const direction=previousIndex<0 || nextIndex>=previousIndex ? 1 : -1;
    const transitionRunId=resetTabPageTransitions();
    if(previousButton!==nextButton) animateTabbar(nextButton);
    document.getElementById('app').dataset.activeTab=name;
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    nextTab.classList.add('active');
    if(previousButton!==nextButton){
      animateTabPage(previousTab,nextTab,direction,previousVisual,transitionRunId);
    }
    document.querySelectorAll('nav.tabbar button').forEach(b=>{
      const active=b.dataset.tab===name;
      b.classList.toggle('active',active);
      if(active) b.setAttribute('aria-current','page');
      else b.removeAttribute('aria-current');
    });
    if(name==='today') renderToday();
    if(name==='report') renderReportTab().catch(error=>showToast(error.message));
    if(name==='history'){
      initializeHistoryFilters();
      renderHistory();
      if(state.history.dirty && !state.history.loading){
        loadHistory(false).catch(error=>renderHistoryError(error.message));
      }
    }
    if(name==='settings') renderSettingsForm();
  }
  document.querySelectorAll('nav.tabbar button').forEach(b=>{
    b.addEventListener('click', ()=>switchTab(b.dataset.tab));
  });
  window.addEventListener('resize',syncTabbarVisual);
  if(window.visualViewport) window.visualViewport.addEventListener('resize',syncTabbarVisual);

  // ---------- DATE CHANGE ----------
  document.getElementById('dateInput').addEventListener('change', async (e)=>{
    if(!requireOnline()){
      e.target.value=state.date;
      renderSelectedDate();
      return;
    }
    if(state.editingOrderId) finishOrderEdit(false);
    state.date = e.target.value || todayStr();
    e.target.value=state.date;
    renderSelectedDate();
    try{
      await loadOrdersForDate(state.date);
      renderToday();
      await renderReportTab();
    }catch(error){ showToast(error.message); }
  });

  document.getElementById('loginForm').addEventListener('submit',login);
  document.getElementById('resetForm').addEventListener('submit',updatePassword);
  document.getElementById('btnForgotPassword').addEventListener('click',sendPasswordReset);
  document.getElementById('btnSignOut').addEventListener('click',signOut);
  document.getElementById('btnAccountMenu').addEventListener('click',toggleAccountMenu);
  document.addEventListener('click',event=>{
    const accountArea=event.target.closest('.account-area');
    if(!accountArea) setAccountMenu(false);
    const orderMenu=event.target.closest('.order-menu');
    if(orderMenu) closeOrderMenus(orderMenu);
    else closeOrderMenus();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      const openOrderMenu=document.querySelector('.order-menu[open]');
      if(openOrderMenu){
        const summary=openOrderMenu.querySelector('summary');
        closeOrderMenus();
        if(summary) summary.focus();
        event.preventDefault();
        return;
      }
    }
    if(event.key==='Escape' && document.getElementById('btnAccountMenu').getAttribute('aria-expanded')==='true'){
      setAccountMenu(false);
      document.getElementById('btnAccountMenu').focus();
    }
  });
  document.getElementById('btnAvatarCamera').addEventListener('click',()=>{
    if(!state.avatarBusy) document.getElementById('avatarInput').click();
  });
  document.getElementById('avatarInput').addEventListener('change',event=>{
    const file=event.target.files && event.target.files[0];
    if(file) uploadAvatar(file);
  });
  document.getElementById('btnRemoveAvatar').addEventListener('click',removeAvatar);
  ['navbarAvatarImage','settingsAvatarImage'].forEach(id=>{
    document.getElementById(id).addEventListener('error',()=>{
      state.avatarUrl='';
      renderProfile();
    });
  });
  document.getElementById('btnLocation').addEventListener('click',captureLocation);
  document.getElementById('todayList').addEventListener('toggle',event=>{
    const menu=event.target.closest('.order-menu');
    if(!menu) return;
    if(menu.open) closeOrderMenus(menu);
    const summary=menu.querySelector('summary');
    if(summary) summary.setAttribute('aria-expanded',String(menu.open));
  },true);
  document.getElementById('todayList').addEventListener('click',event=>{
    const button=event.target.closest('[data-order-action]');
    if(!button) return;
    const id=button.dataset.orderId;
    closeOrderMenus();
    if(button.dataset.orderAction==='edit') beginEditOrder(id);
    if(button.dataset.orderAction==='copy') copyOrderMessage(id);
    if(button.dataset.orderAction==='share') shareOrderMessage(id);
    if(button.dataset.orderAction==='delete') deleteOrder(id);
  });
  document.querySelectorAll('[data-history-mode]').forEach(button=>{
    button.addEventListener('click',()=>{
      state.history.filters.mode=button.dataset.historyMode;
      syncHistoryControls();
      reloadHistory();
    });
  });
  ['historySingleDate','historyDateFrom','historyDateTo','historyProduct','historyDistrict'].forEach(id=>{
    document.getElementById(id).addEventListener('change',reloadHistory);
  });
  document.getElementById('historyCustomer').addEventListener('input',scheduleHistoryReload);
  document.getElementById('btnResetHistory').addEventListener('click',resetHistoryFilters);
  document.getElementById('btnLoadMoreHistory').addEventListener('click',()=>{
    loadHistory(true).catch(error=>renderHistoryError(error.message));
  });
  document.getElementById('historyResults').addEventListener('click',event=>{
    const button=event.target.closest('[data-history-action]');
    if(!button) return;
    if(button.dataset.historyAction==='copy') copyHistoryOrder(button.dataset.orderId);
    if(button.dataset.historyAction==='share') shareHistoryOrder(button.dataset.orderId);
    if(button.dataset.historyAction==='retry') reloadHistory();
  });
  document.getElementById('btnAddOrder').addEventListener('click',submitOrderForm);
  document.getElementById('btnCancelOrderEdit').addEventListener('click',cancelOrderEdit);
  document.getElementById('btnFinalize').addEventListener('click', finalizeDay);
  document.getElementById('btnSaveSettings').addEventListener('click', saveSettingsForm);
  document.getElementById('btnRetryOnline').addEventListener('click',async ()=>{
    syncOnlineState();
    if(navigator.onLine && state.user){
      bootingForUser=null;
      await bootstrapAccount();
    }
  });
  window.addEventListener('offline',syncOnlineState);
  window.addEventListener('online',async ()=>{
    syncOnlineState();
    if(state.user){
      bootingForUser=null;
      await bootstrapAccount();
    }
  });

  // ---------- INIT ----------
  async function verifyActiveSession(session){
    if(!session || !navigator.onLine) return session;
    const {data,error}=await client.auth.getUser();
    if(!error && data && data.user){
      return Object.assign({},session,{user:data.user});
    }
    if(error && (error.status===401 || error.status===403)){
      await client.auth.signOut({scope:'local'});
      return null;
    }
    return session;
  }
  async function initAuth(){
    renderCurrentDateTimeVN();
    setInterval(renderCurrentDateTimeVN,1000);
    renderFilterOptions();
    // Keep the 13 product inputs visible even when account data cannot load.
    // They are rendered again after settings load to apply custom prices.
    renderProductRows();
    syncOnlineState();
    if(!client){
      showAuth();
      setAuthMessage('Chưa cấu hình Supabase. Xem file SUPABASE_SETUP.md.', 'error');
      document.getElementById('btnLogin').disabled=true;
      document.getElementById('btnForgotPassword').disabled=true;
      return;
    }
    client.auth.onAuthStateChange((event,session)=>{
      setTimeout(async ()=>{
        if(event==='PASSWORD_RECOVERY' || (authLinkModePending && session)){
          authLinkModePending=false;
          recoveryMode=true;
          state.session=session;
          state.user=session && session.user || null;
          showAuth();
          return;
        }
        if(event==='SIGNED_OUT'){
          recoveryMode=false;
          clearAccountState();
          showAuth();
          return;
        }
        await handleSession(await verifyActiveSession(session));
      },0);
    });
    const {data,error}=await client.auth.getSession();
    if(error){
      setAuthMessage('Không thể kiểm tra phiên đăng nhập.', 'error');
      showAuth();
      return;
    }
    if(authLinkModePending && data.session){
      authLinkModePending=false;
      recoveryMode=true;
      state.session=data.session;
      state.user=data.session.user;
      showAuth();
      return;
    }
    await handleSession(await verifyActiveSession(data.session));
  }
  initAuth();
})();
