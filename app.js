const API = {
  list: "/api/companies",
  detail: (companyId) => `/api/company/id/${encodeURIComponent(companyId)}`,
};

const CSE_BASE = "https://internship.cse.hcmut.edu.vn";

const state = {
  companies: [],
  meta: {
    numberAccepted: 0,
    numberInterns: 0,
    numberStudentRegisters: 0,
  },
  filters: {
    query: "",
  },
  page: 1,
  pageSize: 10,
  detailCache: new Map(),
};

const elements = {
  kpiTotal: document.querySelector("#kpiTotal"),
  kpiTotalStudents: document.querySelector("#kpiTotalStudents"),
  kpiRegister: document.querySelector("#kpiRegister"),
  kpiAccepted: document.querySelector("#kpiAccepted"),
  searchInput: document.querySelector("#searchInput"),
  resetFilterBtn: document.querySelector("#resetFilterBtn"),
  companyTableBody: document.querySelector("#companyTableBody"),
  resultCount: document.querySelector("#resultCount"),
  topPrevPageBtn: document.querySelector("#topPrevPageBtn"),
  topNextPageBtn: document.querySelector("#topNextPageBtn"),
  topPageInfo: document.querySelector("#topPageInfo"),
  statusBox: document.querySelector("#statusBox"),
  pagination: document.querySelector("#pagination"),
  lastUpdated: document.querySelector("#lastUpdated"),
  drawer: document.querySelector("#detailDrawer"),
  drawerTitle: document.querySelector("#drawerTitle"),
  drawerBody: document.querySelector("#drawerBody"),
  closeDrawerBtn: document.querySelector("#closeDrawerBtn"),
};

function setStatus(message, isError = false) {
  elements.statusBox.textContent = message;
  elements.statusBox.classList.toggle("error", isError);
}

function normalizeText(text) {
  return (text || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(value || 0);
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN");
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("vi-VN");
}

function getLatestFileUpdateTimestamp(item) {
  const texts = [];

  if (item.internshipFile) texts.push(item.internshipFile);
  if (item.newInternshipFile) texts.push(item.newInternshipFile);

  if (Array.isArray(item.internshipFiles)) {
    item.internshipFiles.forEach((file) => {
      if (!file) return;
      if (file.name) texts.push(file.name);
      if (file.path) texts.push(file.path);
      if (file.url) texts.push(file.url);
    });
  }

  const regex = /(\d{4})[-_](\d{2})[-_](\d{2})/g;
  let latest = 0;

  texts.forEach((text) => {
    if (!text) return;

    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(String(text))) !== null) {
      const y = Number(match[1]);
      const m = Number(match[2]);
      const d = Number(match[3]);
      const dateObj = new Date(y, m - 1, d);

      if (
        Number.isNaN(dateObj.getTime()) ||
        dateObj.getFullYear() !== y ||
        dateObj.getMonth() !== m - 1 ||
        dateObj.getDate() !== d
      ) {
        continue;
      }

      const ts = dateObj.getTime();
      if (ts > latest) latest = ts;
    }
  });

  return latest;
}

