# Hướng dẫn triển khai (Deployment Guide) - Ubuntu VPS

Tài liệu này hướng dẫn chi tiết cách cài đặt và triển khai hệ thống **License Key Manager** (bao gồm FastAPI backend, Next.js frontend, PostgreSQL database và Nginx proxy) trực tiếp trên một máy chủ VPS chạy hệ điều hành **Ubuntu 22.04 LTS** hoặc mới hơn mà không dùng Docker.

---

## ⚡ Cách 1: Triển khai Tự Động bằng Script (Khuyên dùng)

Dự án đã được tích hợp sẵn một script shell `deploy.sh` giúp tự động hóa toàn bộ quy trình cài đặt các gói hệ thống, cấu hình PostgreSQL, setup Backend, build Frontend Next.js, cài đặt Nginx Reverse Proxy và lấy chứng chỉ SSL Let's Encrypt.

### Các bước thực hiện:

1. **Chuẩn bị tên miền (Domain)**:
   - Hãy chắc chắn rằng bạn đã trỏ bản ghi DNS (bản ghi `A`) của tên miền (ví dụ: `license.yourdomain.com`) về địa chỉ IP của VPS của bạn.

2. **Tải mã nguồn về VPS**:
   ```bash
   sudo mkdir -p /var/www/license-manager
   sudo chown -R $USER:$USER /var/www/license-manager
   cd /var/www/license-manager
   git clone <URL_REPO_CUA_BAN> .
   ```

3. **Chạy script deploy tự động**:
   ```bash
   sudo chmod +x deploy.sh
   sudo ./deploy.sh
   ```
   Script sẽ yêu cầu bạn nhập tên miền (domain) của bạn và mật khẩu PostgreSQL (nếu không nhập sẽ tự tạo ngẫu nhiên). Ở cuối quy trình, script sẽ hỏi bạn có muốn cài đặt chứng chỉ SSL tự động thông qua Certbot không, hãy chọn `y` (Yes) và làm theo hướng dẫn.

---

## 🛠️ Cách 2: Triển khai Thủ công từng bước

Dưới đây là chi tiết các bước cài đặt thủ công nếu bạn muốn tự kiểm soát cấu hình:

### 1. Chuẩn bị Hệ thống và Cài đặt Packages

Cập nhật danh sách gói và cài đặt các thư viện hệ thống cần thiết (bao gồm Python, Node.js, PostgreSQL, Nginx và Certbot):

```bash
sudo apt update && sudo apt upgrade -y

# Cài đặt Python 3 và các công cụ venv, pip
sudo apt install -y python3 python3-pip python3-venv git curl build-essential

# Cài đặt PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Cài đặt Nginx
sudo apt install -y nginx

# Cài đặt Certbot cho SSL Nginx
sudo apt install -y certbot python3-certbot-nginx
```

### Cài đặt Node.js (phiên bản v20 LTS hoặc mới hơn)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 2. Cấu hình Cơ sở dữ liệu PostgreSQL

Kết nối vào tài khoản PostgreSQL mặc định để tạo Database và User riêng cho ứng dụng:

```bash
sudo -i -u postgres psql
```

Trong giao diện psql dòng lệnh, chạy các lệnh sau (thay thế mật khẩu bằng mật khẩu mạnh của bạn):

```sql
-- Tạo cơ sở dữ liệu
CREATE DATABASE license_manager;

-- Tạo người dùng quản trị cơ sở dữ liệu
CREATE USER license_user WITH PASSWORD 'MatKhauSieuManh_123';

-- Cấp quyền toàn quyền cho user trên database
GRANT ALL PRIVILEGES ON DATABASE license_manager TO license_user;

-- Đối với PostgreSQL 15 trở lên, cần cấp thêm quyền tạo schema
\c license_manager
GRANT ALL ON SCHEMA public TO license_user;

-- Thoát psql
\q
```

---

## 3. Triển khai Mã nguồn & Cấu hình Backend (FastAPI)

Di chuyển mã nguồn của dự án vào thư mục `/var/www/license-manager` (hoặc vị trí mong muốn):

```bash
sudo mkdir -p /var/www/license-manager
sudo chown -R $USER:$USER /var/www/license-manager
cd /var/www/license-manager
# (Clone code của bạn từ repository vào đây)
```

