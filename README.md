# CSE Internship Company Tracker Dashboard

Dashboard theo dõi công ty thực tập CSE với:

- Filter theo tên công ty
- Thứ tự danh sách theo mảng API đảo ngược (phần tử cuối lên đầu)
- Xem chi tiết công ty từ endpoint id
- Popup chi tiết ở giữa màn hình
- Preview file PDF/DOC/DOCX trực tiếp trong popup (không cần tải về)
- UI responsive cho desktop và mobile

## Chạy nhanh

Yêu cầu: Node.js 18+

```bash
node server.js
```

Mở trình duyệt tại:

```text
http://localhost:5173
```

## Kiến trúc

- `server.js`: local server + proxy API để tránh CORS
    - `/api/companies` -> `https://internship.cse.hcmut.edu.vn/home/company/all`
    - `/api/company/id/:id` -> `https://internship.cse.hcmut.edu.vn/home/company/id/:id`
    - `/api/company/:shortname` -> `https://internship.cse.hcmut.edu.vn/home/company/short-name/:shortname` (tương thích)
- `index.html`: layout dashboard
- `styles.css`: giao diện SaaS + responsive + animation
- `app.js`: logic load dữ liệu, filter tên, thứ tự API đảo ngược, phân trang, drawer chi tiết
