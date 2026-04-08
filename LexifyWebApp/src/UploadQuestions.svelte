<script>
  import { createEventDispatcher } from "svelte";
  import Button from "./Button.svelte";
  
  const dispatch = createEventDispatcher();
  
  let uploading = false;
  let message = "";
  
  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.name.endsWith('.json')) {
      message = "❌ Please upload a .json file";
      return;
    }
    
    uploading = true;
    message = "";
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate structure
      if (!Array.isArray(data)) {
        throw new Error("JSON must be an array");
      }
      
      // Validate each question
      for (let i = 0; i < data.length; i++) {
        const q = data[i];
        if (!q.correct || !q.german || !Array.isArray(q.options)) {
          throw new Error(`Question ${i + 1} is missing required fields: correct, german, options`);
        }
        if (q.options.length < 2) {
          throw new Error(`Question ${i + 1} must have at least 2 options`);
        }
        if (!q.options.includes(q.correct)) {
          throw new Error(`Question ${i + 1}: correct answer must be in options array`);
        }
      }
      
      // Success - send to parent
      dispatch("upload", { questions: data });
      message = `✅ ${data.length} questions validated successfully!`;
      
      // Reset file input
      event.target.value = "";
      
    } catch (error) {
      message = `❌ Error: ${error.message}`;
    } finally {
      uploading = false;
    }
  }
</script>

<div class="upload-container">
  <label class="upload-label">
    <input
      type="file"
      accept=".json"
      on:change={handleFileUpload}
      disabled={uploading}
    />
    <Button variant="primary" disabled={uploading} fullWidth>
      <span class="plus-icon">+</span>
      <span>Upload Questions</span>
    </Button>
  </label>
  
  {#if message}
    <p class="message">{message}</p>
  {/if}
</div>

<style>
  .upload-container {
    margin-bottom: 1rem;
  }
  
  .upload-label {
    display: block;
    cursor: pointer;
  }
  
  .upload-label input[type="file"] {
    display: none;
  }
  
  .plus-icon {
    font-size: 1.3rem;
    font-weight: bold;
  }
  
  .message {
    margin-top: 0.75rem;
    font-weight: 500;
    text-align: center;
    color: rgba(0, 0, 0, 0.7);
  }
  .message {
    margin-top: 1rem;
    padding: 0.8rem;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 500;
    text-align: center;
    
    /* Glass Effect */
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }
</style>