<script>
  export let variant = "default"; // default, primary, danger
  export let type = "button";
  export let disabled = false;
  export let fullWidth = false;
  export let className = "";
</script>

<button
  {type}
  {disabled}
  class={variant}
  class:full-width={fullWidth}
  on:click
>
  <slot />
</button>

<style>
  button {
    padding: 0.75rem 1.5rem;
    border-radius: 50px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    transition: all 0.3s ease;
    backdrop-filter: blur(8px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  button:hover:not(:disabled) {
    transform: scale(1.02);
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    transform: none;
  }

  /* Variants */
  button.default {
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border-color: rgba(255, 255, 255, 0.3);
  }

  button.default:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.85);
  }

  button.primary {
    background: rgba(77, 171, 247, 0.8);
    color: white;
    border-color: rgba(77, 171, 247, 0.5);
  }

  button.primary:hover:not(:disabled) {
    background: rgba(77, 171, 247, 0.95);
  }

  button.danger {
    background: rgba(224, 49, 49, 0.8);
    color: white;
    border-color: rgba(224, 49, 49, 0.5);
  }

  button.danger:hover:not(:disabled) {
    background: rgba(201, 42, 42, 0.95);
  }

  button.full-width {
    width: 100%;
  }
</style>