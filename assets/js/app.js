(() => {
  'use strict';

  const STATUSES = {
    idea: 'Идея',
    script: 'Сценарий',
    production: 'Продакшн',
    editing: 'Монтаж',
    review: 'Проверка',
    scheduled: 'Запланировано',
    published: 'Опубликовано'
  };

  const state = {
    session: null,
    profile: null,
    tasks: [],
    profiles: []
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const esc = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const config = window.APP_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseAnonKey || config.supabaseUrl.includes('YOUR_PROJECT')) {
    document.addEventListener('DOMContentLoaded', () => {
      $('#authError').textContent = 'Заполните Supabase URL и anon key в assets/js/config.example.js.';
    });
    return;
  }

  const db = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const Auth = {
    async signIn(email, password) {
      return db.auth.signInWithPassword({ email, password });
    },
    async signOut() {
      await db.auth.signOut();
    },
    async loadSession() {
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      state.session = data.session;
      return data.session;
    },
    async loadProfile() {
      const userId = state.session?.user?.id;
      if (!userId) return null;
      const { data, error } = await db
        .from('profiles')
        .select('id,email,display_name,role,department,created_at')
        .eq('id', userId)
        .single();
      if (error) throw error;
      state.profile = data;
      return data;
    },
    isAdmin() {
      return state.profile?.role === 'admin';
    }
  };

  const Api = {
    async listProfiles() {
      const { data, error } = await db
        .from('profiles')
        .select('id,email,display_name,role,department')
        .order('display_name', { ascending: true });
      if (error) throw error;
      state.profiles = data || [];
    },
    async listTasks() {
      const { data, error } = await db
        .from('tasks')
        .select('id,title,description,status,due_date,executor_ids,created_by,created_at,updated_at')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      state.tasks = data || [];
    },
    async saveTask(payload, id) {
      const query = id
        ? db.from('tasks').update(payload).eq('id', id).select().single()
        : db.from('tasks').insert(payload).select().single();
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    async deleteTask(id) {
      const { error } = await db.from('tasks').update({ is_deleted: true }).eq('id', id);
      if (error) throw error;
    }
  };

  const UI = {
    setView(name) {
      const titles = { tasks: 'Задачи', team: 'Команда', profile: 'Профиль' };
      $('#pageTitle').textContent = titles[name] || 'Задачи';
      ['tasks', 'team', 'profile'].forEach(view => {
        $(`#${view}Panel`).classList.toggle('hidden', view !== name);
      });
      $$('.nav').forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
    },
    renderAuth() {
      const logged = Boolean(state.session && state.profile);
      $('#authView').classList.toggle('hidden', logged);
      $('#crmView').classList.toggle('hidden', !logged);
      if (!logged) return;
      $('#userBox').innerHTML = `<strong>${esc(state.profile.display_name || state.profile.email)}</strong><br><span>${esc(state.profile.role || 'user')}</span>`;
      UI.renderProfile();
    },
    fillSelectors() {
      const statusOptions = ['<option value="ALL">Все статусы</option>']
        .concat(Object.entries(STATUSES).map(([value, label]) => `<option value="${value}">${esc(label)}</option>`));
      $('#statusFilter').innerHTML = statusOptions.join('');
      $('#taskStatus').innerHTML = Object.entries(STATUSES).map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join('');
      $('#taskExecutors').innerHTML = state.profiles.map(p => `<option value="${p.id}">${esc(p.display_name || p.email)}</option>`).join('');
    },
    renderTasks() {
      const q = $('#searchInput').value.trim().toLowerCase();
      const status = $('#statusFilter').value;
      const tasks = state.tasks.filter(task => {
        const matchesStatus = status === 'ALL' || task.status === status;
        const haystack = `${task.title || ''} ${task.description || ''}`.toLowerCase();
        return matchesStatus && (!q || haystack.includes(q));
      });
      $('#tasksList').innerHTML = tasks.length ? tasks.map(UI.taskCard).join('') : '<p class="muted">Задач пока нет.</p>';
    },
    taskCard(task) {
      const executors = (task.executor_ids || [])
        .map(id => state.profiles.find(p => p.id === id)?.display_name)
        .filter(Boolean)
        .join(', ') || 'Не назначены';
      const canEdit = Auth.isAdmin() || task.created_by === state.profile?.id || (task.executor_ids || []).includes(state.profile?.id);
      return `<article class="card" data-task-id="${task.id}">
        <div class="card-head"><div><span class="badge">${esc(STATUSES[task.status] || task.status)}</span><h3>${esc(task.title)}</h3></div><div class="muted">${esc(task.due_date || 'без даты')}</div></div>
        <p>${esc(task.description || '')}</p>
        <div class="muted">Исполнители: ${esc(executors)}</div>
        ${canEdit ? `<div class="actions"><button data-action="edit">Изменить</button><button data-action="delete" class="danger">В корзину</button></div>` : ''}
      </article>`;
    },
    renderTeam() {
      $('#teamList').innerHTML = state.profiles.map(p => `<div class="person"><strong>${esc(p.display_name || p.email)}</strong><br><span class="muted">${esc(p.department || 'Без отдела')} · ${esc(p.role || 'user')}</span></div>`).join('');
    },
    renderProfile() {
      $('#profileData').innerHTML = `<p><strong>${esc(state.profile.display_name || '')}</strong></p><p>${esc(state.profile.email || '')}</p><p>Роль: ${esc(state.profile.role || 'user')}</p>`;
    },
    openTaskDialog(task = null) {
      $('#taskDialogTitle').textContent = task ? 'Правка задачи' : 'Новая задача';
      $('#taskId').value = task?.id || '';
      $('#taskTitle').value = task?.title || '';
      $('#taskDescription').value = task?.description || '';
      $('#taskStatus').value = task?.status || 'idea';
      $('#taskDate').value = task?.due_date || '';
      const ids = new Set(task?.executor_ids || []);
      $$('#taskExecutors option').forEach(option => { option.selected = ids.has(option.value); });
      $('#taskError').textContent = '';
      $('#taskDialog').showModal();
    }
  };

  async function bootstrap() {
    await Auth.loadSession();
    if (state.session) {
      await Auth.loadProfile();
      await Api.listProfiles();
      await Api.listTasks();
      UI.fillSelectors();
      UI.renderAuth();
      UI.renderTasks();
      UI.renderTeam();
    } else {
      UI.renderAuth();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bootstrap().catch(err => { $('#authError').textContent = err.message; });

    $('#loginForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      $('#authError').textContent = '';
      const email = $('#email').value.trim();
      const password = $('#password').value;
      try {
        const { error } = await Auth.signIn(email, password);
        if (error) throw error;
        await bootstrap();
      } catch (err) {
        $('#authError').textContent = err.message || 'Ошибка входа';
      }
    });

    $('#logoutBtn').addEventListener('click', async () => {
      await Auth.signOut();
      state.session = null; state.profile = null; state.tasks = []; state.profiles = [];
      UI.renderAuth();
    });

    $$('.nav').forEach(btn => btn.addEventListener('click', () => UI.setView(btn.dataset.view)));
    $('#searchInput').addEventListener('input', UI.renderTasks);
    $('#statusFilter').addEventListener('change', UI.renderTasks);
    $('#newTaskBtn').addEventListener('click', () => UI.openTaskDialog());
    $('#cancelTaskBtn').addEventListener('click', () => $('#taskDialog').close());

    $('#tasksList').addEventListener('click', async (event) => {
      const card = event.target.closest('[data-task-id]');
      const action = event.target.dataset.action;
      if (!card || !action) return;
      const task = state.tasks.find(t => String(t.id) === String(card.dataset.taskId));
      if (!task) return;
      if (action === 'edit') UI.openTaskDialog(task);
      if (action === 'delete') {
        await Api.deleteTask(task.id);
        await Api.listTasks();
        UI.renderTasks();
      }
    });

    $('#taskForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const id = $('#taskId').value || null;
      const executorIds = $$('#taskExecutors option:checked').map(o => o.value);
      const payload = {
        title: $('#taskTitle').value.trim(),
        description: $('#taskDescription').value.trim(),
        status: $('#taskStatus').value,
        due_date: $('#taskDate').value || null,
        executor_ids: executorIds,
        updated_at: new Date().toISOString()
      };
      if (!id) payload.created_by = state.profile.id;
      try {
        await Api.saveTask(payload, id);
        $('#taskDialog').close();
        await Api.listTasks();
        UI.renderTasks();
      } catch (err) {
        $('#taskError').textContent = err.message || 'Не удалось сохранить задачу';
      }
    });

    $('#resetPasswordBtn').addEventListener('click', async () => {
      const email = state.profile?.email;
      if (!email) return;
      await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      alert('Письмо для смены пароля отправлено.');
    });
  });
})();
