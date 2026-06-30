const state = {
  data: null,
  route: { name: 'home', params: {} },
  user: null,
  profile: null,
  firebaseReady: false,
  firebaseError: '',
  firebase: {},
  commentCounts: {},
  readingProgress: {},
  readingProgressLoaded: false,
  bookPageIndex: 0,
  lastPageKey: '',
  pageTurnDirection: 'next',
  readerFullscreen: false,
  theme: localStorage.getItem('siteTheme') || 'light',
  lang: localStorage.getItem('siteLang') || 'tr',
  bookCommentUnsub: null,
  modalUnsub: null,
  activeBookCommentsSlug: null,
  selectedChapterIndex: 0,
  activeBookSlug: '',
  manualChapterSelection: false,
  audioActive: false,
  currentAudioTrack: '',
  audioElement: null,
  audioContext: null,
  ambientNodes: []
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const EMOJIS = ['❤️', '🔥', '👏', '😢', '😮', '😊', '😡', '✨', '💔', '📖', '🖋️', '🌙'];
const APP_VERSION = 'v12-reader-cache-fix';

console.info('Kenan Kaya site version:', APP_VERSION);
init().catch(handleFatalError);

const FALLBACK_DATA = {
  site: {
    siteName: 'Kenan Kaya',
    siteSubtitle: 'Romanlar ve kişisel paylaşımlar.',
    authorName: 'Kenan Kaya',
    logoText: 'K.K.',
    heroTitle: 'Kitaplarımın sessiz odası',
    heroLead: 'Site güvenli modda açıldı. İçerikler yüklenince burada görünecek.',
    footerText: '© Kenan Kaya',
    adminEmails: ['kenank4ya@gmail.com'],
    firebase: {},
    fonts: {},
    audio: {},
    homeWindows: [],
    socialLinks: []
  },
  about: { title: 'Hakkımda', subtitle: '', body: '' },
  books: [],
  posts: []
};

function handleFatalError(err) {
  console.error('Site açılış hatası:', err);
  if (!state.data) {
    state.data = JSON.parse(JSON.stringify(FALLBACK_DATA));
    normalizeData();
  }
  try { applySiteTheme(); renderShell(); } catch (_) {}
  const app = document.querySelector('#app');
  if (app) {
    app.innerHTML = `
      <section class="page-hero error-hero">
        <div class="eyebrow">Güvenli mod</div>
        <h1>Site açıldı, fakat bazı içerikler yüklenemedi.</h1>
        <p class="lead">Bu genellikle Cloudflare ayarı, Firebase içeriği veya bozuk kitap kaydı yüzünden olur. Ana dosyalar korunuyor; admin panelden son eklenen içeriği kontrol edebilirsin.</p>
        <div class="reader-actions">
          <a class="btn primary" href="#/">Ana Sayfayı Yeniden Dene</a>
          <a class="btn" href="/admin/">Admin Paneli</a>
        </div>
        <details class="error-details">
          <summary>Teknik hata</summary>
          <pre>${escapeHtml(err?.message || String(err || 'Bilinmeyen hata'))}</pre>
        </details>
      </section>`;
  }
}

function safeRender() {
  try {
    render();
  } catch (err) {
    handleFatalError(err);
  }
}

async function init() {
  document.documentElement.dataset.siteVersion = APP_VERSION;
  bindGlobalEvents();
  installCopyProtection();
  await loadData();
  await initFirebase();
  await loadRemoteContent();
  applySiteTheme();
  applyLanguage();
  renderShell();
  parseRoute();
  safeRender();
}

function bindGlobalEvents() {
  window.addEventListener('hashchange', () => {
    parseRoute();
    safeRender();
  });
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('input', handleDocumentInput);
  $('#audio-control')?.addEventListener('click', toggleAudio);
}

function installCopyProtection() {
  const isEditable = (el) => !!el.closest('input, textarea, select, [contenteditable="true"], .modal, button, a');
  const isProtected = (el) => !!el.closest('.reader, .article-body, .protected-content, .book-side-cover, .book-cover');
  const block = (event) => {
    const target = event.target;
    if (isEditable(target)) return;
    if (!isProtected(target)) return;
    event.preventDefault();
    toast('Kitap metinlerinde kopyalama ve sağ tık kapalıdır.');
  };
  ['contextmenu', 'copy', 'cut', 'dragstart', 'selectstart'].forEach((name) => document.addEventListener(name, block));
  document.addEventListener('keydown', (event) => {
    const key = String(event.key || '').toLowerCase();
    if (!(event.ctrlKey || event.metaKey)) return;
    if (!['c', 'x', 's', 'u', 'p'].includes(key)) return;
    if (isEditable(event.target)) return;
    if (isProtected(event.target) || state.route.name === 'kitap') {
      event.preventDefault();
      toast('Kitap sayfasında kopyalama/kaydetme kısayolları kapalıdır.');
    }
  });
}

async function loadData() {
  try {
    const res = await fetch('/content/index.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`/content/index.json yüklenemedi: ${res.status}`);
    state.data = await res.json();
  } catch (err) {
    console.warn('Statik içerik yüklenemedi, güvenli varsayılan içerik kullanılacak:', err);
    state.data = JSON.parse(JSON.stringify(FALLBACK_DATA));
  }
  normalizeData();
}

function normalizeData() {
  state.data = state.data && typeof state.data === 'object' ? state.data : JSON.parse(JSON.stringify(FALLBACK_DATA));
  state.data.site = state.data.site && typeof state.data.site === 'object' ? state.data.site : {};
  state.data.about = state.data.about && typeof state.data.about === 'object' ? state.data.about : {};
  state.data.books = Array.isArray(state.data.books) ? state.data.books.map(sanitizeBook).filter(Boolean) : [];
  state.data.posts = Array.isArray(state.data.posts) ? state.data.posts.map(sanitizePost).filter(Boolean) : [];
  state.data.site.fonts = {
    bodyFont: "Inter, system-ui, sans-serif",
    titleFont: "Cormorant Garamond, Georgia, serif",
    readerFont: "Georgia, serif",
    baseSize: 16,
    readerSize: 20,
    lineHeight: 1.9,
    ...(state.data.site.fonts || {})
  };
  state.data.site.audio = {
    enableBuiltInAmbient: true,
    defaultTrack: '',
    homeTrack: '',
    booksTrack: '',
    postsTrack: '',
    aboutTrack: '',
    volume: 0.18,
    ...(state.data.site.audio || {})
  };
}

function sanitizeBook(book) {
  if (!book || typeof book !== 'object') return null;
  const slug = String(book.slug || book.title || '').trim().toLowerCase()
    .replace(/[^a-z0-9ığüşöçİĞÜŞÖÇ-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || `kitap-${Date.now()}`;
  const chapters = Array.isArray(book.chapters) ? book.chapters : [];
  return {
    ...book,
    title: String(book.title || 'Başlıksız Kitap'),
    slug,
    chapters: chapters.map((chapter, index) => ({
      title: String(chapter?.title || `Bölüm ${index + 1}`),
      slug: String(chapter?.slug || `bolum-${index + 1}`),
      image: String(chapter?.image || ''),
      topImages: Array.isArray(chapter?.topImages) ? chapter.topImages : [],
      bottomImages: Array.isArray(chapter?.bottomImages) ? chapter.bottomImages : [],
      content: String(chapter?.content || '')
    }))
  };
}

function sanitizePost(post) {
  if (!post || typeof post !== 'object') return null;
  return {
    ...post,
    title: String(post.title || 'Başlıksız Paylaşım'),
    slug: String(post.slug || post.title || `paylasim-${Date.now()}`).trim().toLowerCase().replace(/[^a-z0-9ığüşöçİĞÜŞÖÇ-]+/gi, '-').replace(/^-+|-+$/g, ''),
    body: String(post.body || '')
  };
}

async function loadRemoteContent() {
  if (!state.firebaseReady) return;
  const { db, storeMod } = state.firebase;
  try {
    const [siteSnap, aboutSnap, booksSnap, postsSnap] = await Promise.all([
      storeMod.getDoc(storeMod.doc(db, 'cmsSite', 'main')),
      storeMod.getDoc(storeMod.doc(db, 'cmsPages', 'about')),
      storeMod.getDocs(storeMod.collection(db, 'cmsBooks')),
      storeMod.getDocs(storeMod.collection(db, 'cmsPosts'))
    ]);

    if (siteSnap.exists()) state.data.site = { ...state.data.site, ...siteSnap.data() };
    if (aboutSnap.exists()) state.data.about = { ...state.data.about, ...aboutSnap.data() };
    if (!booksSnap.empty) {
      state.data.books = booksSnap.docs
        .map((doc) => sanitizeBook({ ...doc.data(), __firestoreId: doc.id }))
        .filter(Boolean)
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || String(a.title || '').localeCompare(String(b.title || ''), 'tr'));
    }
    if (!postsSnap.empty) {
      state.data.posts = postsSnap.docs
        .map((doc) => sanitizePost({ ...doc.data(), __firestoreId: doc.id }))
        .filter(Boolean)
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }
    normalizeData();
  } catch (err) {
    console.warn('Firebase içerik yüklenemedi, statik içerik kullanılacak:', err);
  }
}

function parseRoute() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  const name = parts[0] || 'home';
  state.route = { name, params: { slug: parts[1] || '' } };
}

function renderShell() {
  const { site } = state.data;
  $('#site-header').innerHTML = `
    <div class="header-inner">
      <a class="brand" href="#/" aria-label="${escapeAttr(t('home'))}">
        <span class="logo-mark">${escapeHtml(site.logoText || 'K.K.')}</span>
        <span>
          <span class="brand-title">${escapeHtml(site.siteName || 'Kenan Kaya')}</span>
          <span class="brand-subtitle">${escapeHtml(site.authorName || 'Yazar')}</span>
        </span>
      </a>
      <nav class="nav" aria-label="Site menüsü">
        <a href="#/" data-nav="home">${t('home')}</a>
        <a href="#/kitaplar" data-nav="kitaplar">${t('books')}</a>
        <a href="#/paylasimlar" data-nav="paylasimlar">${t('posts')}</a>
        <a href="#/hakkimda" data-nav="hakkimda">${t('about')}</a>
      </nav>
      <div class="site-controls">
        <button class="btn small ghost theme-toggle" type="button" data-action="toggle-theme" title="Tema değiştir">${state.theme === 'dark' ? '☀️ Açık Tema' : '🌙 Koyu Tema'}</button>
        <button class="btn small ghost lang-toggle" type="button" data-action="toggle-lang" title="Dil değiştir">${state.lang === 'tr' ? 'English' : 'Türkçe'}</button>
      </div>
      <div class="auth-actions" id="auth-actions"></div>
    </div>`;
  renderAuthArea();
  renderFooter();
}

function renderFooter() {
  const { site } = state.data;
  const links = (site.socialLinks || []).filter((x) => x.url);
  $('#site-footer').innerHTML = `
    <span>${escapeHtml(site.footerText || '')}</span>
    <span class="footer-links">${links.map((x) => `<a href="${escapeAttr(x.url)}" target="_blank" rel="noopener">${escapeHtml(x.label)}</a>`).join('')}</span>
  `;
}

function renderAuthArea() {
  const root = $('#auth-actions');
  if (!root) return;
  if (!state.user) {
    root.innerHTML = `
      <button class="btn ghost" type="button" data-action="open-login">${t('login')}</button>
      <button class="btn primary" type="button" data-action="open-register">${t('register')}</button>
    `;
    return;
  }
  const avatar = getAvatarHtml(state.profile?.avatarURL || state.user.photoURL, state.user.displayName || state.user.email, 'avatar');
  root.innerHTML = `
    <button class="user-pill" type="button" data-action="open-profile" title="Profil ve avatar">
      ${avatar}
      <span class="user-name">${escapeHtml(state.user.displayName || state.user.email || 'Okur')}</span>
    </button>
    <button class="btn small ghost" type="button" data-action="logout">${t('logout')}</button>
  `;
}

function chooseBookChapterIndex(bookSlug) {
  const book = state.data.books.find((b) => b.slug === bookSlug);
  const chapters = Array.isArray(book?.chapters) ? book.chapters : [];
  const maxIndex = Math.max(chapters.length - 1, 0);
  const progress = getBookProgress(bookSlug);
  const savedIndex = progress ? clampNumber(progress.chapterIndex, 0, maxIndex, 0) : null;
  const routeChanged = state.activeBookSlug !== bookSlug;

  if (routeChanged) {
    state.activeBookSlug = bookSlug || '';
    state.manualChapterSelection = false;
  }

  if (!state.manualChapterSelection && savedIndex !== null) {
    state.selectedChapterIndex = savedIndex;
    state.bookPageIndex = clampNumber(progress?.pageIndex, 0, 999, 0);
    sessionStorage.setItem(chapterSessionKeyFor(bookSlug), String(savedIndex));
    return;
  }

  const sessionValue = sessionStorage.getItem(chapterSessionKeyFor(bookSlug));
  if (!state.manualChapterSelection && sessionValue !== null) {
    state.selectedChapterIndex = clampNumber(sessionValue, 0, maxIndex, 0);
    return;
  }

  state.selectedChapterIndex = clampNumber(state.selectedChapterIndex, 0, maxIndex, 0);
}

function render() {
  const navKey = routeToNavKey();
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === navKey));
  const { name } = state.route;
  if (name === 'kitap') {
    chooseBookChapterIndex(state.route.params.slug);
  } else {
    state.activeBookSlug = '';
    state.manualChapterSelection = false;
    state.selectedChapterIndex = 0;
    state.readerFullscreen = false;
    document.body.classList.remove('reader-lock');
  }


  if (name === 'kitaplar') renderBooksPage();
  else if (name === 'kitap') renderBookDetail(state.route.params.slug);
  else if (name === 'paylasimlar') renderPostsPage();
  else if (name === 'paylasim') renderPostDetail(state.route.params.slug);
  else if (name === 'hakkimda') renderAboutPage();
  else renderHomePage();

  setRouteAudio();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function routeToNavKey() {
  if (state.route.name === 'kitap' || state.route.name === 'kitaplar') return 'kitaplar';
  if (state.route.name === 'paylasim' || state.route.name === 'paylasimlar') return 'paylasimlar';
  if (state.route.name === 'hakkimda') return 'hakkimda';
  return 'home';
}

function renderHomePage() {
  const { site, books, posts } = state.data;
  setHeroImage(site.heroImage || '');
  $('#app').innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow">Yazar sitesi</div>
        <h1>${escapeHtml(site.heroTitle || site.siteName)}</h1>
        <p class="lead">${escapeHtml(site.heroLead || site.siteSubtitle || '')}</p>
        <div class="hero-actions">
          <a class="btn primary" href="#/kitaplar">Kitapları Oku</a>
          <a class="btn" href="#/paylasimlar">Kişisel Paylaşımlar</a>
        </div>
      </div>
      <div class="hero-art">
        <div class="hero-art-card">
          <b>${escapeHtml(site.siteName || 'Kenan Kaya')}</b>
          <p>${escapeHtml(site.siteSubtitle || '')}</p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <div class="eyebrow">Vitrin</div>
          <h2>Kitaplar</h2>
          <p>Devam eden romanlar, taslak bölümler ve okurların yorum bırakabileceği sahneler.</p>
        </div>
        <a class="btn" href="#/kitaplar">Tümünü Gör</a>
      </div>
      <div class="grid two">${books.slice(0, 2).map(renderBookCard).join('')}</div>
    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <div class="eyebrow">Özel Alanlar</div>
          <h2>Site Pencereleri</h2>
          <p>Bu pencerelerdeki başlık, metin, buton, görsel ve bağlantılar admin panelinden değiştirilebilir.</p>
        </div>
      </div>
      <div class="grid three">${(site.homeWindows || []).map(renderWindowCard).join('')}</div>
    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <div class="eyebrow">Notlar</div>
          <h2>Son Paylaşımlar</h2>
        </div>
        <a class="btn" href="#/paylasimlar">Paylaşımlara Git</a>
      </div>
      <div class="grid two">${posts.slice(0, 2).map(renderPostCard).join('') || empty('Henüz paylaşım eklenmedi.')}</div>
    </section>
  `;
}

function renderBooksPage() {
  const { books } = state.data;
  setHeroImage('');
  $('#app').innerHTML = `
    <section class="page-hero">
      <div class="eyebrow">${t('books')}</div>
      <h1>${t('books')}</h1>
      <p class="lead">Her kitap kendi kapağı, ara görselleri, müziği ve yorum alanlarıyla düzenlenebilir.</p>
    </section>
    <section class="section">
      <div class="grid two">${books.map(renderBookCard).join('') || empty('Henüz kitap eklenmedi.')}</div>
    </section>
  `;
}

function renderBookCard(book) {
  const cover = bg(book.cover || book.heroImage || '');
  const progress = getBookProgress(book.slug);
  return `
    <article class="book-card protected-content">
      <a class="book-cover" href="#/kitap/${escapeAttr(book.slug)}" style="${cover}"></a>
      <div class="card-body">
        <div class="meta-row">
          ${book.category ? `<span class="badge">${escapeHtml(book.category)}</span>` : ''}
          ${book.status ? `<span class="badge">${escapeHtml(book.status)}</span>` : ''}
        </div>
        <h3><a href="#/kitap/${escapeAttr(book.slug)}">${escapeHtml(book.title)}</a></h3>
        <p>${escapeHtml(book.summary || book.subtitle || '')}</p>
        ${renderProgressMini(book, progress)}
        <div class="reader-actions compact-actions">
          <a class="btn small" href="#/kitap/${escapeAttr(book.slug)}">${t('books') === 'Books' ? 'Open Book' : 'Kitabı Aç'}</a>
          ${progress ? `<a class="btn small primary" href="#/kitap/${escapeAttr(book.slug)}" data-action="continue-reading" data-book="${escapeAttr(book.slug)}" data-index="${Number(progress.chapterIndex || 0)}">Kaldığın Yerden Devam Et</a>` : ''}
        </div>
      </div>
    </article>
  `;
}


function renderProgressMini(book, progress) {
  if (!state.user || !progress) return '';
  const chapters = Array.isArray(book.chapters) ? book.chapters : [];
  const chapterIndex = clampNumber(progress.chapterIndex, 0, Math.max(chapters.length - 1, 0), 0);
  const chapter = chapters[chapterIndex] || {};
  const percent = chapters.length ? Math.round(((chapterIndex + 1) / chapters.length) * 100) : 0;
  const page = progress.pageNumber ? ` · ${t('page')} ${Number(progress.pageNumber)}` : '';
  return `
    <div class="reading-progress-mini">
      <span>📌 ${t('savedPlace')}</span>
      <b>${escapeHtml(chapter.title || progress.chapterTitle || `${t('chapter')} ${chapterIndex + 1}`)}${page}</b>
      ${percent ? `<small>%${percent} tamamlandı</small>` : ''}
    </div>`;
}

function renderProgressPrompt(book, selectedIndex) {
  if (!state.user) {
    return `
      <div class="reading-progress-card muted-card">
        <div>
          <b>${state.lang === 'en' ? 'Want to save your reading place?' : 'Okuma yerini kaydetmek ister misin?'}</b>
          <p>${state.lang === 'en' ? 'Log in to mark the exact chapter and page you left off.' : 'Giriş yaparsan kaldığın bölümü ve sayfayı işaretleyebilir, sonra otomatik olarak oradan devam edebilirsin.'}</p>
        </div>
        <button class="btn small primary" type="button" data-action="open-login">${t('login')}</button>
      </div>`;
  }
  const progress = getBookProgress(book.slug);
  const chapters = Array.isArray(book.chapters) ? book.chapters : [];
  if (!progress) {
    return `
      <div class="reading-progress-card">
        <div>
          <b>${state.lang === 'en' ? 'No saved place yet.' : 'Bu kitapta kaldığın yer henüz işaretlenmedi.'}</b>
          <p>${state.lang === 'en' ? 'You can save the currently open chapter and page.' : 'Şu an açık olan bölümü ve sayfayı hesabına kaydedebilirsin.'}</p>
        </div>
        <button class="btn small primary" type="button" data-action="save-reading-progress" data-book="${escapeAttr(book.slug)}" data-index="${selectedIndex}">${t('markPlace')}</button>
      </div>`;
  }
  const savedIndex = clampNumber(progress.chapterIndex, 0, Math.max(chapters.length - 1, 0), 0);
  const savedChapter = chapters[savedIndex] || {};
  const isCurrent = savedIndex === selectedIndex;
  const savedDate = progress.updatedAt?.toDate ? progress.updatedAt.toDate() : progress.updatedAt;
  const pageInfo = progress.pageNumber ? ` · ${t('page')} ${Number(progress.pageNumber)}` : '';
  return `
    <div class="reading-progress-card ${isCurrent ? 'current-progress' : ''}">
      <div>
        <b>${isCurrent ? (state.lang === 'en' ? 'This chapter is marked.' : 'Bu bölüm kaldığın yer olarak işaretli.') : (state.lang === 'en' ? 'Your saved place is ready.' : 'Kaldığın bölüm hazır.')}</b>
        <p>${state.lang === 'en' ? 'Last saved place' : 'Son işaretlenen yer'}: <strong>${escapeHtml(savedChapter.title || progress.chapterTitle || `${t('chapter')} ${savedIndex + 1}`)}${pageInfo}</strong>${savedDate ? ` · ${formatDateTime(savedDate)}` : ''}</p>
      </div>
      <div class="row-actions">
        ${!isCurrent ? `<button class="btn small primary" type="button" data-action="continue-reading" data-book="${escapeAttr(book.slug)}" data-index="${savedIndex}">${state.lang === 'en' ? 'Go There' : 'Bu Bölüme Git'}</button>` : ''}
        <button class="btn small" type="button" data-action="save-reading-progress" data-book="${escapeAttr(book.slug)}" data-index="${selectedIndex}">${t('markPlace')}</button>
        <button class="btn small ghost" type="button" data-action="clear-reading-progress" data-book="${escapeAttr(book.slug)}">${t('removeMark')}</button>
      </div>
    </div>`;
}

function renderWindowCard(item) {
  return `
    <article class="window-card">
      <div class="window-image" style="${bg(item.image || '')}"></div>
      <div class="card-body">
        <h3>${escapeHtml(item.title || '')}</h3>
        <p>${escapeHtml(item.text || '')}</p>
        ${item.buttonText ? `<a class="btn small" href="${escapeAttr(item.buttonLink || '#/')}">${escapeHtml(item.buttonText)}</a>` : ''}
      </div>
    </article>`;
}

function renderPostsPage() {
  const { posts } = state.data;
  setHeroImage('');
  $('#app').innerHTML = `
    <section class="page-hero">
      <div class="eyebrow">Kişisel paylaşımlar</div>
      <h1>Duyurular ve Notlar</h1>
      <p class="lead">Kitapların arka planı, karakter notları, bölüm duyuruları ve sana ait özel yazılar.</p>
    </section>
    <section class="section">
      <div class="grid two">${posts.map(renderPostCard).join('') || empty('Henüz paylaşım eklenmedi.')}</div>
    </section>
  `;
}

function renderPostCard(post) {
  return `
    <article class="post-card">
      <a class="post-cover" href="#/paylasim/${escapeAttr(post.slug)}" style="${bg(post.coverImage || post.backgroundImage || '')}"></a>
      <div class="card-body">
        <div class="meta-row">
          ${post.category ? `<span class="badge">${escapeHtml(post.category)}</span>` : ''}
          ${post.date ? `<span class="badge">${formatDate(post.date)}</span>` : ''}
        </div>
        <h3><a href="#/paylasim/${escapeAttr(post.slug)}">${escapeHtml(post.title)}</a></h3>
        <p>${escapeHtml(post.excerpt || '')}</p>
        <a class="btn small" href="#/paylasim/${escapeAttr(post.slug)}">Oku</a>
      </div>
    </article>
  `;
}

function renderPostDetail(slug) {
  const post = state.data.posts.find((p) => p.slug === slug);
  if (!post) return renderNotFound('Paylaşım bulunamadı.');
  setHeroImage(post.backgroundImage || post.coverImage || '');
  $('#app').innerHTML = `
    <section class="page-hero ${post.backgroundImage || post.coverImage ? 'with-image' : ''}">
      <div class="eyebrow">${escapeHtml(post.category || 'Paylaşım')}</div>
      <h1>${escapeHtml(post.title)}</h1>
      <p class="lead">${escapeHtml(post.excerpt || '')}</p>
    </section>
    <article class="article-body rich-content protected-content">${renderRichArticle(post.body || '')}</article>
  `;
}

function renderAboutPage() {
  const { about, site } = state.data;
  setHeroImage(about.image || site.aboutImage || '');
  $('#app').innerHTML = `
    <section class="page-hero ${about.image || site.aboutImage ? 'with-image' : ''}">
      <div class="eyebrow">Yazar</div>
      <h1>${escapeHtml(about.title || 'Hakkımda')}</h1>
      <p class="lead">${escapeHtml(about.subtitle || '')}</p>
    </section>
    <article class="article-body rich-content protected-content">${renderRichArticle(about.body || '')}</article>
  `;
}

function renderBookDetail(slug) {
  const book = state.data.books.find((b) => b.slug === slug);
  if (!book) return renderNotFound(t('bookNotFound'));
  const chapters = Array.isArray(book.chapters) ? book.chapters : [];
  const selectedIndex = Math.min(Math.max(state.selectedChapterIndex, 0), Math.max(chapters.length - 1, 0));
  state.selectedChapterIndex = selectedIndex;
  const chapter = chapters[selectedIndex] || { title: t('noChapter'), content: '' };
  const pages = paginateChapter(book, chapter, selectedIndex);
  const pageCount = Math.max(pages.length, 1);
  state.bookPageIndex = clampNumber(state.bookPageIndex, 0, pageCount - 1, 0);
  const progress = getBookProgress(book.slug);
  const savedIndex = progress ? clampNumber(progress.chapterIndex, 0, Math.max(chapters.length - 1, 0), 0) : -1;
  const savedPage = progress ? clampNumber(progress.pageIndex, 0, 999, 0) : 0;
  const currentPage = pages[state.bookPageIndex] || { blocks: [], number: 1 };
  const pageKey = `${book.slug}:${selectedIndex}:${state.bookPageIndex}`;
  const turnClass = state.lastPageKey && state.lastPageKey !== pageKey ? `turn-${state.pageTurnDirection || 'next'}` : '';
  state.lastPageKey = pageKey;
  setHeroImage(book.heroImage || book.backgroundImage || book.cover || '');
  const cover = book.cover || book.heroImage || '';
  $('#app').innerHTML = `
    <section class="page-hero ${book.heroImage || book.backgroundImage ? 'with-image' : ''}">
      <div class="eyebrow">${escapeHtml(book.category || t('book'))}</div>
      <h1>${escapeHtml(book.title)}</h1>
      <p class="lead">${escapeHtml(book.subtitle || book.summary || '')}</p>
      ${book.quote ? `<div class="quote">“${escapeHtml(book.quote)}”</div>` : ''}
    </section>
    <section class="book-layout ${state.readerFullscreen ? 'reader-fullscreen' : ''}">
      <aside class="book-side">
        <div class="book-side-cover" style="${bg(cover)}"></div>
        <div class="meta-row">
          ${book.status ? `<span class="badge">${escapeHtml(book.status)}</span>` : ''}
          <span class="badge">${chapters.length} ${t('chapters')}</span>
        </div>
        <p class="helper">${t('readerHelp')}</p>
        <div class="reader-actions">
          <button class="btn small primary" type="button" data-action="save-reading-progress" data-book="${escapeAttr(book.slug)}" data-index="${selectedIndex}">${t('markPlace')}</button>
          ${progress ? `<button class="btn small" type="button" data-action="clear-reading-progress" data-book="${escapeAttr(book.slug)}">${t('removeMark')}</button>` : ''}
          <button class="btn small" type="button" data-action="open-all-comments" data-book="${escapeAttr(book.slug)}">${t('allComments')}</button>
        </div>
        <div class="chapter-tabs">
          ${chapters.map((c, i) => renderChapterTab(book, c, i, selectedIndex, savedIndex, savedPage)).join('')}
        </div>
      </aside>
      <article class="reader protected-content book-reader ${state.readerFullscreen ? 'is-fullscreen' : ''}">
        <div class="reader-topbar">
          <div>
            <div class="eyebrow">${t('readingArea')}</div>
            <h2>${escapeHtml(chapter.title || t('chapter'))}</h2>
            <div class="reader-mode-note">${t('pageReaderMode')}</div>
          </div>
          <button class="btn small" type="button" data-action="toggle-fullscreen-reader">${state.readerFullscreen ? t('exitFullscreen') : t('fullscreen')}</button>
        </div>
        ${renderProgressPrompt(book, selectedIndex)}
        ${chapter.image ? `<div class="chapter-image" style="${bg(chapter.image)}"></div>` : ''}
        <div class="page-nav top">
          <button class="btn small" type="button" data-action="prev-reader-page" ${state.bookPageIndex <= 0 ? 'disabled' : ''}>‹ ${t('prevPage')}</button>
          <div class="page-jump">
            <span>${t('page')}</span>
            <input id="reader-page-jump" class="input small-input" type="number" min="1" max="${pageCount}" value="${state.bookPageIndex + 1}" />
            <span>/ ${pageCount}</span>
            <button class="btn small" type="button" data-action="jump-reader-page">${t('go')}</button>
          </div>
          <button class="btn small primary" type="button" data-action="next-reader-page" ${state.bookPageIndex >= pageCount - 1 ? 'disabled' : ''}>${t('nextPage')} ›</button>
        </div>
        <div class="book-page-stage">
          <div class="book-page-paper ${turnClass}">
            <div class="book-page-head">
              <span>${escapeHtml(book.title)}</span>
              <span>${escapeHtml(chapter.title || '')}</span>
            </div>
            <div class="book-page-content">
              ${renderPageBlocks(book, currentPage.blocks, selectedIndex)}
            </div>
            <div class="book-page-foot">
              <span>${t('page')} ${state.bookPageIndex + 1}</span>
              <span>${t('chapterPageCount').replace('{count}', pageCount)}</span>
            </div>
          </div>
        </div>
        <div class="page-nav bottom">
          <button class="btn small" type="button" data-action="prev-reader-page" ${state.bookPageIndex <= 0 ? 'disabled' : ''}>‹ ${t('prevPage')}</button>
          <button class="btn small primary" type="button" data-action="next-reader-page" ${state.bookPageIndex >= pageCount - 1 ? 'disabled' : ''}>${t('nextPage')} ›</button>
        </div>
      </article>
    </section>
  `;
  subscribeBookComments(book.slug);
}

function renderChapterTab(book, chapter, index, selectedIndex, savedIndex, savedPage) {
  const pageCount = chapterPageCount(book, chapter, index);
  const paragraphCount = richBlocks(chapter.content || '').filter((x) => x.kind !== 'media').length;
  const isSaved = index === savedIndex;
  const details = `${t('chapterPageCount').replace('{count}', pageCount)} · ${paragraphCount} ${t('paragraphs')}${isSaved ? ` · ${t('markedPage').replace('{page}', savedPage + 1)}` : ''}`;
  return `<button class="chapter-tab ${index === selectedIndex ? 'active' : ''} ${isSaved ? 'saved' : ''}" type="button" data-action="select-chapter" data-index="${index}">
    <span>${isSaved ? '📌 ' : ''}${escapeHtml(chapter.title || `${t('chapter')} ${index + 1}`)}</span>
    <small class="chapter-hover-detail">${escapeHtml(details)}</small>
  </button>`;
}

function chapterPageCount(book, chapter, chapterIndex) {
  return Math.max(1, paginateChapter(book, chapter, chapterIndex).length);
}

function paginateChapter(book, chapter, chapterIndex) {
  const rawBlocks = richBlocks(chapter.content || '');
  const blocks = [];
  let paragraphIndex = 0;
  rawBlocks.forEach((block) => {
    if (block.kind === 'media') blocks.push({ ...block, pageWeight: 380 });
    else blocks.push({ ...block, paragraphIndex: paragraphIndex++, pageWeight: Math.max(220, (block.text || '').length) });
  });
  if (chapter.topImages?.length) chapter.topImages.forEach((img) => blocks.unshift({ kind: 'media', html: `<figure class="chapter-break"><img src="${escapeAttr(normalizeAssetUrl(img))}" alt="Ara görsel" loading="lazy" /></figure>`, pageWeight: 420 }));
  if (chapter.bottomImages?.length) chapter.bottomImages.forEach((img) => blocks.push({ kind: 'media', html: `<figure class="chapter-break"><img src="${escapeAttr(normalizeAssetUrl(img))}" alt="Ara görsel" loading="lazy" /></figure>`, pageWeight: 420 }));
  const limit = state.readerFullscreen ? 2100 : 1500;
  const pages = [];
  let current = [];
  let weight = 0;
  blocks.forEach((block) => {
    const w = block.pageWeight || 300;
    if (current.length && weight + w > limit) {
      pages.push({ number: pages.length + 1, blocks: current });
      current = [];
      weight = 0;
    }
    current.push(block);
    weight += w;
  });
  if (current.length) pages.push({ number: pages.length + 1, blocks: current });
  return pages.length ? pages : [{ number: 1, blocks: [] }];
}

function renderPageBlocks(book, blocks, chapterIndex) {
  if (!blocks.length) return empty(t('emptyChapter'));
  return blocks.map((block) => {
    if (block.kind === 'media') return `<div class="rich-media-block">${block.html}</div>`;
    const paragraphIndex = Number(block.paragraphIndex || 0);
    const key = anchorKey(book.slug, chapterIndex, paragraphIndex);
    const count = state.commentCounts[key] || 0;
    return `
      <section class="paragraph-block page-paragraph" id="p-${chapterIndex}-${paragraphIndex}">
        <div class="rich-paragraph">${block.html}</div>
        <button class="comment-trigger" type="button" data-action="open-comments" data-book="${escapeAttr(book.slug)}" data-chapter-index="${chapterIndex}" data-paragraph-index="${paragraphIndex}" data-comment-key="${escapeAttr(key)}" aria-label="${escapeAttr(t('commentHere'))}">
          💬 ${count ? `<span class="count">${count}</span>` : ''}
        </button>
      </section>
    `;
  }).join('');
}

function renderDividerImages(images) {
  return (images || []).map(normalizeAssetUrl).filter(Boolean).map((url) => `<figure class="chapter-break"><img src="${escapeAttr(url)}" alt="Ara görsel" loading="lazy" /></figure>`).join('');
}

function renderChapterBlocks(book, chapter, chapterIndex) {
  const blocks = richBlocks(chapter.content || '');
  if (!blocks.length) return empty('Bu bölüme henüz metin eklenmedi.');
  return blocks.map((block, paragraphIndex) => {
    if (block.kind === 'media') return `<div class="rich-media-block">${block.html}</div>`;
    const key = anchorKey(book.slug, chapterIndex, paragraphIndex);
    const count = state.commentCounts[key] || 0;
    return `
      <section class="paragraph-block" id="p-${chapterIndex}-${paragraphIndex}">
        <div class="rich-paragraph">${block.html}</div>
        <button class="comment-trigger" type="button" data-action="open-comments" data-book="${escapeAttr(book.slug)}" data-chapter-index="${chapterIndex}" data-paragraph-index="${paragraphIndex}" data-comment-key="${escapeAttr(key)}" aria-label="Bu paragrafa yorum bırak">
          💬 ${count ? `<span class="count">${count}</span>` : ''}
        </button>
      </section>
    `;
  }).join('');
}

function richBlocks(content) {
  const raw = String(content || '').trim();
  if (!raw) return [];
  if (!looksLikeHtml(raw)) {
    return textToParagraphs(raw).map((text) => ({ kind: 'text', text, html: `<p>${inlineMarkdown(escapeHtml(text))}</p>` }));
  }
  const template = document.createElement('template');
  template.innerHTML = raw;
  const children = Array.from(template.content.childNodes).filter((node) => node.nodeType === 1 || String(node.textContent || '').trim());
  if (!children.length) return [];
  return children.map((node) => {
    if (node.nodeType === 3) {
      const text = node.textContent.trim();
      return text ? { kind: 'text', text, html: `<p>${escapeHtml(text)}</p>` } : null;
    }
    const html = sanitizeRichHtml(node.outerHTML || '');
    const tag = String(node.nodeName || '').toLowerCase();
    const kind = ['figure', 'img', 'hr'].includes(tag) || node.classList?.contains('chapter-break') ? 'media' : 'text';
    return { kind, text: node.textContent || '', html };
  }).filter(Boolean);
}

function renderRichArticle(content) {
  const blocks = richBlocks(content);
  return blocks.map((b) => b.html).join('') || empty('Metin eklenmedi.');
}

function looksLikeHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function sanitizeRichHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const allowedTags = new Set(['P','BR','STRONG','B','EM','I','U','S','SPAN','H2','H3','H4','BLOCKQUOTE','UL','OL','LI','FIGURE','FIGCAPTION','IMG','HR','DIV']);
  const allowedAttrs = new Set(['class','style','src','alt','loading']);
  template.content.querySelectorAll('*').forEach((el) => {
    if (!allowedTags.has(el.tagName)) {
      el.replaceWith(document.createTextNode(el.textContent || ''));
      return;
    }
    Array.from(el.attributes).forEach((attr) => {
      if (!allowedAttrs.has(attr.name)) el.removeAttribute(attr.name);
      if (attr.name === 'src' && /^javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
      if (attr.name === 'src') el.setAttribute('src', normalizeAssetUrl(attr.value));
      if (attr.name === 'style') el.setAttribute('style', cleanInlineStyle(attr.value));
    });
    if (el.tagName === 'IMG') {
      el.setAttribute('loading', 'lazy');
      el.setAttribute('alt', el.getAttribute('alt') || 'Ara görsel');
    }
  });
  return template.innerHTML;
}

function cleanInlineStyle(style) {
  return String(style || '')
    .split(';')
    .map((x) => x.trim())
    .filter((x) => /^(font-size|font-family|font-weight|font-style|text-align|color|background-color|line-height)\s*:/i.test(x))
    .join('; ');
}

function renderNotFound(message) {
  $('#app').innerHTML = `<section class="page-hero"><h1>Bulunamadı</h1><p class="lead">${escapeHtml(message)}</p><a class="btn" href="#/">Ana Sayfaya Dön</a></section>`;
}

function handleDocumentClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'continue-reading') event.preventDefault();
  if (action === 'open-login' || action === 'open-register') openLoginModal(action === 'open-register');
  if (action === 'logout') logout();
  if (action === 'open-profile') openProfileModal();
  if (action === 'select-chapter') {
    const index = Number(target.dataset.index || 0);
    sessionStorage.setItem(chapterSessionKey(), String(index));
    state.selectedChapterIndex = index;
    state.bookPageIndex = 0;
    state.manualChapterSelection = true;
    safeRender();
  }
  if (action === 'continue-reading') continueReading(target.dataset.book, target.dataset.index);
  if (action === 'save-reading-progress') saveReadingProgress(target.dataset.book, target.dataset.index);
  if (action === 'clear-reading-progress') clearReadingProgress(target.dataset.book);
  if (action === 'open-comments') openCommentsModal(target.dataset);
  if (action === 'open-all-comments') openAllCommentsModal(target.dataset.book);
  if (action === 'close-modal') closeModal();
  if (action === 'google-login') signInProvider('google');
  if (action === 'facebook-login') signInProvider('facebook');
  if (action === 'email-login') emailLogin(false);
  if (action === 'email-register') emailLogin(true);
  if (action === 'save-comment') saveComment(target.dataset);
  if (action === 'delete-comment') deleteComment(target.dataset.id);
  if (action === 'edit-comment') startEditComment(target.dataset.id);
  if (action === 'cancel-edit-comment') cancelEditComment(target.dataset.id);
  if (action === 'update-comment') updateComment(target.dataset.id);
  if (action === 'emoji-comment') appendEmoji(target.dataset.emoji || '');
  if (action === 'upload-avatar') uploadAvatar();
  if (action === 'toggle-theme') toggleTheme();
  if (action === 'toggle-lang') toggleLanguage();
  if (action === 'prev-reader-page') moveReaderPage(-1);
  if (action === 'next-reader-page') moveReaderPage(1);
  if (action === 'jump-reader-page') jumpReaderPage();
  if (action === 'toggle-fullscreen-reader') toggleReaderFullscreen();
}


function handleDocumentInput(event) {
  if (event.target?.id === 'comment-text') updateCommentCounter();
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target?.id === 'reader-page-jump') {
    event.preventDefault();
    jumpReaderPage();
  }
  const typing = !!event.target?.closest?.('input, textarea, select, [contenteditable="true"]');
  if (!typing && state.route.name === 'kitap') {
    if (event.key === 'ArrowRight') moveReaderPage(1);
    if (event.key === 'ArrowLeft') moveReaderPage(-1);
    if (event.key === 'Escape' && state.readerFullscreen) toggleReaderFullscreen();
  }
});

function openLoginModal(registerMode = false) {
  setModalImage(state.data.site.loginImage || state.data.site.heroImage || '');
  $('#modal-root').innerHTML = `
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal">
        <div class="modal-art"></div>
        <div class="modal-content">
          <div class="modal-head">
            <div>
              <div class="eyebrow">Okur hesabı</div>
              <h3>${registerMode ? 'Kayıt Ol' : 'Giriş Yap'}</h3>
            </div>
            <button class="close-btn" type="button" data-action="close-modal">×</button>
          </div>
          <div class="form-grid">
            <button class="btn primary" type="button" data-action="google-login">Google ile devam et</button>
            <button class="btn" type="button" data-action="facebook-login">Facebook ile devam et</button>
            <div class="divider">veya e-posta</div>
            <input class="input" id="auth-name" placeholder="Adın / görünen isim" autocomplete="name" />
            <input class="input" id="auth-email" type="email" placeholder="E-posta" autocomplete="email" />
            <input class="input" id="auth-password" type="password" placeholder="Şifre" autocomplete="current-password" />
            <div class="reader-actions">
              <button class="btn primary" type="button" data-action="email-login">Giriş Yap</button>
              <button class="btn" type="button" data-action="email-register">Yeni Hesap Oluştur</button>
            </div>
            <p class="helper">Google/Facebook girişlerinin çalışması için Firebase Authentication içinde bu sağlayıcıları etkinleştirmen gerekir.</p>
          </div>
        </div>
      </div>
    </div>`;
}

function openProfileModal() {
  if (!state.user) return openLoginModal();
  setModalImage(state.data.site.profileImage || state.data.site.heroImage || '');
  const avatar = getAvatarHtml(state.profile?.avatarURL || state.user.photoURL, state.user.displayName || state.user.email, 'avatar-large');
  $('#modal-root').innerHTML = `
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal">
        <div class="modal-art"></div>
        <div class="modal-content">
          <div class="modal-head">
            <div>
              <div class="eyebrow">Profil</div>
              <h3>Avatarını Değiştir</h3>
            </div>
            <button class="close-btn" type="button" data-action="close-modal">×</button>
          </div>
          <div class="profile-card">
            ${avatar}
            <div>
              <b>${escapeHtml(state.user.displayName || 'Okur')}</b><br />
              <span class="helper">${escapeHtml(state.user.email || '')}</span>
            </div>
            <input class="input" id="avatar-file" type="file" accept="image/*" />
            <button class="btn primary" type="button" data-action="upload-avatar">Yeni Avatarı Kaydet</button>
            <p class="helper">Ücretsiz kullanım için Firebase Storage devre dışı. Avatar küçük boyuta sıkıştırılıp Firestore profil kaydına yazılır.</p>
          </div>
        </div>
      </div>
    </div>`;
}

function openCommentsModal(dataset) {
  const book = state.data.books.find((b) => b.slug === dataset.book);
  if (!book) return;
  const chapterIndex = Number(dataset.chapterIndex || 0);
  const paragraphIndex = Number(dataset.paragraphIndex || 0);
  const chapter = (book.chapters || [])[chapterIndex] || {};
  const block = richBlocks(chapter.content || '').filter((x) => x.kind !== 'media')[paragraphIndex] || { text: '' };
  const paragraph = block.text || '';
  const key = anchorKey(book.slug, chapterIndex, paragraphIndex);
  setModalImage(state.data.site.commentImage || book.detailImage || book.cover || '');
  $('#modal-root').innerHTML = `
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal">
        <div class="modal-art"></div>
        <div class="modal-content">
          <div class="modal-head">
            <div>
              <div class="eyebrow">Paragraf yorumu</div>
              <h3>${escapeHtml(chapter.title || book.title)}</h3>
            </div>
            <button class="close-btn" type="button" data-action="close-modal">×</button>
          </div>
          <p class="helper"><b>Seçili yer:</b> ${escapeHtml(paragraph.slice(0, 180))}${paragraph.length > 180 ? '…' : ''}</p>
          <div class="form-grid">
            ${state.user ? commentComposer(book.slug, chapterIndex, paragraphIndex, key) : `<button class="btn primary" type="button" data-action="open-login">Yorum yazmak için giriş yap</button>`}
          </div>
          <div id="modal-comments" class="comment-list">${empty('Yorumlar yükleniyor...')}</div>
        </div>
      </div>
    </div>`;
  subscribeAnchorComments(key);
}

function commentComposer(bookSlug, chapterIndex, paragraphIndex, key) {
  return `
    <div class="emoji-row">${EMOJIS.map((emoji) => `<button type="button" data-action="emoji-comment" data-emoji="${escapeAttr(emoji)}">${emoji}</button>`).join('')}</div>
    <textarea class="textarea" id="comment-text" maxlength="1500" placeholder="Bu bölüme yorumunu yaz... Emoji bırakabilirsin."></textarea>
    <div class="helper" id="comment-counter">0 / 1500</div>
    <button class="btn primary" type="button" data-action="save-comment" data-book="${escapeAttr(bookSlug)}" data-chapter-index="${chapterIndex}" data-paragraph-index="${paragraphIndex}" data-comment-key="${escapeAttr(key)}">Yorumu Yayınla</button>
  `;
}

function updateCommentCounter() {
  const el = $('#comment-counter');
  if (el) el.textContent = `${$('#comment-text')?.value.length || 0} / 1500`;
}

function appendEmoji(emoji) {
  const area = $('#comment-text');
  if (!area) return;
  const start = area.selectionStart || area.value.length;
  const end = area.selectionEnd || area.value.length;
  area.value = area.value.slice(0, start) + emoji + area.value.slice(end);
  area.focus();
  area.selectionStart = area.selectionEnd = start + emoji.length;
  updateCommentCounter();
}

function openAllCommentsModal(bookSlug) {
  const book = state.data.books.find((b) => b.slug === bookSlug);
  if (!book) return;
  setModalImage(state.data.site.commentImage || book.detailImage || book.cover || '');
  $('#modal-root').innerHTML = `
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <div class="modal compact">
        <div class="modal-content">
          <div class="modal-head">
            <div>
              <div class="eyebrow">Okur yorumları</div>
              <h3>${escapeHtml(book.title)}</h3>
              <p class="helper">Bu kitap için bırakılan tüm yorumlar. Okur kendi yorumunu düzenleyebilir; site sahibi yorumu silebilir ama değiştiremez.</p>
            </div>
            <button class="close-btn" type="button" data-action="close-modal">×</button>
          </div>
          <div id="modal-comments" class="comment-list">${empty('Yorumlar yükleniyor...')}</div>
        </div>
      </div>
    </div>`;
  subscribeBookComments(bookSlug, true);
}

async function initFirebase() {
  const config = state.data.site.firebase || {};
  if (!config.apiKey || !config.projectId || !config.authDomain) {
    state.firebaseError = 'Firebase ayarları henüz girilmedi.';
    return;
  }
  try {
    const [appMod, authMod, storeMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js')
    ]);
    const app = appMod.initializeApp(config);
    const auth = authMod.getAuth(app);
    const db = storeMod.getFirestore(app);
    state.firebase = { app, auth, db, authMod, storeMod };
    state.firebaseReady = true;
    authMod.onAuthStateChanged(auth, async (user) => {
      state.user = user;
      if (user) {
        try { state.profile = await getOrCreateProfile(user); } catch (err) { console.warn('Profil okunamadı; temel kullanıcı bilgileri kullanılacak.', err); state.profile = { uid: user.uid, displayName: user.displayName || user.email || 'Okur', email: user.email || '', avatarURL: user.photoURL || '' }; }
        await loadReadingProgress(user.uid);
      } else {
        state.profile = null;
        state.readingProgress = {};
        state.readingProgressLoaded = false;
      }
      renderAuthArea();
      updateCommentBadges();
      if ($('#app')) safeRender();
      const list = $('#modal-comments');
      if (list && state.route.name === 'kitap') subscribeBookComments(state.route.params.slug, true);
    });
  } catch (err) {
    console.error(err);
    state.firebaseError = err.message || 'Firebase başlatılamadı.';
    console.warn('Firebase başlatılamadı; site yerel/güvenli modda devam ediyor.', err);
  }
}

async function getOrCreateProfile(user) {
  const { db, storeMod } = state.firebase;
  const ref = storeMod.doc(db, 'users', user.uid);
  const snap = await storeMod.getDoc(ref);
  if (snap.exists()) return snap.data();
  const profile = {
    uid: user.uid,
    displayName: user.displayName || user.email || 'Okur',
    email: user.email || '',
    avatarURL: user.photoURL || '',
    createdAt: storeMod.serverTimestamp()
  };
  await storeMod.setDoc(ref, profile, { merge: true });
  return { ...profile, createdAt: null };
}


async function loadReadingProgress(uid) {
  state.readingProgress = readCachedReadingProgress(uid);
  state.readingProgressLoaded = false;
  if (!state.firebaseReady || !uid) { state.readingProgressLoaded = true; return; }
  const { db, storeMod } = state.firebase;
  const progress = { ...state.readingProgress };

  // v10: Okuma işaretleri artık kullanıcı hesabının altında tutulur.
  // Bu yol Firestore kurallarında daha güvenlidir ve "Missing permissions" hatalarını azaltır.
  try {
    const personalSnap = await storeMod.getDocs(storeMod.collection(db, 'users', uid, 'readingProgress'));
    personalSnap.docs.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() };
      if (data.bookSlug) progress[data.bookSlug] = data;
    });
  } catch (err) {
    console.warn('Kullanıcıya ait okuma işaretleri okunamadı. Yerel kayıt kullanılacak:', err);
  }

  // Eski v7/v8/v9 kayıtları varsa okumayı dene. Bu başarısız olursa site çalışmaya devam eder.
  try {
    const q = storeMod.query(storeMod.collection(db, 'readingProgress'), storeMod.where('uid', '==', uid));
    const oldSnap = await storeMod.getDocs(q);
    oldSnap.docs.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() };
      if (data.bookSlug && !progress[data.bookSlug]) progress[data.bookSlug] = data;
    });
  } catch (err) {
    console.warn('Eski okuma işaretleri okunamadı; bu normal olabilir:', err);
  }

  state.readingProgress = progress;
  writeCachedReadingProgress(uid, progress);
  state.readingProgressLoaded = true;
}

function readingProgressCacheKey(uid) {
  return `readingProgress:${uid || 'anonymous'}`;
}

function readCachedReadingProgress(uid) {
  try {
    const raw = localStorage.getItem(readingProgressCacheKey(uid));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeCachedReadingProgress(uid, progress) {
  try {
    localStorage.setItem(readingProgressCacheKey(uid), JSON.stringify(progress || {}));
  } catch (_) {}
}

function getBookProgress(bookSlug) {
  if (!state.user || !bookSlug) return null;
  const progress = state.readingProgress?.[bookSlug];
  const book = state.data.books.find((b) => b.slug === bookSlug);
  if (!progress || !book) return null;
  const chapters = Array.isArray(book.chapters) ? book.chapters : [];
  const index = Number(progress.chapterIndex);
  if (!Number.isFinite(index) || index < 0 || index >= chapters.length) return null;
  return progress;
}

function readingProgressDocId(bookSlug) {
  return encodeURIComponent(String(bookSlug || 'kitap'));
}

function readingProgressRef(bookSlug) {
  const { db, storeMod } = state.firebase;
  return storeMod.doc(db, 'users', state.user.uid, 'readingProgress', readingProgressDocId(bookSlug));
}

async function saveReadingProgress(bookSlug, chapterIndexValue) {
  if (!state.user) return openLoginModal();
  const book = state.data.books.find((b) => b.slug === bookSlug);
  if (!book) return toast(t('bookNotFound'));
  const chapters = Array.isArray(book.chapters) ? book.chapters : [];
  const chapterIndex = clampNumber(chapterIndexValue, 0, Math.max(chapters.length - 1, 0), 0);
  const chapter = chapters[chapterIndex] || {};
  const pages = paginateChapter(book, chapter, chapterIndex);
  const pageIndex = clampNumber(state.bookPageIndex, 0, Math.max(pages.length - 1, 0), 0);
  const localCreatedAt = state.readingProgress?.[bookSlug]?.createdAt || new Date().toISOString();
  const payload = {
    uid: state.user.uid,
    bookSlug,
    bookTitle: book.title || '',
    chapterIndex,
    chapterTitle: chapter.title || `${t('chapter')} ${chapterIndex + 1}`,
    pageIndex,
    pageNumber: pageIndex + 1,
    totalPages: pages.length,
    totalChapters: chapters.length,
    progressPercent: chapters.length ? Math.round(((chapterIndex + 1) / chapters.length) * 100) : 0,
    updatedAt: new Date().toISOString(),
    createdAt: localCreatedAt
  };

  state.readingProgress[bookSlug] = payload;
  writeCachedReadingProgress(state.user.uid, state.readingProgress);
  state.selectedChapterIndex = chapterIndex;
  state.bookPageIndex = pageIndex;
  state.manualChapterSelection = true;
  safeRender();
  toast(`${t('placeSaved')}: ${payload.chapterTitle}, ${t('page')} ${payload.pageNumber}`);

  if (!state.firebaseReady) return;
  try {
    const { storeMod } = state.firebase;
    const snap = await storeMod.getDoc(readingProgressRef(bookSlug));
    const remotePayload = {
      uid: state.user.uid,
      bookSlug,
      bookTitle: book.title || '',
      chapterIndex,
      chapterTitle: payload.chapterTitle,
      pageIndex,
      pageNumber: pageIndex + 1,
      totalPages: pages.length,
      totalChapters: chapters.length,
      progressPercent: payload.progressPercent,
      updatedAt: storeMod.serverTimestamp()
    };
    if (!snap.exists()) remotePayload.createdAt = storeMod.serverTimestamp();
    await storeMod.setDoc(readingProgressRef(bookSlug), remotePayload, { merge: true });
  } catch (err) {
    // Okur bu hatayı görmesin: yerel kayıt zaten çalışıyor.
    console.warn('Okuma ilerlemesi Firebase’e yazılamadı; yerel kayıt kullanılacak.', err);
  }
}

async function clearReadingProgress(bookSlug) {
  if (!state.user) return openLoginModal();
  delete state.readingProgress[bookSlug];
  writeCachedReadingProgress(state.user.uid, state.readingProgress);
  sessionStorage.removeItem(chapterSessionKeyFor(bookSlug));
  state.manualChapterSelection = false;
  safeRender();
  toast(t('markRemoved'));
  if (!state.firebaseReady) return;
  try {
    await state.firebase.storeMod.deleteDoc(readingProgressRef(bookSlug));
  } catch (err) {
    console.warn('Okuma işareti Firebase’den silinemedi; yerel kayıt kaldırıldı.', err);
  }
}

function continueReading(bookSlug, chapterIndexValue) {
  const index = clampNumber(chapterIndexValue, 0, 999, 0);
  const progress = getBookProgress(bookSlug);
  state.bookPageIndex = progress ? clampNumber(progress.pageIndex, 0, 999, 0) : 0;
  sessionStorage.setItem(chapterSessionKeyFor(bookSlug), String(index));
  state.activeBookSlug = bookSlug || '';
  state.manualChapterSelection = true;
  state.selectedChapterIndex = index;
  if (state.route.name !== 'kitap' || state.route.params.slug !== bookSlug) {
    location.hash = `#/kitap/${bookSlug}`;
  } else {
    safeRender();
    setTimeout(() => document.querySelector('.reader')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
}

async function signInProvider(providerName) {
  if (!state.firebaseReady) return toast(state.firebaseError || 'Firebase ayarları eksik.');
  const { auth, authMod } = state.firebase;
  const provider = providerName === 'facebook' ? new authMod.FacebookAuthProvider() : new authMod.GoogleAuthProvider();
  try {
    await authMod.signInWithPopup(auth, provider);
    closeModal();
    toast('Giriş yapıldı.');
  } catch (err) {
    toast(firebaseMessage(err));
  }
}

async function emailLogin(register) {
  if (!state.firebaseReady) return toast(state.firebaseError || 'Firebase ayarları eksik.');
  const name = $('#auth-name')?.value.trim();
  const email = $('#auth-email')?.value.trim();
  const password = $('#auth-password')?.value;
  if (!email || !password) return toast('E-posta ve şifre gerekli.');
  const { auth, authMod } = state.firebase;
  try {
    const cred = register
      ? await authMod.createUserWithEmailAndPassword(auth, email, password)
      : await authMod.signInWithEmailAndPassword(auth, email, password);
    if (register && name) await authMod.updateProfile(cred.user, { displayName: name });
    closeModal();
    toast(register ? 'Hesap oluşturuldu.' : 'Giriş yapıldı.');
  } catch (err) {
    toast(firebaseMessage(err));
  }
}

async function logout() {
  if (!state.firebaseReady) return;
  await state.firebase.authMod.signOut(state.firebase.auth);
  toast('Çıkış yapıldı.');
}

async function uploadAvatar() {
  if (!state.user) return openLoginModal();
  if (!state.firebaseReady) return toast(state.firebaseError || 'Firebase ayarları eksik.');
  const file = $('#avatar-file')?.files?.[0];
  if (!file) return toast('Önce bir görsel seç.');
  if (!file.type.startsWith('image/')) return toast('Sadece görsel dosyası seçilebilir.');
  if (file.size > 3 * 1024 * 1024) return toast('Avatar 3 MB altında olmalı.');
  const { db, storeMod } = state.firebase;
  try {
    const avatarURL = await imageFileToDataURL(file, 220, 0.76);
    if (avatarURL.length > 240000) return toast('Avatar çok büyük kaldı. Daha küçük bir görsel seç.');
    await storeMod.setDoc(
      storeMod.doc(db, 'users', state.user.uid),
      { avatarURL, updatedAt: storeMod.serverTimestamp() },
      { merge: true }
    );
    state.profile = { ...(state.profile || {}), avatarURL };
    renderAuthArea();
    openProfileModal();
    toast('Avatar kaydedildi.');
  } catch (err) {
    toast(firebaseMessage(err));
  }
}

function imageFileToDataURL(file, maxSize = 220, quality = 0.76) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Görsel okunamadı.'));
    reader.onload = () => {
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Görsel işlenemedi.'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function saveComment(dataset) {
  if (!state.user) return openLoginModal();
  if (!state.firebaseReady) return toast(state.firebaseError || 'Firebase ayarları eksik.');
  const text = $('#comment-text')?.value.trim();
  if (!text) return toast('Yorum boş olamaz.');
  const book = state.data.books.find((b) => b.slug === dataset.book);
  const chapterIndex = Number(dataset.chapterIndex || 0);
  const paragraphIndex = Number(dataset.paragraphIndex || 0);
  const chapter = (book?.chapters || [])[chapterIndex] || {};
  const blocks = richBlocks(chapter.content || '').filter((x) => x.kind !== 'media');
  const anchorText = blocks[paragraphIndex]?.text || '';
  const { db, storeMod } = state.firebase;
  try {
    await storeMod.addDoc(storeMod.collection(db, 'comments'), {
      key: dataset.commentKey,
      bookSlug: dataset.book,
      bookTitle: book?.title || '',
      chapterIndex,
      chapterTitle: chapter.title || '',
      paragraphIndex,
      anchorPreview: anchorText.slice(0, 240),
      text,
      uid: state.user.uid,
      displayName: state.profile?.displayName || state.user.displayName || state.user.email || 'Okur',
      email: state.user.email || '',
      photoURL: state.profile?.avatarURL || state.user.photoURL || '',
      createdAt: storeMod.serverTimestamp(),
      updatedAt: null,
      editCount: 0,
      editedByName: ''
    });
    $('#comment-text').value = '';
    updateCommentCounter();
    toast('Yorum yayınlandı.');
  } catch (err) {
    toast(firebaseMessage(err));
  }
}

function subscribeAnchorComments(key) {
  cleanupModalSub();
  const root = $('#modal-comments');
  if (!state.firebaseReady) {
    root.innerHTML = empty(state.firebaseError || 'Yorum sistemi için Firebase kurulumu gerekli.');
    return;
  }
  const { db, storeMod } = state.firebase;
  const q = storeMod.query(storeMod.collection(db, 'comments'), storeMod.where('key', '==', key));
  state.modalUnsub = storeMod.onSnapshot(q, (snap) => {
    const comments = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort(sortComments);
    root.innerHTML = comments.map(renderCommentCard).join('') || empty('Bu paragrafta henüz yorum yok.');
  }, (err) => root.innerHTML = empty(firebaseMessage(err)));
}

function subscribeBookComments(bookSlug, renderModalOnly = false) {
  if (!state.firebaseReady) {
    if (renderModalOnly) $('#modal-comments').innerHTML = empty(state.firebaseError || 'Yorum sistemi için Firebase kurulumu gerekli.');
    return;
  }
  if (renderModalOnly) cleanupModalSub();
  if (!renderModalOnly && state.activeBookCommentsSlug === bookSlug && state.bookCommentUnsub) return;
  if (!renderModalOnly && state.bookCommentUnsub) state.bookCommentUnsub();
  const { db, storeMod } = state.firebase;
  const q = storeMod.query(storeMod.collection(db, 'comments'), storeMod.where('bookSlug', '==', bookSlug));
  const unsub = storeMod.onSnapshot(q, (snap) => {
    const comments = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort(sortComments);
    if (renderModalOnly) {
      const root = $('#modal-comments');
      if (root) root.innerHTML = comments.map(renderCommentCard).join('') || empty('Bu kitapta henüz yorum yok.');
    } else {
      state.activeBookCommentsSlug = bookSlug;
      const counts = {};
      comments.forEach((c) => { counts[c.key] = (counts[c.key] || 0) + 1; });
      state.commentCounts = counts;
      updateCommentBadges();
    }
  }, (err) => {
    if (renderModalOnly) $('#modal-comments').innerHTML = empty(firebaseMessage(err));
  });
  if (renderModalOnly) state.modalUnsub = unsub;
  else state.bookCommentUnsub = unsub;
}

function updateCommentBadges() {
  $$('.comment-trigger').forEach((btn) => {
    const count = state.commentCounts[btn.dataset.commentKey] || 0;
    const existing = $('.count', btn);
    if (count && existing) existing.textContent = count;
    else if (count && !existing) btn.insertAdjacentHTML('beforeend', `<span class="count">${count}</span>`);
    else if (!count && existing) existing.remove();
  });
}

async function deleteComment(id) {
  if (!isAdmin()) return toast('Yorumu yalnızca site sahibi silebilir.');
  if (!state.firebaseReady) return toast(state.firebaseError || 'Firebase ayarları eksik.');
  try {
    await state.firebase.storeMod.deleteDoc(state.firebase.storeMod.doc(state.firebase.db, 'comments', id));
    toast('Yorum silindi.');
  } catch (err) {
    toast(firebaseMessage(err));
  }
}

function renderCommentCard(comment) {
  const avatar = getAvatarHtml(comment.photoURL, comment.displayName || comment.email || 'Okur', 'avatar');
  const canDelete = isAdmin();
  const canEdit = state.user && state.user.uid === comment.uid;
  const updated = comment.updatedAt?.toDate ? comment.updatedAt.toDate() : comment.updatedAt;
  return `
    <article class="comment-card" data-comment-card="${escapeAttr(comment.id)}">
      <div class="comment-top">
        <div class="comment-user">
          ${avatar}
          <div>
            <b>${escapeHtml(comment.displayName || 'Okur')}</b><br />
            <span class="helper">${formatDateTime(comment.createdAt?.toDate ? comment.createdAt.toDate() : comment.createdAt)}</span>
          </div>
        </div>
        <div class="row-actions">
          ${canEdit ? `<button class="btn small" type="button" data-action="edit-comment" data-id="${escapeAttr(comment.id)}">Düzenle</button>` : ''}
          ${canDelete ? `<button class="btn small danger" type="button" data-action="delete-comment" data-id="${escapeAttr(comment.id)}">Sil</button>` : ''}
        </div>
      </div>
      <div class="comment-place">${escapeHtml(comment.chapterTitle || '')} · Paragraf ${Number(comment.paragraphIndex ?? 0) + 1}</div>
      ${comment.anchorPreview ? `<p class="helper">“${escapeHtml(comment.anchorPreview)}${comment.anchorPreview.length >= 240 ? '…' : ''}”</p>` : ''}
      <p class="comment-text" data-original="${escapeAttr(comment.text || '')}">${escapeHtml(comment.text || '')}</p>
      ${updated ? `<div class="edited-note">Yorum sahibi tarafından düzeltildi: ${formatDateTime(updated)}${comment.editCount ? ` · ${Number(comment.editCount)} düzenleme` : ''}</div>` : ''}
    </article>
  `;
}

function startEditComment(id) {
  const card = $(`[data-comment-card="${cssEscape(id)}"]`);
  if (!card) return;
  const p = $('.comment-text', card);
  const value = p?.dataset.original || p?.textContent || '';
  p.outerHTML = `
    <div class="comment-edit-box">
      <textarea class="textarea" id="edit-comment-${escapeAttr(id)}" maxlength="1500">${escapeHtml(value)}</textarea>
      <div class="reader-actions">
        <button class="btn primary small" type="button" data-action="update-comment" data-id="${escapeAttr(id)}">Kaydet</button>
        <button class="btn small" type="button" data-action="cancel-edit-comment" data-id="${escapeAttr(id)}">Vazgeç</button>
      </div>
    </div>`;
}

function cancelEditComment(id) {
  const card = $(`[data-comment-card="${cssEscape(id)}"]`);
  const box = $('.comment-edit-box', card);
  const value = $(`#edit-comment-${cssEscape(id)}`)?.value || '';
  if (box) box.outerHTML = `<p class="comment-text" data-original="${escapeAttr(value)}">${escapeHtml(value)}</p>`;
}

async function updateComment(id) {
  if (!state.user) return openLoginModal();
  if (!state.firebaseReady) return toast(state.firebaseError || 'Firebase ayarları eksik.');
  const text = $(`#edit-comment-${cssEscape(id)}`)?.value.trim();
  if (!text) return toast('Yorum boş olamaz.');
  try {
    const { db, storeMod } = state.firebase;
    const ref = storeMod.doc(db, 'comments', id);
    const snap = await storeMod.getDoc(ref);
    if (!snap.exists()) return toast('Yorum bulunamadı.');
    const old = snap.data();
    if (old.uid !== state.user.uid) return toast('Yalnızca kendi yorumunu düzenleyebilirsin.');
    await storeMod.updateDoc(ref, {
      text,
      updatedAt: storeMod.serverTimestamp(),
      editCount: Number(old.editCount || 0) + 1,
      editedByName: state.profile?.displayName || state.user.displayName || state.user.email || 'Okur'
    });
    toast('Yorum güncellendi.');
  } catch (err) {
    toast(firebaseMessage(err));
  }
}

function isAdmin() {
  const email = (state.user?.email || '').toLowerCase();
  return !!email && (state.data.site.adminEmails || []).map((x) => String(x).toLowerCase()).includes(email);
}

function closeModal() {
  cleanupModalSub();
  $('#modal-root').innerHTML = '';
}

function cleanupModalSub() {
  if (state.modalUnsub) state.modalUnsub();
  state.modalUnsub = null;
}

function chapterSessionKey() {
  return chapterSessionKeyFor(state.route.params.slug);
}

function chapterSessionKeyFor(bookSlug) {
  return `chapter:${bookSlug || 'none'}`;
}

function anchorKey(bookSlug, chapterIndex, paragraphIndex) {
  return `${bookSlug}::c${chapterIndex}::p${paragraphIndex}`;
}

function textToParagraphs(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((p) => p.replace(/^#+\s*/gm, '').trim())
    .filter(Boolean);
}

function renderRichArticleText(text) {
  const paragraphs = textToParagraphs(text);
  return paragraphs.map((p) => `<p>${inlineMarkdown(escapeHtml(p))}</p>`).join('') || empty('Metin eklenmedi.');
}

function inlineMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

function normalizeAssetUrl(value) {
  let url = String(value || '').trim().replace(/\\/g, '/');
  if (!url) return '';
  if (/^(data:|blob:|https?:\/\/|\/\/)/i.test(url)) return url;
  url = url.replace(/^\.\//, '');
  url = url.replace(/^dist\//i, '');
  url = url.replace(/^public\//i, '');
  url = url.replace(/^src\//i, '');
  url = url.replace(/^\/src\//i, '/');
  url = url.replace(/^\/dist\//i, '/');
  if (/^assets\//i.test(url)) return '/' + url;
  if (/^uploads\//i.test(url)) return '/assets/' + url;
  if (/^[^/]+\.(png|jpe?g|webp|gif|svg|avif|mp3|m4a|ogg|wav)$/i.test(url)) return '/assets/uploads/' + url;
  return url.startsWith('/') ? url : '/' + url;
}
function bg(url) {
  const safeUrl = normalizeAssetUrl(url);
  return safeUrl ? `background-image: url('${escapeCssUrl(safeUrl)}')` : '';
}
function setHeroImage(url) {
  const safeUrl = normalizeAssetUrl(url);
  document.documentElement.style.setProperty('--hero-image', safeUrl ? `url('${escapeCssUrl(safeUrl)}')` : 'none');
}
function setModalImage(url) {
  const safeUrl = normalizeAssetUrl(url);
  document.documentElement.style.setProperty('--modal-image', safeUrl ? `url('${escapeCssUrl(safeUrl)}')` : 'none');
}
function applySiteTheme() {
  const site = state.data.site || {};
  const bgUrl = normalizeAssetUrl(site.backgroundImage);
  document.body.classList.toggle('has-bg', !!bgUrl);
  document.body.classList.toggle('theme-dark', state.theme === 'dark');
  document.documentElement.style.setProperty('--site-bg', bgUrl ? `url('${escapeCssUrl(bgUrl)}')` : 'none');
  const fonts = site.fonts || {};
  document.documentElement.style.setProperty('--sans', normalizeFont(fonts.bodyFont || "Inter, system-ui, sans-serif"));
  document.documentElement.style.setProperty('--serif', normalizeFont(fonts.titleFont || "Cormorant Garamond, Georgia, serif"));
  document.documentElement.style.setProperty('--reader-font', normalizeFont(fonts.readerFont || "Georgia, serif"));
  document.documentElement.style.setProperty('--base-font-size', `${clampNumber(fonts.baseSize, 13, 22, 16)}px`);
  document.documentElement.style.setProperty('--reader-font-size', `${clampNumber(fonts.readerSize, 15, 30, 20)}px`);
  document.documentElement.style.setProperty('--reader-line-height', String(clampNumber(fonts.lineHeight, 1.3, 2.4, 1.9)));
}

function normalizeFont(value) {
  return String(value || '').replace(/[;{}<>]/g, '') || 'inherit';
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function moveReaderPage(delta) {
  const book = state.data.books.find((b) => b.slug === state.route.params.slug);
  const chapter = book?.chapters?.[state.selectedChapterIndex];
  if (!book || !chapter) return;
  const max = Math.max(paginateChapter(book, chapter, state.selectedChapterIndex).length - 1, 0);
  const next = clampNumber(state.bookPageIndex + delta, 0, max, 0);
  if (next === state.bookPageIndex) return;
  state.pageTurnDirection = delta > 0 ? 'next' : 'prev';
  state.bookPageIndex = next;
  safeRender();
  setTimeout(() => document.querySelector('.book-page-stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
}

function jumpReaderPage() {
  const input = $('#reader-page-jump');
  const book = state.data.books.find((b) => b.slug === state.route.params.slug);
  const chapter = book?.chapters?.[state.selectedChapterIndex];
  if (!input || !book || !chapter) return;
  const max = Math.max(paginateChapter(book, chapter, state.selectedChapterIndex).length - 1, 0);
  const next = clampNumber(Number(input.value) - 1, 0, max, 0);
  state.pageTurnDirection = next >= state.bookPageIndex ? 'next' : 'prev';
  state.bookPageIndex = next;
  safeRender();
}

function toggleReaderFullscreen() {
  state.readerFullscreen = !state.readerFullscreen;
  document.body.classList.toggle('reader-lock', state.readerFullscreen);
  safeRender();
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('siteTheme', state.theme);
  applySiteTheme();
  renderShell();
  safeRender();
}

function toggleLanguage() {
  state.lang = state.lang === 'tr' ? 'en' : 'tr';
  localStorage.setItem('siteLang', state.lang);
  applyLanguage();
  renderShell();
  safeRender();
}

function applyLanguage() {
  document.documentElement.lang = state.lang === 'en' ? 'en' : 'tr';
}

const I18N = {
  tr: {
    home: 'Ana Sayfa', books: 'Kitaplar', posts: 'Paylaşımlar', about: 'Hakkımda', login: 'Giriş Yap', register: 'Kayıt Ol', logout: 'Çıkış', theme: 'Tema',
    book: 'Kitap', chapters: 'Bölüm', chapter: 'Bölüm', noChapter: 'Bölüm yok', bookNotFound: 'Kitap bulunamadı.', emptyChapter: 'Bu sayfada metin yok.',
    readerHelp: 'Bölümlerin üzerine gelince sayfa sayısı ve detaylar görünür. Giriş yaptıysan kaldığın sayfayı işaretleyebilirsin.',
    markPlace: 'Kaldığım Yeri İşaretle', removeMark: 'İşareti Kaldır', allComments: 'Tüm Yorumları Gör', readingArea: 'Okuma alanı', fullscreen: 'Tam Ekran Oku', exitFullscreen: 'Tam Ekrandan Çık',
    prevPage: 'Önceki Sayfa', nextPage: 'Sonraki Sayfa', page: 'Sayfa', go: 'Git', chapterPageCount: '{count} sayfa', paragraphs: 'paragraf', markedPage: 'işaretli sayfa {page}', commentHere: 'Bu paragrafa yorum bırak', placeSaved: 'Kaldığın yer kaydedildi', markRemoved: 'Kaldığın yer işareti kaldırıldı', savedPlace: 'Kaldığın kayıtlı yer', pageReaderMode: 'Sayfa sayfa kitap modu açık. Ok tuşlarıyla da sayfa çevirebilirsin.'
  },
  en: {
    home: 'Home', books: 'Books', posts: 'Posts', about: 'About', login: 'Log in', register: 'Sign up', logout: 'Log out', theme: 'Theme',
    book: 'Book', chapters: 'Chapters', chapter: 'Chapter', noChapter: 'No chapter', bookNotFound: 'Book not found.', emptyChapter: 'No text on this page.',
    readerHelp: 'Hover over chapters to see page count and details. Logged-in readers can mark the exact page they left off.',
    markPlace: 'Mark My Place', removeMark: 'Remove Mark', allComments: 'See All Comments', readingArea: 'Reading area', fullscreen: 'Read Full Screen', exitFullscreen: 'Exit Full Screen',
    prevPage: 'Previous Page', nextPage: 'Next Page', page: 'Page', go: 'Go', chapterPageCount: '{count} pages', paragraphs: 'paragraphs', markedPage: 'marked page {page}', commentHere: 'Comment on this paragraph', placeSaved: 'Your place was saved', markRemoved: 'Reading mark removed', savedPlace: 'Saved place', pageReaderMode: 'Page-by-page reading mode is active. You can also turn pages with arrow keys.'
  }
};

function t(key) {
  return (I18N[state.lang] && I18N[state.lang][key]) || I18N.tr[key] || key;
}

function getAvatarHtml(url, name = '', cls = 'avatar') {
  if (url) return `<span class="${cls}"><img src="${escapeAttr(url)}" alt="" /></span>`;
  const initials = String(name || 'O').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'O';
  return `<span class="${cls}">${escapeHtml(initials)}</span>`;
}

function empty(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function formatDateTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function sortComments(a, b) {
  const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
  const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
  return tb - ta;
}

function firebaseMessage(err) {
  const code = err?.code || '';
  if (code.includes('auth/popup-closed')) return 'Giriş penceresi kapatıldı.';
  if (code.includes('auth/unauthorized-domain')) return 'Firebase içinde bu site alan adı yetkilendirilmemiş.';
  if (code.includes('auth/operation-not-allowed')) return 'Bu giriş yöntemi Firebase içinde etkin değil.';
  if (code.includes('permission-denied')) return 'Bu işlem için yetkin yok veya Firebase kuralları engelledi. Firestore rules dosyasını güncelle.';
  return err?.message || 'İşlem tamamlanamadı.';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#096;'); }
function escapeCssUrl(value) { return String(value || '').replace(/[\\'"()]/g, ''); }
function cssEscape(value) { return (window.CSS && CSS.escape) ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.remove('show'), 3800);
}

function setRouteAudio() {
  const site = state.data.site;
  let track = site.audio?.defaultTrack || '';
  const name = state.route.name;
  if (name === 'home' && site.audio?.homeTrack) track = site.audio.homeTrack;
  if ((name === 'kitaplar' || name === 'kitap') && site.audio?.booksTrack) track = site.audio.booksTrack;
  if ((name === 'paylasimlar' || name === 'paylasim') && site.audio?.postsTrack) track = site.audio.postsTrack;
  if (name === 'hakkimda' && site.audio?.aboutTrack) track = site.audio.aboutTrack;
  if (name === 'kitap') {
    const book = state.data.books.find((b) => b.slug === state.route.params.slug);
    if (book?.audioTrack) track = book.audioTrack;
    const chapter = book?.chapters?.[state.selectedChapterIndex];
    if (chapter?.audioTrack) track = chapter.audioTrack;
  }
  if (name === 'paylasim') {
    const post = state.data.posts.find((p) => p.slug === state.route.params.slug);
    if (post?.audioTrack) track = post.audioTrack;
  }
  track = normalizeAssetUrl(track);
  if (track !== state.currentAudioTrack) {
    state.currentAudioTrack = track;
    if (state.audioActive) startAudio();
  }
}

async function toggleAudio() {
  state.audioActive = !state.audioActive;
  $('#audio-control')?.classList.toggle('active', state.audioActive);
  if (state.audioActive) await startAudio();
  else stopAudio();
}

async function startAudio() {
  stopAudio();
  const volume = Number(state.data.site.audio?.volume ?? 0.18);
  if (state.currentAudioTrack) {
    state.audioElement = new Audio(normalizeAssetUrl(state.currentAudioTrack));
    state.audioElement.loop = true;
    state.audioElement.volume = Math.max(0, Math.min(1, volume));
    try { await state.audioElement.play(); }
    catch { toast('Tarayıcı otomatik sesi engelledi. Ses düğmesine tekrar bas.'); }
    return;
  }
  if (state.data.site.audio?.enableBuiltInAmbient) startAmbient(volume);
}

function stopAudio() {
  if (state.audioElement) {
    state.audioElement.pause();
    state.audioElement = null;
  }
  state.ambientNodes.forEach((node) => {
    try { node.stop?.(); node.disconnect?.(); } catch {}
  });
  state.ambientNodes = [];
}

function startAmbient(volume) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = state.audioContext || new AudioContext();
  state.audioContext = ctx;
  if (ctx.state === 'suspended') ctx.resume();
  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(.25, volume));
  master.connect(ctx.destination);
  const freqs = [196, 246.94, 293.66];
  state.ambientNodes.push(master);
  freqs.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0.035 + index * 0.006;
    lfo.type = 'sine';
    lfo.frequency.value = 0.035 + index * 0.011;
    lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    lfo.start();
    state.ambientNodes.push(osc, gain, lfo, lfoGain);
  });
}