function toAbsoluteFileUrl(filePath) {
  if (!filePath) return "";
  if (/^https?:\/\//i.test(filePath)) return filePath;
  const normalized = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return `${CSE_BASE}${normalized}`;
}

function getFileExtension(fileName = "") {
  const cleanName = fileName.split("?")[0].trim().toLowerCase();
  const idx = cleanName.lastIndexOf(".");
  return idx >= 0 ? cleanName.slice(idx + 1) : "";
}

function buildDetailFiles(item) {
  const candidates = [];

  if (Array.isArray(item.internshipFiles)) {
    item.internshipFiles.forEach((file, index) => {
      if (!file) return;
      const path = file.path || file.url || "";
      if (!path) return;
      candidates.push({
        key: file._id || `internshipFiles-${index}`,
        name: file.name || path.split("/").pop() || `File ${index + 1}`,
        url: toAbsoluteFileUrl(path),
      });
    });
  }

  if (item.newInternshipFile) {
    candidates.push({
      key: "newInternshipFile",
      name: item.newInternshipFile.split("/").pop() || "newInternshipFile",
      url: toAbsoluteFileUrl(item.newInternshipFile),
    });
  }

  if (item.internshipFile) {
    candidates.push({
      key: "internshipFile",
      name: item.internshipFile.split("/").pop() || "internshipFile",
      url: toAbsoluteFileUrl(item.internshipFile),
    });
  }

  const seen = new Set();
  return candidates.filter((file) => {
    if (!file.url || seen.has(file.url)) return false;
    seen.add(file.url);
    return true;
  });
}

function getPreviewConfig(file) {
  const ext = getFileExtension(file.name || file.url);
  const officeExts = new Set([
    "doc",
    "docx",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
    "rtf",
    "odt",
    "ods",
    "odp",
  ]);

  if (ext === "pdf") {
    return {
      supported: true,
      src: `${file.url}#view=FitH`,
      note: "Preview PDF trực tiếp trong popup",
    };
  }

  if (officeExts.has(ext)) {
    return {
      supported: true,
      src: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
        file.url
      )}`,
      note: "Preview tài liệu Office qua Office Web Viewer",
    };
  }

  return {
    supported: false,
    src: "",
    note: "Định dạng này chưa hỗ trợ preview trực tiếp",
  };
}

function renderFilePreview(files, selectedIndex) {
  const panel = elements.drawerBody.querySelector("#filePreviewPanel");
  if (!panel) return;

  const file = files[selectedIndex];
  if (!file) {
    panel.innerHTML = '<p class="preview-empty">Không có file để preview.</p>';
    return;
  }

  const preview = getPreviewConfig(file);
  if (!preview.supported) {
    panel.innerHTML = `
      <p class="preview-empty">
        ${preview.note}. Bạn có thể mở file ở tab mới:
        <a href="${file.url}" target="_blank" rel="noreferrer">${file.name}</a>
      </p>
    `;
    return;
  }

  panel.innerHTML = `
    <iframe class="preview-frame" src="${preview.src}" title="Preview ${file.name}"></iframe>
  `;
}

function getFilteredSortedList() {
  let list = [...state.companies];

  if (state.filters.query) {
    const q = normalizeText(state.filters.query);
    list = list.filter((company) => {
      const source = normalizeText(
        `${company.shortname || ""} ${company.fullname || ""}`
      );
      return source.includes(q);
    });
  }

  // Sort by latest update date from attachment file names (newest first).
  // Fallback keeps previous reverse API ordering for ties or missing dates.
  list.sort((a, b) => {
    const diff = (b.lastFileUpdateAt || 0) - (a.lastFileUpdateAt || 0);
    if (diff !== 0) return diff;
    return (b.apiIndex || 0) - (a.apiIndex || 0);
  });

  return list;
}

function renderKpis() {
  elements.kpiTotal.textContent = formatNumber(state.companies.length);
  elements.kpiTotalStudents.textContent = formatNumber(state.meta.numberInterns);
  elements.kpiRegister.textContent = formatNumber(state.meta.numberStudentRegisters);
  elements.kpiAccepted.textContent = formatNumber(state.meta.numberAccepted);
}

function getLogoUrl(company) {
  if (!company.image) return "";
  return `${CSE_BASE}${company.image}`;
}

function renderTable() {
  const list = getFilteredSortedList();
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));

  if (state.page > totalPages) state.page = totalPages;

  const startIndex = (state.page - 1) * state.pageSize;
  const pageItems = list.slice(startIndex, startIndex + state.pageSize);

  elements.resultCount.textContent = `${formatNumber(total)} kết quả`;
  if (elements.topPageInfo) {
    elements.topPageInfo.textContent = `${state.page}/${totalPages}`;
  }
  if (elements.topPrevPageBtn) {
    elements.topPrevPageBtn.disabled = state.page <= 1;
  }
  if (elements.topNextPageBtn) {
    elements.topNextPageBtn.disabled = state.page >= totalPages;
  }

  if (!pageItems.length) {
    elements.companyTableBody.innerHTML = `
      <tr>
        <td colspan="5">Không có dữ liệu phù hợp với bộ lọc hiện tại.</td>
      </tr>
    `;
    renderPagination(totalPages);
    return;
  }

  elements.companyTableBody.innerHTML = pageItems
    .map((company, index) => {
      return `
        <tr class="company-row" data-company-id="${company._id || ""}" data-company-name="${encodeURIComponent(
          company.shortname || ""
        )}" tabindex="0" role="button" aria-label="Xem chi tiết ${company.shortname || "công ty"}">
          <td>${startIndex + index + 1}</td>
          <td>
            <img class="company-logo" src="${getLogoUrl(company)}" alt="${
              company.shortname || "logo"
            }" loading="lazy" />
          </td>
          <td>${company.shortname || "-"}</td>
          <td>${company.fullname || "-"}</td>
          <td>${company.lastFileUpdateLabel || "-"}</td>
        </tr>
      `;
    })
    .join("");

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const buttons = [];
  const page = state.page;

  buttons.push(
    `<button class="page-btn" data-page="${Math.max(1, page - 1)}" ${
      page === 1 ? "disabled" : ""
    }>Trước</button>`
  );

  for (let i = 1; i <= totalPages; i += 1) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      buttons.push(
        `<button class="page-btn ${i === page ? "active" : ""}" data-page="${i}">${i}</button>`
      );
    } else if (i === page - 2 || i === page + 2) {
      buttons.push("<span>...</span>");
    }
  }

  buttons.push(
    `<button class="page-btn" data-page="${Math.min(totalPages, page + 1)}" ${
      page === totalPages ? "disabled" : ""
    }>Sau</button>`
  );

  elements.pagination.innerHTML = buttons.join("");
}

function htmlToPlainText(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

async function openCompanyDetail(companyId, fallbackName = "") {
  if (!companyId) return;

  elements.drawer.classList.add("open");
  elements.drawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  elements.drawerTitle.textContent = fallbackName || companyId;
  elements.drawerBody.innerHTML = "<p>Đang tải chi tiết...</p>";

  try {
    let data = state.detailCache.get(companyId);

    if (!data) {
      const res = await fetch(API.detail(companyId));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
      state.detailCache.set(companyId, data);
    }

    const item = data.item || {};
    const lastFileUpdateAt = getLatestFileUpdateTimestamp(item);
    const lastFileUpdateLabel = formatDate(lastFileUpdateAt);
    const summary = htmlToPlainText(item.description || item.work || "");
    const summarySnippet = summary ? `${summary.slice(0, 450)}...` : "Không có mô tả";
    const files = buildDetailFiles(item);
    const companyInfo =
      Array.isArray(item.contactEmails) && item.contactEmails.length
        ? item.contactEmails.join(", ")
        : item.shortname || "Đang cập nhật";

    elements.drawerTitle.textContent = item.shortname || fallbackName || companyId;
    elements.drawerBody.innerHTML = `
      <div class="detail-card">
        <h4 class="detail-title">${item.fullname || "-"}</h4>
        <p class="detail-row detail-address-row">
          <span class="detail-label">Địa chỉ</span>
          <span class="detail-value detail-value-address">${item.address || "-"}</span>
        </p>
        <p class="detail-row">
          <span class="detail-label">Cập nhật gần nhất</span>
          <span class="detail-value">${lastFileUpdateLabel}</span>
        </p>
      </div>

      <div class="detail-card">
        <h4 class="detail-title">Chỉ số thực tập</h4>
        <p class="detail-row detail-metric-row">
          <span class="detail-label">Số lượng đăng ký tối đa</span>
          <span class="detail-value detail-value-metric detail-value-max-register">${formatNumber(
            item.maxRegister
          )}</span>
        </p>
        <p class="detail-row detail-metric-row">
          <span class="detail-label">Sinh viên đăng ký</span>
          <span class="detail-value detail-value-metric detail-value-register">${formatNumber(
            item.studentRegister
          )}</span>
        </p>
        <p class="detail-row detail-metric-row">
          <span class="detail-label">Sinh viên đã được nhận</span>
          <span class="detail-value detail-value-metric detail-value-accepted">${formatNumber(
            item.studentAccepted
          )}</span>
        </p>
        <p class="detail-row detail-metric-row">
          <span class="detail-label">Max accepted</span>
          <span class="detail-value detail-value-metric detail-value-max">${formatNumber(
            item.maxAcceptedStudent
          )}</span>
        </p>
      </div>

      <div class="detail-card">
        <h4 class="detail-title">Mô tả nhanh</h4>
        <p class="detail-row">${summarySnippet}</p>
      </div>

      <div class="detail-card">
        <h4 class="detail-title">Tài liệu đính kèm (DOC/PDF)</h4>
        ${
          files.length
            ? `<div class="file-list">
                ${files
                  .map(
                    (file, index) =>
                      `<button type="button" class="file-btn ${
                        index === 0 ? "active" : ""
                      }" data-file-index="${index}">${file.name}</button>`
                  )
                  .join("")}
              </div>
              <div id="filePreviewPanel" class="preview-panel"></div>`
            : '<p class="detail-row">Công ty chưa có file đính kèm.</p>'
        }
      </div>
    `;

    if (files.length) {
      renderFilePreview(files, 0);

      const fileButtons = elements.drawerBody.querySelectorAll(".file-btn");
      fileButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const idx = Number(button.dataset.fileIndex);
          fileButtons.forEach((btn) => btn.classList.remove("active"));
          button.classList.add("active");
          renderFilePreview(files, idx);
        });
      });
    }
  } catch (error) {
    elements.drawerBody.innerHTML = `
      <p class="detail-row">Không tải được chi tiết công ty. Lỗi: ${error.message}</p>
    `;
  }
}

