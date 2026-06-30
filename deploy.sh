#!/usr/bin/env bash

# ==============================================================================
# Web License Manager - VPS Deployment Automation Script
# Supported OS: Ubuntu 24.04 LTS (and Ubuntu 22.04 LTS)
# Description: Automates the setup of PostgreSQL, FastAPI backend, Next.js frontend,
#              Nginx Reverse Proxy, and SSL (Certbot) on a single custom domain.
# ==============================================================================

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
  echo -e "\033[1;31mError: Please run this script as root (using sudo): sudo ./deploy.sh\033[0m"
  exit 1
fi

# Visual header
echo -e "\033[1;34m=========================================================\033[0m"
echo -e "\033[1;34m   LICENSE KEY MANAGER - VPS AUTOMATED DEPLOYMENT        \033[0m"
echo -e "\033[1;34m=========================================================\033[0m"
echo ""

# ==============================================================================
# Cáº¤U HÃŒNH TÃŠN MIá»€N (DOMAIN) Cá»¦A Báº N Táº I ÄÃ‚Y:
DOMAIN="vuihappy.com"
# ==============================================================================

if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "license.yourdomain.com" ]; then
  echo -e "\033[1;33mNháº¯c nhá»Ÿ: HÃ£y chá»‰nh sá»­a file deploy.sh Ä‘á»ƒ Ä‘iá»n Ä‘Ãºng tÃªn miá»n cá»§a báº¡n.\033[0m"
  read -p "Hoáº·c nháº­p tÃªn miá»n cá»§a báº¡n ngay bÃ¢y giá»: " INPUT_DOMAIN
  if [ ! -z "$INPUT_DOMAIN" ]; then
    DOMAIN="$INPUT_DOMAIN"
  fi
fi

if [ -z "$DOMAIN" ]; then
  echo -e "\033[1;31mError: Custom domain cannot be empty.\033[0m"
  exit 1
fi

# Get database password or auto-generate
read -sp "Enter PostgreSQL password for 'license_user' (press Enter to auto-generate): " DB_PASSWORD
echo ""
if [ -z "$DB_PASSWORD" ]; then
  DB_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9')
  echo -e "\033[1;32mAuto-generated database password: $DB_PASSWORD\033[0m"
fi

# Escape single quotes in password for SQL queries (replace ' with '')
ESCAPED_DB_PASSWORD=$(python3 -c "import sys; print(sys.argv[1].replace(\"'\", \"''\"))" "$DB_PASSWORD")

# URL-encode the password for the connection string
ENCODED_DB_PASSWORD=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote_plus(sys.argv[1]))" "$DB_PASSWORD")


# Determine SCRIPT_DIR and execution users
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REAL_USER=${SUDO_USER:-$USER}
REAL_HOME=$(eval echo ~$REAL_USER)

echo -e "\033[1;33m\n[1/7] Updating system and installing system packages...\033[0m"
apt update
apt install -y python3 python3-pip python3-venv git curl build-essential postgresql postgresql-contrib nginx certbot python3-certbot-nginx

# Install Node.js v20 LTS
echo -e "\033[1;33m\n[2/7] Installing Node.js v20 LTS...\033[0m"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Configure PostgreSQL database
echo -e "\033[1;33m\n[3/7] Setting up PostgreSQL database (port 5433)...\033[0m"
CONF_FILES=$(find /etc/postgresql/ -name "postgresql.conf")
for conf in $CONF_FILES; do
  echo "Configuring PostgreSQL port to 5433 in $conf..."
  sed -i "s/#port = 5432/port = 5433/g" "$conf"
  sed -i "s/port = 5432/port = 5433/g" "$conf"
done
systemctl restart postgresql
systemctl enable postgresql

# Create Database, User, and Grant Privileges
echo "Creating database license_manager..."
sudo -u postgres psql -p 5433 -c "CREATE DATABASE license_manager;" 2>&1 | grep -E -v "already exists|already exists"

echo "Creating database user..."
sudo -u postgres psql -p 5433 -c "CREATE USER license_user WITH PASSWORD '$ESCAPED_DB_PASSWORD';" 2>&1 | grep -E -v "already exists|already exists"

echo "Updating database user password..."
if ! sudo -u postgres psql -p 5433 -c "ALTER USER license_user WITH PASSWORD '$ESCAPED_DB_PASSWORD';" ; then
    echo -e "\033[1;31mError: Failed to update password for user 'license_user' in PostgreSQL.\033[0m"
    exit 1
