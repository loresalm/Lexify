<script>
  import { onMount } from "svelte";
  import { onAuthStateChanged } from "firebase/auth";
  import { collection, getDocs, getCountFromServer } from "firebase/firestore";
  import { getRedirectResult } from "firebase/auth";

  import {
    auth,
    logout,
    loadCalendar,
    incrementQuiz,
    updateQuestionStats,
    loadUserStats,
    ensureUserQuestions,
    deleteUserQuestion,
    addQuestionsFromJSON, 
    ensureUserDoc,
    db, 
    deleteLibrary
  } from "./firebase";

  import Quiz from "./Quiz.svelte";
  import Calendar from "./Calendar.svelte";
  import Auth from "./Auth.svelte";
  import UploadQuestions from "./UploadQuestions.svelte";
  import Button from "./Button.svelte";
  import GlassCard from "./GlassCard.svelte";
  import LibrarySelect from "./Libraryselect.svelte";

  /* ---------------- STATE ---------------- */
  let user = null;
  let userId = null;
  let loading = true;
  let screen = "auth";
  let promptTopic = "";

  let libraries = [];
  let activeLibrary = null;

  let questions = [];
  let stats = {};
  let quizCounts = {};

  let index = 0;
  let answered = false;
  let mode = "random"; // "random" | "worst" | "tries"
  let currentQuestion = null;

  let uploadText = ""; // For the paste-in text box
  let isUploading = false;

  let generateCount = 10;
  let showDeleteModal = false;

  let toastMessage = "";
  let showToast = false;

  /* ---------------- QUESTION ORDERING ---------------- */
  // Unified sorting logic based on the selected mode
  $: sortedQuestions = [...questions].sort((a, b) => {
    const statsA = stats[a.id] || { successRate: 100, tries: 0 };
    const statsB = stats[b.id] || { successRate: 100, tries: 0 };

    if (mode === "worst") {
      return (statsA.successRate || 0) - (statsB.successRate || 0);
    } 
    if (mode === "tries") {
      return (statsA.tries || 0) - (statsB.tries || 0);
    }
    return 0; // "random" relies on pickRandomQuestion() instead of this sort
  });

  /* ---------------- UI HELPERS ---------------- */
  function triggerToast(msg) {
    toastMessage = msg;
    showToast = true;
    // Auto-hide after 3 seconds
    setTimeout(() => {
      showToast = false;
    }, 3000);
  }

  /* ---------------- AUTH & LOAD ---------------- */
