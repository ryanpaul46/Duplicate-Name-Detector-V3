// ======================
// Upload on Landing Page
// ======================
if (document.getElementById("uploadMain")) {
  const uploadMain = document.getElementById("uploadMain");
  uploadMain.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById("lastModifiedMain").innerText =
      new Date(file.lastModified).toLocaleString();

    const reader = new FileReader();
    reader.onload = function (ev) {
      const data = new Uint8Array(ev.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) || [];

      localStorage.setItem("uploadedData", JSON.stringify(rows));
      alert("File uploaded successfully! You can now open Duplicates or Full List.");
    };
    reader.readAsArrayBuffer(file);
  });
}

// ======================
// Shared helpers
// ======================
function loadDataOrRedirect() {
  const stored = localStorage.getItem("uploadedData");
  if (!stored) {
    alert("Please upload a file first.");
    window.location.href = "index.html";
    return null;
  }
  return JSON.parse(stored);
}

function tableHTMLFromArray(headers, rows, highlightNameIndex = null, highlightSet = null, tableId = "") {
  const thead = "<thead><tr>" + headers.map(h => `<th>${h ?? ""}</th>`).join("") + "</tr></thead>";
  const tbody = "<tbody>" + rows.map(r => {
    return "<tr>" + headers.map((_, i) => {
      const val = r[i] ?? "";
      const isName = i === highlightNameIndex && highlightSet && highlightSet.has((r[highlightNameIndex] ?? "").toString().trim().toLowerCase());
      return `<td class="${isName ? "name-dup" : ""}">${val}</td>`;
    }).join("") + "</tr>";
  }).join("") + "</tbody>";
  return `<table class="table table-bordered table-striped" ${tableId ? `id="${tableId}"` : ""}>${thead}${tbody}</table>`;
}

// ============ Export helpers ============
function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportTableToCSV(tableId, filename) {
  const rows = document.querySelectorAll(`#${tableId} tr`);
  const csv = Array.from(rows).map(row => {
    const cells = row.querySelectorAll("th,td");
    return Array.from(cells).map(cell => {
      const text = (cell.innerText ?? "").replace(/"/g, '""');
      return `"${text}"`;
    }).join(",");
  }).join("\n");
  downloadBlob(csv, filename, "text/csv;charset=utf-8;");
}

function exportTableToXLSX(tableId, filename) {
  const table = document.getElementById(tableId);
  const ws = XLSX.utils.table_to_sheet(table);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function printTable(tableId, title = "Print View") {
  const tableHTML = document.getElementById(tableId).outerHTML;
  const w = window.open("", "_blank");
  w.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet"/>
        <style>body{padding:20px}</style>
      </head>
      <body>
        <h3 class="mb-3">${title}</h3>
        ${tableHTML}
        <script>window.onload = () => window.print();<\/script>
      </body>
    </html>
  `);
  w.document.close();
}

// ======================
// Duplicates Page
// ======================
if (document.getElementById("duplicatesContainer")) {
  const rows = loadDataOrRedirect();
  if (rows) {
    const headers = rows[0];
    const data = rows.slice(1);

    const nameIdx = 2; // Column 3 (0-based)
    const groups = new Map(); // normalized name -> rows[]
    data.forEach(r => {
      const raw = r[nameIdx];
      if (raw == null || raw === "") return;
      const key = raw.toString().trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });

    // Build results: include original + duplicates for names with count > 1
    const dupNameKeys = new Set();
    let resultRows = [];
    Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0])) // alphabetical by name
      .forEach(([key, arr]) => {
        if (arr.length > 1) {
          dupNameKeys.add(key);
          resultRows = resultRows.concat(arr);
        }
      });

    document.getElementById("dupCount").innerText = dupNameKeys.size;

    const html = resultRows.length
      ? tableHTMLFromArray(headers, resultRows, nameIdx, dupNameKeys, "dupTable")
      : "<p class='text-center text-success fw-bold'>No duplicates found ✅</p>";

    document.getElementById("duplicatesContainer").innerHTML = html;

    // Export buttons
    const btnCSV  = document.getElementById("dupExportCSV");
    const btnXLSX = document.getElementById("dupExportXLSX");
    const btnPrint= document.getElementById("dupPrint");
    if (btnCSV)  btnCSV.onclick  = () => exportTableToCSV("dupTable",  "duplicates.csv");
    if (btnXLSX) btnXLSX.onclick = () => exportTableToXLSX("dupTable", "duplicates.xlsx");
    if (btnPrint)btnPrint.onclick= () => printTable("dupTable", "Duplicate Names");
  }
}

// ======================
// Full List Page
// ======================
function renderFullList() {
  const stored = localStorage.getItem("uploadedData");
  if (!stored) {
    alert("Please upload a file first on the landing page.");
    window.location.href = "index.html";
    return;
  }

  const rows = JSON.parse(stored);
  const headers = rows[0];
  const data = rows.slice(1);

  const table = $("#fullTable");

  // Build table header
  let theadHtml = "<tr>" + headers.map(h => `<th>${h ?? ""}</th>`).join("") + "</tr>";
  table.find("thead").html(theadHtml);

  // Build all rows but keep table hidden initially
  let tbodyHtml = data.map(r => {
    return "<tr>" + headers.map((_, i) => `<td>${r[i] ?? ""}</td>`).join("") + "</tr>";
  }).join("");
  table.find("tbody").html(tbodyHtml);

  // Initialize DataTable but keep it hidden
  const dt = table.DataTable({
    pageLength: 10,
    ordering: true,
    dom: 'lrtip' // remove default search bar
  });

  // Hide table initially
  $("#fullTable_wrapper").hide();

  // Show table only when search has input
  $("#searchBar").on("keyup", function () {
    if (this.value.trim() === "") {
      $("#fullTable_wrapper").hide();
    } else {
      $("#fullTable_wrapper").show();
      dt.search(this.value).draw();
    }
  });
    

    // Export buttons
    const btnCSV  = document.getElementById("fullExportCSV");
    const btnXLSX = document.getElementById("fullExportXLSX");
    const btnPrint= document.getElementById("fullPrint");
    if (btnCSV)  btnCSV.onclick  = () => exportTableToCSV("fullTable",  "full-list.csv");
    if (btnXLSX) btnXLSX.onclick = () => exportTableToXLSX("fullTable", "full-list.xlsx");
    if (btnPrint)btnPrint.onclick= () => printTable("fullTable", "Full List of Names");
  }

