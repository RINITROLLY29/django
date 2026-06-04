import firebase_admin
from firebase_admin import credentials
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CRED_PATH = os.path.join(BASE_DIR, "serviceAccountKey.json")

def initialize_firebase():
    """
    Initializes Firebase safely. 
    Checks if an app is already initialized to prevent crashes.
    """
    try:
        # Check if Firebase is already initialized
        firebase_admin.get_app()
        print("Firebase Admin SDK already initialized.")
    except ValueError:
        # If get_app() raises a ValueError, no app exists, so we initialize it
        if os.path.exists(CRED_PATH):
            try:
                cred = credentials.Certificate(CRED_PATH)
                firebase_admin.initialize_app(cred)
                print("Firebase Admin SDK initialized successfully.")
            except Exception as e:
                print(f"FAILED to initialize Firebase: {e}")
        else:
            print(f"CRITICAL ERROR: serviceAccountKey.json NOT FOUND at: {CRED_PATH}")

# Call the function immediately upon import
initialize_firebase()