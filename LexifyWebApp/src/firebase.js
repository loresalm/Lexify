import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  writeBatch, 
  deleteDoc 
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

/* ================= AUTH ================= */

export async function ensureUserDoc(userId) {
  const ref = doc(db, "users", userId);
  await setDoc(ref, { lastLogin: Date.now() }, { merge: true });
}

export async function signInWithGoogle() {
  await signInWithPopup(auth, googleProvider);
}

export async function registerWithEmail(email, password) {
  const res = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(res.user);
  return res.user;
}

export async function loginWithEmail(email, password) {
  const res = await signInWithEmailAndPassword(auth, email, password);
  return res.user;
}

export function logout() {
  return signOut(auth);
}

/* =============== CALENDAR & ACTIVITY =============== */

export async function loadCalendar(userId) {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data().calendar || {};
  }
  await setDoc(ref, { calendar: {} }, { merge: true });
  return {};
}

export async function incrementQuiz(userId, date) {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  const calendar = snap.exists() ? snap.data().calendar || {} : {};
  
  calendar[date] = (parseInt(calendar[date] || 0) + 1).toString();
  await setDoc(ref, { calendar }, { merge: true });
  return calendar;
}

/* =============== CORE QUIZ LOGIC =============== */

/**
 * SEEDING: When a library is first opened, it checks the global 'quizzes'
 * collection for the specific language pair and copies 3 questions over.
 */
export async function ensureUserQuestions(userId, libraryId) {
  const libRef = doc(db, "users", userId, "libraries", libraryId);
  const libSnap = await getDoc(libRef);
  
  if (!libSnap.exists()) return;
  const { fromLang, toLang } = libSnap.data();
  const pairKey = `${fromLang}_${toLang}`; 

  const libQuestionsRef = collection(db, "users", userId, "libraries", libraryId, "questions");
  const snap = await getDocs(libQuestionsRef);
  
  // If questions already exist, don't seed again
  if (!snap.empty) return;

  // Fetch from the 'quizzes' collection we uploaded earlier
  const quizRef = doc(db, "quizzes", pairKey);
  const quizSnap = await getDoc(quizRef);

  if (quizSnap.exists()) {
    const batch = writeBatch(db);
    const quizData = quizSnap.data();

    Object.entries(quizData).forEach(([key, q]) => {
      const newDocRef = doc(libQuestionsRef); 
      batch.set(newDocRef, {
        ...q,
        tries: 0,
        successRate: 0,
        correctCount: 0,
        score: 0, // simple metric: correct - wrong
        createdAt: Date.now()
      });
    });
    await batch.commit();
  }
}

/**
 * STATS: Updates fields directly on the question document.
 * This is faster than maintaining a massive global stats object.
 */
export async function updateQuestionStats(userId, libraryId, questionId, isCorrect) {
  const qRef = doc(db, "users", userId, "libraries", libraryId, "questions", questionId);
  const qSnap = await getDoc(qRef);

  if (!qSnap.exists()) return;

  const data = qSnap.data();
  const newTries = (data.tries || 0) + 1;
  const newCorrectCount = (data.correctCount || 0) + (isCorrect ? 1 : 0);
  const newSuccessRate = Math.round((newCorrectCount / newTries) * 100);
  const newScore = isCorrect ? (data.score || 0) + 1 : (data.score || 0) - 1;

  await setDoc(qRef, {
    tries: newTries,
    correctCount: newCorrectCount,
    successRate: newSuccessRate,
    score: newScore
  }, { merge: true });
}

/**
 * Optional: Kept for legacy support if needed, but App.svelte should 
 * now rely on fields within the question documents themselves.
 */
export async function loadUserStats(userId) {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().stats || {} : {};
}

/* =============== DATA MANAGEMENT =============== */

export async function deleteUserQuestion(userId, questionId, libraryId) {
  const ref = doc(db, "users", userId, "libraries", libraryId, "questions", questionId);
  await deleteDoc(ref);
}

export async function addQuestionsFromJSON(userId, questionsArray, libraryId) {
  const batch = writeBatch(db);
  const libQuestionsRef = collection(db, "users", userId, "libraries", libraryId, "questions");

  questionsArray.forEach((question) => {
    const questionRef = doc(libQuestionsRef);
    batch.set(questionRef, {
      ...question,
      tries: 0,
      successRate: 0,
      correctCount: 0,
      score: 0,
      createdAt: Date.now()
    });
  });

  await batch.commit();
}


export async function deleteLibrary(userId, libId) {
  const batch = writeBatch(db);

  // 1. Get all questions inside this library first
  const qCol = collection(db, "users", userId, "libraries", libId, "questions");
  const qSnap = await getDocs(qCol);

  // 2. Add each question to the deletion batch
  qSnap.forEach((qDoc) => {
    batch.delete(qDoc.ref);
  });

  // 3. Add the library document itself to the batch
  const libRef = doc(db, "users", userId, "libraries", libId);
  batch.delete(libRef);

  // 4. Execute the whole thing at once
  await batch.commit();
}