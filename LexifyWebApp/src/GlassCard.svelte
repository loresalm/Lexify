<script>
  export let maxWidth = "420px";
</script>

<div class="glass-card" style="max-width: {maxWidth}">
  <slot />
</div>

<style>
  .glass-card {
    width: 100%;
    margin-bottom: 1.25rem;
    padding: 1.25rem;

    background: rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);

    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.3);

    box-shadow:
      0 20px 40px rgba(0, 0, 0, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.25);
  }
</style>