/**
 * ════════════════════════════════════════════
 * INFINIVERSAL · app.js
 * PWA offline para poetas y compositores
 * ════════════════════════════════════════════
 */

'use strict';

/* ══════════════════════════════════════════
   MÓDULO: STORAGE
   Toda la persistencia va a localStorage.
══════════════════════════════════════════ */
const Storage = (() => {
  const NOTES_KEY    = 'infiniversal_notes';
  const SETTINGS_KEY = 'infiniversal_settings';
  const FIRST_KEY    = 'infiniversal_first_run';

  const defaults = { theme:'dark', zoom:1, richText:false, metric:false };

  const getAllNotes   = () => { try { return JSON.parse(localStorage.getItem(NOTES_KEY)) || []; } catch { return []; } };
  const saveNotes    = n  => localStorage.setItem(NOTES_KEY, JSON.stringify(n));
  const getSettings  = () => { try { return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }; } catch { return { ...defaults }; } };
  const saveSettings = s  => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  const isFirstRun   = () => localStorage.getItem(FIRST_KEY) !== 'done';
  const markFirstRun = () => localStorage.setItem(FIRST_KEY, 'done');

  return { getAllNotes, saveNotes, getSettings, saveSettings, isFirstRun, markFirstRun };
})();


/* ══════════════════════════════════════════
   MÓDULO: INSTALL (PWA)

   Cómo funciona beforeinstallprompt:
   - Chrome/Edge lo disparan automáticamente
     cuando la app cumple los criterios PWA
     (HTTPS + manifest + SW).
   - El evento puede llegar ANTES o DESPUÉS
     de que el usuario pulse el botón, por eso
     lo guardamos globalmente en cuanto llega.
   - En iOS Safari este evento NO existe;
     se muestran instrucciones manuales.
   - El botón de instalar vive en DOS sitios:
     (a) modal flotante tras el tutorial,
     (b) sección "Instalar app" en Ajustes.
     Ambos llaman a la misma función triggerPrompt().
══════════════════════════════════════════ */
const Install = (() => {

  // El prompt del navegador se guarda aquí en cuanto llega
  let deferredPrompt = null;

  // Detectar iOS (Safari no tiene beforeinstallprompt)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

  // ¿Ya está instalada como PWA standalone?
  const isInstalled = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  // ── Elementos del modal flotante ──
  const overlayEl    = document.getElementById('install-prompt');
  const btnAccept    = document.getElementById('install-accept');
  const btnDismiss   = document.getElementById('install-dismiss');
  const btnClose     = document.getElementById('install-close');
  const iosHint      = document.getElementById('ios-hint');

  // ── Elementos del panel Ajustes ──
  const stateNative      = document.getElementById('install-state-native');
  const stateIos         = document.getElementById('install-state-ios');
  const stateDone        = document.getElementById('install-state-done');
  const stateUnsupported = document.getElementById('install-state-unsupported');
  const stateWaiting     = document.getElementById('install-state-waiting');
  const btnInstallSettings = document.getElementById('btn-install-settings');

  // ── Capturar el evento del navegador ──────────────────────────
  // IMPORTANTE: este listener se registra lo antes posible (top-level)
  // para no perder el evento si Chrome lo dispara pronto.
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();       // Evitar el mini-banner automático de Chrome
    deferredPrompt = e;       // Guardarlo para usarlo cuando el usuario pulse
    updateSettingsState();    // Actualizar la sección de Ajustes si ya estaba abierta
  });

  // Cuando la instalación se completa exitosamente
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideModal();
    updateSettingsState();
  });

  // ── Lanzar el diálogo nativo de instalación ───────────────────
  async function triggerPrompt(callerBtn) {
    if (!deferredPrompt) return false;

    // Feedback visual en el botón mientras espera
    const originalText = callerBtn ? callerBtn.textContent : '';
    if (callerBtn) { callerBtn.textContent = 'Abriendo...'; callerBtn.disabled = true; }

    try {
      await deferredPrompt.prompt();                    // Mostrar el diálogo del navegador
      const { outcome } = await deferredPrompt.userChoice; // Esperar la decisión
      deferredPrompt = null;                            // Ya no se puede reutilizar

      if (outcome === 'dismissed') {
        localStorage.setItem('infiniversal_install_dismissed', '1');
      }
      return outcome === 'accepted';
    } catch (err) {
      console.warn('[Install] Error en prompt():', err);
      return false;
    } finally {
      if (callerBtn) { callerBtn.textContent = originalText; callerBtn.disabled = false; }
      updateSettingsState();
    }
  }

  // ── Modal flotante ─────────────────────────────────────────────
  function hideModal() { overlayEl.classList.add('hidden'); }

  function maybeShow() {
    // No molestar si ya está instalada o si ya rechazó antes
    if (isInstalled()) return;
    if (localStorage.getItem('infiniversal_install_dismissed') === '1') return;

    if (deferredPrompt) {
      // Chrome/Edge: prompt nativo listo
      iosHint.classList.add('hidden');
      btnAccept.style.display = '';
      overlayEl.classList.remove('hidden');
    } else if (isIOS) {
      // Safari iOS: instrucciones manuales
      iosHint.classList.remove('hidden');
      btnAccept.style.display = 'none';
      overlayEl.classList.remove('hidden');
    }
    // Otros navegadores sin soporte: no mostrar nada
  }

  // Botón "Instalar ahora" del modal flotante
  btnAccept.addEventListener('click', async () => {
    const ok = await triggerPrompt(btnAccept);
    if (ok) hideModal();
    else hideModal(); // Cerrar de todos modos
  });
  btnDismiss.addEventListener('click', () => {
    hideModal();
    localStorage.setItem('infiniversal_install_dismissed', '1');
  });
  btnClose.addEventListener('click', () => {
    hideModal();
    localStorage.setItem('infiniversal_install_dismissed', '1');
  });

  // ── Estado en panel de Ajustes ─────────────────────────────────
  // Muestra el estado correcto según el contexto del navegador
  function updateSettingsState() {
    // Ocultar todos
    [stateNative, stateIos, stateDone, stateUnsupported, stateWaiting].forEach(el => {
      if (el) el.classList.add('hidden');
    });

    if (isInstalled()) {
      if (stateDone) stateDone.classList.remove('hidden');
    } else if (deferredPrompt) {
      // Prompt listo: mostrar botón de instalación
      if (stateNative) stateNative.classList.remove('hidden');
    } else if (isIOS) {
      // Safari iOS: instrucciones paso a paso
      if (stateIos) stateIos.classList.remove('hidden');
    } else if (typeof BeforeInstallPromptEvent !== 'undefined' || /android/i.test(navigator.userAgent)) {
      // Android Chrome/Edge pero el prompt aún no ha llegado
      // (puede tardar unos segundos en cumplirse los criterios PWA)
      if (stateWaiting) stateWaiting.classList.remove('hidden');
    } else {
      // Navegador sin soporte (Firefox, etc.)
      if (stateUnsupported) stateUnsupported.classList.remove('hidden');
    }
  }

  // Botón instalar dentro de Ajustes
  if (btnInstallSettings) {
    btnInstallSettings.addEventListener('click', async () => {
      const ok = await triggerPrompt(btnInstallSettings);
      if (ok) {
        // Cerrar el modal de ajustes también
        document.getElementById('settings-modal').classList.add('hidden');
      }
    });
  }

  // Llamado cuando se abre el modal de Ajustes
  function initSettingsState() { updateSettingsState(); }

  return { maybeShow, initSettingsState };
})();