function closeDrawer() {
  elements.drawer.classList.remove("open");
  elements.drawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.filters.query = event.target.value.trim();
    state.page = 1;
    renderTable();
  });

  elements.resetFilterBtn.addEventListener("click", () => {
    state.filters = { query: "" };
    state.page = 1;

    elements.searchInput.value = "";
    renderTable();
  });

  elements.topPrevPageBtn?.addEventListener("click", () => {
    if (state.page <= 1) return;
    state.page -= 1;
    renderTable();
  });

  elements.topNextPageBtn?.addEventListener("click", () => {
    const total = getFilteredSortedList().length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page >= totalPages) return;
    state.page += 1;
    renderTable();
  });

  elements.companyTableBody.addEventListener("click", (event) => {
    const trigger = event.target.closest("tr[data-company-id]");
    if (!trigger) return;
    const name = trigger.dataset.companyName
      ? decodeURIComponent(trigger.dataset.companyName)
      : "";
    openCompanyDetail(trigger.dataset.companyId, name);
  });

  elements.companyTableBody.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const trigger = event.target.closest("tr[data-company-id]");
    if (!trigger) return;
    event.preventDefault();
    const name = trigger.dataset.companyName
      ? decodeURIComponent(trigger.dataset.companyName)
      : "";
    openCompanyDetail(trigger.dataset.companyId, name);
  });

  elements.pagination.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-page]");
    if (!button || button.disabled) return;

    state.page = Number(button.dataset.page);
    renderTable();
  });

  elements.closeDrawerBtn.addEventListener("click", closeDrawer);

  elements.drawer.addEventListener("click", (event) => {
    if (event.target === elements.drawer) closeDrawer();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
  });
}

