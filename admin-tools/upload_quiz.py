import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import json
import os

def upload_quiz_data():
    # 1. Setup Firebase Admin SDK
    # Ensure serviceAccountKey.json is in the same directory
    cred_path = 'serviceAccountKey.json'
    
    if not os.path.exists(cred_path):
        print("Error: serviceAccountKey.json not found!")
        return

    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    # 2. Load your JSON file
    file_path = 'init_q.json'
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found!")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 3. Upload to Firestore
    # We will create a collection called 'quizzes'
    # Each language pair (e.g., 'italian_english') will be a document
    collection_name = 'quizzes'
    
    print(f"Starting upload to collection: {collection_name}...")

    for lang_pair, questions in data.items():
        try:
            # Using the language pair as the Document ID for easy retrieval
            doc_ref = db.collection(collection_name).document(lang_pair)
            doc_ref.set(questions)
            print(f"Successfully uploaded: {lang_pair}")
        except Exception as e:
            print(f"Failed to upload {lang_pair}: {e}")

    print("\nUpload complete!")

if __name__ == "__main__":
    upload_quiz_data()