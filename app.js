(function(){
  "use strict";

  // ---------- SẢN PHẨM ----------
  const PRODUCTS = [
    {id:'pho_bo',          name:'Phở Bò',                          shortLabel:'Phở bò',                  price:6667,  cat:'mi',     caseSize:30},
    {id:'pho_ga',          name:'Phở gà',                          shortLabel:'Phở gà',                  price:6667,  cat:'mi',     caseSize:30},
    {id:'hu_tieu_nv',      name:'Hủ Tiếu Nam Vang',                shortLabel:'Hủ tiếu Nam Vang',        price:7667,  cat:'mi',     caseSize:30},
    {id:'hu_tieu_sh',      name:'Hủ Tiếu Sườn Heo',                shortLabel:'Hủ tiếu sườn heo',        price:7667,  cat:'mi',     caseSize:30},
    {id:'pho_chay',        name:'Phở chay',                        shortLabel:'Phở chay',                price:7667,  cat:'mi',     caseSize:30},
    {id:'hu_tieu_chay',    name:'Hủ tiếu chay',                    shortLabel:'Hủ tiếu chay',            price:7667,  cat:'mi',     caseSize:30},
    {id:'bun_bo_hue',      name:'Bún bò Huế',                      shortLabel:'Bún bò Huế',              price:7667,  cat:'mi',     caseSize:30},
    {id:'bun_gio_heo',     name:'Bún Giò Heo',                     shortLabel:'Bún Giò Heo',             price:7667,  cat:'mi',     caseSize:30},
    {id:'bot_ngot',        name:'Bột ngọt Thuần Việt',             shortLabel:'Bột ngọt',                price:23000, cat:'gia_vi', caseSize:30},
    {id:'tieu_den',        name:'Tiêu đen xay',                    shortLabel:'Tiêu đen xay',            price:14000, cat:'gia_vi', caseSize:50},
    {id:'muoi_cham',       name:'Muối chấm tôm chua cay',          shortLabel:'Muối chấm tôm chua cay',  price:10000, cat:'gia_vi', caseSize:50},
    {id:'bot_canh_tom',    name:'Bột canh tôm',                    shortLabel:'Bột canh tôm',            price:4600,  cat:'gia_vi', caseSize:50},
    {id:'bot_canh_nam',    name:'Bột canh nấm',                    shortLabel:'Bột canh nấm',            price:4600,  cat:'gia_vi', caseSize:50},
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

  const DEFAULT_SETTINGS = {
    npp:'Thuận Lợi - Trà Vinh',
    nvbh:'Hữu Thi',
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
  function fmtReportMoney(n){ return Math.round((n||0)/1000).toLocaleString('vi-VN'); }
  function fmtDateVN(iso){ const [y,m,d]=iso.split('-'); return d+'/'+m+'/'+y; }
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
      if(le>0) parts.push(le+' gói lẻ');
      return parts.length ? parts.join(' + ') : '0 gói';
    }
    return itemSoldQty(item)+' gói';
  }
  function formatItemQuantity(item){
    if(!item || (!itemSoldQty(item) && !Number(item.tang||0))) return '';
    let text = formatSoldQuantity(item);
    if(Number(item.tang||0)>0) text += ' (tặng '+Number(item.tang)+' gói)';
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
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = busyLabel;
    try{ return await action(); }
    finally{
      button.disabled = false;
      button.textContent = oldText;
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
  }
  function clearAccountState(){
    bootingForUser = null;
    state.session = null;
    state.user = null;
    state.settings = Object.assign({}, DEFAULT_SETTINGS, {prices:{}});
    state.orders = [];
    state.pendingLocation = null;
    state.history = createHistoryState();
    resetOrderForm();
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

  // ---------- DATABASE LOAD / SAVE ----------
  function rowToSettings(row){
    if(!row) return Object.assign({},DEFAULT_SETTINGS,{prices:{}});
    return {
      npp:row.npp || DEFAULT_SETTINGS.npp,
      nvbh:row.nvbh || DEFAULT_SETTINGS.nvbh,
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
  async function loadSettings(){
    const {data,error} = await client.from('user_settings')
      .select('*').eq('user_id',state.user.id).maybeSingle();
    throwQueryError(error,'Không thể tải cấu hình.');
    state.settings = rowToSettings(data);
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

  function resetOrderForm(){
    document.getElementById('f_kh').value='';
    document.getElementById('f_diachi').value='';
    document.getElementById('f_district').value='';
    document.getElementById('f_sdt').value='';
    document.getElementById('f_isnew').checked=false;
    document.getElementById('f_ghichu').value='';
    state.pendingLocation=null;
    setLocationStatus('','');
    PRODUCTS.forEach(p=>{
      const cases=document.getElementById('thung_'+p.id);
      const loose=document.getElementById('le_'+p.id);
      const gifted=document.getElementById('tang_'+p.id);
      if(cases) cases.value='';
      if(loose) loose.value='';
      if(gifted) gifted.value='';
    });
  }

  async function addOrder(){
    if(!requireOnline()) return;
    const kh = document.getElementById('f_kh').value.trim();
    if(!kh){ showToast('Vui lòng nhập tên khách hàng'); document.getElementById('f_kh').focus(); return; }
    const district = document.getElementById('f_district').value;
    if(!DISTRICTS.includes(district)){
      showToast('Vui lòng chọn huyện');
      document.getElementById('f_district').focus();
      return;
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
    const order = {
      id: makeId(),
      stt: state.orders.length+1,
      kh,
      diaChi: document.getElementById('f_diachi').value.trim(),
      district,
      sdt: document.getElementById('f_sdt').value.trim(),
      isNew: document.getElementById('f_isnew').checked,
      ghiChu: document.getElementById('f_ghichu').value.trim(),
      items,
      location:state.pendingLocation,
      createdAt: new Date().toISOString()
    };
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
      invalidateHistory();
      renderToday();
    }finally{
      state.deletingIds.delete(id);
    }
  }

  // ---------- RENDER: TODAY TAB ----------
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
            '<details class="order-menu"><summary aria-label="Thao tác khác"><svg class="ui-icon" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg></summary>'+
              '<div class="order-menu-popover"><button data-order-action="delete" data-order-id="'+esc(o.id)+'">Xóa đơn</button></div></details>'+
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
      state.pendingLocation=null;
      setLocationStatus('error',geolocationErrorMessage(error));
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

  async function getMonthReports(mKey){
    const [year,month]=mKey.split('-').map(Number);
    const nextMonth = month===12 ? (year+1)+'-01-01' : year+'-'+pad(month+1)+'-01';
    const {data,error}=await client.from('daily_reports').select('*')
      .eq('user_id',state.user.id)
      .gte('work_date',mKey+'-01').lt('work_date',nextMonth)
      .order('work_date',{ascending:true});
    throwQueryError(error,'Không thể tải lịch sử báo cáo.');
    return (data||[]).map(rowToReport);
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
    const reports = await getMonthReports(mKey);
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

    let cdRevenue=0, cdGiaVi=0, daysAchieved=0;
    const phoneSet = new Set();
    reports.forEach(r=>{
      cdRevenue += r.revenue;
      cdGiaVi += r.giaVi;
      if(r.dat) daysAchieved++;
      (r.newCustomers||[]).forEach(c=>{
        const key = (c.phone||c.name||'').trim().toLowerCase();
        if(key) phoneSet.add(key);
      });
    });
    const daysReported = reports.length;
    const s = state.settings;

    const pctNgay   = safeDiv(todayReport.revenue, s.targetDaily);
    const pctThang  = safeDiv(cdRevenue, s.targetMonthly);
    const pctASO    = safeDiv(phoneSet.size, s.targetASO);
    const pctGiaVi  = safeDiv(cdGiaVi, s.targetGiaVi);
    const pctTienDo = safeDiv(daysReported, s.workDays);

    const text =
`Báo cáo ngày : ${fmtDateVN(state.date)}
- Npp: ${s.npp}
- NVBH: ${s.nvbh}
- Tiến độ thời gian: ${daysReported}/${s.workDays} ngày (${pctTienDo.toFixed(0)}%)
1. Doanh số thực hiện (ĐVT: 1000đ)
- TH/CT ngày: ${fmtReportMoney(todayReport.revenue)}/${fmtReportMoney(s.targetDaily)}/${pctNgay.toFixed(1)}%
- CD/CT tháng: ${fmtReportMoney(cdRevenue)}/${fmtReportMoney(s.targetMonthly)}/${pctThang.toFixed(1)}%
2. Đơn hàng thành công: ${todayReport.orderCount}đh
3. KPI
- KPI 1 - ASO : ${todayReport.newCustomers.length}/${phoneSet.size}/${s.targetASO}/${pctASO.toFixed(0)}%
- KPI 2 - CT ngày: ${daysAchieved}/${daysReported} ngày đạt
- KPI 3 - Gia vị: ${fmtReportMoney(todayReport.giaVi)}/${fmtReportMoney(cdGiaVi)}/${fmtReportMoney(s.targetGiaVi)}/${pctGiaVi.toFixed(1)}%`;

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
  function switchTab(name){
    document.getElementById('app').dataset.activeTab=name;
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.getElementById('tab-'+name).classList.add('active');
    document.querySelectorAll('nav.tabbar button').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
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

  // ---------- DATE CHANGE ----------
  document.getElementById('dateInput').addEventListener('change', async (e)=>{
    if(!requireOnline()){
      e.target.value=state.date;
      renderSelectedDate();
      return;
    }
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
  document.getElementById('btnLocation').addEventListener('click',captureLocation);
  document.getElementById('todayList').addEventListener('click',event=>{
    const button=event.target.closest('[data-order-action]');
    if(!button) return;
    const id=button.dataset.orderId;
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
  document.getElementById('btnAddOrder').addEventListener('click', addOrder);
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
        await handleSession(session);
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
    await handleSession(data.session);
  }
  initAuth();
})();
