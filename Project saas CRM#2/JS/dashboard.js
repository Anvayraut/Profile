/* Enhanced CRM Dashboard Analytics */
    (function() {
      "use strict";

      // Utility functions
      const $ = (sel, root=document) => root.querySelector(sel);
      const store = {
        get(key, fallback=null) {
          try { 
            const v = localStorage.getItem(key); 
            return v ? JSON.parse(v) : fallback; 
          }
          catch(e) { return fallback; }
        }
      };

      const todayStr = () => {
        const d = new Date();
        return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
      };

      const ymNow = () => {
        const d = new Date();
        return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}`;
      };

      const nextMonth = (ym) => {
        if(!ym) return ymNow();
        const [y, m] = ym.split('-').map(Number);
        const d = new Date(y, m-1, 1);
        d.setMonth(d.getMonth()+1);
        return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}`;
      };

      // Data access functions
      function getBatches() { return store.get('crm.batches', []); }
      function getStudents(batchId) { return store.get(`crm.batch.${batchId}.students`, []); }

      // Initialize dashboard
      function initDashboard() {
        updateMainStats();
        initFinancialOverview();
        initBatchAnalytics();
        initStudentInsights();
        updateFollowupsList();
        setupSidebar();
      }

      // Setup sidebar mobile functionality
      function setupSidebar() {
        const sideMenu = document.querySelector("aside");
        const menuBtn = document.querySelector("#menu-btn");
        const closeBtn = document.querySelector("#close-btn");
        
        if(menuBtn && sideMenu) {
          menuBtn.addEventListener('click', () => {
            sideMenu.style.display = 'block';
          });
        }
        
        if(closeBtn && sideMenu) {
          closeBtn.addEventListener('click', () => {
            sideMenu.style.display = 'none';
          });
        }
      }

      // Update main statistics cards
      function updateMainStats() {
        const batches = getBatches();
        let totalStudents = 0;
        let totalRevenue = 0;
        let monthlyRevenue = 0;
        let followups = 0;

        batches.forEach(batch => {
          const students = getStudents(batch.id);
          const activeStudents = students.filter(s => !s.dropped);
          totalStudents += activeStudents.length;

          students.forEach(student => {
            let needsFollowup = false;
            
            if (batch.feeModel === 'monthly') {
              const dueMonth = student.lastPaidMonth ? nextMonth(student.lastPaidMonth) : (batch.startDate ? batch.startDate.slice(0,7) : ymNow());
              if (dueMonth <= ymNow()) needsFollowup = true;
              if (student.lastPaidMonth === ymNow()) {
                monthlyRevenue += Number(batch.totalFee || 0);
              }
            } else if (batch.feeModel === 'course') {
              if (!student.paid) needsFollowup = true;
              if (student.paid) totalRevenue += Number(batch.totalFee || 0);
            } else {
              const total = Number(batch.totalFee || 0);
              const paid = Number(student.paidTotal || 0);
              if (paid < total) needsFollowup = true;
              totalRevenue += paid;
            }
            
            if (needsFollowup) followups++;
          });
        });

        // Update DOM elements
        $('#totalRevenue').textContent = '₹' + totalRevenue.toLocaleString();
        $('#totalStudents').textContent = totalStudents.toString();
        $('#totalFollowups').textContent = followups.toString();

        // Update progress indicators
        const progressPercent = totalRevenue > 0 ? Math.round((monthlyRevenue / totalRevenue) * 100) : 0;
        $('#revenueProgress').textContent = `${progressPercent}% this month`;
        $('#studentProgress').textContent = `+${Math.floor(totalStudents * 0.1)} this month`;
        
        const conversionRate = totalStudents > 0 ? Math.round(((totalStudents - followups) / totalStudents) * 100) : 0;
        $('#followupProgress').textContent = `${conversionRate}% converted`;
      }

      // 1. Financial Overview Implementation
// 1. Financial Overview Implementation (Instagram-style)
// 1. Financial Overview Implementation (Instagram-style + Card Updates)
function initFinancialOverview() {
  const canvas = document.getElementById("revenueChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const batches = getBatches();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Initialize daily arrays with 0 for each day
  const dailyCollected = Array(daysInMonth).fill(0);
  const dailyPending   = Array(daysInMonth).fill(0);
  const dailyOverdue   = Array(daysInMonth).fill(0);

  // Helper → convert "YYYY-MM-DD" into day index
  function getDayIndex(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (d.getMonth() !== month || d.getFullYear() !== year) return null;
    return d.getDate() - 1; // 0-based index
  }

  // Process batches and students
  batches.forEach(batch => {
    const students = getStudents(batch.id);

    students.forEach(student => {
      if (batch.feeModel === "monthly") {
        const feeAmount = Number(batch.totalFee || 0);
        if (student.lastPaidMonth) {
          const paidDate = student.lastPaidMonth + "-01"; // convert to full date
          const idx = getDayIndex(paidDate);
          if (idx !== null) dailyCollected[idx] += feeAmount;
        }
        const dueMonth = student.lastPaidMonth
          ? nextMonth(student.lastPaidMonth)
          : (batch.startDate ? batch.startDate.slice(0, 7) : ymNow());
        const dueDate = dueMonth + "-01";
        const idx = getDayIndex(dueDate);
        if (idx !== null) {
          if (dueMonth < ymNow()) dailyOverdue[idx] += feeAmount;
          else dailyPending[idx] += feeAmount;
        }
      } else if (batch.feeModel === "course") {
        const feeAmount = Number(batch.totalFee || 0);
        if (student.paid) {
          const idx = getDayIndex(student.dueDate);
          if (idx !== null) dailyCollected[idx] += feeAmount;
        } else {
          const isOverdue = student.dueDate && student.dueDate < todayStr();
          const idx = getDayIndex(student.dueDate);
          if (idx !== null) {
            if (isOverdue) dailyOverdue[idx] += feeAmount;
            else dailyPending[idx] += feeAmount;
          }
        }
      } else {
        const total = Number(batch.totalFee || 0);
        const paid = Number(student.paidTotal || 0);
        const remaining = total - paid;
        const idx = getDayIndex(student.dueDate);
        if (paid > 0 && idx !== null) dailyCollected[idx] += paid;
        if (remaining > 0 && idx !== null) {
          const isOverdue = student.dueDate && student.dueDate < todayStr();
          if (isOverdue) dailyOverdue[idx] += remaining;
          else dailyPending[idx] += remaining;
        }
      }
    });
  });

  // Save globally (for debugging)
  window.dailyCollected = dailyCollected;
  window.dailyPending = dailyPending;
  window.dailyOverdue = dailyOverdue;

  // ==== Update Cards Below Chart ====
  const totalCollected = dailyCollected.reduce((a, b) => a + b, 0);
  const totalPending   = dailyPending.reduce((a, b) => a + b, 0);
  const totalOverdue   = dailyOverdue.reduce((a, b) => a + b, 0);
  const grandTotal     = totalCollected + totalPending + totalOverdue;

  document.getElementById("collectedFees").textContent = "₹" + totalCollected.toLocaleString();
  document.getElementById("pendingFees").textContent   = "₹" + totalPending.toLocaleString();
  document.getElementById("overdueFees").textContent   = "₹" + totalOverdue.toLocaleString();
  document.getElementById("collectionRate").textContent = 
    grandTotal > 0 ? Math.round((totalCollected / grandTotal) * 100) + "%" : "0%";

  // Generate labels → real dates like "1/9"
  const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}/${month + 1}`);

  // Render chart
  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Collected",
          data: dailyCollected,
          borderColor: "#4caf50", // green
          backgroundColor: "rgba(76, 175, 80, 0.15)",
          fill: true,
          tension: 0.3
        },
        {
          label: "Pending",
          data: dailyPending,
          borderColor: "#555", // dark gray
          backgroundColor: "rgba(150, 150, 150, 0.15)",
          fill: true,
          tension: 0.3
        },
        {
          label: "Overdue",
          data: dailyOverdue,
          borderColor: "#f44336", // red
          backgroundColor: "rgba(244, 67, 54, 0.15)",
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        tooltip: { enabled: true },
        legend: { position: "top" }
      },
      scales: {
        x: { title: { display: true, text: "Date" } },
        y: { title: { display: true, text: "Amount (₹)" }, beginAtZero: true }
      }
    }
  });
}



      // 2. Batch Management Analytics
      function initBatchAnalytics() {
        const ctx = document.getElementById('batchChart').getContext('2d');
        const batches = getBatches();
        
        const batchData = batches.map(batch => {
          const students = getStudents(batch.id);
          const activeStudents = students.filter(s => !s.dropped).length;
          return {
            name: batch.name,
            students: activeStudents,
            capacity: Math.max(activeStudents + 5, 20), // Assume capacity
          };
        });

        // Update batch stats
        $('#totalBatches').textContent = batches.length.toString();
        
        const avgSize = batches.length > 0 ? Math.round(batchData.reduce((sum, b) => sum + b.students, 0) / batches.length) : 0;
        $('#avgBatchSize').textContent = avgSize.toString();
        
        const totalCapacity = batchData.reduce((sum, b) => sum + b.capacity, 0);
        const totalStudents = batchData.reduce((sum, b) => sum + b.students, 0);
        const utilization = totalCapacity > 0 ? Math.round((totalStudents / totalCapacity) * 100) : 0;
        $('#capacityUtilization').textContent = utilization + '%';
        
        const bestBatch = batchData.reduce((best, curr) => curr.students > best.students ? curr : best, {students: 0});
        const performance = bestBatch.capacity > 0 ? Math.round((bestBatch.students / bestBatch.capacity) * 100) : 0;
        $('#batchPerformance').textContent = performance + '%';

        // Create batch chart
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: batchData.map(b => b.name.length > 10 ? b.name.slice(0,10)+'...' : b.name),
            datasets: [{
              label: 'Active Students',
              data: batchData.map(b => b.students),
              backgroundColor: '#000',
              borderRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  stepSize: 1
                }
              }
            }
          }
        });
      }

      // 3. Student Insights
      function initStudentInsights() {
        const batches = getBatches();
        
        // High Priority Students (overdue + large amounts)
        const highPriorityStudents = [];
        
        // Top Performing Batches
        const batchPerformance = [];
        
        // Payment Patterns
        const paymentPatterns = {
          onTime: 0,
          late: 0,
          overdue: 0
        };

        batches.forEach(batch => {
          const students = getStudents(batch.id);
          const activeStudents = students.filter(s => !s.dropped);
          let batchRevenue = 0;
          let batchOnTime = 0;
          
          students.forEach(student => {
            let amount = 0;
            let isOverdue = false;
            let isDue = false;
            
            if (batch.feeModel === 'monthly') {
              amount = Number(batch.totalFee || 0);
              const dueMonth = student.lastPaidMonth ? nextMonth(student.lastPaidMonth) : (batch.startDate ? batch.startDate.slice(0,7) : ymNow());
              isOverdue = dueMonth < ymNow();
              isDue = dueMonth === ymNow();
              if (student.lastPaidMonth === ymNow()) batchOnTime++;
            } else if (batch.feeModel === 'course') {
              amount = Number(batch.totalFee || 0);
              if (!student.paid) {
                isOverdue = student.dueDate && student.dueDate < todayStr();
                isDue = !isOverdue;
              } else {
                batchRevenue += amount;
                batchOnTime++;
              }
            } else {
              const total = Number(batch.totalFee || 0);
              const paid = Number(student.paidTotal || 0);
              amount = total - paid;
              batchRevenue += paid;
              if (paid >= total) batchOnTime++;
              else {
                isOverdue = student.dueDate && student.dueDate < todayStr();
                isDue = !isOverdue;
              }
            }
            
            // Add to high priority if overdue or large amount
            if ((isOverdue || amount > 5000) && amount > 0) {
              highPriorityStudents.push({
                name: student.name,
                batch: batch.name,
                amount: amount,
                isOverdue: isOverdue
              });
            }
            
            // Update payment patterns
            if (isOverdue) paymentPatterns.overdue++;
            else if (isDue) paymentPatterns.late++;
            else if (batch.feeModel === 'course' ? student.paid : student.lastPaidMonth === ymNow()) paymentPatterns.onTime++;
          });
          
          // Calculate batch performance
          const performance = activeStudents.length > 0 ? (batchOnTime / activeStudents.length) * 100 : 0;
          batchPerformance.push({
            name: batch.name,
            performance: Math.round(performance),
            students: activeStudents.length,
            revenue: batchRevenue
          });
        });

        // Render high priority students
        const highPriorityEl = $('#highPriorityStudents');
        highPriorityEl.innerHTML = highPriorityStudents
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5)
          .map(student => `
            <div class="student-item">
              <div class="student-info">
                <div class="student-name">${student.name}</div>
                <div class="student-batch">${student.batch}</div>
              </div>
              <div class="amount-tag ${student.isOverdue ? 'amount-overdue' : 'amount-due'}">
                ₹${student.amount.toLocaleString()}
              </div>
            </div>
          `).join('') || '<div class="muted">No high priority students</div>';

        // Render top performing batches
        const topBatchesEl = $('#topBatches');
        topBatchesEl.innerHTML = batchPerformance
          .sort((a, b) => b.performance - a.performance)
          .slice(0, 5)
          .map(batch => `
            <div class="performance-item">
              <div class="batch-name">${batch.name}</div>
              <div class="performance-stats">
                <span class="stat-positive">${batch.performance}%</span>
                <span>${batch.students} students</span>
              </div>
            </div>
          `).join('') || '<div class="muted">No batch data available</div>';

        // Render payment patterns
        const patternsEl = $('#paymentPatterns');
        const total = paymentPatterns.onTime + paymentPatterns.late + paymentPatterns.overdue;
        patternsEl.innerHTML = total > 0 ? `
          <div class="performance-item">
            <div class="batch-name">On Time</div>
            <div class="performance-stats">
              <span class="stat-positive">${Math.round((paymentPatterns.onTime/total)*100)}%</span>
              <span>${paymentPatterns.onTime} payments</span>
            </div>
          </div>
          <div class="performance-item">
            <div class="batch-name">Late</div>
            <div class="performance-stats">
              <span class="stat-negative">${Math.round((paymentPatterns.late/total)*100)}%</span>
              <span>${paymentPatterns.late} payments</span>
            </div>
          </div>
          <div class="performance-item">
            <div class="batch-name">Overdue</div>
            <div class="performance-stats">
              <span class="stat-negative">${Math.round((paymentPatterns.overdue/total)*100)}%</span>
              <span>${paymentPatterns.overdue} payments</span>
            </div>
          </div>
        ` : '<div class="muted">No payment data available</div>';
      }

      // Enhanced follow-ups list
      function updateFollowupsList() {
        const ul = document.getElementById('followupList');
        if (!ul) return;

        const batches = getBatches();
        const followupStudents = [];
        
        batches.forEach(batch => {
          const students = getStudents(batch.id);
          students.forEach(student => {
            if (followupStudents.length >= 5) return;
            
            let needsFollowup = false;
            if (batch.feeModel === 'monthly') {
              const dueMonth = student.lastPaidMonth ? nextMonth(student.lastPaidMonth) : (batch.startDate ? batch.startDate.slice(0,7) : ymNow());
              if (dueMonth <= ymNow()) needsFollowup = true;
            } else if (batch.feeModel === 'course') {
              if (!student.paid) needsFollowup = true;
            } else {
              const total = Number(batch.totalFee || 0);
              const paid = Number(student.paidTotal || 0);
              if (paid < total) needsFollowup = true;
            }
            
            if (needsFollowup) {
              followupStudents.push({
                name: student.name, 
                phone: student.phone, 
                batch: batch.name
              });
            }
          });
        });

        ul.innerHTML = followupStudents.map(student => 
          `<li>${student.name} <button class="btn-primary call-btn" data-phone="${student.phone}" data-name="${student.name}">Call</button></li>`
        ).join('') || '<li class="muted">No follow-ups pending.</li>';

        // Add call functionality
        ul.addEventListener('click', (e) => {
          if (e.target.classList.contains('call-btn')) {
            const phone = e.target.getAttribute('data-phone');
            const name = e.target.getAttribute('data-name');
            if (phone) {
              const cleanPhone = phone.replace(/\D/g, '');
              window.location.href = `tel:${cleanPhone}`;
            }
          }
        });
      }
// Save monthly stats & reset cards at month-end
function rolloverMonth() {
  const stats = JSON.parse(localStorage.getItem("crm.stats") || "{}");
  const now = new Date();
  const ym = ymNow(); // e.g. "2025-09"
  const year = now.getFullYear().toString();

  // Ensure structure exists
  if (!stats.monthly) stats.monthly = {};
  if (!stats.yearly) stats.yearly = {};
  if (!stats.lifetimeRevenue) stats.lifetimeRevenue = 0;
  if (!stats.lifetimeStudents) stats.lifetimeStudents = 0;

  // Only run if this month not already saved
  if (!stats.monthly[ym]) {
    const revenue = Number($('#totalRevenue')?.textContent.replace(/[₹,]/g, "") || 0);
    const students = Number($('#totalStudents')?.textContent || 0);
    const followups = Number($('#totalFollowups')?.textContent || 0);

    // Save monthly snapshot
    stats.monthly[ym] = { revenue, students, followups };

    // Add into yearly
    if (!stats.yearly[year]) stats.yearly[year] = { revenue: 0, students: 0, followups: 0 };
    stats.yearly[year].revenue += revenue;
    stats.yearly[year].students += students;
    stats.yearly[year].followups += followups;

    // Add into lifetime
    stats.lifetimeRevenue += revenue;
    stats.lifetimeStudents += students;

    localStorage.setItem("crm.stats", JSON.stringify(stats));

    // Reset cards for the new month
    $('#totalRevenue').textContent = "₹0";
    $('#totalStudents').textContent = "0";
    $('#totalFollowups').textContent = "0";
    $('#followupProgress').textContent = "0% converted";
    $('#revenueProgress').textContent = "0% this month";
    $('#studentProgress').textContent = "+0 this month";
  }
}

      // Refresh functions
      window.refreshBatchAnalytics = function() {
        initBatchAnalytics();
        initStudentInsights();
      };

      // Finance timeframe change handler
      $('#financeTimeframe')?.addEventListener('change', (e) => {
        // You can extend this to show different time periods
        initFinancialOverview();
      });

// Initialize dashboard on load
document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
  rolloverMonth();
});


    })();

