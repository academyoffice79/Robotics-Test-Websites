// logsHome.js — fully functional calendar with month/year navigation, event hooks and modal.
// Expected server endpoints (examples):
// GET  /api/logs?start=YYYY-MM-DD&end=YYYY-MM-DD   -> returns [{ date, title, subteam, body }]
// GET  /api/me                                      -> returns { username } if logged in (200) or 401 if not
// POST /api/login                                   -> { username, password } (server sets HttpOnly cookie)
// POST /api/logout

// -------------------- State & DOM --------------------
const calendarGrid = document.getElementById('calendarGrid');
const monthYearEl = document.getElementById('monthYear');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const prevYearBtn = document.getElementById('prevYear');
const nextYearBtn = document.getElementById('nextYear');
const weekdayRow = document.getElementById('weekdayRow');
const calendarSource = document.getElementById('calendarSource');

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Modal elements
const modal = document.getElementById('logModal');
const closeModalBtn = document.getElementById('closeModal');
const modalDateEl = document.getElementById('modalDate');
const subteamSelect = document.getElementById('subteamSelect');
const logText = document.getElementById('logText');
const addLogBtn = document.getElementById('addLogBtn');

const SUBTEAMS = ['Mechanical', 'Programming', 'Electrical', 'Outreach', 'Business'];

// viewDate: the first day of currently visible month
let viewDate = new Date();
viewDate.setDate(1);

// cached events for visible range: map date -> [events]
let currentEvents = {};

// -------------------- Utilities --------------------
function toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

// -------------------- Render helpers --------------------
function renderWeekdays() {
    weekdayRow.innerHTML = '';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(d => {
        const el = document.createElement('div');
        el.textContent = d;
        weekdayRow.appendChild(el);
    });
}

function renderCalendar() {
    calendarGrid.innerHTML = '';

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    monthYearEl.textContent = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    // 42 cell calendar (6 weeks) for stable layout
    const firstDayOfGrid = new Date(year, month, 1);
    const shift = firstDayOfGrid.getDay(); // day of week index (0..6)
    firstDayOfGrid.setDate(firstDayOfGrid.getDate() - shift);

    // compute visible range for fetching events
    const startISO = toISO(firstDayOfGrid);
    const endDate = new Date(firstDayOfGrid);
    endDate.setDate(endDate.getDate() + 42 - 1);
    const endISO = toISO(endDate);

    // fetch events for range, then build cells
    fetchEventsForRange(startISO, endISO, calendarSource.value)
        .then(events => {
            // normalize to map
            currentEvents = {};
            events.forEach(ev => {
                if (!ev.date) return;
                if (!currentEvents[ev.date]) currentEvents[ev.date] = [];
                currentEvents[ev.date].push(ev);
            });

            // build 42 cells
            const it = new Date(firstDayOfGrid);
            for (let i = 0; i < 42; i++) {
                const cell = document.createElement('div');
                cell.className = 'calendar-cell';

                const dayNum = document.createElement('div');
                dayNum.className = 'day-num';
                dayNum.textContent = it.getDate();
                cell.appendChild(dayNum);

                const dateISO = toISO(it);
                // mark event
                if (currentEvents[dateISO] && currentEvents[dateISO].length > 0) {
                    const dot = document.createElement('span');
                    dot.className = 'event-dot';
                    cell.appendChild(dot);
                }

                // mark inactive (other month)
                if (it.getMonth() !== month) cell.classList.add('inactive');

                // click opens modal
                cell.addEventListener('click', () => openModalForDate(dateISO));

                calendarGrid.appendChild(cell);
                it.setDate(it.getDate() + 1);
            }
        })
        .catch(err => {
            console.error('fetchEventsForRange failed', err);
            // still render empty grid to avoid blank page, using same iteration
            const it = new Date(firstDayOfGrid);
            for (let i = 0; i < 42; i++) {
                const cell = document.createElement('div');
                cell.className = 'calendar-cell';
                const dayNum = document.createElement('div');
                dayNum.className = 'day-num';
                dayNum.textContent = it.getDate();
                if (it.getMonth() !== month) cell.classList.add('inactive');
                cell.appendChild(dayNum);
                cell.addEventListener('click', () => openModalForDate(toISO(it)));
                calendarGrid.appendChild(cell);
                it.setDate(it.getDate() + 1);
            }
        });
}