/* ══════════════════════════════════════════
   MÓDULO: SYLLABLES
   Contador de sílabas en español.
   Algoritmo basado en reglas fonológicas:
   diptongos, vocales fuertes/débiles.
══════════════════════════════════════════ */
const Syllables = (() => {
  const VOWELS = 'aeiouáéíóúüAEIOUÁÉÍÓÚÜ';
  const STRONG = 'aeoáéóAEOÁÉÓ';
  const WEAK   = 'iuüíúIUÜÍÚ';
  // Diptongos válidos en español
  const DIPHTHONGS = new Set([
    'ai','au','ei','eu','oi','ou','ia','ie','io','iu','ua','ue','ui','uo',
    'ái','áu','éi','éu','ói','íu','úi','iá','ié','ió','iú','uá','ué','uó','üe','üi'
  ]);

  const isVowel  = c => VOWELS.includes(c);
  const isStrong = c => STRONG.includes(c);

  function countWord(word) {
    if (!word) return 0;
    word = word.toLowerCase().normalize('NFC');
    let count = 0, i = 0;
    while (i < word.length) {
      if (isVowel(word[i])) {
        count++;
        if (i + 1 < word.length && isVowel(word[i+1])) {
          const pair = word[i] + word[i+1];
          // Si forman diptongo, cuentan como una sola sílaba
          if (DIPHTHONGS.has(pair)) { i++; }
          // Si ambas son fuertes (hiato), cada una es sílaba → dejar contar separado
        }
      }
      i++;
    }
    return Math.max(1, count);
  }

  function countText(text) {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).reduce((sum, w) => {
      const clean = w.replace(/[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ]/g, '');
      return sum + (clean ? countWord(clean) : 0);
    }, 0);
  }

  function verseName(n) {
    const names = {
      1:'Monosílabo',2:'Bisílabo',3:'Trisílabo',4:'Tetrasílabo',
      5:'Pentasílabo',6:'Hexasílabo',7:'Heptasílabo',8:'Octosílabo',
      9:'Eneasílabo',10:'Decasílabo',11:'Endecasílabo',12:'Dodecasílabo',
      13:'Tridecasílabo',14:'Alejandrino'
    };
    return names[n] || `${n} sílabas`;
  }

  function countWords(text) {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  return { countText, verseName, countWords };
})();


