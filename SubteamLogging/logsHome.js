/**
 * script.js
 * - Builds a navigable calendar (month/year)
 * - Hooks into a pluggable "fetchEventsForRange" function that can retrieve events from:
 *    - your backend (recommended) OR
 *    - Google Calendar API (public calendar via API key or OAuth for private)
 *
 * This file intentionally does not implement server auth or database writes;
 * the "add/edit" button is a hook that should POST to your authenticated backend.
 */

/* -----------------------
   Utility & state
   ----------------------- */
const calendarEl = document.getElementById('calendar');
const monthYearEl = document.getElementById('monthYear');
const prevBtn = document.getElementById('prevMonth');
const nextBtn = document.getElementById('nextMonth');
const calendarSourceSel = document.getElementById('calendarSource');

let viewDate = new Date(); // current view (first day of month will be used)
viewDate.setDate(1);

let currentEvents = {}; // map dateStr -> [events]

/* -----------------------
   Navigation
   ----------------------- */
prevBtn.addEventListener('click', () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    renderCalendar();
});
nextBtn.addEventListener('click', () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    renderCalendar();
});
calendarSourceSel.addEventListener('change', () => {
    renderCalendar();
});

/* -----------------------
   Render calendar grid
   ----------------------- */
function renderCalendar() {
    calendarEl.innerHTML = '';
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    monthYearEl.textContent = viewDate.toLocaleString(undefined, { month: 'long', year: 'numeric' });

    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // previous month's trailing days (optional)
    const prevMonthDays = firstDayOfWeek;
    const prevMonthLastDate = new Date(year, month, 0).getDate();

    // Build 6 rows x 7 columns = 42 cells (stable layout)
    const totalCells = 42;
    const startDate = new Date(year, month, 1 - prevMonthDays);

    // Fetch events for the visible range before rendering (so we can mark days)
    const startISO = toISODate(startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + totalCells - 1);
    const endISO = toISODate(endDate);

    // choose source: local or google (hook)
    const source = calendarSourceSel.value;

    // fetch events then draw
    fetchEventsForRange(startISO, endISO, source)
        .then(events => {
            // normalize to map dateStr -> [events]
            currentEvents = {};
            events.forEach(ev => {
                const d = ev.date; // we expect { date: 'YYYY-MM-DD', title: '...' }
                if (!currentEvents[d]) currentEvents[d] = [];
                currentEvents[d].push(ev);
            });

            // render the 42 calendar cells
            let iter = new Date(startDate);
            for (let i = 0; i < totalCells; i++) {
                const cell = document.createElement('div');
                cell.className = 'calendar-cell';
                const dateStr = toISODate(iter);
                const inMonth = (iter.getMonth() === month);

                if (!inMonth) cell.classList.add('inactive');

                const dayNum = document.createElement('div');
                dayNum.className = 'day-num';
                dayNum.textContent = iter.getDate();
                cell.appendChild(dayNum);

                // show a small dot if there are events/logs
                if (currentEvents[dateStr] && currentEvents[dateStr].length > 0) {
                    const dot = document.createElement('span');
                    dot.className = 'event-dot';
                    cell.appendChild(dot);
                }

                // click => open modal with logs for that date
                cell.addEventListener('click', () => openModal(dateStr));

                calendarEl.appendChild(cell);
                iter.setDate(iter.getDate() + 1);
            }
        })
        .catch(err => {
            console.error('Failed to load events:', err);
            // still render empty grid to avoid blank page
            let iter = new Date(startDate);
            for (let i = 0; i < totalCells; i++) {
                const cell = document.createElement('div');
                cell.className = 'calendar-cell';
                if (iter.getMonth() !== month) cell.classList.add('inactive');
                const dayNum = document.createElement('div');
                dayNum.className = 'day-num';
                dayNum.textContent = iter.getDate();
                cell.appendChild(dayNum);
                cell.addEventListener('click', () => openModal(toISODate(iter)));
                calendarEl.appendChild(cell);
                iter.setDate(iter.getDate() + 1);
            }
        });
}

/* -----------------------
   Modal & logs UI
   ----------------------- */
const modal = document.getElementById('logModal');
const closeModalBtn = document.getElementById('closeModal');
const modalDateEl = document.getElementById('modalDate');
const subteamSelect = document.getElementById('subteamSelect');
const logTextEl = document.getElementById('logText');
const addLogBtn = document.getElementById('addLogBtn');

