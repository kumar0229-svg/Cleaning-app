#!/bin/bash
set -e

APP_DIR="/home/ubuntu/cleaning-app"
cd "$APP_DIR"

echo "==> Pulling latest code..."
git pull origin main

echo "==> Installing backend dependencies..."
cd backend
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ..

echo "==> Building frontend..."
cd frontend
npm install --legacy-peer-deps
npm run build
cd ..

echo "==> Copying frontend build to Nginx..."
sudo cp -r frontend/build/* /var/www/cleaning-app/

echo "==> Restarting backend..."
sudo systemctl restart cleaning-backend

echo "==> Deploy complete!"