/* ══════════════════════════════════════════
   MÓDULO: EDITOR HISTORY
   Pila de deshacer/rehacer para el editor.
══════════════════════════════════════════ */
const EditorHistory = (() => {
  let stack = [], index = -1, timer = null;

  function save(text) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      stack = stack.slice(0, index + 1);
      stack.push(text);
      if (stack.length > 100) stack.shift();
      index = stack.length - 1;
    }, 300);
  }

  function undo() { return index > 0 ? stack[--index] : null; }
  function redo() { return index < stack.length - 1 ? stack[++index] : null; }
  function reset(text) { stack = [text]; index = 0; clearTimeout(timer); }

  return { save, undo, redo, reset };
})();


/* ══════════════════════════════════════════
   MÓDULO: POEM STRUCTURES
   Definición de estructuras poéticas clásicas.
══════════════════════════════════════════ */
const PoemStructures = {
  soneto:  { name:'Soneto',     stanzas:[{label:'1.er Cuarteto',verses:4,hint:'ABBA · 11 sílabas'},{label:'2.º Cuarteto',verses:4,hint:'ABBA · 11 sílabas'},{label:'1.er Terceto',verses:3,hint:'CDC · libre'},{label:'2.º Terceto',verses:3,hint:'DCD · libre'}] },
  cuarteto:{ name:'Cuarteto',   stanzas:[{label:'Cuarteto',verses:4,hint:'ABBA · versos endecasílabos'}] },
  lira:    { name:'Lira',       stanzas:[{label:'Lira',verses:5,hint:'7-11-7-7-11 sílabas · rima aBabB'}] },
  haiku:   { name:'Haiku',      stanzas:[{label:'Haiku',verses:3,hint:'5 síl. · 7 síl. · 5 síl.'}] },
  silva:   { name:'Silva',      stanzas:[{label:'Silva',verses:0,hint:'Heptasílabos y endecasílabos libres'}] },
  libre:   { name:'Verso libre',stanzas:[{label:'',verses:0,hint:'Sin estructura fija · tu ritmo, tus reglas.'}] }
};


/* ══════════════════════════════════════════
   MÓDULO: TUTORIAL
   Onboarding de 4 pasos en la primera visita.
══════════════════════════════════════════ */
const Tutorial = (() => {
  let step = 1;
  const TOTAL = 4;

  const overlay = document.getElementById('tutorial-overlay');
  const btnNext = document.getElementById('tutorial-next');
  const btnPrev = document.getElementById('tutorial-prev');
  const btnSkip = document.getElementById('tutorial-skip');

  function show() { overlay.classList.remove('hidden'); updateUI(); }

  function hide() {
    overlay.classList.add('hidden');
    Storage.markFirstRun();
    // Intentar mostrar el prompt de instalación tras el tutorial
    setTimeout(() => Install.maybeShow(), 800);
  }

  function updateUI() {
    document.querySelectorAll('.tutorial-step').forEach(el =>
      el.classList.toggle('active', parseInt(el.dataset.step) === step));
    document.querySelectorAll('.dot').forEach(el =>
      el.classList.toggle('active', parseInt(el.dataset.dot) === step));
    btnPrev.classList.toggle('hidden', step === 1);
    btnNext.textContent = step === TOTAL ? 'Comenzar' : 'Siguiente';
  }

  btnNext.addEventListener('click', () => { step < TOTAL ? (step++, updateUI()) : hide(); });
  btnPrev.addEventListener('click', () => { step > 1 && (step--, updateUI()); });
  btnSkip.addEventListener('click', hide);
  document.querySelectorAll('.dot').forEach(el =>
    el.addEventListener('click', () => { step = parseInt(el.dataset.dot); updateUI(); }));

  return { show };
})();