fi

echo "Granting database privileges..."
if ! sudo -u postgres psql -p 5433 -c "GRANT ALL PRIVILEGES ON DATABASE license_manager TO license_user;" ; then
    echo -e "\033[1;31mError: Failed to grant database privileges to 'license_user'.\033[0m"
    exit 1
fi

echo "Granting schema privileges..."
if ! sudo -u postgres psql -p 5433 -d license_manager -c "GRANT ALL ON SCHEMA public TO license_user;" ; then
    echo -e "\033[1;31mError: Failed to grant schema privileges on public to 'license_user'.\033[0m"
    exit 1
fi

# Setup Backend environment and libraries
echo -e "\033[1;33m\n[4/7] Setting up Backend virtual environment & migrations...\033[0m"
cd "$SCRIPT_DIR/backend"

# Recreate virtualenv if it exists or create new
if [ -d "venv" ]; then
  rm -rf venv
fi
python3 -m venv venv
chown -R $REAL_USER:$REAL_USER venv

# Upgrade pip & install requirements under real user
sudo -u $REAL_USER ./venv/bin/pip install --upgrade pip
sudo -u $REAL_USER ./venv/bin/pip install -r requirements.txt

# Generate secure random secret keys
SECRET_KEY=$(openssl rand -hex 32)
PASSWORD_CHANGE_AUTH_CODE=$(openssl rand -hex 16)

# Write backend .env file
cat <<EOT > "$SCRIPT_DIR/backend/.env"
PROJECT_NAME="License Key Manager"
DATABASE_URL=postgresql+asyncpg://license_user:$ENCODED_DB_PASSWORD@127.0.0.1:5433/license_manager
SECRET_KEY=$SECRET_KEY
ACCESS_TOKEN_EXPIRE_MINUTES=1440
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=admin_password_123
PASSWORD_CHANGE_AUTH_CODE=$PASSWORD_CHANGE_AUTH_CODE
ALLOWED_ORIGINS=["https://$DOMAIN", "http://$DOMAIN"]
EOT
chown $REAL_USER:$REAL_USER "$SCRIPT_DIR/backend/.env"

# Test PostgreSQL database connection
echo "Testing database connection..."
if ! sudo -u $REAL_USER ./venv/bin/python -c "
import asyncio, sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
async def test():
    engine = create_async_engine('postgresql+asyncpg://license_user:$ENCODED_DB_PASSWORD@127.0.0.1:5433/license_manager')
    try:
        async with engine.connect() as conn:
            await conn.execute(text('SELECT 1'))
        print('Database connection test successful.')
    except Exception as e:
        print(f'Database connection test failed: {e}', file=sys.stderr)
        sys.exit(1)
asyncio.run(test())
" ; then
    echo -e "\033[1;31mError: Database connection test failed. Aborting deployment.\033[0m"
    echo -e "\033[1;33m\n=== DIAGNOSTIC INFORMATION ===\033[0m"
    echo "1. Checking active PostgreSQL systemd services..."
    systemctl status postgresql --no-pager || true
    echo "2. Checking listening ports on the system (port 5432 and 5433)..."
    ss -tlnp | grep -E "5432|5433" || netstat -tlnp | grep -E "5432|5433" || true
    echo "3. Checking running postgres processes..."
    ps aux | grep -E "postgres|postmaster" | grep -v grep || true
    echo "4. Checking default psql version..."
    psql --version || true
    echo "5. Testing connection via local Unix socket using psql on port 5433..."
    sudo -u postgres psql -p 5433 -l || true
    exit 1
fi

# Execute database migration and seed admin account
echo "Running alembic migrations & database seeding..."
sudo -u $REAL_USER ./venv/bin/alembic upgrade head
sudo -u $REAL_USER ./venv/bin/python -c "
import asyncio
from app.db.init_db import setup_database
asyncio.run(setup_database())
" || echo "Database seeding finished."

# Create systemd service for Backend
echo "Configuring systemd service for Backend..."
cat <<EOT > /etc/systemd/system/license-backend.service
[Unit]
Description=FastAPI License Key Manager Backend
After=network.target postgresql.service

[Service]
User=$REAL_USER
WorkingDirectory=$SCRIPT_DIR/backend
ExecStart=$SCRIPT_DIR/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
EnvironmentFile=$SCRIPT_DIR/backend/.env

[Install]
WantedBy=multi-user.target
EOT

systemctl daemon-reload
systemctl enable license-backend
systemctl restart license-backend

