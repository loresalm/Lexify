<script>
  import { createEventDispatcher } from "svelte";

  export let question;
  export let fromLang; 

  const dispatch = createEventDispatcher();

  let selected = null;
  let answered = false;
  let shuffledOptions = [];

  $: if (question) {
    selected = null;
    answered = false;
    shuffledOptions = shuffle(question.options);
  }

  function select(option) {
    if (answered) return;
    selected = option;
    answered = true;
    dispatch("answered", { correct: option === question.correct });
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
      class="delete-btn-rect"
      on:click={requestDelete}
      type="button"
      aria-label="Delete question"
    >
      Delete
    </button>
  </div>

  {#each shuffledOptions as option}
    <button
      on:click={() => select(option)}
      disabled={answered}
      class:selected={option === selected}
      class:correct={answered && option === question.correct}
      class:wrong={answered && option === selected && option !== question.correct}
      class="option-btn"
    >
      {option}
    </button>
  {/each}

  {#if answered}
    <p class={isCorrect ? "correct-text" : "wrong-text"}>
      {isCorrect ? "Correct" : "Wrong"}
    </p>
  {/if}
</div>

<style>
  .quiz {
    display: flex;
    flex-direction: column;
    gap: 0.4em; /* Slightly tighter gap */
  }

  /* General button styling for options */
  .option-btn {
    padding: 0.5em 0.7em; /* Slimmer padding */
    border-radius: 6px;
    border: none;
    cursor: pointer;
    background-color: rgba(255, 255, 255, 0.5);
    font-size: 0.9rem; /* REDUCED from 1rem */
    transition: all 0.2s ease;
  }

  .option-btn.selected {
    outline: 2px solid #888;
  }

  .option-btn.correct {
    background-color: #4caf50;
    color: white;
  }

  .option-btn.wrong {
    background-color: #f44336;
    color: white;
  }

  .option-btn:disabled {
    cursor: not-allowed;
    opacity: 0.9;
  }

  .correct-text {
    color: #4caf50; /* Fixed the stray comma from your snippet */
    font-weight: bold;
    text-align: center;
    font-size: 0.85rem; /* Slightly smaller feedback */
  }

  .wrong-text {
    color: #f44336;
    font-weight: bold;
    text-align: center;
    font-size: 0.85rem; /* Slightly smaller feedback */
  }

  .question-header {
    display: flex;
    align-items: center;
    width: 100%;
    margin-bottom: 0.75rem; /* Reduced margin */
  }

  .question-text {
    font-size: 1rem; /* REDUCED from 1.1rem */
    margin: 0;
    line-height: 1.2;
    flex: 1;
    color: #2c003e;
    font-weight: 600; /* Added weight so it stays readable at smaller size */
  }

  /* The New Rectangular Delete Button */
  button.delete-btn-rect {
    margin-left: 0.75rem;
    padding: 0.3rem 0.6rem; /* Slimmer padding */
    border-radius: 6px;
    background-color: #e03131;
    color: white;
    border: none;
    font-size: 0.65rem;    /* Reduced to keep header height low */
    font-weight: bold;
    text-transform: uppercase;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  button.delete-btn-rect:hover {
    background-color: #c92a2a;
  }
</style>