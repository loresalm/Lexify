<script>
  import { createEventDispatcher } from "svelte";

  export let question;
  export let fromLang; // This is the "Question" language key (e.g., 'english')

  const dispatch = createEventDispatcher();

  // 🔍 DEBUG LOGS
  $: if (question || fromLang) {
    console.log("--- Quiz Component Debug ---");
    console.log("Question Language (fromLang):", fromLang);
    // If fromLang is 'english', this shows question['english']
    console.log("Displaying Sentence:", question?.[fromLang]); 
  }

  let selected = null;
  let answered = false;
  let shuffledOptions = [];

  // Reset state and reshuffle whenever the question object changes
  $: if (question) {
    selected = null;
    answered = false;
    shuffledOptions = shuffle(question.options);
  }

  function select(option) {
    if (answered) return;
    selected = option;
    answered = true;

    dispatch("answered", {
      correct: option === question.correct
    });
  }

  function requestDelete() {
    dispatch("delete");
  }

  function shuffle(array) {
    return [...array].sort(() => Math.random() - 0.5);
  }

  $: isCorrect = selected === question.correct;
</script>

<div class="quiz">
  <div class="question-header">
    <h2 class="question-text">
      {question[fromLang] || `Error: Translation for "${fromLang}" not found.`}
    </h2>

    <button
      class="delete-circle"
      on:click={requestDelete}
      type="button"
      aria-label="Delete question"
    >
      ×
    </button>
  </div>

  {#each shuffledOptions as option}
    <button
      on:click={() => select(option)}
      disabled={answered}
      class:selected={option === selected}
      class:correct={answered && option === question.correct}
      class:wrong={answered && option === selected && option !== question.correct}
    >
      {option}
    </button>
  {/each}

  {#if answered}
    <p class={isCorrect ? "correct-text" : "wrong-text"}>
      {isCorrect ? "✅ Correct!" : "❌ Wrong — correct answer shown above"}
    </p>
  {/if}
</div>
<style>
  .quiz {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }

  button {
    padding: 0.6em;
    border-radius: 6px;
    border: none;
    cursor: pointer;
  }

  button.selected {
    outline: 2px solid #888;
  }

  button.correct {
    background-color: #4caf50;
    color: white;
  }

  button.wrong {
    background-color: #f44336;
    color: white;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.9;
  }

  .correct-text {
    color: #4caf50;
    font-weight: bold;
  }

  .wrong-text {
    color: #f44336;
    font-weight: bold;
  }
  .question-header {
    display: flex;
    align-items: center;
    width: 100%;
  }

  .question-text {
    margin: 0;
    line-height: 1.3;
    flex: 1;                  /* ← pushes button to the right */
  }

  button.delete-circle {
    margin-left: 0.75rem;     /* ← space between text and button */
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background-color: #e03131;
    color: white;
    border: none;
    font-size: 1.1rem;
    font-weight: bold;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  button.delete-circle:hover {
    background-color: #c92a2a;
  }


</style>
