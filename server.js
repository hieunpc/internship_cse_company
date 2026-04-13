const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;
const CSE_BASE_URL = "https://internship.cse.hcmut.edu.vn";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": CONTENT_TYPES[".json"],
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "File not found" });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
}

function requestJson(targetUrl) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      targetUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "internship-cse-dashboard-local",
        },
      },
      (res) => {
        let rawData = "";

        res.on("data", (chunk) => {
          rawData += chunk;
        });

        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Remote API error: ${res.statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(rawData));
          } catch (error) {
            reject(new Error("Cannot parse remote JSON response"));
          }
        });
      }
    );

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

function buildRemoteUrl(routePath) {
  const url = new URL(routePath, CSE_BASE_URL);
  url.searchParams.set("t", String(Date.now()));
  return url.toString();
}

async function handleApi(req, res, pathname) {
  try {
    if (pathname === "/api/health") {
      sendJson(res, 200, { ok: true, service: "internship-cse-dashboard" });
      return;
    }

    if (pathname === "/api/companies") {
      const payload = await requestJson(buildRemoteUrl("/home/company/all"));
      sendJson(res, 200, payload);
      return;
    }

    if (pathname.startsWith("/api/company/id/")) {
      const encodedCompanyId = pathname.replace("/api/company/id/", "");
      const companyId = decodeURIComponent(encodedCompanyId);

      if (!companyId) {
        sendJson(res, 400, { error: "Missing company id" });
        return;
      }

      const safeCompanyId = encodeURIComponent(companyId);
      const payload = await requestJson(buildRemoteUrl(`/home/company/id/${safeCompanyId}`));
      sendJson(res, 200, payload);
      return;
    }

    if (pathname.startsWith("/api/company/")) {
      const encodedShortName = pathname.replace("/api/company/", "");
      const shortName = decodeURIComponent(encodedShortName);

      if (!shortName) {
        sendJson(res, 400, { error: "Missing shortname" });
        return;
      }

      const safeShortName = encodeURIComponent(shortName);
      const payload = await requestJson(
        buildRemoteUrl(`/home/company/short-name/${safeShortName}`)
      );
      sendJson(res, 200, payload);
      return;
    }

    sendJson(res, 404, { error: "API route not found" });
  } catch (error) {
    sendJson(res, 502, {
      error: "Cannot fetch data from Internship CSE API",
      detail: error.message,
    });
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname.startsWith("/api/")) {
    await handleApi(req, res, pathname);
    return;
  }

  const staticPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(staticPath).replace(/^([.][.][/\\])+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden path" });
    return;
  }

  sendFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Internship CSE Dashboard is running at http://localhost:${PORT}`);
});
