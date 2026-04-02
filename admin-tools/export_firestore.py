import firebase_admin
from firebase_admin import credentials, firestore
import json

# 1. Setup Authentication using the external JSON file
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)

db = firestore.client()

def download_database():
    all_data = {}

    # 2. Get all root-level collections
    collections = db.collections()

    for coll in collections:
        print(f"Downloading collection: {coll.id}...")
        all_data[coll.id] = {}
        
        # 3. Get all documents in the collection
        docs = coll.stream()
        for doc in docs:
            all_data[coll.id][doc.id] = doc.to_dict()

    # 4. Save to a local file
    with open("firestore_backup.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, indent=4, ensure_ascii=False)
    
    print("\nSuccess! Data saved to firestore_backup.json")

if __name__ == "__main__":
    download_database()