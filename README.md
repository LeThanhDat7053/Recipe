# 🍲 Sổ Tay Nấu Ăn

Web công thức nấu ăn cá nhân, tối ưu cho điện thoại. Cài được lên màn hình chính như app (PWA).

**Công nghệ:** Vite + React 19 + React Router + Tailwind CSS v4 + Supabase

## Chạy thử

```bash
npm install
npm run dev
```

Chưa có file `.env` thì app chạy **chế độ lưu trên máy** (localStorage, có sẵn 3 món mẫu), dùng để thử giao diện.
Mở trên điện thoại cùng mạng wifi: `npm run dev -- --host` rồi vào địa chỉ `http://192.168.x.x:5173`.

## Kết nối Supabase (lưu dữ liệu thật + tài khoản)

Mỗi tài khoản có **danh mục, công thức và ảnh riêng**. Chưa đăng nhập thì không thấy gì.
Việc tách dữ liệu được database kiểm soát (Row Level Security), không chỉ ẩn trên giao diện.

### 1. Tạo project
Đăng ký tại [supabase.com](https://supabase.com) → **New project**.
Đặt tên, tạo mật khẩu database (lưu lại), chọn Region **Southeast Asia (Singapore)** cho nhanh. Đợi khoảng 1–2 phút.

### 2. Tạo bảng
Menu trái chọn **SQL Editor → New query**, dán toàn bộ [supabase/schema.sql](supabase/schema.sql) rồi bấm **Run**.
Kết quả báo *Success. No rows returned* là được.

### 3. Lấy `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`
Cách nhanh nhất: bấm nút **Connect** ở thanh trên cùng của project, chọn tab **App Frameworks**.
Tab này hiện sẵn cả URL lẫn key.

Hoặc lấy thủ công:

| Biến | Lấy ở đâu | Dạng |
|---|---|---|
| `VITE_SUPABASE_URL` | **Project Settings** (bánh răng) → **Data API** → *Project URL* | `https://abcdxyz.supabase.co`<br>(**không** kèm `/rest/v1/`) |
| `VITE_SUPABASE_ANON_KEY` | **Project Settings** → **API Keys** → *Publishable key*<br>(hoặc tab *Legacy API Keys* → `anon` `public`) | `sb_publishable_...` hoặc `eyJ...` |

> ⚠️ Chỉ dùng **publishable / anon** key. **Không** dùng *secret* / `service_role` key, vì key đó bỏ qua mọi bảo mật.

Tạo file `.env` ở thư mục gốc project:

```env
VITE_SUPABASE_URL=https://abcdxyz.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxx
```

Chạy lại `npm run dev`. Trên Netlify thêm 2 biến này vào **Environment variables** rồi deploy lại.

### 4. Cài đặt đăng ký tài khoản
Vào **Authentication → Sign In / Providers**, mục **Email**:

- **Allow new users to sign up**: **bật** để người quen tự tạo tài khoản trong app.
- **Confirm email**:
  - **Tắt** (khuyên dùng cho nhóm nhỏ): tạo tài khoản xong vào dùng được ngay.
  - Bật: phải bấm link trong email mới đăng nhập được. Gói miễn phí chỉ gửi được vài email mỗi giờ.

Nếu để bật xác nhận email, vào **Authentication → URL Configuration**:

- **Site URL**: điền link Netlify của bạn (`https://ten-web.netlify.app`).
- **Redirect URLs**: thêm cả link Netlify và `http://localhost:5173`.

> Muốn **chỉ người bạn cho phép** mới dùng được: tắt *Allow new users to sign up*.
> Sau đó tự tạo tài khoản cho từng người ở **Authentication → Users → Add user → Create new user** (tick *Auto Confirm User*).

Tài khoản mới tự có sẵn 6 danh mục. Người khác muốn có công thức của bạn: bạn **Xuất** file JSON ở trang Tài khoản gửi cho họ, họ **Nhập** vào tài khoản của mình.

> Supabase gói miễn phí sẽ **tạm dừng project nếu 7 ngày không có ai truy cập**. Khi đó vào dashboard bấm *Restore*.
> Trong lúc bị tạm dừng, app vẫn hiện dữ liệu đã cache trên điện thoại.

## Tính năng

- **Trang chủ:** món yêu thích, món mới thêm, chọn món ngẫu nhiên
- **Danh mục:** thêm, sửa, sắp xếp, chọn emoji
- **Tìm kiếm** không cần gõ dấu, tìm theo tên, nguyên liệu và tag
- **Chi tiết món:**
  - tăng giảm khẩu phần thì lượng nguyên liệu tự nhân chia
  - tick nguyên liệu và các bước đã làm
  - nút *Bắt đầu nấu* giữ màn hình luôn sáng
- **Soạn công thức:**
  - chia nhóm nguyên liệu
  - *Nhập nhanh*: dán nhiều dòng một lúc
  - đổi thứ tự các bước
  - ảnh được nén (WebP) trước khi tải lên
- **Offline:** mở lại app khi mất mạng vẫn xem được dữ liệu và ảnh đã cache
- **Sao lưu:** xuất và nhập file JSON
- **Giao diện tối** tự động theo cài đặt điện thoại

## Cấu trúc

```
src/
  lib/api.js        # Lớp dữ liệu: Supabase hoặc localStorage
  store.jsx         # State toàn app + cache
  router.jsx        # Định tuyến
  components/       # BottomNav, Sheet, RecipeCard, Toast…
  pages/            # Home, Categories, Search, RecipeDetail, RecipeEdit, Account
supabase/schema.sql # Cấu trúc database
```

Đổi icon app: sửa `public/favicon.svg` rồi chạy `npm run icons`.
