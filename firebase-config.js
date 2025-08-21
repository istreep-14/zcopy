// Firebase configuration
// This file contains the actual Firebase API key and should not be committed to version control

export const firebaseConfig = {
  apiKey: "AIzaSyA07ZanY_LxDyEhWMlSWBo6LLRc2XqAsDk",
  authDomain: "smart-zetamac-coach.firebaseapp.com",
  projectId: "smart-zetamac-coach",
  storageBucket: "smart-zetamac-coach.firebasestorage.app",
  messagingSenderId: "79167404245",
  appId: "1:79167404245:web:8e3303bff31790d15fca5c"
};

export async function getFirebaseApiKey() {
  return firebaseConfig.apiKey;
}
