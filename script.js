// Handle File Upload
function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  // ✅ Reset old results whenever new file is uploaded
  localStorage.removeItem("uploadedData");
  localStorage.removeItem("uploadedFileInfo");

  const reader = new FileReader();
  reader.onload = function (evt) {
    const data = new Uint8Array(evt.target.result);
    const workbook = XLSX.read(data, { type: "array" });

    // Read first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // ✅ Save data and file info to localStorage
    localStorage.setItem("uploadedData", JSON.stringify(json));
    localStorage.setItem("uploadedFileInfo", JSON.stringify({
      name: file.name,
      lastModified: new Date(file.lastModified).toLocaleString()
    }));

    alert("File uploaded successfully! Data has been reset.");
    displayFileInfo();
  };
  reader.readAsArrayBuffer(file);
}

// Display File Info (name + last modified)
function displayFileInfo() {
  const info = JSON.parse(localStorage.getItem("uploadedFileInfo"));
  if (info) {
    const container = document.getElementById("fileInfo");
    if (container) {
      container.innerHTML = `
        <p><strong>File:</strong> ${info.name}</p>
        <p><strong>Last Modified:</strong> ${info.lastModified}</p>
      `;
    }
  }
}

// Find Duplicates
function findDuplicates() {
  const stored = localStorage.getItem("uploadedData");
  if (!stored) {
    alert("Please upload a file first.");
    return;
  }

  const rows = JSON.parse(stored);
  const headers = rows[0];
  const data = rows.slice(1);

  const nameIndex = 2; // ✅ Column 3 (zero-based index)
  const seen = {};
  const duplicates = [];

  data.forEach((row, i) => {
    const name = (row[nameIndex] || "").toString().trim();
    if (!name) return;
    if (seen[name]) {
      duplicates.push(row);        // duplicate row
      if (seen[name].count === 1) {
        duplicates.push(seen[name].row); // include original once
      }
      seen[name].count++;
    } else {
      seen[name] = { count: 1, row };
    }
  });

  // Sort alphabetically by column 3 (name)
  duplicates.sort((a, b) => {
    const nameA = (a[nameIndex] || "").toString().toLowerCase();
    const nameB = (b[nameIndex] || "").toString().toLowerCase();
    return nameA.localeCompare(nameB);
  });

  renderTable("duplicateTable", headers, duplicates, nameIndex);
  $("#progressBar").css("width", "100%");
}

// Render Table (with optional highlight on duplicate column)
function renderTable(tableId, headers, rows, highlightIndex = null) {
  const table = $("#" + tableId);
  let theadHtml = "<tr>" + headers.map(h => `<th>${h ?? ""}</th>`).join("") + "</tr>";
  table.find("thead").html(theadHtml);

  let tbodyHtml = rows.map(r => {
    return "<tr>" + headers.map((_, i) => {
      let cell = r[i] ?? "";
      if (i === highlightIndex) {
        return `<td class="highlight">${cell}</td>`;
      }
      return `<td>${cell}</td>`;
    }).join("") + "</tr>";
  }).join("");
  table.find("tbody").html(tbodyHtml);

  if ($.fn.DataTable.isDataTable("#" + tableId)) {
    table.DataTable().destroy();
  }
  table.DataTable({
    pageLength: 10,
    ordering: true
  });
}

// Reset Results
function resetResults() {
  $("#duplicateTable tbody").empty();
  $("#progressBar").css("width", "0%");
  $("#searchBar").val("");
  localStorage.removeItem("uploadedData");
  localStorage.removeItem("uploadedFileInfo");
  const fileInfo = document.getElementById("fileInfo");
  if (fileInfo) fileInfo.innerHTML = "";
  alert("Results cleared. Please upload a new file.");
}

// Render Full List Page
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

  // Build all rows
  let tbodyHtml = data.map(r => {
    return "<tr>" + headers.map((_, i) => `<td>${r[i] ?? ""}</td>`).join("") + "</tr>";
  }).join("");
  table.find("tbody").html(tbodyHtml);

  // Initialize DataTable but keep hidden initially
  const dt = table.DataTable({
    pageLength: 10,
    ordering: true,
    dom: 'lrtip' // no default search bar
  });

  // Hide wrapper initially
  $("#fullTable_wrapper").hide();

  // Show only when input is given
  $("#searchBar").on("keyup", function () {
    if (this.value.trim() === "") {
      $("#fullTable_wrapper").hide();
    } else {
      $("#fullTable_wrapper").show();
      dt.search(this.value).draw();
    }
  });

  displayFileInfo();
}

// Auto run file info display if element exists
document.addEventListener("DOMContentLoaded", displayFileInfo);
