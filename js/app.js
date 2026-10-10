// Address of the Spring Boot backend (change this if the backend runs elsewhere)
const API_BASE = 'http://localhost:8080';

/* TeamForge – plain JavaScript single-page frontend (Fetch API + JWT in localStorage) */
const $ = s => document.querySelector(s);
const app = () => $('#app');
const STATUS = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chips = s => (s || '').split(',').map(x => x.trim()).filter(Boolean).map(x => `<span class="chip">${esc(x)}</span>`).join('');
const user = () => JSON.parse(localStorage.getItem('user') || 'null');
const authed = () => !!localStorage.getItem('token');
const label = s => String(s).replace('_', ' ');

function toast(msg, err) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.className = ''), 3200);
}

async function api(path, method = 'GET', body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(API_BASE + '/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }
  if (res.status === 401 && token && !path.startsWith('/auth')) {
    localStorage.clear();
    location.hash = '#/login';
    throw new Error('Your session expired. Please log in again.');
  }
  if (!res.ok) throw new Error((data && data.message) || 'Something went wrong (' + res.status + ')');
  return data;
}

const save = d => { localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user)); };
const submit = fn => async e => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  try { await fn(d); } catch (x) { toast(x.message, true); }
};
let timer;
const debounce = f => () => { clearTimeout(timer); timer = setTimeout(f, 250); };