onMount(async () => {
  try {
    // 1. Wait for the redirect result FIRST
    const result = await getRedirectResult(auth);
    if (result?.user) {
      console.log("Redirect login success:", result.user.email);
      // The observer below (onAuthStateChanged) will handle the screen switch
    }
  } catch (e) {
    console.error("Redirect error:", e);
  }

  // 2. Now listen for the auth state
  onAuthStateChanged(auth, async (u) => {
    loading = true; // Show loading while we verify
    try {
      if (u) {
        user = u;
        userId = u.uid;
        await ensureUserDoc(userId);
        await reloadLibraries();
        screen = "library"; // Successfully logged in
      } else {
        user = null;
        userId = null;
        screen = "auth"; // Truly not logged in
      }
    } catch (e) {
      console.error("Startup error:", e);
      screen = "auth"; 
    } finally {
      loading = false; // Only stop loading once we know where the user belongs
    }
  });
});

  /* ---------------- LIBRARIES ---------------- */
  async function reloadLibraries() {
    const snap = await getDocs(collection(db, "users", userId, "libraries"));
    const libsWithCounts = await Promise.all(
      snap.docs.map(async (d) => {
        const qCol = collection(db, "users", userId, "libraries", d.id, "questions");
        const countSnap = await getCountFromServer(qCol);
        return { id: d.id, ...d.data(), questionCount: countSnap.data().count };
      })
    );
    libraries = libsWithCounts;
  }

  async function handleLibraryCreated(event) {
    libraries = [...libraries, event.detail];
  }

  async function handleSelectLibrary(event) {
    activeLibrary = event.detail;
    loading = true;
    await ensureUserQuestions(userId, activeLibrary.id);
    await reloadQuestions(activeLibrary.id);
    stats = await loadUserStats(userId);
    quizCounts = await loadCalendar(userId);
    pickRandomQuestion();
    screen = "quiz";
    loading = false;
  }

  async function reloadQuestions(libId = activeLibrary?.id) {
    const qs = await getDocs(collection(db, "users", userId, "libraries", libId, "questions"));
    questions = qs.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  /* ---------------- QUESTION SELECTION ---------------- */
function setMode(newMode) {
  mode = newMode;
  answered = false;
  index = 0;

  if (mode === "random") {
    pickRandomQuestion();
  } else if (mode === "worst") {
    // Sort ONCE: Worst success rate (0) to best (100)
    questions = [...questions].sort((a, b) => (a.successRate || 0) - (b.successRate || 0));
    currentQuestion = questions[0];
  } else if (mode === "tries") {
    // Sort ONCE: Newest (highest timestamp) to oldest (lowest)
    questions = [...questions].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    currentQuestion = questions[0];
  }
}

function pickRandomQuestion() {
  if (questions.length === 0) return;
  index = Math.floor(Math.random() * questions.length);
  currentQuestion = questions[index];
  answered = false;
}

  /* ---------------- ACTIONS ---------------- */
  // Step 1: Open the glass modal instead of the browser confirm
  function triggerDeleteRequest() {
    showDeleteModal = true;
  }

  // Step 2: The actual logic that runs when they click "Delete" in the modal
  async function confirmDeletion() {
    if (!currentQuestion) return;

    try {
      // 1. Delete from Firebase
      await deleteUserQuestion(userId, currentQuestion.id, activeLibrary.id);
      
      // 2. Remove from local array
      questions = questions.filter(q => q.id !== currentQuestion.id);

      // 3. Update library card count
      libraries = libraries.map(lib => 
        lib.id === activeLibrary.id ? { ...lib, questionCount: questions.length } : lib
      );

      // 4. Handle Navigation (Display next question)
      if (questions.length === 0) {
        currentQuestion = null;
      } else {
        // Stay at the same index (which is now the next question) 
        // or loop to the start if we deleted the last one
        index = index % questions.length;
        currentQuestion = questions[index];
        answered = false;
      }
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Error deleting question.");
    } finally {
      showDeleteModal = false; // Close modal regardless
    }
  }

  async function handleUpload(event) {
    try {
      await addQuestionsFromJSON(userId, event.detail.questions, activeLibrary.id);
      await reloadQuestions();
      libraries = libraries.map(lib => 
        lib.id === activeLibrary.id ? { ...lib, questionCount: questions.length } : lib
      );
      if (questions.length > 0) pickRandomQuestion();
    } catch (error) {
      alert(`Upload failed: ${error.message}`);
    }
  }


  /* ---------------- NAVIGATION ---------------- */
function nextQuestion() {
    // Only move forward if we have already answered
    if (!answered) return;

    if (mode === "random") {
      pickRandomQuestion();
    } else {
      // Move to the next index in our sorted list
      index = (index + 1) % questions.length;
      currentQuestion = questions[index];
    }
    
    // CRITICAL: Reset answered to false ONLY when we move to the next card
    answered = false;
  }

// Update your onAnswered to update the local object directly
async function onAnswered(event) {
    if (answered) return; // Prevent double-clicking
    
    answered = true;
    const isCorrect = event.detail.correct;

    // 1. Update Firebase (Async)
    updateQuestionStats(userId, activeLibrary.id, currentQuestion.id, isCorrect);

    // 2. Update the local data for THIS specific question
    // We update it inside the 'questions' array so it's saved for later
    questions = questions.map(q => {
      if (q.id === currentQuestion.id) {
        const newTries = (q.tries || 0) + 1;
        const newCorrect = (q.correctCount || 0) + (isCorrect ? 1 : 0);
        return {
          ...q,
          tries: newTries,
          correctCount: newCorrect,
          successRate: Math.round((newCorrect / newTries) * 100)
        };
      }
      return q;
    });

    // 3. Increment activity calendar
    const today = new Date().toISOString().slice(0, 10);
    quizCounts = await incrementQuiz(userId, today);
  }

  function backToLibrary() {
    screen = "library";
    activeLibrary = null;
    questions = [];
    currentQuestion = null;
    mode = "random";
  }

  async function handleLogout() {
    await logout();
    screen = "auth";
    libraries = [];
    activeLibrary = null;
  }

/* ---------------- PROMPTING ---------------- */
async function copyGeneratedPrompt() {
  const from = activeLibrary?.fromLang || "source language";
  const to = activeLibrary?.toLang || "target language";

  // Use the generateCount variable here
  const fullPrompt = `Generate exactly ${generateCount} quiz questions to learn about: "${promptTopic}". 
The goal is to translate from ${from} to ${to}.

STRICT CHALLENGE RULES:
1. VARIATION: Include a mix of short (5-8 words), medium (8-16 words), and long (16+ words) sentences in ${from}.
2. DECEPTIVE OPTIONS: The 3 options in ${to} must be approximately the same length. 
3. ANTI-GUESSING: Do NOT let the longest or shortest option be the giveaway. 
4. SEMANTIC CHALLENGE: Distractors must be contextually wrong but grammatically correct.

STRICT JSON FORMAT:
Return ONLY a JSON object where each key is "q" followed by a number.
{
  "q1": {
    "${from}": "...",
    "options": ["...", "...", "..."],
    "correct": "..."
  }
}`;

  try {
      await navigator.clipboard.writeText(fullPrompt);
      triggerToast(`${generateCount} questions prompt copied`);
    } catch (err) {
      triggerToast("Failed to copy");
    }
}


async function handleManualUpload() {
  if (!uploadText.trim()) {
    triggerToast("Error: Please paste JSON or upload a file first.");
    return;
  }
  
  isUploading = true;
  try {
    if (uploadText.length > 1000000) throw new Error("File is too large.");

    const data = JSON.parse(uploadText);
    const questionKeys = Object.keys(data);
    if (questionKeys.length === 0) throw new Error("JSON is empty.");

    const firstKey = questionKeys[0];
    
    // VALIDATION: Ensure the JSON has the 'fromLang' key for the sentence
    const requiredLangKey = activeLibrary.fromLang; 

    if (!data[firstKey][requiredLangKey] || !data[firstKey].options || !data[firstKey].correct) {
      throw new Error(`Format error: Each question must have "${requiredLangKey}", "options", and "correct".`);
    }

    const questionsArray = Object.values(data);
    await addQuestionsFromJSON(userId, questionsArray, activeLibrary.id);
    
    await reloadQuestions(activeLibrary.id);
    await reloadLibraries(); 
    
    // Replace alert with toast
    triggerToast(`Success: Added ${questionsArray.length} questions.`);
    
    uploadText = "";
    screen = "quiz";
    if (questions.length > 0) pickRandomQuestion();

  } catch (err) {
    // Replace alert with toast
    triggerToast(`Upload Failed: ${err.message}`);
  } finally {
    isUploading = false;
  }
}

  // Handle File Upload
  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.type !== "application/json") {
      alert("Please upload a .json file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      uploadText = e.target.result;
    };
    reader.readAsText(file);
  }


  /* ---------------- DELETE LIBRARY ---------------- */
 async function handleDeleteLibrary(event) {
  const libId = event.detail;
  const libToDelete = libraries.find(l => l.id === libId);

  if (!libToDelete) {
    console.error("Library not found in state:", libId);
    return;
  }

  const confirmName = `${libToDelete.fromLang} → ${libToDelete.toLang}`;
  if (!confirm(`Delete "${confirmName}"?`)) return;

  try {
    await deleteLibrary(userId, libId);
    libraries = libraries.filter(l => l.id !== libId);
  } catch (error) {
    console.error("Firebase Delete Error:", error); // Check the browser console for this!
    alert("Failed to delete library.");
  }
}

