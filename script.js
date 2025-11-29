let allData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 20;

// ห่อทุกอย่างไว้ใน DOMContentLoaded
document.addEventListener("DOMContentLoaded", function () {
  // Event listeners
  const uploadArea = document.getElementById("uploadArea");
  const csvFile = document.getElementById("csvFile");

  // เช็คว่า elements มีอยู่จริงก่อน
  if (uploadArea && csvFile) {
    uploadArea.addEventListener("click", () => csvFile.click());
    uploadArea.addEventListener("dragover", handleDragOver);
    uploadArea.addEventListener("dragleave", handleDragLeave);
    uploadArea.addEventListener("drop", handleDrop);
    csvFile.addEventListener("change", handleFileSelect);
  }

  function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  }

  function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
  }

  function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    const files = e.dataTransfer.files;
    if (files.length > 0) processFile(files[0]);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
  }
});

function processFile(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    complete: function (result) {
      allData = result.data.map((row) => {
        // ปรับเวลาให้เป็นเวลาไทย (+7 ชั่วโมง) และแทนที่ใน data เลย
        ["opening_time_utc", "closing_time_utc"].forEach((key) => {
          if (row[key]) {
            // ตัด microseconds ออก
            let cleanDateStr = row[key].split(".")[0] + "Z"; // Z = UTC
            let date = new Date(cleanDateStr);

            // บวก 7 ชั่วโมงเวลาไทย
            date.setUTCHours(date.getUTCHours() + 7);

            const day = date.toISOString().split("T")[0];
            const hours = date.getUTCHours().toString().padStart(2, "0");
            const minutes = date.getUTCMinutes().toString().padStart(2, "0");

            row[key] = `${day} : (${hours}:${minutes})`;
          }
        });

        // ปัดตัวเลข 2 ตำแหน่งทศนิยม
        ["opening_price", "closing_price", "stop_loss"].forEach((key) => {
          if (row[key] !== undefined && row[key] !== null && !isNaN(row[key])) {
            row[key] = Number(row[key]).toFixed(2);
          }
        });

        return row; // คืนค่าที่แก้แล้ว
      });

      // Process data
      processData();

      // Show dashboard
      document.getElementById("uploadSection").style.display = "none";
      document.getElementById("dashboard").style.display = "block";

      // Initialize filters
      initializeFilters();

      // Display data
      applyFilters();
    },
    error: function (error) {
      alert("เกิดข้อผิดพลาดในการอ่านไฟล์: " + error.message);
    },
  });
}

function processData() {
  // Clean and standardize data
  allData = allData.map((row) => {
    // Try to find profit/loss column (various possible names)
    const profitKeys = ["profit_usd"];
    const dateKeys = ["date", "time", "datetime", "timestamp"];

    let profit = 0;
    let dateValue = "";

    // Find profit column
    for (const key of Object.keys(row)) {
      if (
        profitKeys.some((pk) => key.toLowerCase().includes(pk.toLowerCase()))
      ) {
        profit = parseFloat(row[key]) || 0;
        break;
      }
    }

    // Find date column
    for (const key of Object.keys(row)) {
      if (dateKeys.some((dk) => key.toLowerCase().includes(dk.toLowerCase()))) {
        dateValue = row[key];
        break;
      }
    }

    return {
      ...row,
      _profit: profit,
      _date: dateValue,
      _dateObj: new Date(dateValue),
    };
  });

  // Sort by date descending (ใหม่ → เก่า)
  allData.sort((a, b) => b._dateObj - a._dateObj);
}

