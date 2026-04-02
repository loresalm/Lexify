<script>
  import { createEventDispatcher } from "svelte";
  import { doc, collection, getDocs, setDoc } from "firebase/firestore";
  import { db } from "./firebase";

  export let userId;
  export let libraries = []; // [{ id, fromLang, toLang, questionCount }]

  const dispatch = createEventDispatcher();

  /* ---- language config ---- */
  const LANGUAGES = [
    { code: "english",    label: "English",    flag: "🇬🇧" },
    { code: "french",     label: "French",     flag: "🇫🇷" },
    { code: "german",     label: "German",     flag: "🇩🇪" },
    { code: "italian",    label: "Italian",    flag: "🇮🇹" },
    { code: "dutch",      label: "Dutch",      flag: "🇳🇱" },
    { code: "spanish",    label: "Spanish",    flag: "🇪🇸" },
    { code: "portuguese", label: "Portuguese", flag: "🇵🇹" },
  ];

  /* ---- modal state ---- */
  let showModal = false;
  let fromLang = null;
  let toLang = null;
  let creating = false;
  let error = "";

  function openModal() {
    fromLang = null;
    toLang = null;
    error = "";
    showModal = true;
  }

  function closeModal() {
    showModal = false;
  }

  function removeLibrary(id, e) {
    e.stopPropagation(); // 👈 CRITICAL: Stops the library from opening when you click X
    dispatch("delete", id);
  }

  async function createLibrary() {
    if (!fromLang || !toLang) { error = "Please select both languages."; return; }
    if (fromLang === toLang) { error = "Languages must be different."; return; }

    const exists = libraries.some(
      l => l.fromLang === fromLang && l.toLang === toLang
    );
    if (exists) { error = "You already have this library."; return; }

    creating = true;
    error = "";

    try {
        const userRef = doc(db, "users", userId);
        await setDoc(userRef, { createdAt: Date.now() }, { merge: true });

        const libRef = doc(collection(db, "users", userId, "libraries"));
        
        // UPDATED LOGIC: 
        // fromLang = The Question (The sentence displayed)
        // toLang   = The Options (The translations to choose from)
        await setDoc(libRef, { 
          fromLang, // Now correctly represents the Question language
          toLang,   // Now correctly represents the Options language
          createdAt: Date.now() 
        });

        dispatch("libraryCreated", { id: libRef.id, fromLang, toLang, questionCount: 0 });
        showModal = false;
    } catch (e) {
        error = e.message;
    } finally {
        creating = false;
    }
}

  function selectLibrary(lib) {
    dispatch("select", lib);
  }

  function langLabel(code) {
    return LANGUAGES.find(l => l.code === code)?.label ?? code;
  }
  function langFlag(code) {
    return LANGUAGES.find(l => l.code === code)?.flag ?? "🏳️";
  }
</script>