</script>


<main>
  {#if loading}
    <div class="loading-wrap">
      <p class="loading-text">Loading…</p>
    </div>

  {:else if screen === "auth"}
    <GlassCard><Auth /></GlassCard>

  {:else if screen === "library"}
    <Button on:click={handleLogout} className="logout">Logout</Button>
    <LibrarySelect
      {userId}
      {libraries}
      on:libraryCreated={handleLibraryCreated}
      on:select={handleSelectLibrary}
      on:delete={handleDeleteLibrary} />

  {:else if screen === "prompt"}
    <div class="top-bar">
      <Button on:click={() => screen = "quiz"} variant="default">← Back</Button>
    </div>

    <div class="vertical-upload-stack">
<GlassCard>
  <h3 class="compact-title">1. Create Prompt</h3>
  
  <div class="input-row-space">
    <div class="input-pair">
      <select bind:value={generateCount} class="compact-select-auto">
        <option value={3}>3</option>
        <option value={10}>10</option>
        <option value={25}>25</option>
        <option value={50}>50</option>
      </select>
      <label class="compact-label">Questions</label>
    </div>

    <div class="mini-btn-wrap">
      <Button on:click={copyGeneratedPrompt} variant="primary">Copy Prompt</Button>
    </div>
  </div>

  <textarea 
    bind:value={promptTopic} 
    placeholder="Quiz questions to learn about ... (e.g. Travel, Cooking...)"
    class="compact-textarea-short"
  ></textarea>
</GlassCard>

  <GlassCard>
    <h3 class="compact-title">2. Paste & Upload JSON</h3>
    
    <div class="input-row-space">
      <input type="file" accept=".json" on:change={handleFileSelect} class="file-input-compact"/>
      <div class="mini-btn-wrap">
        <Button on:click={handleManualUpload} disabled={isUploading || !uploadText} variant="primary">
          {isUploading ? "..." : "Upload"}
        </Button>
      </div>
    </div>

    <textarea 
      bind:value={uploadText} 
      placeholder='Paste JSON here...'
      class="compact-textarea-long"
    ></textarea>
  </GlassCard>
</div>

  {:else if screen === "quiz"}
    <div class="top-bar">
      <Button on:click={backToLibrary} variant="default">← Exit</Button>
      <div style="display: flex; gap: 0.5rem;">
        <Button on:click={() => screen = "prompt"} variant="primary">Generate & Upload</Button>
        <Button on:click={handleLogout} className="logout">Logout</Button>
      </div>
    </div>

    <GlassCard>
      <div class="mode-toggle">
        <button class:active={mode === "random"} on:click={() => setMode("random")}>Random</button>
        <button class:active={mode === "worst"} on:click={() => setMode("worst")}>Worst</button>
        <button class:active={mode === "tries"} on:click={() => setMode("tries")}>Newest</button>
      </div>

      <Quiz
        question={currentQuestion}
        fromLang={activeLibrary?.fromLang} 
        on:answered={onAnswered}
        on:delete={triggerDeleteRequest} 
      />

      <Button on:click={nextQuestion} disabled={!answered} variant={answered ? "primary" : "default"} fullWidth>Next</Button>
    </GlassCard>

    <GlassCard>
      <h3 style="margin-top: 0;">Activity</h3>
      <Calendar quizCounts={quizCounts} />
    </GlassCard>
  {/if}

  {#if showDeleteModal}
    <div class="modal-overlay" on:click|self={() => showDeleteModal = false}>
      <div class="glass-modal">
        <h2 style="margin-top: 0;">Confirm Deletion</h2>
        <p>Are you sure you want to delete this question? This cannot be undone.</p>
        <div class="modal-buttons">
          <button class="modal-btn cancel" on:click={() => showDeleteModal = false}>Keep</button>
          <button class="modal-btn confirm" on:click={confirmDeletion}>Delete</button>
        </div>
      </div>
    </div>
  {/if}

  {#if showToast}
    <div class="glass-toast">{toastMessage}</div>
  {/if}
</main>

<style>
/* =====================
   PAGE BACKGROUND
====================== */
:global(html),
:global(body) {
  height: 100%;
  margin: 0;
  padding: 0;
  background: linear-gradient(
    135deg,
    #2c003e,
    #f26db6,
    #5c93e6,
    #001f5b
  );
  background-repeat: no-repeat;
  background-size: cover;
}

/* =====================
   LAYOUT
====================== */
main {
  min-height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
  box-sizing: border-box;
  background: transparent;
}

/* =====================
   LOADING
====================== */
.loading-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.loading-text {
  font-family: 'Georgia', serif;
  font-size: 1.1rem;
  color: rgba(255,255,255,0.7);
  letter-spacing: 0.08em;
}

/* =====================
   LOGOUT BUTTON
====================== */
:global(.logout) {
  align-self: flex-end;
  margin-bottom: 1rem;
}

/* =====================
   TOP BAR (quiz screen)
====================== */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 680px;
  margin-bottom: 1.2rem;
  gap: 1rem;
}
.active-lib-label {
  font-family: 'Georgia', serif;
  font-size: 0.85rem;
  font-style: italic;
  color: rgba(255,255,255,0.75);
  letter-spacing: 0.04em;
  text-transform: capitalize;
}

/* =====================
   MODE TOGGLE
====================== */
.mode-toggle {
  display: flex;
  width: 100%;
  margin-bottom: 1.5rem;
  gap: 0;
}
.mode-toggle button {
  flex: 1;
  padding: 0.75rem 1.5rem;
  font-size: 0.8rem;
  font-weight: 500;
  background: transparent;
  color: rgba(0, 0, 0, 0.7);
  border: 2px solid rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  cursor: pointer;
}
.mode-toggle button:first-child {
  border-radius: 50px 0 0 50px;
  border-right: 1px solid rgba(0, 0, 0, 0.3);
}
.mode-toggle button:last-child {
  border-radius: 0 50px 50px 0;
  border-left: 1px solid rgba(0, 0, 0, 0.3);
}
.mode-toggle button:hover:not(.active) {
  background: rgba(128, 128, 128, 0.2);
}
.mode-toggle button.active {
  background: rgba(0, 0, 0, 0.85);
  color: white;
  border-color: rgba(0, 0, 0, 0.85);
}


textarea {
    width: 100%;
    height: 150px;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid rgba(0, 0, 0, 0.1) !important;
    background: rgba(255, 255, 255, 0.4);
    font-family: inherit;
    font-size: 1rem;
    margin-bottom: 1.5rem;
    resize: none;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }

  textarea:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.7);
    border-color: #2c003e !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  }

  /* =====================
     GLASS MODAL
  ====================== */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000; /* Ensure it's above everything */
  }

  .glass-modal {
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 24px;
    padding: 2rem;
    width: 90%;
    max-width: 400px;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    color: white;
  }

  .modal-buttons {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .modal-btn {
    flex: 1;
    padding: 0.8rem;
    border-radius: 12px;
    border: none;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
  }

  .modal-btn.cancel {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.4);
  }

  .modal-btn.confirm {
    background: #e03131;
    color: white;
  }

  .modal-btn:hover {
    transform: translateY(-2px);
    filter: brightness(1.1);
  }
  /* =====================
     GLASS TOAST NOTIFICATION
  ====================== */
  .glass-toast {
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    padding: 1rem 2rem;
    
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 50px; /* Pill shape */
    
    color: white;
    font-weight: 600;
    font-size: 0.9rem;
    white-space: nowrap;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    
    /* Animation */
    animation: slideUpFade 0.3s ease-out;
  }

  @keyframes slideUpFade {
    from {
      opacity: 0;
      transform: translate(-50%, 20px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  /* =====================
     COMPACT ALIGNMENT & MINI BUTTONS
  ====================== */
.input-row-left {
    display: flex;
    align-items: center;
    justify-content: space-between; /* Changed from flex-start to space-between */
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  /* This remains the same as it already used space-between */
  .input-row-space {
    display: flex;
    align-items: center;
    justify-content: space-between; 
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  /* Force the Button component to be smaller within these containers */
  .mini-btn-wrap :global(button) {
    padding: 0.4rem 0.8rem !important; /* Smaller padding */
    font-size: 0.75rem !important;    /* Smaller text */
    min-width: auto !important;       /* Prevents stretching */
    width: auto !important;
  }

  .compact-select {
    padding: 0.3rem;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    font-size: 0.8rem;
    width: 60px; /* Keep select fixed so button stays left */
  }

  .file-input-compact {
    font-size: 0.7rem;
    color: white;
    max-width: 180px; /* Prevents file input from pushing button off screen */
  }

  /* =====================
     VERTICAL COMPACT UPLOAD
  ====================== */
  .vertical-upload-stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 480px; /* Slimmer for a cleaner vertical look */
  }

  .compact-title {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: white;
    text-align: left;
    opacity: 0.9;
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .compact-label {
    color: white;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .compact-select {
    padding: 0.3rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    font-size: 0.85rem;
  }

  /* Force height reduction on textareas */
  .compact-textarea-short {
    height: 48px !important; 
    margin-bottom: 0 !important;
    font-size: 0.85rem !important;
    padding: 8px !important;
  }

  .compact-textarea-long {
    height: 85px !important;
    margin-bottom: 0 !important;
    font-size: 0.8rem !important;
    padding: 8px !important;
  }

  .file-input-compact {
    font-size: 0.75rem;
    color: white;
    width: 100%;
    flex: 1;
  }

  /* Make the glass cards in this stack have less internal padding */
  :global(.vertical-upload-stack .glass-card) {
    padding: 1rem 1.25rem !important;
  }
  /* 1. This keeps the dropdown and text together as one group on the left */
  .input-pair {
    display: flex;
    align-items: center;
    gap: 0.5rem; 
  }

  /* 2. This makes the dropdown small and prevents it from stretching */
  .compact-select-auto {
    padding: 0.3rem 0.5rem;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    font-size: 0.8rem;
    width: auto; /* This ensures it stays on the left */
    cursor: pointer;
  }

  /* 3. Ensure this is set to space-between to push the button to the right */
  .input-row-space {
    display: flex;
    align-items: center;
    justify-content: space-between; 
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

</style>