# CSE Internship Company

## How to run

Yêu cầu: Node.js 18+

```bash
node server.js
```

Mở trình duyệt tại:

```text
http://localhost:5173
```

## Deploy Railway

Repo đã sẵn sàng deploy Railway với:

- `package.json` (`npm start` -> `node server.js`)
- `railway.json` (Nixpacks + start command)

## Kiến trúc

- `server.js`: local server + proxy API để tránh CORS
    - `/api/companies` -> `https://internship.cse.hcmut.edu.vn/home/company/all`
    - `/api/company/id/:id` -> `https://internship.cse.hcmut.edu.vn/home/company/id/:id`
    - `/api/company/:shortname` -> `https://internship.cse.hcmut.edu.vn/home/company/short-name/:shortname`
- `index.html`: layout dashboard
- `styles.css`: giao diện
- `app.js`: logic app
