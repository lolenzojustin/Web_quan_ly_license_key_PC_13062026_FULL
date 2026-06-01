# Ke hoach xay dung website quan ly license key

## 1. Muc tieu du an

Xay dung mot he thong web de admin quan ly license key cho ung dung PC. He thong gom:

- Frontend: Next.js, giao dien hien dai, phang, de dung.
- Backend: Python FastAPI chay voi Uvicorn.
- Database: PostgreSQL.
- Auth: chi co tai khoan admin tao san, khong co dang ky.
- License flow: key duoc tao truoc, chua co ngay het han cho den khi user active tren thiet bi dau tien. Ngay het han duoc tinh theo thoi diem active va goi thoi gian cua key.
- Timezone: toan bo logic datetime va so sanh het han dung gio Viet Nam, timezone `Asia/Ho_Chi_Minh`.
- Khong dung Docker. Moi thanh phan se cai va chay truc tiep tren may local/VPS bang Python virtualenv, Node.js process, PostgreSQL service, systemd va Nginx.

## 2. Chuc nang chinh

### 2.1. Quan ly license key

Bang danh sach license key can hien thi cac cot:

- STT.
- License key.
- So thiet bi da active.
- Thoi gian tao key.
- Thoi gian active key.
- Thoi gian het han.
- Category.
- Hanh dong: gia han key, xoa key.

Chuc nang can co:

- Xem danh sach key co phan trang.
- Tim kiem theo license key.
- Filter theo category.
- Filter theo trang thai: chua active, dang active, da het han, vinh vien.
- Xoa key.
- Gia han key theo cac moc thoi gian duoc cau hinh.
- Xem chi tiet cac thiet bi da active key.

### 2.2. Tao license key

Form tao key can co:

- So luong key can tao.
- Moc thoi gian:
  - 7 ngay.
  - 1 thang.
  - 3 thang.
  - 6 thang.
  - 1 nam.
  - Vinh vien.
- So luong thiet bi toi da duoc active.
- Category.

Quy tac:

- Key moi tao co `created_at`.
- Key moi tao chua co `activated_at`.
- Key moi tao chua co `expires_at`.
- Khi user active key lan dau, backend tinh `expires_at = activated_at + duration`.
- Neu key la vinh vien, `expires_at` co the de `NULL` va them field `is_lifetime = true`.

### 2.3. Category

Chuc nang can co:

- Tao category.
- Lay danh sach category.
- Filter license key theo category.
- Moi license key thuoc mot category.

Co the mo rong sau:

- Sua category.
- Xoa category neu khong con key nao dang dung.
- Mau/nhan hien thi cho category.

### 2.4. Admin login va doi password

Chuc nang:

- Admin login bang username/password tao san.
- Backend tra ve access token.
- Frontend luu token an toan de goi API quan tri.
- Admin doi password sau khi login.
- Khong co dang ky tai khoan.

Yeu cau bao mat:

- Password phai duoc hash bang bcrypt/argon2, khong luu plain text.
- Token nen dung JWT co thoi gian het han.
- API quan tri phai yeu cau token.
- Co seed admin mac dinh khi khoi tao database lan dau.

### 2.5. Active license key tu ung dung PC

API active duoc goi tu ung dung PC, gui len:

- License key.
- Device ID/fingerprint.
- Device name.
- OS/version neu co.
- App version neu co.

Quy tac active:

- Neu key khong ton tai: tra loi invalid.
- Neu key da bi xoa/revoked: tra loi revoked.
- Neu key da het han: tra loi expired.
- Neu device da active key truoc do: tra loi thanh cong va thong tin expires.
- Neu device moi va so device da active chua vuot `max_devices`: tao ban ghi device activation.
- Neu day la lan active dau tien cua key: set `activated_at` va tinh `expires_at`.
- Neu device moi nhung da dat gioi han `max_devices`: tra loi device_limit_exceeded.

### 2.6. Check license key tu ung dung PC

API check duoc goi tu ung dung PC, gui len:

- License key.
- Device ID/fingerprint.

Quy tac check:

- Key phai ton tai.
- Device phai nam trong danh sach da active cua key.
- Neu key khong vinh vien thi so sanh `expires_at` voi thoi gian hien tai theo `Asia/Ho_Chi_Minh`.
- Tra ve trang thai:
  - valid.
  - expired.
  - not_activated.
  - device_not_activated.
  - revoked.
  - invalid.

## 3. Kien truc tong quan

### 3.1. Cau truc repository de xuat

