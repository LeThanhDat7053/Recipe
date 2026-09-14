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

## Cập nhật database khi có tính năng mới

Mỗi khi `supabase/schema.sql` thay đổi, chỉ cần **chạy lại toàn bộ file** trong SQL Editor.
File viết để chạy lại nhiều lần vẫn an toàn: chỉ thêm bảng hoặc cột còn thiếu, **không xoá dữ liệu**.

## Nhập công thức từ link

Tính năng này dùng một **Netlify Function** ([netlify/functions/import-recipe.mjs](netlify/functions/import-recipe.mjs)). Netlify tự triển khai function khi deploy, không cần cấu hình thêm.

- Biến môi trường trên Netlify phải để scope **All scopes**, hoặc có tick **Functions**. Function dùng biến này để kiểm tra người gọi đã đăng nhập.
- `npm run dev` **không chạy** được function. Muốn thử ở máy thì dùng `npx netlify dev` (mở tại `http://localhost:8888`).

## Tính năng

**Xem & nấu**
- Tăng giảm khẩu phần thì lượng nguyên liệu tự nhân chia; tick nguyên liệu và các bước đã làm.
- **Chế độ nấu từng bước:**
  - toàn màn hình, chữ to, vuốt trái/phải để chuyển bước
  - màn hình luôn sáng
  - **đọc to** từng bước bằng giọng tiếng Việt có sẵn trên máy
- **Hẹn giờ:** bước nào có thời gian (VD "luộc 10 phút") thì hiện nút hẹn giờ.
  - Chạy nhiều đồng hồ cùng lúc; hết giờ thì kêu và rung.
  - Đồng hồ nổi ở góc màn hình khi chuyển sang trang khác.
- **Nhật ký đã nấu:** ngày nấu, ghi chú từng lần, số lần nấu. Trang chủ có mục "Lâu rồi chưa nấu".
- **Chấm sao** từng món.

**Lên kế hoạch**
- **Đi chợ:** thêm nguyên liệu từ công thức (bỏ qua thứ đã tick), món trùng tự cộng dồn; tick khi mua; gửi danh sách qua Zalo.
- **Tủ lạnh còn gì?** Nhập nguyên liệu đang có, app gợi ý món nấu được và cho biết món nào còn thiếu gì.

**Tổ chức**
- **Danh mục** (thêm, sửa, sắp xếp, chọn emoji) và **bộ sưu tập** (một món có thể nằm trong nhiều bộ).
- **Tìm kiếm** không cần gõ dấu.
  - Lọc theo thời gian, độ khó, số sao.
  - Sắp xếp: mới nhất, A→Z, nhanh nhất, đánh giá cao, nấu nhiều nhất, lâu chưa nấu.
- **Thùng rác:** món bị xoá giữ 30 ngày, khôi phục được.

**Soạn công thức**
- **Nhập từ link** bài công thức trên web.
- Nhập nhanh nhiều dòng; chia nhóm nguyên liệu; đổi thứ tự các bước.
- **Ảnh cho từng bước.** Ảnh được nén sang WebP trước khi tải lên.
- **Nhân bản món** để làm biến tấu.

**Chia sẻ**
- **Link công khai cho từng món:** người nhận xem được không cần tài khoản, bấm "Lưu vào sổ của tôi" để chép về tài khoản của họ.
- **Xuất ảnh thẻ công thức** (PNG) để gửi, đăng mạng xã hội hoặc in.
- Sao lưu và nhập bằng file JSON.

**Chạy mượt trên điện thoại**
- Cài lên màn hình chính như app (PWA).
- **Mất mạng vẫn xem và sửa được.** Thay đổi được xếp hàng chờ, có mạng lại tự đồng bộ.
- Giao diện tối tự động theo cài đặt điện thoại.

## Cấu trúc

```
src/
  lib/api.js          # Gọi Supabase (dữ liệu, ảnh, đăng nhập, nhập từ link)
  lib/utils.js        # Tách nguyên liệu, hẹn giờ, gộp danh sách đi chợ…
  lib/card.js         # Vẽ ảnh thẻ công thức
  store.jsx           # State toàn app, cache, hàng đợi khi offline
  timers.jsx          # Đồng hồ hẹn giờ
  components/         # BottomNav, Sheet, RecipeCard, RecipeSheets…
  pages/              # Home, Search, RecipeDetail, CookMode, RecipeEdit, Shopping, Fridge, Trash, Shared…
netlify/functions/    # import-recipe: đọc công thức từ link
supabase/schema.sql   # Cấu trúc database
```

Đổi icon app: sửa `public/favicon.svg` rồi chạy `npm run icons`.
