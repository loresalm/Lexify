# DeutschDash

DeutschDash is a focused language-learning tool designed to help you master vocabulary through custom quizzes and data-driven review. By combining personalized content with progress visualization, it turns daily practice into a measurable habit.

---

### Key Functionalities

#### 1. Smart Library Management
* **Custom Libraries:** Organize your learning by creating specific libraries (e.g., "Travel," "Business," or "Cooking").
* **JSON Integration:** Instantly populate your libraries by pasting JSON data or uploading .json files.
* **CRUD Actions:** Easily add, view, or delete individual questions and entire libraries.

#### 2. AI-Powered Prompting
* **Prompt Generator:** Use the built-in tool to generate structured prompts for Large Language Models.
* **Custom Constraints:** Specify the exact number of questions and the specific topic to receive perfectly formatted JSON for your study sessions.

#### 3. Data-Driven Quiz Modes
Tailor your review sessions based on your actual performance:
* **Random:** A standard shuffle for general practice.
* **Worst:** A targeted mode that prioritizes questions with the lowest success rate.
* **Newest:** A chronological review that focuses on recently added material to reinforce fresh concepts.

#### 4. Progress Tracking
* **Activity Calendar:** Visualize consistency with a GitHub-style contribution heat map that tracks daily question volume.
* **Real-time Stats:** The system tracks attempts and success rates for every question, updating mastery levels dynamically.

#### 5. User Experience
* **Secure Authentication:** Firebase-powered login keeps libraries and progress synced across devices.
* **Glassmorphism UI:** A modern, semi-transparent interface designed to minimize distractions and provide a focused learning environment.

---

### Tech Stack
* **Frontend:** Svelte
* **Backend and Database:** Firebase Firestore
* **Authentication:** Firebase Auth
* **Styling:** CSS3 with Backdrop-filters and Flexbox layouts.

---

### How It Works
1. **Authenticate:** Log in via the secure portal.
2. **Create or Select Library:** Choose a language pair and create a new deck.
3. **Add Content:** Navigate to the Generate and Upload screen to paste JSON questions.
4. **Quiz:** Select a mode—the Worst mode is recommended for addressing knowledge gaps—and start practicing.
5. **Analyze:** Monitor the Activity Calendar at the bottom of the screen to maintain learning streaks and track long-term progress.