/* ══════════════════════════════════════════
   MÓDULO: SETTINGS
   Gestión de preferencias de usuario.
══════════════════════════════════════════ */
const Settings = (() => {
  let s = Storage.getSettings();

  const overlay      = document.getElementById('settings-modal');
  const btnOpen      = document.getElementById('btn-settings');
  const btnClose     = document.getElementById('settings-close');
  const zoomInBtn    = document.getElementById('zoom-in');
  const zoomOutBtn   = document.getElementById('zoom-out');
  const zoomLabel    = document.getElementById('zoom-label');
  const toggleRich   = document.getElementById('toggle-rich');
  const toggleMetric = document.getElementById('toggle-metric');

  function open() {
    document.querySelectorAll('.theme-opt').forEach(el =>
      el.classList.toggle('active', el.dataset.theme === s.theme));
    toggleRich.checked    = s.richText;
    toggleMetric.checked  = s.metric;
    zoomLabel.textContent = Math.round(s.zoom * 100) + '%';
    overlay.classList.remove('hidden');
    Install.initSettingsState(); // Mostrar estado de instalación actualizado
  }

  function close() { overlay.classList.add('hidden'); }

  function applyTheme() {
    document.body.classList.toggle('theme-dark',  s.theme === 'dark');
    document.body.classList.toggle('theme-light', s.theme === 'light');
  }
  function applyZoom() {
    document.documentElement.style.setProperty('--text-zoom', s.zoom);
    zoomLabel.textContent = Math.round(s.zoom * 100) + '%';
  }
  function applyRichText() {
    document.getElementById('rich-toolbar').classList.toggle('hidden', !s.richText);
    document.getElementById('plain-undo-bar').classList.toggle('hidden', s.richText);
  }
  function applyMetric() {
    document.getElementById('metric-toolbar').classList.toggle('hidden', !s.metric);
  }

  btnOpen.addEventListener('click', open);
  btnClose.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  document.querySelectorAll('.theme-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      s.theme = btn.dataset.theme;
      Storage.saveSettings(s);
      applyTheme();
      document.querySelectorAll('.theme-opt').forEach(b =>
        b.classList.toggle('active', b.dataset.theme === s.theme));
    });
  });

  zoomInBtn.addEventListener('click', () => {
    if (s.zoom < 2) { s.zoom = Math.round((s.zoom + 0.1) * 10) / 10; Storage.saveSettings(s); applyZoom(); }
  });
  zoomOutBtn.addEventListener('click', () => {
    if (s.zoom > 0.6) { s.zoom = Math.round((s.zoom - 0.1) * 10) / 10; Storage.saveSettings(s); applyZoom(); }
  });

  toggleRich.addEventListener('change', () => { s.richText = toggleRich.checked; Storage.saveSettings(s); applyRichText(); });
  toggleMetric.addEventListener('change', () => { s.metric = toggleMetric.checked; Storage.saveSettings(s); applyMetric(); });

  function init() { applyTheme(); applyZoom(); applyRichText(); applyMetric(); }
  function get()  { return s; }

  return { init, get, open, close };
})();


/* ══════════════════════════════════════════
   MÓDULO: NOTES MANAGER
   CRUD de notas sobre Storage.
══════════════════════════════════════════ */
const NotesManager = (() => {
  function create(type, structure) {
    return {
      id:        Date.now().toString(36) + Math.random().toString(36).slice(2),
      type, structure: structure || null,
      title:'', content:'', tags:[], favorite:false,
      createdAt: Date.now(), updatedAt: Date.now()
    };
  }

  function save(note) {
    const notes = Storage.getAllNotes();
    const idx   = notes.findIndex(n => n.id === note.id);
    note.updatedAt = Date.now();
    if (idx >= 0) notes[idx] = note; else notes.unshift(note);
    Storage.saveNotes(notes);
  }

  function remove(id)  { Storage.saveNotes(Storage.getAllNotes().filter(n => n.id !== id)); }
  function getAll()    { return Storage.getAllNotes().sort((a,b) => b.updatedAt - a.updatedAt); }
  function getById(id) { return Storage.getAllNotes().find(n => n.id === id) || null; }
  function getAllTags() { return [...new Set(getAll().flatMap(n => n.tags || []))]; }

  return { create, save, remove, getAll, getById, getAllTags };
})();


