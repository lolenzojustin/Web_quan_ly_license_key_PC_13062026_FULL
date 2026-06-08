# License Key Manager

Hệ thống quản lý license key chuyên nghiệp cho các ứng dụng client (PC/Desktop), được phát triển với hiệu năng cao, giao diện hiện đại và quy trình bảo mật chuẩn.

## 🚀 Công nghệ sử dụng
- **Backend**: Python FastAPI, Uvicorn, SQLAlchemy 2.0 (Async), Alembic, Pydantic v2.
- **Frontend**: Next.js 16+ (App Router), TypeScript, Tailwind CSS v4, Lucide Icons.
- **Database**: PostgreSQL (Tự động khởi tạo database, đồng bộ bảng và seed tài khoản admin khi chạy backend).
- **Timezone**: Đồng bộ toàn bộ logic múi giờ Việt Nam `Asia/Ho_Chi_Minh` (GMT+7).

---

## 📁 Cấu trúc Thư mục chính
- `backend/`: Chứa mã nguồn FastAPI server, database models, schemas, business logic services và database migrations.
- `frontend/`: Chứa mã nguồn Next.js dashboard quản trị.
- `docs/`: Tài liệu chi tiết các bước cài đặt và deploy VPS Ubuntu (`DEPLOY_UBUNTU.md`).

---

## 🛠️ Hướng dẫn Chạy Local Development

### 1. Khởi chạy Backend (FastAPI)
Di chuyển vào thư mục `backend`, cài đặt môi trường ảo Python và khởi chạy:

```bash
cd backend

# Tạo virtual environment
python -m venv venv

# Kích hoạt virtualenv (Windows PowerShell)
.\venv\Scripts\Activate.ps1
# (Hoặc trên Linux/macOS: source venv/bin/activate)

# Cài đặt thư viện
pip install -r requirements.txt

# Chạy server development (Dự án sẽ tự động kiểm tra PostgreSQL, tạo db 'license_manager', tạo các bảng và seed admin mặc định)
python -m uvicorn app.main:app --reload --port 8000
```
API docs (Swagger UI) sẽ hiển thị tại: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

### 2. Khởi chạy Frontend (Next.js)
Mở một terminal mới, di chuyển vào thư mục `frontend` và khởi chạy Next.js development server:

```bash
cd frontend

# Cài đặt dependencies
npm install

# Khởi chạy server phát triển
npm run dev
```
Trang Dashboard Quản trị sẽ hiển thị tại: [http://localhost:3000](http://localhost:3000)

- Đăng nhập bằng tài khoản: **admin** / **admin_password_123**
- Thực hiện đổi mật khẩu ngay sau lần đăng nhập đầu tiên tại mục **Settings**.

---

## 🧪 Chạy Kiểm thử Logic Backend
Dự án đã tích hợp script kiểm thử tự động trên SQLite bộ nhớ, không ghi dữ liệu rác vào PostgreSQL. Script bao phủ đăng nhập, đổi mật khẩu, sinh key, kích hoạt/check thiết bị, giới hạn thiết bị, lifetime filter, gia hạn, thu hồi và xóa key:

```bash
cd backend
# Đảm bảo đã kích hoạt virtualenv
python test_services.py
```
Nếu màn hình in ra `All integration tests passed successfully!` nghĩa là toàn bộ nghiệp vụ hoạt động hoàn hảo.

---

## 🔒 Tài liệu Deployment
Để đưa hệ thống lên máy chủ VPS Ubuntu chạy thực tế, tham khảo tài liệu hướng dẫn chi tiết tại:  
👉 [docs/DEPLOY_UBUNTU.md](docs/DEPLOY_UBUNTU.md)