# Setup Frontend Next.js app
echo -e "\033[1;33m\n[5/7] Building Frontend Next.js application...\033[0m"
cd "$SCRIPT_DIR/frontend"

# Clear frontend .env before building. The frontend uses the browser current origin in production,
# so changing domains does not require baking a new API URL into the JavaScript bundle.
cat <<EOT > "$SCRIPT_DIR/frontend/.env"
# NEXT_PUBLIC_API_URL is intentionally unset for same-domain deployments.
# Set it only if the API runs on a different domain.
EOT
chown $REAL_USER:$REAL_USER "$SCRIPT_DIR/frontend/.env"

# Install packages and build frontend
sudo -u $REAL_USER npm install
sudo -u $REAL_USER npm run build

# Find npm binary path
NPM_PATH=$(which npm)

# Create systemd service for Next.js Frontend
echo "Configuring systemd service for Frontend..."
cat <<EOT > /etc/systemd/system/license-frontend.service
[Unit]
Description=NextJS License Key Manager Frontend
After=network.target

[Service]
User=$REAL_USER
WorkingDirectory=$SCRIPT_DIR/frontend
ExecStart=$NPM_PATH run start -- --port 3000
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOT

systemctl daemon-reload
systemctl enable license-frontend
systemctl restart license-frontend

# Configure Nginx reverse proxy
echo -e "\033[1;33m\n[6/7] Configuring Nginx Reverse Proxy...\033[0m"
cat <<EOT > /etc/nginx/sites-available/license-manager
server {
    listen 80;
    server_name $DOMAIN;

    # Forward API requests to FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Forward remaining requests to NextJS
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOT

# Enable Nginx configuration site
ln -sf /etc/nginx/sites-available/license-manager /etc/nginx/sites-enabled/
# Remove default site if it exists to prevent conflict
rm -f /etc/nginx/sites-enabled/default

# Test Nginx syntax and restart
nginx -t
systemctl restart nginx

# Setup SSL/HTTPS with Let's Encrypt Certbot
echo -e "\033[1;33m\n[7/7] Configuring SSL/HTTPS with Certbot...\033[0m"
echo "NOTE: Make sure your DNS record for '$DOMAIN' already points to this VPS IP address."
read -p "Would you like to run Let's Encrypt Certbot right now? (y/n): " RUN_CERTBOT
if [[ "$RUN_CERTBOT" =~ ^[Yy]$ ]]; then
  certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN --redirect
else
  echo -e "\033[1;35mSkipped Certbot configuration. You must set up SSL manually for HTTPS later.\033[0m"
fi

# Output credentials and information summary
echo ""
echo -e "\033[1;32m=========================================================\033[0m"
echo -e "\033[1;32m   DEPLOYMENT COMPLETED SUCCESSFULLY!                     \033[0m"
echo -e "\033[1;32m=========================================================\033[0m"
echo ""
echo -e "Your Website is hosted at: \033[1;36mhttps://$DOMAIN\033[0m"
echo -e "API Endpoint prefix is at: \033[1;36mhttps://$DOMAIN/api\033[0m"
echo -e "API Swagger docs are at:   \033[1;36mhttps://$DOMAIN/api/docs\033[0m"
echo ""
echo -e "\033[1;33m[Administrative Credentials]\033[0m"
echo -e "- Initial Admin Username:  \033[1;37madmin\033[0m"
echo -e "- Initial Admin Password:  \033[1;37madmin_password_123\033[0m \033[1;31m(Change this immediately in settings)\033[0m"
echo -e "- Password Security Code:  \033[1;37m$PASSWORD_CHANGE_AUTH_CODE\033[0m \033[1;35m(Required for password and category deletions)\033[0m"
echo ""
echo -e "\033[1;33m[Database Credentials]\033[0m"
echo -e "- Database Name:           \033[1;37mlicense_manager\033[0m"
echo -e "- Database Username:       \033[1;37mlicense_user\033[0m"
echo -e "- Database Password:       \033[1;37m$DB_PASSWORD\033[0m"
echo -e "- Database Port:           \033[1;37m5433\033[0m"
echo ""
echo -e "You can manage services using systemctl:"
echo -e "  - Backend Status:  \033[1;35msudo systemctl status license-backend\033[0m"
echo -e "  - Frontend Status: \033[1;35msudo systemctl status license-frontend\033[0m"
echo -e "  - Nginx Status:    \033[1;35msudo systemctl status nginx\033[0m"
echo -e "========================================================="
