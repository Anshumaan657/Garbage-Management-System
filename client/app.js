const state = {
    user: null,
    view: 'tickets',
    filter: 'active',
    tickets: [],
    selectedTicket: null
};

const $ = (selector) => document.querySelector(selector);

const api = async (path, options = {}) => {
    const response = await fetch(path, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options
    });
    const text = await response.text();
    let data = text;
    try { data = text ? JSON.parse(text) : {}; } catch (_) {}
    if (!response.ok) {
        throw new Error(data.message || data || 'Request failed');
    }
    return data;
};

const toast = (message, isError = false) => {
    const el = $('#toast');
    el.textContent = message;
    el.classList.toggle('error', isError);
    el.classList.remove('hidden');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => el.classList.add('hidden'), 3200);
};

const formData = (form) => Object.fromEntries(new FormData(form).entries());

const titleCase = (value = '') => value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

const setBusy = (form, busy) => {
    [...form.querySelectorAll('button, input, select, textarea')].forEach(el => el.disabled = busy);
};

const showApp = () => {
    $('#authView').classList.add('hidden');
    $('#appView').classList.remove('hidden');
    $('#logoutBtn').classList.remove('hidden');
    $('#sessionLabel').textContent = `${state.user.username} · ${state.user.role}`;
    renderNav();
    render();
};

const showAuth = () => {
    state.user = null;
    state.tickets = [];
    state.selectedTicket = null;
    $('#authView').classList.remove('hidden');
    $('#appView').classList.add('hidden');
    $('#logoutBtn').classList.add('hidden');
    $('#sessionLabel').textContent = 'Not signed in';
};

const renderNav = () => {
    const items = state.user.role === 'admin'
        ? [['tickets', 'Dispatch Queue'], ['profile', 'Account']]
        : [['tickets', 'Requests'], ['new', 'New Request'], ['profile', 'Account']];

    $('#nav').innerHTML = items.map(([id, label]) =>
        `<button type="button" class="${state.view === id ? 'active' : ''}" data-view="${id}">${label}</button>`
    ).join('');

    $('#nav').querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            state.view = btn.dataset.view;
            state.selectedTicket = null;
            renderNav();
            render();
        });
    });
};

const loadProfile = async () => {
    const path = state.user.role === 'admin' ? '/api/v1/admin' : '/api/v1/customer';
    return api(path);
};

const loadTickets = async () => {
    const path = state.user.role === 'admin'
        ? `/api/v1/admin/ticket?status=${state.filter}`
        : `/api/v1/customer/ticket${state.filter === 'all' ? '' : `?status=${state.filter}`}`;
    const data = await api(path);
    state.tickets = Array.isArray(data) ? data : data.tickets || [];
    state.shortestPath = data.shortestPath || null;
};

const ticketTitle = (ticket) => {
    const coords = ticket.location?.coordinates || [];
    return `${titleCase(ticket.slot || 'slot')} pickup`;
};

const ticketList = () => {
    if (!state.tickets.length) {
        return '<div class="empty-state"><strong>No tickets found</strong><span>Try another status filter or create a new request.</span></div>';
    }

    return `<div class="tickets">${state.tickets.map(ticket => `
        <article class="ticket">
            <div>
                <h3>${ticketTitle(ticket)}</h3>
                <p>${ticket.dateOfCreation || 'Pending date'} ${ticket.timeOfCreation || ''} · ${ticket.location?.coordinates?.join(', ') || 'No coordinates'}</p>
                <p><span class="badge ${ticket.status === 'closed' ? 'closed' : ''}">${titleCase(ticket.status || 'active')}</span></p>
            </div>
            <div class="actions">
                <button type="button" class="secondary" data-ticket="${ticket._id}">Details</button>
                ${state.user.role === 'customer' ? `<button type="button" class="danger" data-delete="${ticket._id}">Delete</button>` : ''}
                ${state.user.role === 'admin' && ticket.status !== 'closed' ? `<button type="button" data-close="${ticket._id}">Close</button>` : ''}
            </div>
        </article>
    `).join('')}</div>`;
};

