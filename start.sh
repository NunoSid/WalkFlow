#!/usr/bin/env bash
set -euo pipefail

echo "Starting WalkFlow..."

if [ ! -f "server/.env" ] && [ -f "server/.env.example" ]; then
  echo "server/.env not found / nao encontrado."
  read -r -p "Create server/.env from .env.example? / Criar server/.env a partir de .env.example? (y/S for yes, enter to skip): " create_env
  if [[ "${create_env:-}" =~ ^[yYsS]$ ]]; then
    echo "Creating server/.env from .env.example..."
    cp "server/.env.example" "server/.env"
  else
    echo "Continuing without server/.env (create it manually if needed)."
  fi
fi

if [ ! -d "server/node_modules" ]; then
  echo "Installing server dependencies..."
  npm --prefix server install
fi

if [ ! -d "client/node_modules" ]; then
  echo "Installing client dependencies..."
  npm --prefix client install
fi

echo "Preparing database..."
(cd server && npx prisma migrate dev --name init)
(cd server && npx ts-node src/seed.ts)

echo "Starting backend (http://localhost:3000)..."
npm --prefix server run dev &
SERVER_PID=$!

echo "Starting frontend (http://localhost:5173)..."
npm --prefix client run dev &
CLIENT_PID=$!

trap 'kill $SERVER_PID $CLIENT_PID' EXIT
wait
