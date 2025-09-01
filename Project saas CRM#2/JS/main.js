/* ============================================================
   Enhanced CRM main.js - All fixes and improvements
   ============================================================ */

(function () {
  "use strict";

  /* ------------------ Utilities ------------------ */
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const pad2 = (n) => (n<10 ? '0'+n : ''+n);
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  };
  const ymNow = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
  };
  const nextMonth = (ym /* 'YYYY-MM' */) => {
    if(!ym) return ymNow();
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m-1, 1);
    d.setMonth(d.getMonth()+1);
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
  };

  const store = {
    get(key, fallback=null) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
      catch(e){ return fallback; }
    },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
  };

  const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,9)}`;

  /* ------------------ Data access ------------------ */
  const BATCHES_KEY = 'crm.batches';
  const TODOS_KEY = 'crm.todos';
  const SKEY = (bid, tail) => `crm.batch.${bid}.${tail}`;

  function getBatches() { return store.get(BATCHES_KEY, []); }
  function setBatches(list) { store.set(BATCHES_KEY, list); }

  function getBatch(id) { return getBatches().find(b => b.id === id) || null; }
  function upsertBatch(batch) {
    const list = getBatches();
    const i = list.findIndex(x => x.id === batch.id);
    if(i === -1) list.push(batch); else list[i] = batch;
    setBatches(list);
  }

  function deleteBatch(id) {
    const list = getBatches().filter(b => b.id !== id);
    setBatches(list);
    // Also clean up student data
    localStorage.removeItem(SKEY(id, 'students'));
    localStorage.removeItem(SKEY(id, 'notes'));
  }

  function getStudents(batchId) { return store.get(SKEY(batchId, 'students'), []); }
  function setStudents(batchId, students) { store.set(SKEY(batchId, 'students'), students); }

  // Todo list functions
  function getTodos() { return store.get(TODOS_KEY, []); }
  function setTodos(todos) { store.set(TODOS_KEY, todos); }

  /* ------------------ Call functionality ------------------ */
  function makeCall(phone, studentName = '') {
    if (!phone) {
      alert('No phone number available');
      return;
    }
    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, '');
    // Try to open phone dialer
    window.location.href = `tel:${cleanPhone}`;
    
    // Log the call attempt
    console.log(`Call initiated to ${studentName}: ${phone}`);
    
    // Optional: You could add call logging here
    // logCallAttempt(studentName, phone);
  }

  /* ------------------ Page detection ------------------ */
  const onDashboard = !!document.querySelector('.followups-card') && !!document.querySelector('.cards');
  const onBatches   = !!document.getElementById('batchesGrid') || /batches\.html/i.test(location.pathname);
  const onBatchPage = /bt\.html/i.test(location.pathname);

  /* ------------------ Sidebar (mobile) ------------------ */
  (function sidebarInit(){
    const sideMenu = document.querySelector("aside");
    const menuBtn = document.querySelector("#menu-btn");
    const closeBtn = document.querySelector("#close-btn");
    if(!sideMenu || !menuBtn || !closeBtn) return;

    menuBtn.addEventListener('click', () => {
      sideMenu.style.display = 'block';
    });
    closeBtn.addEventListener('click', () => {
      sideMenu.style.display = 'none';
    });
  })();

  /* =====================================================
     Dashboard enhancements (Index.html)
     ===================================================== */
  if (onDashboard) {
    // Initialize dashboard with enhanced analytics
    initDashboard();
    
    // Fix call buttons in follow-ups
    fixDashboardCallButtons();
    
    // Add todo list
    addTodoListToDashboard();
  }

  function initDashboard() {
    const batches = getBatches();
    let totalStudents = 0;
    let followups = 0;
    let revenue = 0;
    let monthlyRevenue = 0;
    

    batches.forEach(b => {
      const students = getStudents(b.id);
      totalStudents += students.filter(s => !s.dropped).length;

      students.forEach(s => {
        let needs = false;
        if (b.feeModel === 'monthly') {
          const st = (s.lastPaidMonth ? nextMonth(s.lastPaidMonth) : (b.startDate ? b.startDate.slice(0,7) : ymNow()));
          if (st <= ymNow()) needs = true;
          // Calculate monthly revenue
          if (s.lastPaidMonth === ymNow()) {
            monthlyRevenue += Number(b.totalFee || 0);
          }
        } else if (b.feeModel === 'course') {
          if (!s.paid) needs = true;
        } else {
          const total = Number(b.totalFee||0);
          const paid = Number(s.paidTotal||0);
          if (paid < total) needs = true;
        }
        if (needs) followups++;
        if (b.feeModel === 'course' && s.paid) revenue += Number(b.totalFee||0);
        if (b.feeModel === 'installment') revenue += Number(s.paidTotal||0);
      });
    });

    // Update dashboard cards with better formatting
    const revEl = document.querySelector('.totalrevenuecarrd h1');
    const stuEl = document.querySelector('.totalstudentscarrd h1');
    const fupEl = document.querySelector('.followupscarrd h1');
    
    if (revEl) revEl.textContent = '₹' + revenue.toLocaleString();
    if (stuEl) stuEl.textContent = totalStudents.toString();
    if (fupEl) fupEl.textContent = followups.toString();

    // Update progress indicators
    const revProgress = document.querySelector('.totalrevenuecarrd h6');
    const stuProgress = document.querySelector('.totalstudentscarrd h6');
    const fupProgress = document.querySelector('.followupscarrd h6');
    
    if (revProgress) {
      const progressPercent = monthlyRevenue > 0 ? Math.round((monthlyRevenue / revenue) * 100) : 0;
      revProgress.textContent = `${progressPercent}% this month`;
    }
    if (stuProgress) stuProgress.textContent = `+${Math.floor(totalStudents * 0.1)} this month`;
    if (fupProgress) {
      const conversionRate = totalStudents > 0 ? Math.round(((totalStudents - followups) / totalStudents) * 100) : 0;
      fupProgress.textContent = `${conversionRate}% converted`;
    }

  // === Daily trends (Collected, Pending, Overdue) ===
const today = new Date();
const y = today.getFullYear();
const m = today.getMonth();
const daysInMonth = new Date(y, m + 1, 0).getDate();

const dailyCollected = Array(daysInMonth).fill(0);
const dailyPending   = Array(daysInMonth).fill(0);
const dailyOverdue   = Array(daysInMonth).fill(0);

batches.forEach(b => {
  const students = getStudents(b.id);

  students.forEach(s => {
    const fee = Number(b.totalFee || 0);

    if (b.feeModel === "monthly") {
      if (s.lastPaidMonth === ymNow()) {
        const payDay = 1; // replace with actual pay date if available
        dailyCollected[payDay - 1] += fee;
      } else {
        // unpaid → treat as pending/overdue
        for (let d = 1; d <= daysInMonth; d++) {
          const dd = new Date(y, m, d);
          if (dd < today) dailyOverdue[d - 1] += fee;
          else dailyPending[d - 1] += fee;
        }
      }
    }

    if (b.feeModel === "course") {
      if (s.paid) {
        const payDay = 1;
        dailyCollected[payDay - 1] += fee;
      } else {
        for (let d = 1; d <= daysInMonth; d++) {
          const dd = new Date(y, m, d);
          if (dd < today) dailyOverdue[d - 1] += fee;
          else dailyPending[d - 1] += fee;
        }
      }
    }

    if (b.feeModel === "installment") {
      const paid = Number(s.paidTotal || 0);
      if (paid > 0) {
        dailyCollected[0] += paid; // lump on day 1 (or replace with actual pay date)
      }
      if (paid < fee) {
        for (let d = 1; d <= daysInMonth; d++) {
          const dd = new Date(y, m, d);
          if (dd < today) dailyOverdue[d - 1] += (fee - paid);
          else dailyPending[d - 1] += (fee - paid);
        }
      }
    }
  });
});

// Expose globally for Chart.js
window.dailyCollected = dailyCollected;
window.dailyPending   = dailyPending;
window.dailyOverdue   = dailyOverdue;
window.daysInMonth    = daysInMonth;

  }

  function fixDashboardCallButtons() {
    const ul = document.getElementById('followupList');
    if (!ul) return;

    const batches = getBatches();
    const followupStudents = [];
    
    batches.forEach(b => {
      getStudents(b.id).forEach(s => {
        if (followupStudents.length >= 5) return;
        
        let needs = false;
        if (b.feeModel === 'monthly') {
          const st = (s.lastPaidMonth ? nextMonth(s.lastPaidMonth) : (b.startDate ? b.startDate.slice(0,7) : ymNow()));
          if (st <= ymNow()) needs = true;
        } else if (b.feeModel === 'course') {
          if (!s.paid) needs = true;
        } else {
          const total = Number(b.totalFee||0);
          const paid = Number(s.paidTotal||0);
          if (paid < total) needs = true;
        }
        if (needs) followupStudents.push({name: s.name, phone: s.phone, batchName: b.name});
      });
    });

    ul.innerHTML = followupStudents.map(s => 
      `<li>${s.name} 
         <button class="btn-primary call-btn" data-phone="${s.phone}" data-name="${s.name}">Call</button>
       </li>`
    ).join('') || '<li class="muted">No follow-ups pending.</li>';

    // Add call button functionality
    ul.addEventListener('click', (e) => {
      if (e.target.classList.contains('call-btn')) {
        const phone = e.target.getAttribute('data-phone');
        const name = e.target.getAttribute('data-name');
        makeCall(phone, name);
      }
    });

    // Fix "More" button
    const moreBtn = document.querySelector('.more-btn');
    if (moreBtn) {
      moreBtn.addEventListener('click', () => {
        window.location.href = 'batches.html';
      });
    }
  }

  function addTodoListToDashboard() {
    const main = document.querySelector('.main-content');
    if (!main) return;

    // Add todo section after follow-ups
    const followupsCard = document.querySelector('.followups-card');
    if (!followupsCard) return;

    const todoHTML = `
      <div class="todo-card followups-card" style="margin-top: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3>Syllabus Progress</h3>
          <button class="btn-secondary" id="addTodoBtn" style="padding: 4px 8px; font-size: 12px;">Add Topic</button>
        </div>
        <div class="f-list">
          <ul id="todoList">
            <!-- Todos will be populated here -->
          </ul>
        </div>
      </div>
    `;

    followupsCard.insertAdjacentHTML('afterend', todoHTML);

    // Initialize todo functionality
    initTodoList();
  }

  function initTodoList() {
    const todoList = document.getElementById('todoList');
    const addTodoBtn = document.getElementById('addTodoBtn');
    
    if (!todoList || !addTodoBtn) return;

    function renderTodos() {
      const todos = getTodos();
      todoList.innerHTML = todos.length ? todos.map(todo => `
        <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee;">
          <span style="flex: 1; ${todo.completed ? 'text-decoration: line-through; color: #999;' : ''}">${todo.text}</span>
          <div style="display: flex; gap: 8px;">
            <button class="btn-secondary toggle-todo" data-id="${todo.id}" style="padding: 2px 6px; font-size: 11px;">
              ${todo.completed ? 'Undo' : 'Done'}
            </button>
            <button class="btn-secondary delete-todo" data-id="${todo.id}" style="padding: 2px 6px; font-size: 11px; color: #dc3545;">
              Delete
            </button>
          </div>
        </li>
      `).join('') : '<li class="muted">No syllabus topics added yet.</li>';
    }

    addTodoBtn.addEventListener('click', () => {
      const text = prompt('Enter syllabus topic:');
      if (!text || !text.trim()) return;
      
      const todos = getTodos();
      todos.push({
        id: uid('todo'),
        text: text.trim(),
        completed: false,
        createdAt: new Date().toISOString()
      });
      setTodos(todos);
      renderTodos();
    });

    todoList.addEventListener('click', (e) => {
      const todos = getTodos();
      
      if (e.target.classList.contains('toggle-todo')) {
        const id = e.target.getAttribute('data-id');
        const todo = todos.find(t => t.id === id);
        if (todo) {
          todo.completed = !todo.completed;
          setTodos(todos);
          renderTodos();
        }
      }
      
      if (e.target.classList.contains('delete-todo')) {
        const id = e.target.getAttribute('data-id');
        const filteredTodos = todos.filter(t => t.id !== id);
        setTodos(filteredTodos);
        renderTodos();
      }
    });

    renderTodos();
  }

  /* =====================================================
     Batches page with delete functionality
     ===================================================== */
  if (onBatches) {
    const grid = document.getElementById('batchesGrid') || document.getElementById('batchList');

    function renderBatches() {
      const batches = getBatches();
      if(!grid) return;
      grid.innerHTML = batches.map(b => `
        <div class="card">
          <h2>${b.name}</h2>
          <h6>${b.course || ''}${b.time ? ' • ' + b.time : ''}${b.startDate ? ' • ' + b.startDate : ''}${b.endDate ? ' – ' + b.endDate : ''}</h6>
          <div class="cards-btn">
            <a class="btn-primary" href="bt.html?id=${encodeURIComponent(b.id)}">View Batch</a>
            ${b.whatsappUrl ? `<a class="btn-secondary" href="${b.whatsappUrl}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
            <button class="btn-secondary delete-batch-btn" data-id="${b.id}" style="background: #dc3545; color: white; border-color: #dc3545;">Delete</button>
          </div>
          <div class="muted" style="margin-top:6px;">Fee: ${b.feeModel === 'monthly' ? 'Monthly' : b.feeModel === 'course' ? 'Per course' : 'Installments'} ${b.totalFee ? '• ₹' + b.totalFee.toLocaleString() : ''}</div>
        </div>
      `).join('') || '<p class="muted">No batches yet. Click "Add Batch".</p>';
    }

    // Add delete functionality
    grid?.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-batch-btn')) {
        const id = e.target.getAttribute('data-id');
        const batch = getBatch(id);
        const students = getStudents(id);
        
        const confirmMsg = students.length > 0 
          ? `Delete "${batch?.name}"?\n\nThis will also delete ${students.length} student(s) in this batch.\n\nThis action cannot be undone.`
          : `Delete "${batch?.name}"?\n\nThis action cannot be undone.`;
        
        if (confirm(confirmMsg)) {
          deleteBatch(id);
          renderBatches();
        }
      }
    });

    renderBatches();

    // Keep existing modal functionality
    const addBtn   = document.getElementById('openbatchmodal') || document.getElementById('openBatchModal');
    const modal    = document.getElementById('addbatchmodal')  || document.getElementById('addBatchModal');
    const closeBtn = document.getElementById('closebatchmodal') || document.getElementById('closeBatchModal');
    const cancel   = document.getElementById('cancelAddBatch');
    const form     = document.getElementById('addBatchForm');

    function openModal(){ modal?.classList.add('show'); }
    function closeModal(){ modal?.classList.remove('show'); }

    addBtn && addBtn.addEventListener('click', openModal);
    closeBtn && closeBtn.addEventListener('click', closeModal);
    cancel && cancel.addEventListener('click', closeModal);

    form && form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const batch = {
        id: uid('b'),
        name: (fd.get('batchName') || fd.get('name') || '').toString().trim(),
        course: (fd.get('course') || '').toString().trim(),
        time: (fd.get('time') || '').toString().trim(),
        startDate: (fd.get('startDate') || '').toString(),
        endDate: (fd.get('endDate') || '').toString(),
        whatsappUrl: (fd.get('whatsappUrl') || fd.get('whatsapp') || '').toString().trim(),
        feeModel: (fd.get('feeModel') || 'monthly').toString(),
        totalFee: Number(fd.get('totalFee') || 0),
        installmentPlan: (fd.get('installmentPlan') || '')
                          .toString()
                          .split(',')
                          .map(x => Number(x.trim()))
                          .filter(x => !isNaN(x) && x>0)
      };
      if (batch.feeModel === 'installment' && !batch.totalFee && batch.installmentPlan.length) {
        batch.totalFee = batch.installmentPlan.reduce((a,b) => a+b, 0);
      }
      upsertBatch(batch);
      renderBatches();
      form.reset();
      closeModal();
    });
  }

  /* =====================================================
     Batch template page with call fixes and mobile optimization
     ===================================================== */
  if (onBatchPage) {
    const params = new URLSearchParams(location.search);
    const batchId = params.get('id');
    const batch = batchId ? getBatch(batchId) : null;
    if(!batch) {
      const root = document.querySelector('main') || document.body;
      root.innerHTML = '<div class="card"><h2>Batch not found</h2><p class="muted">Go back to Batches and open again.</p></div>';
      return;
    }

    const headerTitle = document.querySelector('.header-title') || document.querySelector('.header-title-div .header-title');
    if(headerTitle) headerTitle.textContent = batch.name;

    const studentsTableBody = $('#studentsTable tbody');
    const studentsCount = $('#studentsCount');
    const filters = $$('.filters .chip');
    const search = $('#studentSearch');
    const addStudentForm = $('#addStudentForm');
    const exportBtn = document.getElementById('exportCsvBtn');

    let students = getStudents(batch.id);

    function computeStatus(student) {
      if (student.dropped) return {label: 'Dropped', type: 'dropped'};

      if (batch.feeModel === 'monthly') {
        const currentYM = ymNow();
        const lastPaid = student.lastPaidMonth || '';
        const dueYM = lastPaid ? nextMonth(lastPaid) : (batch.startDate ? batch.startDate.slice(0,7) : currentYM);
        const overdue = dueYM < currentYM;
        return {label: overdue ? 'Overdue' : (dueYM === currentYM ? 'Due' : 'Ok'), type: overdue ? 'overdue' : (dueYM === currentYM ? 'due' : 'ok'), nextDue: dueYM + '-01'};
      }

      if (batch.feeModel === 'course') {
        if (student.paid) return {label:'Paid', type:'ok'};
        const dd = student.dueDate || '';
        const overdue = dd && dd < todayStr();
        return {label: overdue ? 'Overdue' : 'Due', type: overdue ? 'overdue' : 'due', nextDue: dd || ''};
      }

      const total = Number(batch.totalFee || 0);
      const paid = Number(student.paidTotal || 0);
      if (paid >= total && total > 0) return {label:'Paid', type:'ok'};
      const dd = student.dueDate || '';
      const overdue = dd && dd < todayStr();
      return {label: overdue ? 'Overdue' : 'Due', type: overdue ? 'overdue' : 'due', nextDue: dd || ''};
    }

    function tagHTML(type){
      if (type === 'ok') return '<span class="tag ok">OK</span>';
      if (type === 'due') return '<span class="tag due">Due</span>';
      if (type === 'overdue') return '<span class="tag overdue">Overdue</span>';
      if (type === 'dropped') return '<span class="tag dropped">Dropped</span>';
      return '<span class="tag">—</span>';
    }

    function rowHTML(s) {
      const st = computeStatus(s);
      const feeInfo = (batch.feeModel === 'installment')
          ? `<div class="muted">Paid: ₹${Number(s.paidTotal||0).toLocaleString()} / ₹${Number(batch.totalFee||0).toLocaleString()}</div>`
          : '';
      const nextDue = st.nextDue || '—';

      // Enhanced actions with working call button
      let actions = `
        <button class="btn btn-secondary call-student-btn" data-phone="${s.phone}" data-name="${s.name}" data-id="${s.id}">
          <span class="material-symbols-outlined" style="font-size: 16px;">phone</span>
        </button>
        <button class="btn btn-secondary" data-act="remind" data-id="${s.id}">
          <span class="material-symbols-outlined" style="font-size: 16px;">message</span>
        </button>`;

      if (batch.feeModel === 'monthly') {
        actions += `<button class="btn btn-primary" data-act="markPaidMonth" data-id="${s.id}">Mark Paid</button>`;
      } else if (batch.feeModel === 'course') {
        actions += s.paid ? '' : `<button class="btn btn-primary" data-act="markPaidCourse" data-id="${s.id}">Mark Paid</button>`;
      } else {
        actions += `<button class="btn btn-primary" data-act="addPayment" data-id="${s.id}">Add Payment</button>`;
      }
      actions += `<button class="btn btn-secondary" data-act="toggleDrop" data-id="${s.id}" style="background: ${s.dropped ? '#28a745' : '#dc3545'}; color: white;">${s.dropped ? 'Rejoin' : 'Drop'}</button>`;

      const amountCol = (batch.feeModel === 'monthly')
        ? (s.lastPaidMonth ? 'Paid ' + s.lastPaidMonth : '—')
        : (batch.feeModel === 'course')
          ? (s.paid ? 'Paid' : ('₹' + Number(batch.totalFee||0).toLocaleString()))
          : ('₹' + Number(batch.totalFee||0).toLocaleString());

      return `<tr data-id="${s.id}" class="student-row">
        <td class="student-info">
          <div class="student-name">${s.name}</div>
          ${feeInfo}
          <div class="mobile-phone"><a href="tel:${s.phone}">📞 ${s.phone}</a></div>
        </td>
        <td class="col-phone"><a href="tel:${s.phone}">${s.phone}</a></td>
        <td class="fee-col">
          ${tagHTML(st.type)}
          <div class="fee-amount">${amountCol}</div>
        </td>
        <td class="due-col">${nextDue}</td>
        <td class="actions-col">
          <div class="actions-inline">${actions}</div>
        </td>
      </tr>`;
    }

    function render() {
      if (studentsTableBody) studentsTableBody.innerHTML = students.map(rowHTML).join('');
      if (studentsCount) studentsCount.textContent = `${students.filter(x => !x.dropped).length} students`;
      updateBatchCards(); 
      renderFollowups();
    }

    function persist(){ setStudents(batch.id, students); }

    const addStudentModal = document.getElementById('addStudentModal');
    const openAddStudentModal = document.getElementById('openAddStudentModal');
    const closeAddStudentModal = document.getElementById('closeAddStudentModal');

    if(openAddStudentModal && addStudentModal){
      openAddStudentModal.addEventListener('click', () => addStudentModal.classList.add('show'));
      closeAddStudentModal.addEventListener('click', () => addStudentModal.classList.remove('show'));
    }

    function updateBatchCards() {
      const totalStudents = students.filter(s => !s.dropped).length;
      let pending = 0;
      let followups = 0;
      let dropouts = students.filter(s => s.dropped).length;

      if(batch.feeModel === "monthly"){
        students.forEach(s => {
          if(s.lastPaidMonth === ymNow()) {
            // paid this month
          } else {
            pending++;
            followups++;
          }
        });
      } else if(batch.feeModel === "course"){
        students.forEach(s => {
          if(!s.paid) {
            pending++;
            followups++;
          }
        });
      } else {
        students.forEach(s => {
          if((s.paidTotal||0) < (batch.totalFee||0)) {
            pending++;
            followups++;
          }
        });
      }

      const totalEl    = document.getElementById("ovrTotalStudents");
      const pendingEl  = document.getElementById("ovrPendingCount");
      const followEl   = document.getElementById("ovrFollowupsToday");
      const dropoutsEl = document.getElementById("ovrDropouts");

      if(totalEl) totalEl.textContent = totalStudents;
      if(pendingEl) pendingEl.textContent = pending;
      if(followEl) followEl.textContent = followups;
      if(dropoutsEl) dropoutsEl.textContent = dropouts;
    }

    // Filters
    filters.forEach(chip => chip.addEventListener('click', () => {
      filters.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const f = chip.getAttribute('data-filter') || 'all';
      const filtered = students.filter(s => {
        const st = computeStatus(s);
        if (f === 'pending') return st.type !== 'ok' && st.type !== 'dropped';
        if (f === 'overdue') return st.type === 'overdue';
        if (f === 'dueSoon') return st.type === 'due';
        if (f === 'dropped') return s.dropped;
        return true;
      });
      if (studentsTableBody) studentsTableBody.innerHTML = filtered.map(rowHTML).join('');
    }));

    // Search
    if (search) search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      const filtered = students.filter(s => s.name.toLowerCase().includes(q) || (s.phone||'').includes(q));
      if (studentsTableBody) studentsTableBody.innerHTML = filtered.map(rowHTML).join('');
    });

    // Add student
    if (addStudentForm) addStudentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(addStudentForm);
      const s = {
        id: uid('s'),
        name: (fd.get('name') || '').toString().trim(),
        phone: (fd.get('phone') || '').toString().trim(),
        dropped: false,
        notes: (fd.get('notes') || '').toString().trim()
      };
      if (!s.name || !s.phone) { alert('Please fill name and phone'); return; }

      if (batch.feeModel === 'monthly') {
        s.lastPaidMonth = '';
      } else if (batch.feeModel === 'course') {
        s.paid = false;
        s.dueDate = (fd.get('dueDate') || '').toString();
      } else {
        s.paidTotal = 0;
        s.dueDate = (fd.get('dueDate') || '').toString();
      }

      students.unshift(s);
      persist(); render();
      addStudentForm.reset();
      addStudentModal?.classList.remove('show');
    });

    // Enhanced table actions with call functionality
    document.getElementById('studentsTable')?.addEventListener('click', (e) => {
      // Handle call buttons
      if (e.target.closest('.call-student-btn')) {
        const btn = e.target.closest('.call-student-btn');
        const phone = btn.getAttribute('data-phone');
        const name = btn.getAttribute('data-name');
        makeCall(phone, name);
        return;
      }

      const btn = e.target.closest('button[data-act]');
      if(!btn) return;
      const id = btn.getAttribute('data-id');
      const act = btn.getAttribute('data-act');
      const s = students.find(x => x.id === id);
      if(!s) return;

      if (act === 'remind') {
        const msg = encodeURIComponent(`Hello ${s.name}, this is a friendly reminder about your fees for ${batch.name}.`);
        window.open(`https://wa.me/91${s.phone}?text=${msg}`, '_blank');
      }
      if (act === 'markPaidMonth') {
        s.lastPaidMonth = ymNow();
        persist(); render();
      }
      if (act === 'markPaidCourse') {
        s.paid = true;
        persist(); render();
      }
      if (act === 'addPayment') {
        const left = Math.max(0, Number(batch.totalFee||0) - Number(s.paidTotal||0));
        const val = prompt(`Enter amount received (pending ₹${left.toLocaleString()}):`, left>0 ? Math.min(left, Number(batch.totalFee||0)).toString() : '');
        const amt = Number(val||0);
        if (!isNaN(amt) && amt>0) {
          s.paidTotal = Number(s.paidTotal||0) + amt;
          persist(); render();
        }
      }
      if (act === 'toggleDrop') {
        s.dropped = !s.dropped;
        persist(); render();
      }
    });

    function renderFollowups() {
      const list = document.getElementById("followupsList");
      const countEl = document.getElementById("followupsCount");
      if (!list) return;

      const pending = students.filter(s => {
        if (s.dropped) return false;
        if (batch.feeModel === 'monthly') {
          const st = (s.lastPaidMonth ? nextMonth(s.lastPaidMonth) : (batch.startDate ? batch.startDate.slice(0,7) : ymNow()));
          return st <= ymNow();
        } else if (batch.feeModel === 'course') {
          return !s.paid;
        } else {
          return (s.paidTotal || 0) < (batch.totalFee || 0);
        }
      });

      if(countEl) countEl.textContent = pending.length;

      list.innerHTML = pending.length
        ? pending.map(s => `
          <li class="item">
            ${s.name} 
            <span class="due">Due</span> 
            <button class="btn-primary call-followup-btn" data-phone="${s.phone}" data-name="${s.name}">Call</button>
          </li>
        `).join("")
        : '<li class="muted">No follow-ups pending.</li>';

      // Add call functionality to follow-up buttons
      list.addEventListener('click', (e) => {
        if (e.target.classList.contains('call-followup-btn')) {
          const phone = e.target.getAttribute('data-phone');
          const name = e.target.getAttribute('data-name');
          makeCall(phone, name);
        }
      });
    }

    // Export CSV
    if (exportBtn) exportBtn.addEventListener('click', () => {
      const rows = [
        ['Name','Phone','Status','Amount/Info','Next Due']
      ];
      students.forEach(s => {
        const st = computeStatus(s);
        const info = (batch.feeModel === 'installment')
          ? `Paid ${Number(s.paidTotal||0)}/${Number(batch.totalFee||0)}`
          : (batch.feeModel === 'course' ? (s.paid ? 'Paid' : 'Unpaid') : (s.lastPaidMonth ? 'Paid '+s.lastPaidMonth : '—'));
        rows.push([s.name, s.phone, st.label, info, st.nextDue || '']);
      });
      const csv = rows.map(r => r.map(t => `"${String(t).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${batch.name.replace(/\s+/g,'_')}_students.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    });

    render();
  }

})(); // end IIFEy