let equityChartInstance = null;
function renderEquityCurve() {
  // รวมกำไรต่อวัน
  const dailyProfit = {};
  filteredData.forEach((row) => {
    const datePart = row._date.split(" : ")[0];
    if (!dailyProfit[datePart]) dailyProfit[datePart] = 0;
    dailyProfit[datePart] += row._profit;
  });

  // เรียงวันที่
  const sortedDates = Object.keys(dailyProfit).sort(
    (a, b) => new Date(a) - new Date(b)
  );

  // equity สะสม
  let equity = 0;
  const labels = [];
  const equityValues = [];

  sortedDates.forEach((datePart) => {
    const [year, month, day] = datePart.split("-");
    labels.push(`${day}/${month}/${year.slice(2)}`);
    equity += dailyProfit[datePart];
    equityValues.push(equity);
  });

  function sumArray(arr) {
    return arr.reduce((acc, val) => acc + val, 0);
  }

  const sumValues = sumArray(equityValues);

  var border;
  var bg;

  if (sumValues > 0) {
    border = "#22c55e";
    bg = "rgba(74, 222, 128, 0.2)";
  } else {
    border = "#ef4444";
    bg = "rgba(248, 113, 113, 0.2)";
  }

  const ctx = document.getElementById("equityChart").getContext("2d");

  // ถ้ามี chart เก่า destroy ก่อน
  if (equityChartInstance) {
    equityChartInstance.destroy();
  }

  equityChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Equity",
          data: equityValues,
          borderColor: border,
          backgroundColor: bg,
          fill: true,
          tension: 0.3,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "rgba(255, 255, 255, 0.8)",
            font: {
              size: window.innerWidth < 768 ? 10 : 12,
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(139, 92, 246, 0.2)",
          },
          ticks: {
            color: "rgba(255, 255, 255, 0.7)",
            font: {
              size: window.innerWidth < 768 ? 9 : 11,
            },
          },
        },
        x: {
          grid: {
            color: "rgba(139, 92, 246, 0.2)",
          },
          ticks: {
            color: "rgba(255, 255, 255, 0.7)",
            font: {
              size: window.innerWidth < 768 ? 9 : 11,
            },
            maxTicksLimit: window.innerWidth < 768 ? 6 : 10,
          },
        },
      },
    },
  });
}

let dailyPLChartInstance = null;
let dailyNetChartInstance = null;