const SUBTEAMS = ['Mechanical', 'Programming', 'Electrical', 'Outreach', 'Business'];

closeModalBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

function openModal(dateStr) {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    modalDateEl.textContent = dateStr;

    // fill subteam dropdown
    subteamSelect.innerHTML = '';
    SUBTEAMS.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        subteamSelect.appendChild(opt);
    });

    subteamSelect.addEventListener('change', () => updateLogText(dateStr));
    updateLogText(dateStr);
}

function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    logTextEl.textContent = '';
    // remove change listeners to avoid duplication
    const newSel = subteamSelect.cloneNode(true);
    subteamSelect.parentNode.replaceChild(newSel, subteamSelect);
}

function updateLogText(dateStr) {
    const team = document.getElementById('subteamSelect').value;
    // If events were fetched, local logs could be embedded as event descriptions or separate field.
    // CurrentEvents format: currentEvents['YYYY-MM-DD'] -> [ {title, subteam, body, ...} ]
    const dayEvents = currentEvents[dateStr] || [];

    // prefer subteam-specific logs
    const filtered = dayEvents.filter(ev => (ev.subteam || '').toLowerCase() === team.toLowerCase());
    if (filtered.length > 0) {
        logTextEl.textContent = filtered.map(f => `• ${f.title}\n${f.body || ''}`).join('\n\n');
    } else {
        logTextEl.textContent = 'No logs for this subteam on this date.';
    }
}

// 'Add / Edit Log' button: send user to a create/edit UI (requires authentication on backend)
addLogBtn.addEventListener('click', () => {
    // This should POST to your backend /api/logs with session credentials.
    // Redirect to a create-log page, or open a form modal — just a placeholder:
    alert('To add or edit logs you must be logged in. Implement server-side auth first (see docs).');
});

/* -----------------------
   Date helpers
   ----------------------- */
function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/* -----------------------
   Event-fetching hook
   - Replace body of fetchEventsForRange with real API calls
   - Should return Promise<[ {date:'YYYY-MM-DD', title:'', subteam:'', body:''}, ... ]>
   ----------------------- */
async function fetchEventsForRange(startISO, endISO, source = 'local') {
    // For local development: return example in-memory events
    if (source === 'local') {
        // sample mocked logs (production: your backend endpoint e.g. /api/logs?start=...&end=...)
        const mocked = [
            { date: '2025-01-10', title: 'Built intake prototype', subteam: 'Mechanical', body: 'Mounted rollers and tested.' },
            { date: '2025-01-10', title: 'PID tuning', subteam: 'Programming', body: 'Tuned angular PID for smoother turns.' },
            { date: '2025-01-12', title: 'Battery tests', subteam: 'Electrical', body: 'Cycle tested 3 batteries.' }
        ];
        // filter by range
        return mocked.filter(e => e.date >= startISO && e.date <= endISO);
    }

    if (source === 'google') {
        // Example: fetch from Google Calendar events list endpoint
        // Implementation notes:
        // - If the calendar is PUBLIC you can use a simple API key and call:
        //   GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events?timeMin={startISO}T00:00:00Z&timeMax={endISO}T23:59:59Z&key=YOUR_API_KEY
        // - For private calendars you must perform OAuth2 server-side or via client libraries (see docs).
        // This function here expects your backend to provide a secure proxy endpoint (recommended).
        //
        // Example fetch to backend proxy:
        try {
            const res = await fetch(`/api/calendar/google-events?start=${startISO}&end=${endISO}`);
            if (!res.ok) throw new Error('Network error');
            const payload = await res.json();
            // normalize to our event shape; payload should be array of calendar events
            return (payload.items || payload).map(it => {
                // pick a date (all-day or start.dateTime)
                const date = (it.start && (it.start.date || it.start.dateTime)) || '';
                return {
                    date: date.split('T')[0],
                    title: it.summary || '(no title)',
                    body: it.description || '',
                    // custom: map to subteam if you encode subteam in description or a specific extendedProperty
                    subteam: ''
                };
            }).filter(e => e.date);
        } catch (err) {
            console.error('Error fetching Google Calendar events:', err);
            return [];
        }
    }

    return [];
}

/* initialize */
renderCalendar();