const field = (n, l, v = '', t = 'text', ex = '') => `<label>${l}<input name="${n}" type="${t}" value="${esc(v)}" ${ex}></label>`;
const area = (n, l, v = '', r = 4) => `<label>${l}<textarea name="${n}" rows="${r}">${esc(v)}</textarea></label>`;
const yearSelect = y => `<label>Year<select name="year"><option value="">Select</option>${[1, 2, 3, 4, 5].map(n => `<option ${y == n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
const stat = (n, l, href) => `<a class="stat" href="${href}"><b>${n}</b><span>${l}</span></a>`;

function card(p, own) {
  return `<div class="card"><div class="row"><h3>${esc(p.title)}</h3><span class="badge ${p.status}">${label(p.status)}</span></div>
  <p class="muted">${esc((p.description || '').slice(0, 130))}${(p.description || '').length > 130 ? '…' : ''}</p>
  <div>${chips(p.requiredSkills)}</div>
  <div class="row foot"><span>${esc(p.ownerName)} · ${p.members}/${p.teamSize} members</span>
  <span>${own ? `<a class="btn alt sm" href="#/edit/${p.id}">Edit</a> ` : ''}<a class="btn sm" href="#/project/${p.id}">View</a></span></div></div>`;
}
const person = (u, extra = '') => `<div class="card"><h3>${esc(u.fullName)}</h3>
  <p class="muted">${esc(u.department || 'Department not set')}${u.year ? ' · Year ' + u.year : ''}</p>
  <div>${chips(u.skills)}</div>${extra}<div class="foot"><a class="btn sm" href="mailto:${esc(u.email)}">Email ${esc(u.fullName.split(' ')[0])}</a></div></div>`;

function nav(active) {
  const isAdmin = authed() && user() && user().role === 'ADMIN';
  const links = [['home', 'Home'], ['dashboard', 'Dashboard'], ['projects', 'Projects'], ['create', 'Create Project'], ['my-projects', 'My Projects'],
    ['teams', 'Teams'], ['requests', 'Requests'], ['recommendations', 'Recommendations'], ['profile', 'Profile'],
    ...(isAdmin ? [['admin', 'Admin']] : []), ['logout', 'Logout']];
  const pub = [['home', 'Home'], ['login', 'Login'], ['register', 'Register']];
  $('#links').innerHTML = (authed() ? links : pub).map(([k, t]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}">${t}</a>`).join('');
}

function projectForm(p) {
  const edit = !!p; p = p || {};
  app().innerHTML = `<div class="panel"><h2 style="margin-top:0">${edit ? 'Edit project' : 'Create a project'}</h2><form id="f">
    ${field('title', 'Project title', p.title, 'text', 'required')}
    ${area('description', 'Description', p.description, 5)}
    ${field('requiredSkills', 'Required skills (comma separated)', p.requiredSkills, 'text', 'placeholder="Java, Spring Boot, MySQL"')}
    <div class="two">${field('teamSize', 'Team size (including you)', p.teamSize || 4, 'number', 'min="1" max="50" required')}
    <label>Status<select name="status">${STATUS.map(s => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${label(s)}</option>`).join('')}</select></label></div>
    <button class="btn">${edit ? 'Save changes' : 'Create project'}</button></form></div>`;
  $('#f').onsubmit = submit(async d => {
    d.teamSize = +d.teamSize;
    const r = await api(edit ? '/projects/' + p.id : '/projects', edit ? 'PUT' : 'POST', d);
    toast(edit ? 'Project updated' : 'Project created');
    location.hash = '#/project/' + r.id;
  });
}

const P = {
  home() {
    app().innerHTML = `<section class="hero"><h1>Find the right teammates for your next project.</h1>
      <p>Post a project, list the skills you need, and build a team with students who want to build it too.</p>
      <div class="actions">${authed() ? '<a class="btn gold" href="#/projects">Browse projects</a><a class="btn alt" href="#/create">Create a project</a>'
        : '<a class="btn gold" href="#/register">Create your account</a><a class="btn alt" href="#/login">Log in</a>'}</div></section>
      <div class="grid">
        <div class="card"><h3>List your skills</h3><p class="muted">Add your technical skills to your profile so project owners can find you.</p></div>
        <div class="card"><h3>Post or join projects</h3><p class="muted">Describe what you are building and how many people you need, or ask to join one.</p></div>
        <div class="card"><h3>Get matched</h3><p class="muted">Recommendations compare your skills with project needs, and your project needs with other students.</p></div>
      </div>`;
  },

  register() {
    app().innerHTML = `<div class="panel narrow"><h2 style="margin-top:0">Create your account</h2><form id="f">
      ${field('fullName', 'Full name', '', 'text', 'required')}${field('email', 'Email', '', 'email', 'required')}
      ${field('password', 'Password', '', 'password', 'required')}
      <div class="two">${field('department', 'Department')}${yearSelect('')}</div>
      ${field('skills', 'Skills (comma separated)', '', 'text', 'placeholder="Java, Spring Boot, MySQL"')}${area('bio', 'Bio')}
      <button class="btn">Register</button> <a href="#/login">I already have an account</a></form></div>`;
    $('#f').onsubmit = submit(async d => {
      d.year = d.year ? +d.year : null;
      save(await api('/auth/register', 'POST', d));
      toast('Account created. Welcome!');
      location.hash = '#/dashboard';
    });
  },

  login() {
    app().innerHTML = `<div class="panel narrow"><h2 style="margin-top:0">Log in</h2><form id="f">
      ${field('email', 'Email', '', 'email', 'required')}${field('password', 'Password', '', 'password', 'required')}
      <button class="btn">Log in</button> <a href="#/register">Create an account</a></form></div>`;
    $('#f').onsubmit = submit(async d => {
      save(await api('/auth/login', 'POST', d));
      toast('Logged in');
      location.hash = '#/dashboard';
    });
  },

  logout() { localStorage.clear(); toast('You are logged out'); location.hash = '#/login'; },

  async admin() {
    if (user().role !== 'ADMIN') { location.hash = '#/dashboard'; return; }
    const [s, us, ps] = await Promise.all([api('/admin/stats'), api('/admin/users'), api('/admin/projects')]);
    app().innerHTML = `<h1>Admin panel</h1>
      <div class="stats">${stat(s.users, 'Users', '#/admin')}${stat(s.projects, 'Projects', '#/admin')}${stat(s.requests, 'Join requests', '#/admin')}${stat(s.pending, 'Pending requests', '#/admin')}</div>
      <h2>Users</h2>${us.map(u => `<div class="item"><div><b>${esc(u.fullName)}</b> ${u.role === 'ADMIN' ? '<span class="badge OPEN">Admin</span>' : ''}
        <div class="muted">${esc(u.email)} · ${esc(u.department || '')}</div><div>${chips(u.skills)}</div></div>
        <div class="side">${u.role === 'ADMIN' ? '' : `<button class="btn danger sm" data-act="user" data-id="${u.id}">Delete user</button>`}</div></div>`).join('')}
      <h2>Projects</h2>${ps.map(p => `<div class="item"><div><b><a href="#/project/${p.id}">${esc(p.title)}</a></b> <span class="badge ${p.status}">${label(p.status)}</span>
        <div class="muted">Owner: ${esc(p.ownerName)} · ${p.members}/${p.teamSize} members</div></div>
        <div class="side"><button class="btn danger sm" data-act="project" data-id="${p.id}">Delete project</button></div></div>`).join('')}`;
    app().onclick = async e => {
      const b = e.target.closest('[data-act]');
      if (!b || !confirm('Delete this ' + b.dataset.act + '? This cannot be undone.')) return;
      try { await api(`/admin/${b.dataset.act}s/${b.dataset.id}`, 'DELETE'); toast('Deleted'); P.admin(); }
      catch (x) { toast(x.message, true); }
    };
  },

  async dashboard() {
    const [mine, teams, inc] = await Promise.all([api('/projects/mine'), api('/projects/teams'), api('/requests/incoming')]);
    const pending = inc.filter(r => r.status === 'PENDING').length;
    app().innerHTML = `<h1>Welcome back, ${esc(user().fullName)}</h1>
      <div class="stats">${stat(mine.length, 'Projects I own', '#/my-projects')}${stat(teams.length, 'Teams I am in', '#/teams')}${stat(pending, 'Requests waiting for you', '#/requests')}</div>
      <div class="actions"><a class="btn" href="#/create">Create project</a><a class="btn alt" href="#/projects">Browse projects</a><a class="btn alt" href="#/recommendations">See recommendations</a></div>
      <h2>Your latest projects</h2><div class="grid">${mine.slice(0, 3).map(p => card(p, true)).join('') || '<p class="muted">You have not created a project yet. Start with “Create project”.</p>'}</div>`;
  },

  async profile() {
    const u = await api('/users/profile');
    app().innerHTML = `<div class="panel"><h2 style="margin-top:0">Your profile</h2><form id="f">
      <div class="two">${field('fullName', 'Full name', u.fullName, 'text', 'required')}${field('email', 'Email', u.email, 'email', 'required')}</div>
      <div class="two">${field('department', 'Department', u.department)}${yearSelect(u.year)}</div>
      ${field('skills', 'Skills (comma separated)', u.skills, 'text', 'placeholder="Java, Spring Boot, MySQL, Machine Learning"')}
      ${area('bio', 'Bio', u.bio, 4)}<button class="btn">Save profile</button></form></div>`;
    $('#f').onsubmit = submit(async d => {
      d.year = d.year ? +d.year : null;
      save(await api('/users/profile', 'PUT', d));
      toast('Profile saved');
    });
  },

  async projects() {
    app().innerHTML = `<h1>Browse projects</h1><div class="filters">
      <input id="q" placeholder="Search by title or description"><input id="sk" placeholder="Filter by skill, e.g. Java">
      <select id="st"><option value="">Any status</option>${STATUS.map(s => `<option value="${s}">${label(s)}</option>`).join('')}</select></div>
      <div id="list" class="grid"></div>`;
    const load = async () => {
      try {
        const qs = new URLSearchParams({ q: $('#q').value, skill: $('#sk').value, status: $('#st').value });
        const l = await api('/projects?' + qs);
        $('#list').innerHTML = l.map(p => card(p)).join('') || '<p class="muted">No projects match. Try fewer filters.</p>';
      } catch (e) { toast(e.message, true); }
    };
    ['#q', '#sk', '#st'].forEach(s => ($(s).oninput = debounce(load)));
    load();
  },

  create() { projectForm(); },
  async edit(id) { projectForm(await api('/projects/' + id)); },

  async project(id) {
    const p = await api('/projects/' + id);
    let action;
    if (p.mine) action = `<a class="btn" href="#/edit/${p.id}">Edit project</a> <button class="btn danger" id="del">Delete</button>`;
    else if (p.myRequest) action = `<span class="badge ${p.myRequest}">Your request: ${p.myRequest}</span>`;
    else if (p.status === 'OPEN' && p.members < p.teamSize)
      action = `<label>Message to the owner<textarea id="msg" rows="3" placeholder="Tell them how you can help (optional)"></textarea></label><button class="btn" id="join">Request to join</button>`;
    else action = '<span class="muted">This project is not accepting new members.</span>';
    app().innerHTML = `<div class="detail"><div class="panel"><div class="row"><h1>${esc(p.title)}</h1><span class="badge ${p.status}">${label(p.status)}</span></div>
      <p class="muted">Owner: ${esc(p.ownerName)} · ${p.members} of ${p.teamSize} places filled</p>
      <p style="white-space:pre-wrap">${esc(p.description || 'No description yet.')}</p>
      <h3>Required skills</h3><div>${chips(p.requiredSkills) || '<span class="muted">None listed</span>'}</div></div>
      <div class="panel">${action}</div></div>
      <h2>Team members</h2><ul class="team">${p.team.map(m => `<li><b>${esc(m.fullName)}</b>${m.id === p.ownerId ? ' <span class="badge OPEN">Owner</span>' : ''}
        <div class="muted">${esc(m.department || '')}${m.year ? ' · Year ' + m.year : ''}</div><div>${chips(m.skills)}</div></li>`).join('')}</ul>`;
    if ($('#join')) $('#join').onclick = async () => {
      try { await api('/projects/' + id + '/join', 'POST', { message: $('#msg').value }); toast('Request sent'); P.project(id); }
      catch (e) { toast(e.message, true); }
    };
    if ($('#del')) $('#del').onclick = async () => {
      if (!confirm('Delete this project and all its requests?')) return;
      try { await api('/projects/' + id, 'DELETE'); toast('Project deleted'); location.hash = '#/my-projects'; }
      catch (e) { toast(e.message, true); }
    };
  },

  async 'my-projects'() {
    const l = await api('/projects/mine');
    app().innerHTML = `<div class="row"><h1>My projects</h1><a class="btn" href="#/create">Create project</a></div>
      <div class="grid">${l.map(p => card(p, true)).join('') || '<p class="muted">You have not created any projects yet.</p>'}</div>`;
  },

  async requests() {
    const [inc, out] = await Promise.all([api('/requests/incoming'), api('/requests/outgoing')]);
    const row = (r, incoming) => `<div class="item"><div>
      <b>${incoming ? esc(r.userName) : esc(r.projectTitle)}</b>
      ${incoming ? `wants to join <a href="#/project/${r.projectId}">${esc(r.projectTitle)}</a><div>${chips(r.userSkills)}</div>` : ''}
      ${r.message ? `<p class="muted">“${esc(r.message)}”</p>` : ''}</div>
      <div class="side"><span class="badge ${r.status}">${r.status}</span>
      ${r.status === 'PENDING' ? (incoming
        ? `<span><button class="btn sm" data-act="accept" data-id="${r.id}">Accept</button><button class="btn danger sm" data-act="reject" data-id="${r.id}">Reject</button></span>`
        : `<button class="btn alt sm" data-act="cancel" data-id="${r.id}">Cancel request</button>`) : ''}</div></div>`;
    app().innerHTML = `<h1>Join requests</h1><h2>Requests to my projects</h2>${inc.map(r => row(r, true)).join('') || '<p class="muted">Nobody has asked to join your projects yet.</p>'}
      <h2>Requests I sent</h2>${out.map(r => row(r, false)).join('') || '<p class="muted">You have not asked to join any project yet.</p>'}`;
    app().onclick = async e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      try {
        if (b.dataset.act === 'cancel') await api('/requests/' + b.dataset.id, 'DELETE');
        else await api(`/requests/${b.dataset.id}/${b.dataset.act}`, 'PUT');
        toast(b.dataset.act === 'accept' ? 'Member added to the team' : b.dataset.act === 'reject' ? 'Request rejected' : 'Request cancelled');
        P.requests();
      } catch (x) { toast(x.message, true); }
    };
  },

  async teams() {
    const l = await api('/projects/teams');
    app().innerHTML = `<h1>My teams</h1>${l.map(p => `<div class="panel" style="margin-bottom:18px;max-width:none">
      <div class="row"><h3><a href="#/project/${p.id}">${esc(p.title)}</a></h3><span class="badge ${p.status}">${label(p.status)}</span></div>
      <p class="muted">${p.mine ? 'You own this project' : 'Owner: ' + esc(p.ownerName)} · ${p.members}/${p.teamSize} members</p>
      <ul class="team">${p.team.map(m => `<li><b>${esc(m.fullName)}</b>${m.id === p.ownerId ? ' <span class="badge OPEN">Owner</span>' : ''}<div>${chips(m.skills)}</div></li>`).join('')}</ul></div>`).join('')
      || '<p class="muted">You are not in a team yet. Create a project or ask to join one.</p>'}`;
  },

  async recommendations() {
    const r = await api('/recommendations');
    const me = user();
    app().innerHTML = `<h1>Recommendations</h1>
      <h2>Projects that need your skills</h2><div class="grid">${r.projects.map(x => `<div>${card(x.project)}<p class="muted">Matches: ${x.matched.map(esc).join(', ')}</p></div>`).join('')
        || '<p class="muted">No matches yet. Add skills to your profile to see projects.</p>'}</div>
      <h2>Students who fit your projects</h2><div class="grid">${r.students.map(x => person(x.student, `<p class="muted">Fits <a href="#/project/${x.projectId}">${esc(x.projectTitle)}</a> · matches ${x.matched.map(esc).join(', ')}</p>`)).join('')
        || '<p class="muted">Create a project with required skills to see matching students.</p>'}</div>
      <h2>Find students by skill</h2><input id="ss" placeholder="Type a skill, e.g. Spring Boot" style="max-width:420px;margin-bottom:16px"><div id="sres" class="grid"></div>`;
    const search = async () => {
      try {
        const l = (await api('/users/search?skill=' + encodeURIComponent($('#ss').value))).filter(u => u.id !== me.id);
        $('#sres').innerHTML = l.map(u => person(u)).join('') || '<p class="muted">No students found with that skill.</p>';
      } catch (e) { toast(e.message, true); }
    };
    $('#ss').oninput = debounce(search);
  }
};

async function route() {
  app().onclick = null;
  const [n, arg] = (location.hash.slice(2) || 'home').split('/');
  const name = P[n] ? n : 'home';
  if (!authed() && !['home', 'login', 'register'].includes(name)) { location.hash = '#/login'; return; }
  if (authed() && (name === 'login' || name === 'register')) { location.hash = '#/dashboard'; return; }
  nav(name);
  window.scrollTo(0, 0);
  try { await P[name](arg); } catch (e) { toast(e.message, true); }
}
window.addEventListener('hashchange', route);
route();