```text
license-manager/
  backend/
    app/
      api/
        routes/
          auth.py
          licenses.py
          categories.py
          activations.py
      core/
        config.py
        security.py
        timezone.py
      db/
        session.py
        base.py
      models/
        admin.py
        license.py
        category.py
        activation.py
      schemas/
        auth.py
        license.py
        category.py
        activation.py
      services/
        license_service.py
        auth_service.py
      main.py
    alembic/
    pyproject.toml
    .env.example
  frontend/
    app/
      login/
      dashboard/
      licenses/
      categories/
      settings/
    components/
    lib/
      api.ts
      auth.ts
    package.json
    .env.example
  docs/
    DEPLOY_UBUNTU.md
  README.md
```

### 3.2. Backend

Cong nghe de xuat:

- FastAPI.
- Uvicorn/Gunicorn cho production.
- SQLAlchemy 2.x.
- Alembic migration.
- PostgreSQL driver: `psycopg` hoac `asyncpg`.
- Pydantic Settings cho config.
- Passlib/bcrypt hoac argon2 cho password hashing.
- JWT auth cho admin API.

Nhom route:

- `/api/auth/login`
- `/api/auth/change-password`
- `/api/licenses`
- `/api/licenses/{id}`
- `/api/licenses/{id}/renew`
- `/api/categories`
- `/api/activation/activate`
- `/api/activation/check`

### 3.3. Frontend

Cong nghe de xuat:

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- TanStack Table hoac table component tu shadcn/ui.
- React Hook Form + Zod cho form validation.
- Lucide icons.

Man hinh chinh:

- Login.
- Dashboard tong quan.
- License list.
- Create license modal/page.
- Renew license modal.
- Category management.
- Change password.

Style:

- 1 mau chu dao: Blue `#2563EB`.
- 2 mau phu:
  - Emerald `#10B981` cho trang thai active/success.
  - Amber `#F59E0B` cho canh bao/sap het han.
- Nen sang, layout phang, khoang cach ro rang.
- Bang du lieu uu tien de scan, co sticky header neu danh sach dai.

### 3.4. Database PostgreSQL

PostgreSQL se duoc cai truc tiep tren may dev hoac VPS, khong chay bang container. Backend ket noi qua bien moi truong `DATABASE_URL`, vi du:

```env
DATABASE_URL=postgresql+psycopg://license_user:strong_password@127.0.0.1:5432/license_manager
```

Bang de xuat:

#### `admins`

| Field | Type | Ghi chu |
| --- | --- | --- |
| id | UUID/serial | Primary key |
| username | varchar | Unique |
| password_hash | varchar | Hash password |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `categories`

| Field | Type | Ghi chu |
| --- | --- | --- |
| id | UUID/serial | Primary key |
| name | varchar | Unique |
| description | text | Nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `licenses`

| Field | Type | Ghi chu |
| --- | --- | --- |
| id | UUID/serial | Primary key |
| key | varchar | Unique, indexed |
| category_id | FK | Link categories |
| duration_type | varchar | `days`, `months`, `years`, `lifetime` |
| duration_value | int | Nullable neu lifetime |
| max_devices | int | So thiet bi toi da |
| activated_at | timestamptz | Nullable |
| expires_at | timestamptz | Nullable |
| is_lifetime | boolean | Default false |
| status | varchar | `new`, `active`, `expired`, `revoked` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `license_activations`

| Field | Type | Ghi chu |
| --- | --- | --- |
| id | UUID/serial | Primary key |
| license_id | FK | Link licenses |
| device_id | varchar | Fingerprint/device id |
| device_name | varchar | Nullable |
| os_info | varchar | Nullable |
| app_version | varchar | Nullable |
| activated_at | timestamptz | |
| last_checked_at | timestamptz | Nullable |

Constraint quan trong:

- Unique `(license_id, device_id)` de tranh active trung.
- Index `licenses.key`.
- Index `licenses.category_id`.
- Index `license_activations.license_id`.

## 4. API de xuat

### 4.1. Admin Auth

#### `POST /api/auth/login`

Request:

```json
{
  "username": "admin",
  "password": "admin_password"
}
```

Response:

```json
{
  "access_token": "jwt_token",
  "token_type": "bearer"
}
```

#### `POST /api/auth/change-password`

Can admin token.

Request:

```json
{
  "old_password": "old",
  "new_password": "new"
}
```

### 4.2. License Admin API

#### `GET /api/licenses`

Query:

- `page`
- `page_size`
- `search`
- `category_id`
- `status`

#### `POST /api/licenses`

Request:

```json
{
  "quantity": 10,
  "duration_type": "months",
  "duration_value": 1,
  "max_devices": 2,
  "category_id": 1
}
```