/* ══════════════════════════════════════════
   MÓDULO: LIST VIEW
   Renderiza y filtra la lista de notas.
══════════════════════════════════════════ */
const ListView = (() => {
  const listEl        = document.getElementById('notes-list');
  const emptyEl       = document.getElementById('empty-state');
  const filterBtns    = document.querySelectorAll('.filter-btn:not(#filter-tags-btn)');
  const filterTagBtn  = document.getElementById('filter-tags-btn');
  const activeTagsBar = document.getElementById('active-tags-bar');

  let currentFilter = 'all';
  let activeTags    = [];

  function formatDate(ts) {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60)    return 'Ahora';
    if (diff < 3600)  return `${Math.floor(diff/60)}m`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h`;
    if (diff < 604800)return `${Math.floor(diff/86400)}d`;
    return new Date(ts).toLocaleDateString('es-ES',{day:'numeric',month:'short'});
  }

  function applyFilters(notes) {
    let r = notes;
    if (currentFilter === 'poem') r = r.filter(n => n.type === 'poem');
    if (currentFilter === 'song') r = r.filter(n => n.type === 'song');
    if (currentFilter === 'fav')  r = r.filter(n => n.favorite);
    if (activeTags.length > 0)    r = r.filter(n => activeTags.every(t => (n.tags||[]).includes(t)));
    return r;
  }

  function render() {
    listEl.querySelectorAll('.note-card').forEach(el => el.remove());
    const filtered = applyFilters(NotesManager.getAll());
    emptyEl.style.display = filtered.length === 0 ? 'flex' : 'none';
    filtered.forEach(note => listEl.appendChild(createCard(note)));
  }

  function createCard(note) {
    const card = document.createElement('div');
    card.className  = 'note-card';
    card.dataset.id = note.id;
    const preview   = note.content.replace(/<[^>]+>/g,'').replace(/\[.*?\]/g,'').trim().slice(0,120);
    const tags      = (note.tags||[]).slice(0,3).map(t=>`<span class="tag-chip" data-tag="${t}">${t}</span>`).join('');
    card.innerHTML  = `
      <div class="note-card-header">
        <div class="note-card-title">${note.title||'Sin título'}</div>
        <button class="note-card-fav ${note.favorite?'active':''}" data-id="${note.id}">${note.favorite?'★':'☆'}</button>
      </div>
      ${preview?`<div class="note-card-preview">${preview}</div>`:''}
      <div class="note-card-footer">
        <div class="note-card-meta">
          <span class="type-badge-card ${note.type}">${note.type==='poem'?'Poesía':'Canción'}</span>
          ${note.structure?' · '+note.structure:''} &nbsp;·&nbsp; ${formatDate(note.updatedAt)}
        </div>
        <div class="note-card-tags">${tags}</div>
      </div>`;

    card.addEventListener('click', e => {
      if (e.target.classList.contains('note-card-fav')) return;
      if (e.target.classList.contains('tag-chip')) { toggleActiveTag(e.target.dataset.tag); return; }
      EditorView.open(note.id);
    });

    card.querySelector('.note-card-fav').addEventListener('click', e => {
      e.stopPropagation();
      const n = NotesManager.getById(note.id);
      if (n) { n.favorite = !n.favorite; NotesManager.save(n); render(); }
    });

    return card;
  }

  function toggleActiveTag(tag) {
    activeTags = activeTags.includes(tag) ? activeTags.filter(t=>t!==tag) : [...activeTags, tag];
    renderActiveTagsBar();
    render();
  }

  function renderActiveTagsBar() {
    if (activeTags.length === 0) { activeTagsBar.classList.add('hidden'); activeTagsBar.innerHTML=''; return; }
    activeTagsBar.classList.remove('hidden');
    activeTagsBar.innerHTML = activeTags.map(t=>`<span class="tag-chip removable" data-tag="${t}">${t}</span>`).join('');
    activeTagsBar.querySelectorAll('.tag-chip').forEach(el =>
      el.addEventListener('click', () => toggleActiveTag(el.dataset.tag)));
  }

  filterBtns.forEach(btn => btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    activeTags = [];
    renderActiveTagsBar();
    render();
  }));

  filterTagBtn.addEventListener('click', () => {
    const allTags = NotesManager.getAllTags();
    if (allTags.length === 0) return;
    activeTagsBar.classList.remove('hidden');
    activeTagsBar.innerHTML = '<span style="color:var(--text-muted);font-size:0.78rem">Tags: </span>' +
      allTags.map(t=>`<span class="tag-chip" data-tag="${t}">${t}</span>`).join('');
    activeTagsBar.querySelectorAll('.tag-chip').forEach(el =>
      el.addEventListener('click', () => toggleActiveTag(el.dataset.tag)));
  });

  return { render };
})();


/* ══════════════════════════════════════════
   MÓDULO: EDITOR VIEW
   Pantalla de edición de una nota.
══════════════════════════════════════════ */
const EditorView = (() => {
  let currentNote = null;
  let saveTimer   = null;

  const viewList    = document.getElementById('view-list');
  const viewEditor  = document.getElementById('view-editor');
  const btnBack     = document.getElementById('btn-back');
  const btnFav      = document.getElementById('btn-fav');
  const btnTags     = document.getElementById('btn-tags');
  const btnShare    = document.getElementById('btn-share');
  const titleInput  = document.getElementById('note-title');
  const editor      = document.getElementById('note-editor');
  const songToolbar = document.getElementById('song-toolbar');
  const poemGuide   = document.getElementById('poem-guide');
  const typeBadge   = document.getElementById('editor-type-badge');
  const noteTagsBar = document.getElementById('note-tags-bar');
  const statWords   = document.getElementById('stat-words');
  const statSyl     = document.getElementById('stat-syllables');
  const statChars   = document.getElementById('stat-chars');
  const metricSyl   = document.getElementById('metric-syllables');
  const metricType  = document.getElementById('metric-type');

  function open(noteId) {
    currentNote = NotesManager.getById(noteId);
    if (!currentNote) return;
    viewList.classList.add('hidden');
    viewEditor.classList.remove('hidden');
    viewEditor.classList.add('entering');
    setTimeout(() => viewEditor.classList.remove('entering'), 300);

    titleInput.value  = currentNote.title;
    editor.innerHTML  = currentNote.content;
    updateFavBtn();
    updateTypeBadge();
    renderNoteTagsBar();
    updateStats();

    if (currentNote.type === 'song') {
      songToolbar.classList.remove('hidden');
      poemGuide.classList.add('hidden');
    } else {
      songToolbar.classList.add('hidden');
      renderPoemGuide();
    }

    EditorHistory.reset(editor.innerHTML);
    editor.focus();
  }

  function openNew(note) { currentNote = note; open(note.id); }

  function close() {
    saveNow();
    viewEditor.classList.add('hidden');
    viewList.classList.remove('hidden');
    ListView.render();
  }

  function saveNow() {
    if (!currentNote) return;
    currentNote.title   = titleInput.value.trim();
    currentNote.content = editor.innerHTML;
    NotesManager.save(currentNote);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 800);
  }

  function updateFavBtn() {
    btnFav.textContent = currentNote.favorite ? '★' : '☆';
    btnFav.classList.toggle('active', currentNote.favorite);
  }

  function updateTypeBadge() {
    typeBadge.textContent = currentNote.type === 'poem' ? 'Poesía' : 'Canción';
    typeBadge.className   = `type-badge ${currentNote.type}`;
  }

  function renderNoteTagsBar() {
    noteTagsBar.innerHTML = '';
    (currentNote.tags||[]).forEach(tag => {
      const chip = document.createElement('span');
      chip.className   = 'tag-chip removable';
      chip.textContent = tag;
      chip.addEventListener('click', () => {
        currentNote.tags = currentNote.tags.filter(t=>t!==tag);
        NotesManager.save(currentNote);
        renderNoteTagsBar();
      });
      noteTagsBar.appendChild(chip);
    });
  }

  function renderPoemGuide() {
    const struct = PoemStructures[currentNote.structure] || null;
    poemGuide.innerHTML = '';
    if (!struct) { poemGuide.classList.add('hidden'); return; }

    if (struct.stanzas[0].verses === 0) {
      poemGuide.classList.remove('hidden');
      poemGuide.innerHTML = `<div class="poem-verse-hint">${struct.name}: ${struct.stanzas[0].hint}</div>`;
      return;
    }
    poemGuide.classList.remove('hidden');
    poemGuide.innerHTML = struct.stanzas.map(st => `
      <div class="poem-stanza">
        <div class="poem-stanza-label">${st.label} (${st.verses} versos)</div>
        <div class="poem-verse-hint">${st.hint}</div>
      </div>`).join('');
  }

  function updateStats() {
    const text = editor.innerText || '';
    statWords.textContent = `${Syllables.countWords(text)} palabras`;
    statSyl.textContent   = `${Syllables.countText(text)} síl.`;
    statChars.textContent = `${text.length} car.`;
  }

  function updateMetric() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const line = (sel.getRangeAt(0).startContainer.textContent || '').split('\n')[0];
    const syls = Syllables.countText(line.trim());
    metricSyl.textContent  = `${syls} síl.`;
    metricType.textContent = syls > 0 ? Syllables.verseName(syls) : '—';
  }

  // Eventos del editor
  titleInput.addEventListener('input', scheduleSave);

  editor.addEventListener('input', () => {
    updateStats(); updateMetric();
    EditorHistory.save(editor.innerHTML);
    scheduleSave();
  });

  editor.addEventListener('keyup', updateMetric);
  editor.addEventListener('click', updateMetric);

  // Selección de texto → métrica instantánea
  document.addEventListener('selectionchange', () => {
    if (viewEditor.classList.contains('hidden')) return;
    const sel = window.getSelection();
    if (sel && sel.toString().trim()) {
      const syls = Syllables.countText(sel.toString());
      metricSyl.textContent  = `${syls} síl.`;
      metricType.textContent = syls > 0 ? Syllables.verseName(syls) : '—';
    }
  });

  btnBack.addEventListener('click', close);

  btnFav.addEventListener('click', () => {
    if (!currentNote) return;
    currentNote.favorite = !currentNote.favorite;
    updateFavBtn();
    NotesManager.save(currentNote);
  });

  btnTags.addEventListener('click', () => {
    TagsModal.open(currentNote, () => { renderNoteTagsBar(); NotesManager.save(currentNote); });
  });

  btnShare.addEventListener('click', () => { saveNow(); ShareModal.open(currentNote); });

  // Insertar marcadores de sección en canciones
  songToolbar.querySelectorAll('.section-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      editor.focus();
      document.execCommand('insertHTML', false,
        `<div><span class="song-section-marker">[ ${btn.dataset.section} ]</span></div><div><br></div>`);
      updateStats(); scheduleSave();
    });
  });

  // Rich text
  document.getElementById('rich-toolbar').querySelectorAll('.fmt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (cmd === 'undo') { const t = EditorHistory.undo(); if (t!==null){editor.innerHTML=t;updateStats();scheduleSave();} }
      else if (cmd === 'redo') { const t = EditorHistory.redo(); if (t!==null){editor.innerHTML=t;updateStats();scheduleSave();} }
      else { document.execCommand(cmd,false,null); editor.focus(); }
    });
  });

  // Plain undo/redo
  document.getElementById('btn-undo').addEventListener('click', () => {
    const t = EditorHistory.undo(); if (t!==null){editor.innerHTML=t;updateStats();scheduleSave();}
  });
  document.getElementById('btn-redo').addEventListener('click', () => {
    const t = EditorHistory.redo(); if (t!==null){editor.innerHTML=t;updateStats();scheduleSave();}
  });

  return { open, openNew, close };
})();


/* ══════════════════════════════════════════
   MÓDULO: TAGS MODAL
══════════════════════════════════════════ */
const TagsModal = (() => {
  const overlay  = document.getElementById('tag-modal');
  const btnClose = document.getElementById('tag-close');
  const tagInput = document.getElementById('tag-input');
  const btnAdd   = document.getElementById('tag-add');
  const tagList  = document.getElementById('tag-list');

  let note = null, onUpdate = null;

  function open(n, cb) {
    note = n; onUpdate = cb;
    tagInput.value = '';
    render();
    overlay.classList.remove('hidden');
  }

  function close() { overlay.classList.add('hidden'); }

  function render() {
    tagList.innerHTML = '';
    const allTags = NotesManager.getAllTags();
    if (allTags.length === 0) {
      tagList.innerHTML = '<span style="color:var(--text-muted);font-size:0.8rem">Aún no hay tags. ¡Crea el primero!</span>';
      return;
    }
    allTags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.textContent = tag;
      chip.style.cursor = 'pointer';
      const active = note && note.tags.includes(tag);
      if (active) chip.style.outline = '2px solid var(--accent)';
      chip.addEventListener('click', () => {
        if (!note) return;
        note.tags = note.tags.includes(tag) ? note.tags.filter(t=>t!==tag) : [...note.tags,tag];
        if (onUpdate) onUpdate();
        render();
      });
      tagList.appendChild(chip);
    });
  }

  btnAdd.addEventListener('click', () => {
    const val = tagInput.value.trim().toLowerCase().replace(/\s+/g,'-');
    if (!val || !note) return;
    if (!note.tags.includes(val)) note.tags.push(val);
    tagInput.value = '';
    if (onUpdate) onUpdate();
    render();
  });

  tagInput.addEventListener('keydown', e => { if (e.key==='Enter') btnAdd.click(); });
  btnClose.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target===overlay) close(); });

  return { open };
})();


/* ══════════════════════════════════════════
   MÓDULO: SHARE MODAL
══════════════════════════════════════════ */
const ShareModal = (() => {
  const overlay  = document.getElementById('share-modal');
  const btnClose = document.getElementById('share-close');
  const btnClip  = document.getElementById('share-clipboard');
  const btnTxt   = document.getElementById('share-txt');
  const btnPdf   = document.getElementById('share-pdf');
  const toast    = document.getElementById('share-toast');

  let currentNote = null;

  function getPlainText(n) {
    const title   = n.title || 'Sin título';
    const content = (n.content||'').replace(/<[^>]+>/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
    return `${title}\n${'─'.repeat(title.length)}\n\n${content}`;
  }

  function open(n) { currentNote=n; toast.classList.add('hidden'); overlay.classList.remove('hidden'); }
  function close() { overlay.classList.add('hidden'); }

  btnClose.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target===overlay) close(); });

  btnClip.addEventListener('click', async () => {
    if (!currentNote) return;
    const text = getPlainText(currentNote);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2500);
  });

  btnTxt.addEventListener('click', () => {
    if (!currentNote) return;
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([getPlainText(currentNote)],{type:'text/plain;charset=utf-8'})),
      download: `${currentNote.title||'nota'}.txt`
    });
    a.click(); URL.revokeObjectURL(a.href); close();
  });

  btnPdf.addEventListener('click', () => {
    if (!currentNote) return;
    close();
    const w = window.open('','_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${currentNote.title||'Nota'}</title>
      <style>body{font-family:Georgia,serif;max-width:600px;margin:40px auto;line-height:1.8;color:#111}
      h1{font-size:1.5rem;border-bottom:1px solid #ccc;padding-bottom:8px;margin-bottom:24px}
      .content{white-space:pre-wrap}</style></head><body>
      <h1>${currentNote.title||'Sin título'}</h1>
      <div class="content">${currentNote.content||''}</div></body></html>`);
    w.document.close(); w.print();
  });

  return { open };
})();