const renderTickets = async () => {
    $('#content').innerHTML = '<div class="panel">Loading tickets...</div>';
    try {
        await loadTickets();
        const active = state.tickets.filter(ticket => ticket.status !== 'closed').length;
        const closed = state.tickets.filter(ticket => ticket.status === 'closed').length;
        $('#content').innerHTML = `
            <div class="section-head">
                <div>
                    <h2>${state.user.role === 'admin' ? 'Dispatch Queue' : 'Service Requests'}</h2>
                    <p>${state.user.role === 'admin' ? 'Region-scoped requests for the active operating slot.' : 'Your pickup requests and their latest status.'}</p>
                </div>
                <div class="toolbar">
                    <select id="statusFilter" aria-label="Status filter">
                        ${state.user.role === 'customer' ? '<option value="all">All</option>' : ''}
                        <option value="active">Active</option>
                        <option value="closed">Closed</option>
                    </select>
                    <button type="button" id="refreshBtn" class="ghost">Refresh</button>
                </div>
            </div>
            <div class="metrics">
                <div class="metric"><span>Visible</span><strong>${state.tickets.length}</strong></div>
                <div class="metric"><span>Active</span><strong>${active}</strong></div>
                <div class="metric"><span>Closed</span><strong>${closed}</strong></div>
            </div>
            ${state.shortestPath ? `
                <div class="route-summary">
                    <h3>Route Summary</h3>
                    <p>${(state.shortestPath.distance / 1000).toFixed(2)} km · ${Math.round(state.shortestPath.duration / 60)} min estimated</p>
                </div>
            ` : ''}
            ${ticketList()}
        `;
        bindTicketActions();
        $('#statusFilter').value = state.filter;
        $('#statusFilter').addEventListener('change', (event) => {
            state.filter = event.target.value;
            renderTickets();
        });
        $('#refreshBtn').addEventListener('click', renderTickets);
    } catch (error) {
        $('#content').innerHTML = `<div class="panel"><p>${error.message}</p></div>`;
    }
};

const bindTicketActions = () => {
    document.querySelectorAll('[data-ticket]').forEach(btn => {
        btn.addEventListener('click', () => openTicket(btn.dataset.ticket));
    });
    document.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', () => deleteTicket(btn.dataset.delete));
    });
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeTicket(btn.dataset.close));
    });
};

const ticketPath = (id) => state.user.role === 'admin'
    ? `/api/v1/admin/ticket/${id}`
    : `/api/v1/customer/ticket/${id}`;

const openTicket = async (id) => {
    try {
        state.selectedTicket = await api(ticketPath(id));
        renderTicketDetail();
    } catch (error) {
        toast(error.message, true);
    }
};

const renderTicketDetail = () => {
    const ticket = state.selectedTicket;
    const coords = ticket.location?.coordinates || [];
    $('#content').innerHTML = `
        <div class="section-head">
            <div>
                <h2>Ticket Detail</h2>
                <p>${ticket._id.slice(-8).toUpperCase()} · ${titleCase(ticket.status)}</p>
            </div>
            <button type="button" id="backBtn" class="ghost">Back</button>
        </div>
        <div class="panel stack">
            <div class="detail-grid">
                <div><span>Status</span><strong><span class="badge ${ticket.status === 'closed' ? 'closed' : ''}">${titleCase(ticket.status)}</span></strong></div>
                <div><span>Slot</span><strong>${titleCase(ticket.slot)}</strong></div>
                <div><span>Latitude</span><strong>${coords[1]}</strong></div>
                <div><span>Longitude</span><strong>${coords[0]}</strong></div>
            </div>
            <div class="map-box"><strong>Pickup Point</strong><span>${coords[1]}, ${coords[0]}</span></div>
            <div>
                <h3>Activity Notes</h3>
                <div class="note-list">
                    ${(ticket.note || []).length ? ticket.note.map(note => `
                        <div class="note"><strong>${note.author}</strong><br>${note.message}</div>
                    `).join('') : '<p class="muted">No activity notes yet.</p>'}
                </div>
            </div>
            <form id="noteForm" class="stack">
                <textarea name="note" placeholder="Add an internal note" aria-label="Add note" required></textarea>
                <button type="submit">Save Note</button>
            </form>
        </div>
    `;
    $('#backBtn').addEventListener('click', renderTickets);
    $('#noteForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setBusy(form, true);
        try {
            state.selectedTicket = await api(ticketPath(ticket._id), {
                method: 'PATCH',
                body: JSON.stringify(formData(form))
            });
            toast('Note added');
            renderTicketDetail();
        } catch (error) {
            toast(error.message, true);
        } finally {
            setBusy(form, false);
        }
    });
};

const deleteTicket = async (id) => {
    if (!confirm('Delete this ticket?')) return;
    try {
        await api(`/api/v1/customer/ticket/${id}`, { method: 'DELETE' });
        toast('Ticket deleted');
        renderTickets();
    } catch (error) {
        toast(error.message, true);
    }
};

const closeTicket = async (id) => {
    try {
        await api(`/api/v1/admin/ticket/${id}`, { method: 'PUT' });
        toast('Ticket closed');
        renderTickets();
    } catch (error) {
        toast(error.message, true);
    }
};

