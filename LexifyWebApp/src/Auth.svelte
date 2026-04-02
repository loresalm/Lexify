<script>
  import {
    signInWithGoogle,
    registerWithEmail,
    loginWithEmail
  } from "./firebase";
  import Button from "./Button.svelte";


  let email = "";
  let password = "";
  let message = "";

  async function google() {
    try {
      await signInWithGoogle();
    } catch (e) {
      message = e.message;
    }
  }

  async function register() {
    try {
      await registerWithEmail(email, password);
      message = "Check your email to verify your account.";
    } catch (e) {
      message = e.message;
    }
  }

  async function login() {
    try {
      await loginWithEmail(email, password);
    } catch (e) {
      message = e.message;
    }
  }
</script>

<div class="auth">
  <h2>Login / Register</h2>

  <Button variant="primary" on:click={google} fullWidth>
    Sign in with Google
  </Button>

  <hr />

  <input placeholder="Email" bind:value={email} />
  <input type="password" placeholder="Password" bind:value={password} />

  <Button on:click={login}>Login</Button>
  <Button variant="primary" on:click={register}>Register</Button>

  {#if message}
    <p>{message}</p>
  {/if}
</div>