function renderDailyPLChart() {
  const dailyProfit = {};
  const dailyLoss = {};

  // รวม Profit และ Loss แยกตามวัน
  filteredData.forEach((row) => {
    let [year, month, day] = row._date.split(" : ")[0].split("-"); // YYYY-MM-DD
    const datePart = `${year.slice(2)}-${month}-${day}`; // YY-MM-DD

    dailyProfit[datePart] =
      (dailyProfit[datePart] || 0) + (row._profit >= 0 ? row._profit : 0);
    dailyLoss[datePart] =
      (dailyLoss[datePart] || 0) + (row._profit < 0 ? row._profit : 0);
  });

  // เรียงวัน และสร้าง labels, values
  const sortedDates = Object.keys(dailyProfit).sort(
    (a, b) => new Date(a) - new Date(b)
  );

  const labels = sortedDates
    .map((d) => d.split("-").reverse().join("/"))
    .reverse();
  const profitValues = sortedDates.map((d) => dailyProfit[d] || 0).reverse();
  const lossValues = sortedDates.map((d) => dailyLoss[d] || 0).reverse();
  const netValues = sortedDates
    .map((d) => (dailyProfit[d] || 0) + (dailyLoss[d] || 0))
    .reverse();

  // === Profit/Loss Chart ===
  if (dailyPLChartInstance) dailyPLChartInstance.destroy();
  const ctx = document.getElementById("dailyPLChart").getContext("2d");

  dailyPLChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Profit",
          data: profitValues,
          backgroundColor: "#22c55e",
          stack: "PL",
        },
        {
          label: "Loss",
          data: lossValues,
          backgroundColor: "#ef4444",
          stack: "PL",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "rgba(255, 255, 255, 0.8)",
            font: {
              size: window.innerWidth < 768 ? 10 : 12,
            },
          },
        },
        tooltip: {
          callbacks: {
            label: (context) =>
              `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            color: "rgba(139, 92, 246, 0.2)",
          },
          ticks: {
            color: "rgba(255, 255, 255, 0.7)",
            font: {
              size: window.innerWidth < 768 ? 9 : 11,
            },
            maxTicksLimit: window.innerWidth < 768 ? 6 : 10,
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: {
            color: "rgba(139, 92, 246, 0.2)",
          },
          ticks: {
            color: "rgba(255, 255, 255, 0.7)",
            font: {
              size: window.innerWidth < 768 ? 9 : 11,
            },
          },
        },
      },
    },
  });

  // === Net Profit Chart ===
  if (dailyNetChartInstance) dailyNetChartInstance.destroy();
  const ctx2 = document.getElementById("dailyNetChart").getContext("2d");

  dailyNetChartInstance = new Chart(ctx2, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Net Profit",
          data: netValues,
          backgroundColor: (ctx) => (ctx.raw >= 0 ? "#22c55e" : "#ef4444"),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "rgba(255, 255, 255, 0.8)",
            font: {
              size: window.innerWidth < 768 ? 10 : 12,
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(139, 92, 246, 0.2)",
          },
          ticks: {
            color: "rgba(255, 255, 255, 0.7)",
            font: {
              size: window.innerWidth < 768 ? 9 : 11,
            },
          },
        },
        x: {
          grid: {
            color: "rgba(139, 92, 246, 0.2)",
          },
          ticks: {
            color: "rgba(255, 255, 255, 0.7)",
            font: {
              size: window.innerWidth < 768 ? 9 : 11,
            },
            maxTicksLimit: window.innerWidth < 768 ? 6 : 10,
          },
        },
      },
    },
  });
}

function renderPnLCalendar() {
  let currentDate = new Date();
  let dailyProfit = {};

  // 1️⃣ คำนวณ profit รายวัน
  function calculateDailyProfit() {
    dailyProfit = {};
    allData.forEach((row) => {
      const datePart = row._date.split(" : ")[0];
      if (!dailyProfit[datePart]) {
        dailyProfit[datePart] = 0;
      }
      dailyProfit[datePart] += row._profit;
    });
  }

  // 2️⃣ สร้างปฏิทิน
  function renderCalendar(year, month) {
    const calendar = document.getElementById("pnlCalendar");
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
        <button onclick="changeMonth(-1)" style="padding: 8px 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 8px; cursor: pointer;">← Prev</button>
        <h3 style="margin: 0; font-size: clamp(1rem, 3vw, 1.3rem);">${monthNames[month]} ${year}</h3>
        <button onclick="changeMonth(1)" style="padding: 8px 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 8px; cursor: pointer;">Next →</button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: clamp(4px, 1vw, 8px);">
    `;

    // Headers
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day) => {
      html += `<div style="text-align: center; font-weight: 600; font-size: clamp(0.7rem, 2vw, 0.9rem); color: rgba(255,255,255,0.6); padding: 8px 4px;">${day}</div>`;
    });

    // Empty cells for first week
    for (let i = 0; i < firstDay; i++) {
      html += `<div style="aspect-ratio: 1; min-height: 50px;"></div>`;
    }

    // Days
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const profit = dailyProfit[dateStr];

      const isToday =
        year === today.getFullYear() &&
        month === today.getMonth() &&
        day === today.getDate();
      const bgColor = profit
        ? profit > 0
          ? "rgba(16, 185, 129, 0.2)"
          : "rgba(239, 68, 68, 0.2)"
        : "rgba(255,255,255,0.05)";
      const borderColor = isToday
        ? "2px solid #3b82f6"
        : "1px solid rgba(255,255,255,0.1)";

      html += `
        <div style="
          aspect-ratio: 1;
          background: ${bgColor};
          border-radius: 8px;
          padding: clamp(4px, 1vw, 8px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: ${borderColor};
          transition: all 0.3s ease;
        " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          <div style="font-size: clamp(0.8rem, 2.5vw, 1rem); font-weight: 600; margin-bottom: 4px;">${day}</div>
          ${
            profit
              ? `<div style="font-size: clamp(0.65rem, 2vw, 0.85rem); font-weight: 700; color: ${
                  profit > 0 ? "#10b981" : "#ef4444"
                };">${profit > 0 ? "+" : ""}${profit.toFixed(2)}</div>`
              : ""
          }
        </div>
      `;
    }

    html += "</div>";
    calendar.innerHTML = html;
  }

  // 3️⃣ ฟังก์ชันเปลี่ยนเดือน
  window.changeMonth = function (delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
  };

  // เริ่มต้น
  calculateDailyProfit();
  renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
}

// Global variable สำหรับ pagination
let currentWeeklyPage = 1;
const rowsPerPage = 5;
let allWeeklyData = [];

function renderWeeklySummary(page = 1) {
  // 1️⃣ รวม profit ตามวันที่
  const dailyProfit = {};
  allData.forEach((row) => {
    const datePart = row._date.split(" : ")[0];
    if (!dailyProfit[datePart]) {
      dailyProfit[datePart] = 0;
    }
    dailyProfit[datePart] += row._profit;
  });

  // 2️⃣ จัดกลุ่มตามสัปดาห์
  const weeklyData = {};

  Object.entries(dailyProfit).forEach(([dateStr, profit]) => {
    const date = new Date(dateStr);

    // หาวันจันทร์ของสัปดาห์นั้น
    const dayOfWeek = date.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // อาทิตย์ = 0, จันทร์ = 1
    const monday = new Date(date);
    monday.setDate(date.getDate() + mondayOffset);

    const weekKey = monday.toISOString().split("T")[0]; // YYYY-MM-DD ของวันจันทร์

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = {
        startDate: new Date(monday),
        endDate: new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000), // +6 วัน = วันอาทิตย์
        totalProfit: 0,
        tradingDays: 0,
        winDays: 0,
        lossDays: 0,
        dailyProfits: [],
      };
    }

    weeklyData[weekKey].totalProfit += profit;
    weeklyData[weekKey].tradingDays++;
    weeklyData[weekKey].dailyProfits.push({ date: dateStr, profit });

    if (profit > 0) {
      weeklyData[weekKey].winDays++;
    } else if (profit < 0) {
      weeklyData[weekKey].lossDays++;
    }
  });

  // 3️⃣ เรียงตามวันที่ (ใหม่สุดก่อน) และเก็บไว้ใน global variable
  allWeeklyData = Object.entries(weeklyData).sort(
    (a, b) => new Date(b[1].startDate) - new Date(a[1].startDate)
  );

  // 4️⃣ คำนวณ pagination
  const totalPages = Math.ceil(allWeeklyData.length / rowsPerPage);
  currentWeeklyPage = page;

  const startIndex = (page - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentPageData = allWeeklyData.slice(startIndex, endIndex);

  // 5️⃣ สร้าง pagination controls
  const paginationHTML =
    totalPages > 1
      ? `
    <div style="
      display: flex; 
      justify-content: center; 
      align-items: center; 
      gap: 12px; 
      margin: 32px 0; 
      flex-wrap: wrap;
      background: var(--bg-glass);
      padding: 24px; 
      border-radius: var(--border-radius); 
      backdrop-filter: blur(20px); 
      border: 1px solid var(--border-primary);
      box-shadow: var(--shadow-light);
    ">
      <!-- ปุ่ม Previous -->
      <button onclick="renderWeeklySummary(${page - 1})" 
              ${page === 1 ? "disabled" : ""} 
              style="
                padding: 12px 16px;
                border: 1px solid var(--border-secondary);
                background: ${
                  page === 1 ? "var(--bg-glass)" : "var(--bg-tertiary)"
                };
                color: ${
                  page === 1 ? "var(--text-muted)" : "var(--text-primary)"
                };
                border-radius: var(--border-radius-small);
                cursor: ${page === 1 ? "not-allowed" : "pointer"};
                font-size: 14px;
                font-weight: 600;
                transition: var(--transition);
                backdrop-filter: blur(20px);
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                ${page === 1 ? "opacity: 0.5;" : ""}
              "
              ${
                page === 1
                  ? ""
                  : "onmouseover=\"this.style.background='var(--bg-secondary)'; this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-light)'\" onmouseout=\"this.style.background='var(--bg-tertiary)'; this.style.transform='translateY(0)'; this.style.boxShadow='none'\""
              }>
        ← ก่อนหน้า
      </button>

      <!-- ตัวเลขหน้า -->
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        ${Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((pageNum) => {
            return (
              pageNum === 1 ||
              pageNum === totalPages ||
              (pageNum >= page - 2 && pageNum <= page + 2)
            );
          })
          .map((pageNum, index, array) => {
            let result = "";
            if (index > 0 && pageNum - array[index - 1] > 1) {
              result +=
                '<span style="color: var(--text-muted); padding: 0 8px; font-size: 14px;">...</span>';
            }

            result += `
              <button onclick="renderWeeklySummary(${pageNum})" 
                      style="
                        padding: 12px 16px;
                        border: 1px solid ${
                          pageNum === page
                            ? "transparent"
                            : "var(--border-secondary)"
                        };
                        background: ${
                          pageNum === page
                            ? "var(--primary-gradient)"
                            : "var(--bg-tertiary)"
                        };
                        color: var(--text-primary);
                        border-radius: var(--border-radius-small);
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: ${pageNum === page ? "700" : "600"};
                        min-width: 44px;
                        transition: var(--transition);
                        backdrop-filter: blur(20px);
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        ${
                          pageNum === page
                            ? "box-shadow: var(--shadow-neon);"
                            : ""
                        }
                      "
                      ${
                        pageNum === page
                          ? ""
                          : "onmouseover=\"this.style.background='var(--bg-secondary)'; this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-light)'\" onmouseout=\"this.style.background='var(--bg-tertiary)'; this.style.transform='translateY(0)'; this.style.boxShadow='none'\""
                      }>
                ${pageNum}
              </button>
            `;
            return result;
          })
          .join("")}
      </div>

      <!-- ปุ่ม Next -->
      <button onclick="renderWeeklySummary(${page + 1})" 
              ${page === totalPages ? "disabled" : ""} 
              style="
                padding: 12px 16px;
                border: 1px solid var(--border-secondary);
                background: ${
                  page === totalPages ? "var(--bg-glass)" : "var(--bg-tertiary)"
                };
                color: ${
                  page === totalPages
                    ? "var(--text-muted)"
                    : "var(--text-primary)"
                };
                border-radius: var(--border-radius-small);
                cursor: ${page === totalPages ? "not-allowed" : "pointer"};
                font-size: 14px;
                font-weight: 600;
                transition: var(--transition);
                backdrop-filter: blur(20px);
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                ${page === totalPages ? "opacity: 0.5;" : ""}
              "
              ${
                page === totalPages
                  ? ""
                  : "onmouseover=\"this.style.background='var(--bg-secondary)'; this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-light)'\" onmouseout=\"this.style.background='var(--bg-tertiary)'; this.style.transform='translateY(0)'; this.style.boxShadow='none'\""
              }>
        ถัดไป →
      </button>

      <!-- ข้อมูลสถิติ -->
      <div style="
        font-size: 14px; 
        color: var(--text-secondary); 
        margin-left: 20px; 
        font-weight: 600; 
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        แสดง ${startIndex + 1}-${Math.min(
          endIndex,
          allWeeklyData.length
        )} จาก ${allWeeklyData.length} รายการ
      </div>
    </div>
  `
      : "";

  // 6️⃣ สร้างตาราง
  const container = document.getElementById("pnlSumaryWeek");

  const tableHTML = `
    ${
      allWeeklyData.length === 0
        ? `
      <div style="
        text-align: center; 
        padding: 60px 40px; 
        color: var(--text-muted); 
        background: var(--bg-glass); 
        border-radius: var(--border-radius); 
        backdrop-filter: blur(20px); 
        border: 1px solid var(--border-primary); 
        box-shadow: var(--shadow-heavy);
      ">
        <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
        <div style="font-size: 18px; font-weight: 600; color: var(--text-primary);">ยังไม่มีข้อมูลการเทรด</div>
        <div style="font-size: 14px; margin-top: 8px; color: var(--text-secondary);">เริ่มเทรดเพื่อดูสรุปรายสัปดาห์</div>
      </div>
    `
        : `
      <div style="
        overflow-x: auto; 
        border-radius: var(--border-radius); 
        box-shadow: var(--shadow-heavy); 
        backdrop-filter: blur(40px);
        background: var(--bg-card);
        border: 1px solid var(--border-primary);
      ">
        <table style="
          width: 100%; 
          border-collapse: collapse; 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <thead>
            <tr style="background: var(--bg-card); color: var(--text-primary);">
              <th style="padding: 10px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">สัปดาห์</th>
              <th style="padding: 10px; text-align: right; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">P&L รวม</th>
              <th style="padding: 10px; text-align: center; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">วันเทรด</th>
              <th style="padding: 10px; text-align: center; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">วันกำไร</th>
              <th style="padding: 10px; text-align: center; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">วันขาดทุน</th>
              <th style="padding: 10px; text-align: center; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Win Rate</th>
              <th style="padding: 10px; text-align: right; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">เฉลี่ย/วัน</th>
            </tr>
          </thead>
          <tbody>
            ${currentPageData
              .map(([weekKey, data], index) => {
                const startDate = data.startDate.toLocaleDateString("th-TH", {
                  day: "2-digit",
                  month: "2-digit",
                });
                const endDate = data.endDate.toLocaleDateString("th-TH", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                });

                const totalProfit = data.totalProfit;
                const winRate =
                  data.tradingDays > 0
                    ? ((data.winDays / data.tradingDays) * 100).toFixed(1)
                    : "0.0";
                const avgDaily =
                  data.tradingDays > 0
                    ? (totalProfit / data.tradingDays).toFixed(2)
                    : "0.00";

                const rowBg =
                  index % 2 === 0 ? "var(--bg-glass)" : "transparent";

                return `
                <tr style="
                  background: ${rowBg}; 
                  transition: var(--transition);
                  border-bottom: 1px solid var(--border-primary);
                " 
                onmouseover="this.style.background='rgba(139, 92, 246, 0.1)'" 
                onmouseout="this.style.background='${rowBg}'">
                  <td style="padding: 10px; color: var(--text-primary);">
                    <div style="font-weight: 600; font-size: 12px;">${startDate} - ${endDate}</div>
                  </td>
                  <td style="padding: 10px; text-align: right;">
                    <span style="
                      font-weight: 700; 
                      background: ${
                        totalProfit > 0
                          ? "var(--success-gradient)"
                          : totalProfit < 0
                          ? "var(--danger-gradient)"
                          : "var(--primary-gradient)"
                      };
                      -webkit-background-clip: text;
                      -webkit-text-fill-color: transparent;
                      background-clip: text;
                      padding: 6px 12px;
                      border-radius: var(--border-radius-small);
                      font-size: 12px;
                      text-shadow: ${
                        totalProfit > 0
                          ? "0 0 20px rgba(16, 185, 129, 0.5)"
                          : totalProfit < 0
                          ? "0 0 20px rgba(239, 68, 68, 0.5)"
                          : "0 0 20px rgba(139, 92, 246, 0.5)"
                      };
                    ">
                      ${totalProfit > 0 ? "+" : ""}${totalProfit.toFixed(2)}
                    </span>
                  </td>
                  <td style="padding: 10px; text-align: center; color: var(--text-secondary); font-weight: 500; font-size: 12px;">
                    ${data.tradingDays}
                  </td>
                  <td style="padding: 10px; text-align: center;">
                    <span style="
                      background: var(--success-gradient);
                      -webkit-background-clip: text;
                      -webkit-text-fill-color: transparent;
                      background-clip: text;
                      font-weight: 600; 
                      font-size: 12px;
                    ">${data.winDays}</span>
                  </td>
                  <td style="padding: 10px; text-align: center;">
                    <span style="
                      background: var(--danger-gradient);
                      -webkit-background-clip: text;
                      -webkit-text-fill-color: transparent;
                      background-clip: text;
                      font-weight: 600; 
                      font-size: 12px;
                    ">${data.lossDays}</span>
                  </td>
                  <td style="padding: 10px; text-align: center;">
                    <span style="
                      font-weight: 600;
                      color: ${
                        parseFloat(winRate) >= 50
                          ? "var(--text-primary)"
                          : "var(--text-primary)"
                      };
                      background: ${
                        parseFloat(winRate) >= 50
                          ? "rgba(16, 185, 129, 0.1)"
                          : "rgba(239, 68, 68, 0.1)"
                      };
                      padding: 6px 12px;
                      border-radius: var(--border-radius-small);
                      font-size: 12px;
                      border: 1px solid ${
                        parseFloat(winRate) >= 50
                          ? "rgba(16, 185, 129, 0.3)"
                          : "rgba(239, 68, 68, 0.3)"
                      };
                      backdrop-filter: blur(20px);
                    ">
                      ${winRate}%
                    </span>
                  </td>
                  <td style="padding: 10px; text-align: right; color: var(--text-secondary); font-weight: 500; font-size: 12px;">
                    ${parseFloat(avgDaily) > 0 ? "+" : ""}${avgDaily}
                  </td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      
      ${paginationHTML}
    `
    }
  `;

  container.innerHTML = tableHTML;
}
// --- Initialize date filter ---
function initializeFilters() {
  const dates = allData
    .map((row) => row._dateObj)
    .filter((d) => d instanceof Date && !isNaN(d));

  if (dates.length > 0) {
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    // แปลงเป็น string yyyy-mm-dd
    const formatDate = (d) =>
      d.getFullYear() +
      "-" +
      (d.getMonth() + 1).toString().padStart(2, "0") +
      "-" +
      d.getDate().toString().padStart(2, "0");

    document.getElementById("startDate").value = formatDate(minDate);
    document.getElementById("endDate").value = formatDate(maxDate);
  }
}

