# 1. Use an official lightweight Python image
FROM python:3.11-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy the script
COPY export_firestore.py .

# 4. Install BOTH Firebase Admin and Firestore libraries
RUN pip install --no-cache-dir firebase-admin google-cloud-firestore

# 5. Run the script
CMD ["python", "export_firestore.py"]