### Setup Python Virtualenv và Cài đặt Thư viện
```bash
cd /var/www/license-manager/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Cấu hình biến môi trường
Tạo file `.env` từ file `.env.example` và điều chỉnh cấu hình kết nối database cũng như JWT key:

```bash
cp .env.example .env
nano .env
```

Nội dung file `.env` trên VPS cần trỏ tới PostgreSQL:
```env
PROJECT_NAME="License Key Manager"
DATABASE_URL=postgresql+asyncpg://license_user:MatKhauSieuManh_123@127.0.0.1:5432/license_manager
SECRET_KEY=sua_chuoi_hex_ngau_nhien_tai_day_de_bao_mat_tot_nhat
ACCESS_TOKEN_EXPIRE_MINUTES=1440
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=admin_password_changed
PASSWORD_CHANGE_AUTH_CODE=replace_with_a_separate_strong_secret
ALLOWED_ORIGINS=["https://yourdomain.com"]
```

### Chạy Database Migrations và Seed Admin mặc định
```bash
# Đang trong venv
alembic upgrade head
python app/db/seed.py
```

---

## 4. Cấu hình Service Systemd chạy Backend

Tạo một systemd service file để quản lý tiến trình FastAPI backend chạy ngầm và tự khởi động lại:

```bash
sudo nano /etc/systemd/system/license-backend.service
```

Thêm nội dung sau vào file:
```ini
[Unit]
Description=FastAPI License Key Manager Backend
After=network.target postgresql.service

[Service]
User=ubuntu
WorkingDirectory=/var/www/license-manager/backend
ExecStart=/var/www/license-manager/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
EnvironmentFile=/var/www/license-manager/backend/.env

[Install]
WantedBy=multi-user.target
```

Kích hoạt và khởi động backend service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable license-backend
sudo systemctl start license-backend

# Kiểm tra trạng thái hoạt động
sudo systemctl status license-backend
```

---

## 5. Triển khai & Cấu hình Frontend (Next.js)

Di chuyển vào thư mục frontend, tạo file cấu hình môi trường và tiến hành build mã nguồn:

```bash
cd /var/www/license-manager/frontend
cp .env.example .env
nano .env
```

Nội dung file `.env` của frontend trỏ sang API backend (trong cấu hình Nginx bên dưới, chúng ta sẽ chuyển tiếp `/api` đến backend, nên Next.js có thể gọi tương đối hoặc gọi trực tiếp):
```env
NEXT_PUBLIC_API_URL=https://yourdomain.com
```

### Cài đặt dependencies và Build ứng dụng
```bash
npm install
npm run build
```

### Cấu hình Service Systemd chạy Next.js Frontend
Tạo file service systemd để khởi chạy Next.js Server (ở port 3000):

```bash
sudo nano /etc/systemd/system/license-frontend.service
```

Thêm nội dung sau (đảm bảo đường dẫn `node` và `npm` chính xác, có thể kiểm tra bằng lệnh `which npm` hoặc `which node`):
```ini
[Unit]
Description=NextJS License Key Manager Frontend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/var/www/license-manager/frontend
ExecStart=/usr/bin/npm run start -- --port 3000
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Kích hoạt và khởi động frontend service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable license-frontend
sudo systemctl start license-frontend

# Kiểm tra trạng thái hoạt động
sudo systemctl status license-frontend
```

---

## 6. Cấu hình Nginx Reverse Proxy và SSL HTTPS

Tạo cấu hình Nginx để điều hướng người dùng và tích hợp API:

```bash
sudo nano /etc/nginx/sites-available/license-manager
```

Thêm cấu hình Nginx (thay thế `yourdomain.com` bằng tên miền trỏ tới VPS của bạn):

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Chuyển tiếp các request /api sang FastAPI Backend (port 8000)
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Chuyển tiếp các request còn lại sang Next.js Frontend (port 3000)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Kích hoạt cấu hình mới và khởi động lại Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/license-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Cấu hình SSL HTTPS miễn phí với Let's Encrypt
```bash
sudo certbot --nginx -d yourdomain.com
```
Thực hiện theo các bước hướng dẫn của Certbot để tự động thiết lập chứng chỉ SSL và tự động cấu hình redirect từ HTTP sang HTTPS.

---

## 7. Sao lưu Cơ sở dữ liệu và Bảo trì

### Kịch bản sao lưu PostgreSQL tự động hằng ngày
Tạo một script sao lưu đơn giản tại `/var/www/license-manager/backup.sh`:
```bash
nano /var/www/license-manager/backup.sh
```

Nội dung script:
```bash
#!/bin/bash
BACKUP_DIR="/var/www/license-manager/backups"
mkdir -p $BACKUP_DIR
FILENAME="$BACKUP_DIR/license_manager_$(date +%F_%H-%M-%S).sql"
pg_dump -U license_user -h 127.0.0.1 license_manager > $FILENAME
# Chỉ giữ lại bản sao lưu của 7 ngày gần nhất
find $BACKUP_DIR -type f -mtime +7 -name "*.sql" -delete
```
Cấp quyền chạy script: `chmod +x /var/www/license-manager/backup.sh`

Thêm cron job để chạy tự động lúc 2:00 AM mỗi ngày bằng cách gõ `crontab -e` và dán dòng sau:
```cron
0 2 * * * /var/www/license-manager/backup.sh
```