function applyFilters() {
  const startDate = new Date(document.getElementById("startDate").value);
  const endDate = new Date(document.getElementById("endDate").value);

  filteredData = allData.filter((row) => {
    const rowDate = row._dateObj;
    if (isNaN(rowDate)) return true;

    return rowDate >= startDate && rowDate <= endDate;
  });

  currentPage = 1;
  updateDisplay();
}

function resetFilters() {
  initializeFilters();
  applyFilters();
}

function updateDisplay() {
  updateStats();
  updateTable();
  updatePagination();
  renderEquityCurve();
  renderPnLCalendar();
  renderDailyPLChart();
  renderWeeklySummary();
}

function updateStats() {
  const profits = filteredData.filter((row) => row._profit > 0);
  const losses = filteredData.filter((row) => row._profit < 0);
  const totalProfit = profits.reduce((sum, row) => sum + row._profit, 0);
  const totalLoss = Math.abs(losses.reduce((sum, row) => sum + row._profit, 0));
  const winRate =
    filteredData.length > 0 ? (profits.length / filteredData.length) * 100 : 0;
  const profitFactor =
    totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? "∞" : 0;
  const netProfit = totalProfit - totalLoss;

  const statsHtml = `
                    <div class="stat-card">
                        <div class="stat-value profit">${totalProfit.toFixed(
                          2
                        )}</div>
                        <div class="stat-label">💰 Total Profit</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value loss">${totalLoss.toFixed(
                          2
                        )}</div>
                        <div class="stat-label">💸 Total Loss</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value ${
                          netProfit >= 0 ? "profit" : "loss"
                        }">${netProfit.toFixed(2)}</div>
                        <div class="stat-label">📊 Net P&L</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value neutral">${winRate.toFixed(
                          1
                        )}%</div>
                        <div class="stat-label">🎯 Win Rate</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value ${
                          profitFactor >= 1 ? "profit" : "loss"
                        }">${
    typeof profitFactor === "number" ? profitFactor.toFixed(2) : profitFactor
  }</div>
                        <div class="stat-label">⚖️ Profit Factor</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value neutral">${
                          filteredData.length
                        }</div>
                        <div class="stat-label">📈 Total Trades</div>
                    </div>
                `;

  document.getElementById("statsGrid").innerHTML = statsHtml;
}