<!-- ===================== LIBRARY SCREEN ===================== -->
<div class="screen">

  <header class="screen-header">
    <div class="brand">
      <span class="brand-icon"></span>
      <h1 class="brand-title">Lexify</h1>
    </div>
    <p class="brand-sub">Your personal vocabulary trainer</p>
  </header>

  <section class="library-section">
    <div class="section-label">YOUR CARD STACKS</div>

    <div class="library-grid">
      {#each libraries as lib (lib.id)}
        <button class="lib-card" on:click={() => selectLibrary(lib)}>
        <button class="btn-delete" on:click={(e) => removeLibrary(lib.id, e)} title="Delete Library">
            ✕
          </button>
          <div class="lib-flags">
            <span class="flag">{langFlag(lib.fromLang)}</span>
            <span class="arrow">→</span>
            <span class="flag">{langFlag(lib.toLang)}</span>
          </div>
          <div class="lib-langs">
            {langLabel(lib.fromLang)} → {langLabel(lib.toLang)}
          </div>
          <div class="lib-meta">
            {lib.questionCount ?? 0} cards
          </div>
          <div class="lib-cta">Open →</div>
        </button>
      {/each}

      <!-- ADD NEW card -->
      <button class="lib-card lib-card--add" on:click={openModal}>
        <span class="plus-icon">+</span>
        <span class="plus-label">New Card Stack</span>
      </button>
    </div>
  </section>
</div>


<!-- ===================== MODAL ===================== -->
{#if showModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-backdrop" on:click|self={closeModal}>
    <div class="modal">
      <button class="modal-close" on:click={closeModal}>✕</button>
      <h2 class="modal-title">New Library</h2>
      <p class="modal-sub">Configure your translation direction</p>

      <div class="lang-section">
  <div class="lang-label">1. Show me one sentence in </div>
  <div class="lang-grid">
    {#each LANGUAGES as lang}
      <button
        class="lang-btn"
        class:selected={fromLang === lang.code} class:dimmed={toLang === lang.code}
        on:click={() => { fromLang = lang.code; error = ""; }}
      >
        <span class="lang-flag">{lang.flag}</span>
        <span class="lang-name">{lang.label}</span>
      </button>
    {/each}
  </div>
</div>

<div class="lang-section">
  <div class="lang-label">2. Show me translation options in</div> 
  <div class="lang-grid">
    {#each LANGUAGES as lang}
      <button
        class="lang-btn"
        class:selected={toLang === lang.code} class:dimmed={fromLang === lang.code}
        on:click={() => { toLang = lang.code; error = ""; }}
      >
        <span class="lang-flag">{lang.flag}</span>
        <span class="lang-name">{lang.label}</span>
      </button>
    {/each}
  </div>
</div>

      {#if error}
        <p class="modal-error">{error}</p>
      {/if}

      <button
        class="modal-create"
        disabled={!fromLang || !toLang || creating}
        on:click={createLibrary}
      >
        {creating ? "Creating…" : "Create Library"}
      </button>
    </div>
  </div>
{/if}


<style>
/* ===================== SCREEN ===================== */
.screen {
  min-height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 1.5rem 4rem;
  box-sizing: border-box;
  font-family: 'Georgia', 'Times New Roman', serif;
}

/* ---- Header ---- */
.screen-header {
  text-align: center;
  margin-bottom: 3rem;
}
.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  margin-bottom: 0.4rem;
}
.brand-icon {
  font-size: 2rem;
}
.brand-title {
  font-size: 2.8rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  margin: 0;
  background: linear-gradient(135deg, #2c003e 0%, #7b2d8b 50%, #001f5b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.brand-sub {
  font-size: 1rem;
  color: rgba(0,0,0,0.45);
  margin: 0;
  font-style: italic;
  letter-spacing: 0.02em;
}

/* ---- Section ---- */
.library-section {
  width: 100%;
  max-width: 680px;
}
.section-label {
  font-size: 0.7rem;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.15em;
  color: rgba(0,0,0,0.4);
  font-weight: 700;
  margin-bottom: 1rem;
}

/* ---- Grid ---- */
.library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

/* ---- Library Card ---- */
.lib-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 1.4rem 1.2rem 1rem;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1.5px solid rgba(255,255,255,0.8);
  border-radius: 16px;
  box-shadow:
    0 4px 24px rgba(44, 0, 62, 0.08),
    0 1px 4px rgba(0,0,0,0.06);
  cursor: pointer;
  text-align: left;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  font-family: inherit;
}
.lib-card:hover {
  transform: translateY(-3px);
  box-shadow:
    0 10px 36px rgba(44, 0, 62, 0.14),
    0 2px 8px rgba(0,0,0,0.08);
  background: rgba(255, 255, 255, 0.72);
}
.lib-flags {
  font-size: 1.6rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 0.2rem;
}
.flag { line-height: 1; }
.arrow {
  font-size: 1rem;
  color: rgba(0,0,0,0.35);
}
.lib-langs {
  font-size: 0.82rem;
  font-weight: 600;
  color: rgba(0,0,0,0.75);
  letter-spacing: 0.01em;
}
.lib-meta {
  font-size: 0.72rem;
  color: rgba(0,0,0,0.4);
  font-family: 'Courier New', monospace;
}
.lib-cta {
  position: absolute;
  bottom: 0.9rem;
  right: 1.1rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(44, 0, 62, 0.5);
  letter-spacing: 0.05em;
  transition: color 0.15s;
}
.lib-card:hover .lib-cta {
  color: rgba(44, 0, 62, 0.85);
}

/* ---- Add Card ---- */
.lib-card--add {
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 2px dashed rgba(0,0,0,0.2);
  background: rgba(255,255,255,0.3);
  min-height: 140px;
}
.lib-card--add:hover {
  border-color: rgba(44, 0, 62, 0.4);
  background: rgba(255,255,255,0.5);
}
.plus-icon {
  font-size: 2rem;
  color: rgba(0,0,0,0.3);
  line-height: 1;
  transition: color 0.15s, transform 0.15s;
}
.lib-card--add:hover .plus-icon {
  color: rgba(44, 0, 62, 0.6);
  transform: scale(1.1);
}
.plus-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: rgba(0,0,0,0.4);
  letter-spacing: 0.03em;
}
.lib-card--add:hover .plus-label {
  color: rgba(44, 0, 62, 0.7);
}

/* ===================== MODAL ===================== */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}
.modal {
  position: relative;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1.5px solid rgba(255,255,255,0.95);
  border-radius: 20px;
  padding: 2.2rem 2rem 2rem;
  width: 100%;
  max-width: 520px;
  box-shadow: 0 24px 80px rgba(44, 0, 62, 0.18);
  font-family: 'Georgia', serif;
}
.modal-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 1rem;
  color: rgba(0,0,0,0.4);
  cursor: pointer;
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;
}
.modal-close:hover {
  background: rgba(0,0,0,0.08);
  color: rgba(0,0,0,0.7);
}
.modal-title {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
  letter-spacing: -0.02em;
  color: #1a001f;
}
.modal-sub {
  font-size: 0.88rem;
  color: rgba(0,0,0,0.45);
  margin: 0 0 1.8rem;
  font-style: italic;
}

/* ---- Language sections ---- */
.lang-section {
  margin-bottom: 1.4rem;
}
.lang-label {
  font-size: 0.68rem;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.14em;
  color: rgba(0,0,0,0.4);
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 0.65rem;
}
.lang-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.45rem;
}
.lang-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.55rem 0.3rem;
  border-radius: 10px;
  border: 1.5px solid rgba(0,0,0,0.12);
  background: rgba(255,255,255,0.7);
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}
.lang-btn:hover:not(.dimmed) {
  border-color: rgba(44, 0, 62, 0.4);
  background: rgba(44, 0, 62, 0.05);
  transform: translateY(-1px);
}
.lang-btn.selected {
  border-color: #2c003e;
  background: rgba(44, 0, 62, 0.1);
  box-shadow: 0 0 0 2px rgba(44, 0, 62, 0.2);
}
.lang-btn.dimmed {
  opacity: 0.35;
  cursor: not-allowed;
}
.lang-flag {
  font-size: 1.4rem;
  line-height: 1;
}
.lang-name {
  font-size: 0.62rem;
  font-weight: 600;
  color: rgba(0,0,0,0.6);
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.lang-btn.selected .lang-name {
  color: #2c003e;
}

/* ---- Error ---- */
.modal-error {
  font-size: 0.8rem;
  color: #c0392b;
  margin: 0 0 1rem;
  padding: 0.5rem 0.75rem;
  background: rgba(192,57,43,0.08);
  border-radius: 8px;
  border-left: 3px solid #c0392b;
}

/* ---- Create button ---- */
.modal-create {
  width: 100%;
  padding: 0.85rem;
  background: #2c003e;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  cursor: pointer;
  font-family: 'Georgia', serif;
  transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
  box-shadow: 0 4px 16px rgba(44,0,62,0.25);
}
.modal-create:hover:not(:disabled) {
  background: #420060;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(44,0,62,0.35);
}
.modal-create:disabled {
  background: rgba(0,0,0,0.2);
  cursor: not-allowed;
  box-shadow: none;
}

/* ---- Responsive ---- */
@media (max-width: 420px) {
  .lang-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .modal {
    padding: 1.6rem 1.2rem 1.4rem;
  }
}

/* ---- Delete Button Styling ---- */
.btn-delete {
  position: absolute;
  top: 0.8rem;
  right: 0.8rem;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.05);
  background: rgba(255, 255, 255, 0.3);
  color: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s ease;
}

.btn-delete:hover {
  background: #c0392b;
  color: white;
  border-color: #c0392b;
  transform: scale(1.1);
}

/* Ensure the card title/cta doesn't overlap on small cards */
.lib-card {
  position: relative; /* Already in your code, but keep it! */
}
</style>