const renderNewTicket = () => {
    $('#content').innerHTML = `
        <div class="section-head">
            <div>
                <h2>New Pickup Request</h2>
                <p>Create a request inside the configured municipal service boundary.</p>
            </div>
        </div>
        <div class="panel stack">
            <div class="map-box"><strong>Pickup Location</strong><span>Use an approved coordinate inside the service boundary.</span></div>
            <div class="actions">
                <button type="button" class="ghost" data-preset="75.77781182767711,26.956567333262228">Region 1</button>
                <button type="button" class="ghost" data-preset="75.78543883994007,26.967577088741734">Region 2</button>
                <button type="button" class="ghost" data-preset="75.77143914802335,26.959392972331557">Region 3</button>
            </div>
            <form id="ticketForm" class="stack">
                <div class="two-col">
                    <input name="longitude" type="number" step="any" placeholder="Longitude" aria-label="Longitude" required>
                    <input name="latitude" type="number" step="any" placeholder="Latitude" aria-label="Latitude" required>
                </div>
                <select name="slot" aria-label="Slot">
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                </select>
                <textarea name="note" placeholder="Collection note" aria-label="Collection note"></textarea>
                <button type="submit">Create Request</button>
            </form>
        </div>
    `;
    document.querySelectorAll('[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
            const [longitude, latitude] = btn.dataset.preset.split(',');
            $('#ticketForm [name="longitude"]').value = longitude;
            $('#ticketForm [name="latitude"]').value = latitude;
        });
    });
    $('#ticketForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = formData(form);
        setBusy(form, true);
        try {
            await api('/api/v1/customer/ticket', {
                method: 'POST',
                body: JSON.stringify({
                    location: {
                        type: 'Point',
                        coordinates: [Number(data.longitude), Number(data.latitude)]
                    },
                    slot: data.slot,
                    note: data.note || undefined
                })
            });
            toast('Ticket created');
            state.view = 'tickets';
            renderNav();
            renderTickets();
        } catch (error) {
            toast(error.message, true);
        } finally {
            setBusy(form, false);
        }
    });
};

const renderProfile = async () => {
    $('#content').innerHTML = '<div class="panel">Loading profile...</div>';
    try {
        const profile = await loadProfile();
        $('#content').innerHTML = `
            <div class="section-head">
                <div>
                    <h2>Account</h2>
                    <p>Signed-in operator details and access scope.</p>
                </div>
            </div>
            <div class="panel stack">
                <div class="detail-grid">
                    <div><span>Username</span><strong>${profile.username}</strong></div>
                    <div><span>Role</span><strong>${titleCase(profile.role)}</strong></div>
                    <div><span>Email</span><strong>${profile.email}</strong></div>
                    <div><span>Phone</span><strong>${profile.phone}</strong></div>
                    ${profile.region ? `<div><span>Region</span><strong>${profile.region}</strong></div>` : ''}
                    ${profile.slot ? `<div><span>Slot</span><strong>${titleCase(profile.slot)}</strong></div>` : ''}
                </div>
            </div>
        `;
    } catch (error) {
        $('#content').innerHTML = `<div class="panel"><p>${error.message}</p></div>`;
    }
};

const render = () => {
    if (state.view === 'new') return renderNewTicket();
    if (state.view === 'profile') return renderProfile();
    return renderTickets();
};

$('#loginTab').addEventListener('click', () => {
    $('#loginTab').classList.add('active');
    $('#signupTab').classList.remove('active');
    $('#loginForm').classList.remove('hidden');
    $('#signupForm').classList.add('hidden');
});

$('#signupTab').addEventListener('click', () => {
    $('#signupTab').classList.add('active');
    $('#loginTab').classList.remove('active');
    $('#signupForm').classList.remove('hidden');
    $('#loginForm').classList.add('hidden');
});

$('#roleSelect').addEventListener('change', (event) => {
    $('#adminFields').classList.toggle('hidden', event.target.value !== 'admin');
});

$('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(form, true);
    try {
        const data = await api('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify(formData(form))
        });
        state.user = data.user;
        state.view = 'tickets';
        state.filter = 'active';
        showApp();
        toast('Logged in');
    } catch (error) {
        toast(error.message, true);
    } finally {
        setBusy(form, false);
    }
});

$('#signupForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formData(form);
    const body = {
        username: data.username,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: data.role
    };
    if (data.role === 'admin') {
        body.region = data.region;
        body.slot = data.slot;
    }
    setBusy(form, true);
    try {
        const result = await api('/api/v1/auth/signup', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        state.user = result.user;
        state.view = 'tickets';
        state.filter = 'active';
        showApp();
        toast('Account created');
    } catch (error) {
        toast(error.message, true);
    } finally {
        setBusy(form, false);
    }
});

$('#logoutBtn').addEventListener('click', async () => {
    await api('/api/v1/auth/logout', { method: 'POST' }).catch(() => null);
    showAuth();
});

(async () => {
    try {
        const data = await api('/api/v1/auth/me');
        state.user = data.user;
        showApp();
    } catch (_) {
        showAuth();
    }
})();