function updateTable() {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = filteredData.slice(startIndex, endIndex);

  if (pageData.length === 0) {
    document.getElementById("tableBody").innerHTML =
      '<tr><td colspan="100%" class="no-data">ไม่พบข้อมูล</td></tr>';
    return;
  }

  // Create table header
  const headers = Object.keys(pageData[0]).filter(
    (key) =>
      !key.startsWith("_") &&
      key !== "margin_level" &&
      key !== "equity_usd" &&
      key !== "commission_usd" &&
      key !== "original_position_size" &&
      key !== "swap_usd"
  );

  const headerHtml =
    "<tr>" + headers.map((header) => `<th>${header}</th>`).join("") + "</tr>";

  document.getElementById("tableHeader").innerHTML = headerHtml;

  // Create table body
  const bodyHtml = pageData
    .map((row, index) => {
      const rowHtml = headers
        .map((header) => {
          let value = row[header];
          let cellClass = "";

          // Format profit/loss columns
          if (
            typeof value === "number" &&
            header.toLowerCase().includes("profit")
          ) {
            cellClass = value >= 0 ? "profit" : "loss";
            value = "$" + value.toFixed(2);
          }

          return `<td class="${cellClass}">${
            value !== null && value !== undefined ? value : ""
          }</td>`;
        })
        .join("");

      return `<tr>${rowHtml}</tr>`;
    })
    .join("");

  document.getElementById("tableBody").innerHTML = bodyHtml;

  // Update page info
  document.getElementById("pageInfo").textContent = `แสดง ${
    startIndex + 1
  }-${Math.min(endIndex, filteredData.length)} จาก ${
    filteredData.length
  } รายการ`;
}