#### `PATCH /api/licenses/{license_id}/renew`

Request:

```json
{
  "duration_type": "months",
  "duration_value": 3
}
```

Quy tac gia han:

- Neu key chua active: chi update goi thoi gian, van chua co `expires_at`.
- Neu key dang active va chua het han: cong them thoi gian vao `expires_at`.
- Neu key da het han: co the tinh tu `now` hoac tu `expires_at` cu. De xuat tinh tu `now` de hop ly voi nguoi dung.
- Neu set lifetime: `is_lifetime = true`, `expires_at = NULL`.

#### `DELETE /api/licenses/{license_id}`

De xuat nen soft delete/revoke thay vi xoa vat ly:

- Cap nhat `status = revoked`.
- Giu lai lich su activation de audit.

Neu user that su muon xoa khoi database, co the lam them hard delete sau.

### 4.3. Category API

#### `GET /api/categories`

Lay danh sach category.

#### `POST /api/categories`

Request:

```json
{
  "name": "Premium",
  "description": "Key cho goi Premium"
}
```

#### `GET /api/categories/{category_id}/licenses`

Lay danh sach key theo category. Co the thay bang `GET /api/licenses?category_id=...` de don gian hon.

### 4.4. Client Activation API

#### `POST /api/activation/activate`

Request:

```json
{
  "license_key": "XXXX-XXXX-XXXX-XXXX",
  "device_id": "device-fingerprint",
  "device_name": "PC Office",
  "os_info": "Windows 11",
  "app_version": "1.0.0"
}
```

Response thanh cong:

```json
{
  "status": "valid",
  "license_key": "XXXX-XXXX-XXXX-XXXX",
  "activated_at": "2026-05-29T10:00:00+07:00",
  "expires_at": "2026-06-29T10:00:00+07:00",
  "is_lifetime": false,
  "max_devices": 2,
  "active_devices": 1
}
```

#### `POST /api/activation/check`

Request:

```json
{
  "license_key": "XXXX-XXXX-XXXX-XXXX",
  "device_id": "device-fingerprint"
}
```

Response:

```json
{
  "status": "valid",
  "expires_at": "2026-06-29T10:00:00+07:00",
  "server_time": "2026-05-29T10:00:00+07:00"
}
```

## 5. Xu ly timezone Viet Nam

Quy tac de xuat:

- Trong database nen luu `timestamptz`.
- Trong backend, moi datetime sinh ra tu server dung timezone-aware datetime voi `ZoneInfo("Asia/Ho_Chi_Minh")`.
- Khi response API, tra ve ISO 8601 co offset `+07:00`.
- Khi so sanh expired, dung `now_vn = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh"))`.
- Tranh dung datetime naive.

Helper backend:

```python
from datetime import datetime
from zoneinfo import ZoneInfo

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

def now_vn() -> datetime:
    return datetime.now(VN_TZ)
```

## 6. Cac phase trien khai

### Phase 1: Khoi tao nen tang du an

Muc tieu:

- Tao monorepo `backend/` va `frontend/`.
- Setup FastAPI, Uvicorn, SQLAlchemy, Alembic.
- Setup Next.js, TypeScript, Tailwind CSS.
- Huong dan cai PostgreSQL local truc tiep va tao database/user cho dev.
- Tao file `.env.example` cho backend va frontend.

Ket qua:

- Backend chay duoc endpoint health check.
- Frontend chay duoc man login placeholder.
- PostgreSQL local chay duoc bang service cai truc tiep tren may.

### Phase 2: Database schema va migration

Muc tieu:

- Thiet ke model `Admin`, `Category`, `License`, `LicenseActivation`.
- Tao Alembic migration.
- Tao seed admin mac dinh.
- Tao helper timezone Viet Nam.

Ket qua:

- Database co schema dau tien.
- Co admin mac dinh de login.
- Co migration reproducible cho VPS.

### Phase 3: Admin authentication

Muc tieu:

- API login.
- JWT token.
- Middleware/dependency bao ve admin routes.
- API change password.
- Frontend login page.
- Frontend auth guard cho dashboard.

Ket qua:

- Admin login duoc.
- Doi password duoc.
- Cac trang quan tri khong truy cap duoc neu chua login.

### Phase 4: Category management

Muc tieu:

- API create/get category.
- UI tao category.
- UI list category.
- Tich hop category vao form tao license.

Ket qua:

- Admin tao va xem category.
- License co the gan vao category.

### Phase 5: License management MVP

Muc tieu:

- API get list license co pagination/filter.
- API create license theo quantity, duration, max devices, category.
- Sinh license key unique.
- UI table list license.
- UI create license.
- UI filter category/status/search.

