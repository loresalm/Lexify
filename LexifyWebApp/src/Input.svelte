<script>
  export let type = "text";
  export let placeholder = "";
  export let value = "";
  export let disabled = false;
</script>

<input
  {type}
  {placeholder}
  {disabled}
  bind:value
  on:input
  on:focus
  on:blur
/>

<style>
  input {
    padding: 0.75rem 1rem;
    border-radius: 50px;
    border: 2px solid rgba(0, 0, 0, 0.2);
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(8px);
    font-size: 1rem;
    transition: all 0.3s ease;
    width: 100%;
    box-sizing: border-box;
  }

  input:focus {
    outline: none;
    border-color: rgba(77, 171, 247, 0.6);
    background: rgba(255, 255, 255, 0.8);
  }

  input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>