function updatePagination() {
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const pagination = document.getElementById("pagination");

  let html = `
          <div class="page-info">${
            document.getElementById("pageInfo").textContent
          }</div>
          <button onclick="goToPage(1)" ${
            currentPage === 1 ? "disabled" : ""
          }>««</button>
          <button onclick="goToPage(${currentPage - 1})" ${
    currentPage === 1 ? "disabled" : ""
  }>‹</button>
        `;

  let startPage, endPage;
  if (totalPages <= 5) {
    // Show all pages if total pages are few
    startPage = 1;
    endPage = totalPages;
  } else {
    // Show a range of pages
    if (currentPage <= 3) {
      startPage = 1;
      endPage = 5;
    } else if (currentPage + 2 >= totalPages) {
      startPage = totalPages - 4;
      endPage = totalPages;
    } else {
      startPage = currentPage - 2;
      endPage = currentPage + 2;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button onclick="goToPage(${i})" class="${
      i === currentPage ? "active" : ""
    }">${i}</button>`;
  }

  html += `
          <button onclick="goToPage(${currentPage + 1})" ${
    currentPage === totalPages ? "disabled" : ""
  }>›</button>
          <button onclick="goToPage(${totalPages})" ${
    currentPage === totalPages ? "disabled" : ""
  }>»»</button>
        `;

  pagination.innerHTML = html;
}

function goToPage(page) {
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    updateTable();
    updatePagination();
  }
}

// Handle window resize for responsive charts
let resizeTimeout;
window.addEventListener("resize", function () {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(function () {
    // Re-render charts to update font sizes and tick limits based on new window width
    if (typeof renderEquityCurve === "function") renderEquityCurve();
    if (typeof renderDailyPLChart === "function") renderDailyPLChart();
    // renderDailyNetChart is part of renderDailyPLChart in the original code?
    // Wait, let's check if renderDailyPLChart handles both or if they are separate.
    // The search result showed renderDailyPLChart creating dailyPLChartInstance.
    // And dailyNetChartInstance was also in the file.
    // Let's assume calling the render functions is enough.
  }, 250);
});