// -------------------- Navigation handlers --------------------
prevMonthBtn.addEventListener('click', () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    renderCalendar();
});
nextMonthBtn.addEventListener('click', () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    renderCalendar();
});
prevYearBtn.addEventListener('click', () => {
    viewDate.setFullYear(viewDate.getFullYear() - 1);
    renderCalendar();
});
nextYearBtn.addEventListener('click', () => {
    viewDate.setFullYear(viewDate.getFullYear() + 1);
    renderCalendar();
});
calendarSource.addEventListener('change', () => renderCalendar());

// -------------------- Modal logic --------------------
function openModalForDate(dateISO) {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    modalDateEl.textContent = dateISO;

    // fill subteams
    subteamSelect.innerHTML = '';
    SUBTEAMS.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        subteamSelect.appendChild(opt);
    });

    subteamSelect.addEventListener('change', () => updateModalText(dateISO));
    updateModalText(dateISO);
}

function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    logText.textContent = '';
    // remove change listeners by cloning
    const newSel = subteamSelect.cloneNode(true);
    subteamSelect.parentNode.replaceChild(newSel, subteamSelect);
}

closeModalBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

// show events for chosen subteam
function updateModalText(dateISO) {
    const team = document.getElementById('subteamSelect').value;
    const list = currentEvents[dateISO] || [];
    const filtered = list.filter(ev => (ev.subteam || '').toLowerCase() === team.toLowerCase());
    if (filtered.length > 0) {
        logText.textContent = filtered.map(f => `• ${f.title}\n${f.body || ''}`).join('\n\n');
    } else {
        logText.textContent = 'No logs for this subteam on this date.';
    }
}

// open add/edit - requires auth (redirect to new page or show inline editor)
addLogBtn.addEventListener('click', async () => {
    // check auth; /api/me returns 200 if logged in
    try {
        const r = await fetch('/api/me', { credentials: 'include' });
        if (r.status === 200) {
            // open a dedicated page to create/edit (you can implement /createLog.html)
            window.location.href = `/createLog.html?date=${encodeURIComponent(modalDateEl.textContent)}`;
        } else {
            // not logged in -> redirect to login
            window.location.href = `login.html?next=${encodeURIComponent(location.pathname)}`;
        }
    } catch (err) {
        console.error(err);
        window.location.href = `login.html?next=${encodeURIComponent(location.pathname)}`;
    }
});

// -------------------- Fetch events hook --------------------
/*
  fetchEventsForRange(startISO, endISO, source)

  - Must return a Promise resolving to an array of events:
    [{ date: 'YYYY-MM-DD', title: '...', subteam: 'Programming', body: '...' }, ...]
  - In production, implement a backend endpoint /api/logs which queries the DB for the range.
  - For Google Calendar, implement a server proxy that returns events normalized to this format.
*/
async function fetchEventsForRange(startISO, endISO, source = 'local') {
    if (source === 'local') {
        // call backend
        const res = await fetch(`/api/logs?start=${startISO}&end=${endISO}`, { credentials: 'include' });
        if (!res.ok) {
            // return empty array on error
            return [];
        }
        return await res.json();
    }

    if (source === 'google') {
        // server proxy for Google Calendar:
        const res = await fetch(`/api/calendar/google-events?start=${startISO}&end=${endISO}`, { credentials: 'include' });
        if (!res.ok) return [];
        const payload = await res.json();
        // normalize if needed (assume server returns normalized list)
        return payload;
    }

    return [];
}

// -------------------- Auth UI --------------------
async function refreshAuthState() {
    try {
        const r = await fetch('/api/me', { credentials: 'include' });
        if (r.status === 200) {
            loginBtn.classList.add('hidden');
            logoutBtn.classList.remove('hidden');
        } else {
            loginBtn.classList.remove('hidden');
            logoutBtn.classList.add('hidden');
        }
    } catch (err) {
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
    }
}
loginBtn.addEventListener('click', () => { window.location.href = 'login.html?next=' + encodeURIComponent(location.pathname); });
logoutBtn.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    refreshAuthState();
});

// -------------------- Init --------------------
renderWeekdays();
refreshAuthState();
renderCalendar();