async function loadCompanies() {
  setStatus("Đang tải dữ liệu từ CSE Internship API...");

  try {
    const response = await fetch(API.list);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();

    const companies = payload.items || [];

    setStatus("Đang phân tích ngày cập nhật từ file đính kèm...");
    const enrichedCompanies = await Promise.all(
      companies.map(async (company, index) => {
        let lastFileUpdateAt = 0;

        try {
          const res = await fetch(API.detail(company._id));
          if (res.ok) {
            const detailData = await res.json();
            state.detailCache.set(company._id, detailData);
            lastFileUpdateAt = getLatestFileUpdateTimestamp(detailData.item || {});
          }
        } catch (error) {
          // Keep company in list even if one detail request fails.
        }

        return {
          ...company,
          apiIndex: index,
          lastFileUpdateAt,
          lastFileUpdateLabel: formatDate(lastFileUpdateAt),
        };
      })
    );

    state.companies = enrichedCompanies;
    state.meta.numberAccepted = payload.numberAccepted || 0;
    state.meta.numberInterns = payload.numberInterns || 0;
    state.meta.numberStudentRegisters = payload.numberStudentRegisters || 0;

    renderKpis();
    renderTable();

    const now = new Date();
    elements.lastUpdated.textContent = now.toLocaleString("vi-VN");
    setStatus(
      `Đã tải ${formatNumber(
        state.companies.length
      )} công ty. Danh sách đang xếp theo ngày cập nhật file đính kèm mới nhất.`
    );
  } catch (error) {
    setStatus(`Lỗi tải dữ liệu: ${error.message}`, true);
  }
}

bindEvents();
loadCompanies();
