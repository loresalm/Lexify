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

  /* ---------------- AUTH & LOAD ---------------- */
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
  function pickRandomQuestion() {
    index = Math.floor(Math.random() * questions.length);
    currentQuestion = questions[index];
    answered = false;
  }

  /* ---------------- ACTIONS ---------------- */
  async function deleteCurrentQuestion() {
    if (!currentQuestion || !confirm("Delete this question?")) return;
    await deleteUserQuestion(userId, currentQuestion.id, activeLibrary.id);
    questions = questions.filter(q => q.id !== currentQuestion.id);

    // Sync library card count
    libraries = libraries.map(lib => 
      lib.id === activeLibrary.id ? { ...lib, questionCount: questions.length } : lib
    );

    if (questions.length === 0) {
      currentQuestion = null;
      return;
    }

    // Move to next available question based on mode
    index = 0;
    currentQuestion = mode === "random" ? questions[0] : sortedQuestions[0];
    answered = false;
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

  async function onAnswered(event) {
    answered = true;
    await updateQuestionStats(userId, activeLibrary.id, currentQuestion.id, event.detail.correct);
    await reloadQuestions(activeLibrary.id); // Refresh stats
    const today = new Date().toISOString().slice(0, 10);
    quizCounts = await incrementQuiz(userId, today);
  }

  /* ---------------- NAVIGATION ---------------- */
  function nextQuestion() {
    if (mode === "random") {
      pickRandomQuestion();
    } else {
      index = (index + 1) % sortedQuestions.length;
      currentQuestion = sortedQuestions[index];
      answered = false;
    }
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

  const fullPrompt = `Generate exactly 20 quiz questions to learn about: "${promptTopic}". 
The goal is to translate from ${from} to ${to}.

STRICT CHALLENGE RULES:
1. VARIATION: Include a mix of short (3-5 words), medium (6-10 words), and long (11+ words) sentences in ${from}.
2. DECEPTIVE OPTIONS: The 3 options in ${to} must be approximately the same length and complexity. 
3. ANTI-GUESSING: Do NOT let the longest or shortest option be the giveaway for the correct answer. 
4. SEMANTIC CHALLENGE: Distractors must be grammatically correct but contextually wrong (e.g., if the sentence is about a "fast car," one distractor might be about a "fast boat" or a "slow car"). The user must understand the specific vocabulary to succeed.

STRICT JSON FORMAT:
Return ONLY the JSON object. No intro, no outro.
{
  "q1": {
    "${from}": "The sentence in ${from}",
    "options": ["Option 1 in ${to}", "Option 2 in ${to}", "Option 3 in ${to}"],
    "correct": "The exact correct option from the list"
  }
}

EXAMPLE (English to Spanish):
{
  "q1": {
    "english": "The keys are on the wooden table.",
    "options": ["Las llaves están en la mesa de madera.", "Los libros están en la mesa de madera.", "Las llaves están bajo la mesa de madera."],
    "correct": "Las llaves están en la mesa de madera."
  }
}`;

  try {
    await navigator.clipboard.writeText(fullPrompt);
    alert("Advanced AI Prompt copied to clipboard!");
  } catch (err) {
    alert("Failed to copy: " + err);
  }
}


async function handleManualUpload() {
  if (!uploadText.trim()) return alert("Please paste JSON or upload a file first.");
  
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
    
    alert(`Successfully added ${questionsArray.length} questions!`);
    uploadText = "";
    screen = "quiz";
    if (questions.length > 0) pickRandomQuestion();

  } catch (err) {
    alert("Upload Failed: " + err.message);
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
      on:delete={handleDeleteLibrary}  />

  {:else if screen === "prompt"}
    <div class="top-bar">
      <Button on:click={() => screen = "quiz"} variant="default">← Back</Button>
    </div>

    <GlassCard>
      <h2 style="margin-top: 0;">1. Create Prompt</h2>
      <textarea 
        bind:value={promptTopic} 
        placeholder="What topic should the AI generate?"
        style="height: 80px;"
      ></textarea>
      <Button on:click={copyGeneratedPrompt} fullWidth variant="primary">Copy Prompt</Button>
    </GlassCard>

    <div style="margin: 1rem 0; text-align: center; color: white;">▼</div>

    <GlassCard>
      <h2 style="margin-top: 0;">2. Paste & Upload JSON</h2>
      <input type="file" accept=".json" on:change={handleFileSelect} style="margin-bottom: 1rem; font-size: 0.8rem;"/>
      <textarea 
        bind:value={uploadText} 
        placeholder='Paste AI JSON result here...'
        style="height: 150px; font-family: monospace; font-size: 0.8rem;"
      ></textarea>
      <Button on:click={handleManualUpload} disabled={isUploading || !uploadText} fullWidth variant="primary">
        {isUploading ? "Uploading..." : "Add to Library"}
      </Button>
    </GlassCard>

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
        <button class:active={mode === "random"} on:click={() => { mode = "random"; answered = false; pickRandomQuestion(); }}>Random</button>
        <button class:active={mode === "worst"} on:click={() => { mode = "worst"; index = 0; currentQuestion = sortedQuestions[0]; answered = false; }}>Worst</button>
        <button class:active={mode === "tries"} on:click={() => { mode = "tries"; index = 0; currentQuestion = sortedQuestions[0]; answered = false; }}>Newest</button>
      </div>

      <Quiz
        question={currentQuestion}
        fromLang={activeLibrary?.fromLang} 
        on:answered={onAnswered}
        on:delete={deleteCurrentQuestion}
      />

      <Button on:click={nextQuestion} disabled={!answered} variant={answered ? "primary" : "default"} fullWidth>Next</Button>
    </GlassCard>

    <GlassCard>
      <h3 style="margin-top: 0;">Activity</h3>
      <Calendar quizCounts={quizCounts} />
    </GlassCard>
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

</style>