Ket qua:

- Admin quan ly danh sach key co ban.
- Tao nhieu key cung luc.
- Filter va search duoc.

### Phase 6: Activation va check API cho ung dung PC

Muc tieu:

- API active license key.
- API check license key.
- Xu ly device limit.
- Xu ly key chua active, da active, het han, vinh vien, revoked.
- Cap nhat `last_checked_at`.

Ket qua:

- Ung dung PC co the active key.
- Ung dung PC co the check tinh trang key.
- Backend tinh expired dung theo gio Viet Nam.

### Phase 7: Gia han va xoa/revoke license

Muc tieu:

- API renew license.
- UI modal gia han.
- API delete/revoke license.
- UI nut xoa/revoke co confirm.
- Cap nhat status expired bang service logic khi list/check.

Ket qua:

- Admin gia han key.
- Admin revoke key.
- Trang thai key hien thi chinh xac.

### Phase 8: Hoan thien UI/UX

Muc tieu:

- Dashboard tong quan:
  - Tong so key.
  - Key chua active.
  - Key dang active.
  - Key da het han.
  - Key bi revoke.
- Badge trang thai.
- Empty state.
- Loading state.
- Error state.
- Responsive layout.

Ket qua:

- Website de dung hon cho van hanh hang ngay.
- Giao dien dong nhat mau sac va component.

### Phase 9: Test va hardening

Muc tieu:

- Unit test cho license service.
- API test cho auth/license/activation.
- Validate input chat che.
- Rate limit cho client activation/check API.
- Log request loi.
- Them CORS config theo domain production.

Ket qua:

- Giam rui ro bug o logic expired/device limit.
- San sang deploy production.

### Phase 10: Deploy VPS Ubuntu voi custom domain

Muc tieu:

- Viet tai lieu `docs/DEPLOY_UBUNTU.md`.
- Cai PostgreSQL truc tiep tren VPS Ubuntu.
- Tao Linux user rieng cho app neu can.
- Tao Python virtualenv cho backend.
- Cai Node.js va build Next.js production.
- Chay backend bang systemd/Gunicorn/Uvicorn.
- Chay frontend Next.js production bang systemd hoac process manager.
- Nginx reverse proxy:
  - `https://yourdomain.com/` -> Next.js frontend.
  - `https://yourdomain.com/api/` -> FastAPI backend.
- Cai SSL bang Certbot.

Ket qua:

- Website va API dung chung mot domain.
- HTTPS hoat dong.
- Co huong dan restart, migrate database, backup PostgreSQL.

## 7. Thu tu uu tien MVP

Nen lam MVP theo thu tu:

1. Backend schema + auth.
2. Category API.
3. License create/list API.
4. Activation/check API.
5. Frontend login.
6. Frontend license table + create key.
7. Renew/revoke key.
8. Deploy doc.

Ly do: logic license nam o backend la phan quan trong nhat. Khi API on dinh, frontend se ket noi nhanh hon va it phai sua lai luong nghiep vu.

## 8. Rui ro can xu ly som

- Device fingerprint tu ung dung PC co the thay doi sau khi user cai lai Windows hoac doi phan cung. Can quy dinh cach tao `device_id` on dinh.
- Neu xoa vat ly license key, mat lich su active. Nen dung revoke/soft delete.
- Neu server VPS sai timezone, logic van phai dung `Asia/Ho_Chi_Minh` trong code.
- Key vinh vien can co logic rieng, khong nen dua vao ngay het han gia lap qua xa.
- API activation/check co the bi spam. Nen them rate limit va logging.
- Admin password mac dinh phai doi ngay sau khi deploy.

## 9. Tai lieu deploy can viet them

File deploy rieng nen gom:

- Chuan bi VPS Ubuntu.
- Tro DNS domain ve IP VPS.
- Cai Node.js, Python, PostgreSQL, Nginx, Certbot.
- Tao PostgreSQL database/user truc tiep tren VPS.
- Cau hinh `.env`.
- Chay migration Alembic.
- Build frontend.
- Chay backend service.
- Chay frontend service.
- Cau hinh Nginx chung domain:

```nginx
server {
    server_name yourdomain.com;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- Cai SSL:

```bash
sudo certbot --nginx -d yourdomain.com
```

- Len lich backup PostgreSQL.
- Huong dan update version moi.

## 10. De xuat sau khi thong nhat ke hoach

Sau khi doc va chot scope, nen bat dau bang Phase 1 den Phase 3 truoc. Khi auth va database da on dinh, cac phase license/category/activation se duoc trien khai nhanh va ro rang hon.