/* ══════════════════════════════════════════
   MÓDULO: NUEVA NOTA
   Flujo de creación: tipo → estructura → editor.
══════════════════════════════════════════ */
const NewNoteFlow = (() => {
  const typeModal   = document.getElementById('type-modal');
  const structModal = document.getElementById('poem-structure-modal');

  function start() { typeModal.classList.remove('hidden'); }

  typeModal.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      typeModal.classList.add('hidden');
      if (btn.dataset.type === 'song') {
        const note = NotesManager.create('song', null);
        NotesManager.save(note);
        EditorView.openNew(note);
      } else {
        structModal.classList.remove('hidden');
      }
    });
  });

  structModal.querySelectorAll('.structure-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      structModal.classList.add('hidden');
      const note = NotesManager.create('poem', btn.dataset.structure);
      NotesManager.save(note);
      EditorView.openNew(note);
    });
  });

  document.getElementById('type-cancel').addEventListener('click', () => typeModal.classList.add('hidden'));
  document.getElementById('poem-structure-back').addEventListener('click', () => {
    structModal.classList.add('hidden');
    typeModal.classList.remove('hidden');
  });
  typeModal.addEventListener('click', e => { if(e.target===typeModal) typeModal.classList.add('hidden'); });
  structModal.addEventListener('click', e => { if(e.target===structModal) structModal.classList.add('hidden'); });
  document.getElementById('btn-new').addEventListener('click', start);

  return { start };
})();


/* ══════════════════════════════════════════
   MÓDULO: AYUDA
══════════════════════════════════════════ */
const Help = (() => {
  const overlay  = document.getElementById('help-modal');
  const btnOpen  = document.getElementById('btn-help');
  const btnClose = document.getElementById('help-close');
  btnOpen.addEventListener('click',  () => overlay.classList.remove('hidden'));
  btnClose.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', e => { if(e.target===overlay) overlay.classList.add('hidden'); });
})();


/* ══════════════════════════════════════════
   INIT · Arranque de la aplicación
══════════════════════════════════════════ */
(function init() {
  Settings.init();
  ListView.render();
  if (Storage.isFirstRun()) {
    Tutorial.show();
  } else {
    // Intentar mostrar prompt de instalación
    // (si beforeinstallprompt ya llegó, se mostrará inmediatamente;
    //  si no, el listener de Install lo captará cuando llegue)
    setTimeout(() => Install.maybeShow(), 1500);
  }
})();


/* ══════════════════════════════════════════
   SERVICE WORKER
══════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(r  => console.log('[SW] registrado:', r.scope))
      .catch(e => console.warn('[SW] error:', e));
  });
}
