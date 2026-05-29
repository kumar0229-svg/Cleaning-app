#!/bin/bash
set -e

APP_DIR="/home/ubuntu/cleaning-app"
cd "$APP_DIR"

echo "==> Pulling latest code..."
# Preserve .env — git pull must not overwrite it
git fetch origin main
git reset --hard origin/main
# Restore .env if git reset removed it
if [ ! -f backend/.env ]; then
  echo "WARNING: .env missing after pull — backend may fail to start"
fi

echo "==> Installing backend dependencies..."
cd backend
source venv/bin/activate
pip install -r requirements.txt -q
deactivate
cd ..

echo "==> Building frontend..."
cd frontend
npm install --legacy-peer-deps --silent
CI=false npm run build
cd ..

echo "==> Copying frontend build to Nginx..."
sudo cp -r frontend/build/* /var/www/cleaning-app/

echo "==> Restarting backend..."
sudo systemctl restart cleaning-backend

echo "==> Deploy complete!"
