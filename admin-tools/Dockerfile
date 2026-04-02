# 1. Use an official lightweight Python image
FROM python:3.11-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy the script, the data, and the credentials
# Make sure these files are in the same folder as this Dockerfile
COPY upload_quiz.py .
COPY init_q.json .
COPY serviceAccountKey.json .

# 4. Install the Firebase Admin SDK
# (firebase-admin includes google-cloud-firestore as a dependency)
RUN pip install --no-cache-dir firebase-admin

# 5. Run the upload script
CMD ["python", "upload_quiz.py"]