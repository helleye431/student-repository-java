if (location.search) {
  history.replaceState(null, '', location.pathname + location.hash);
}

const app = document.getElementById('app');
const message = document.getElementById('message');
const loginForm = document.getElementById('login-form');

const studentForm = document.getElementById('student-form');
const studentModal = document.getElementById('student-modal');
const studentRows = document.getElementById('student-rows');
const studentSaveButton = studentForm.querySelector('button[type="submit"]');
const studentDeleteButton = document.getElementById('delete-student');

const userForm = document.getElementById('user-form');
const userModal = document.getElementById('user-modal');
const userRows = document.getElementById('user-rows');
const userSaveButton = userForm.querySelector('button[type="submit"]');
const userDeleteButton = document.getElementById('delete-user');

let token = '';
let email = '';
let roles = [];

function showError(error) {
  const modal = document.querySelector('dialog[open]');
  const target = modal ? modal.querySelector('.form-message') : message;
  target.textContent = error.message;
}

async function runAction(button, action) {
  if (button.disabled) return;

  button.disabled = true;
  message.textContent = '';
  const modal = document.querySelector('dialog[open]');
  if (modal) modal.querySelector('.form-message').textContent = '';

  try {
    await action();
  } catch (error) {
    showError(error);
  } finally {
    button.disabled = false;
  }
}

function bindClick(id, action) {
  const button = document.getElementById(id);
  button.onclick = function () {
    return runAction(button, action);
  };
}

function bindSubmit(form, action) {
  const button = form.querySelector('button[type="submit"]');
  form.onsubmit = function (event) {
    event.preventDefault();
    return runAction(button, action);
  };
}

function addButton(cell, text, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.onclick = function () {
    return runAction(button, action);
  };
  cell.append(button);
}

async function request(path, method = 'GET', body) {
  const options = { method, headers: {} };
  if (token) options.headers.Authorization = 'Bearer ' + token;
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch('/api/v1' + path, options);
  // API может возвращать пустой ответ после изменения или удаления.
  const data = await response.json().catch(function () {
    return null;
  });

  if (response.status === 401) {
    logout();
    throw new Error('Войдите заново. Проверьте email и пароль.');
  }
  if (response.status === 403) {
    throw new Error('Неверный email или пароль либо недостаточно прав.');
  }
  if (!response.ok) {
    throw new Error(data?.message || 'Ошибка запроса: ' + response.status);
  }
  return data;
}

async function login() {
  const fields = loginForm.elements;
  const loginEmail = fields.email.value.trim();
  const data = await request('/auth/login', 'POST', {
    email: loginEmail,
    password: fields.password.value,
  });

  token = data.token;
  email = loginEmail;
  roles = data.roles.map(function (role) {
    return role.replace('ROLE_', '');
  });
  fields.password.value = '';
  loginForm.hidden = true;
  app.hidden = false;
  document.getElementById('account').textContent = email + ' (' + roles.join(', ') + ')';

  const canReadStudents = roles.includes('ADMIN') || roles.includes('TEACHER');
  document.getElementById('students').hidden = !canReadStudents;
  document.getElementById('users').hidden = !roles.includes('SUPER_ADMIN');
  document.getElementById('add-student').hidden = !roles.includes('ADMIN');

  if (canReadStudents) await loadStudents();
  if (roles.includes('SUPER_ADMIN')) await loadUsers();
  if (!roles.length) message.textContent = 'У вас нет доступных разделов.';
}

function logout() {
  token = '';
  email = '';
  roles = [];
  loginForm.reset();
  loginForm.hidden = false;
  app.hidden = true;
  studentModal.close();
  userModal.close();
  studentRows.replaceChildren();
  userRows.replaceChildren();
  message.textContent = '';
}

async function loadStudents() {
  const data = await request('/student');
  if (!token) return;

  studentRows.replaceChildren();
  for (const student of data.response) {
    const row = studentRows.insertRow();
    row.insertCell().textContent = student.id;
    row.insertCell().textContent = student.name;
    row.insertCell().textContent = student.surname;
    const actions = row.insertCell();

    if (roles.includes('ADMIN')) {
      addButton(actions, 'Изменить', function () {
        return openStudent(student.id);
      });
    }
    addButton(actions, 'Посмотреть', function () {
      return openStudent(student.id, true);
    });
    if (roles.includes('ADMIN')) {
      addButton(actions, 'Удалить', function () {
        return deleteStudent(student.id, student.name + ' ' + student.surname);
      });
    }
  }
  if (!data.response.length) {
    studentRows.insertRow().insertCell().textContent = 'Список пуст.';
  }
}

async function openStudent(id, viewOnly = false) {
  const student = await request('/student/' + id);
  if (token) showStudent(student, viewOnly);
}

function showStudent(student = null, viewOnly = false) {
  studentForm.reset();
  studentForm.querySelector('.form-message').textContent = '';
  studentForm.querySelector('h3').textContent = viewOnly ? 'Просмотр студента' : 'Данные студента';

  const fields = studentForm.elements;
  const readOnly = viewOnly || !roles.includes('ADMIN');
  fields.id.value = student?.id || '';
  fields.name.value = student?.name || '';
  fields.surname.value = student?.surname || '';
  fields.email.value = student?.email || '';
  fields.phoneNumber.value = student?.phoneNumber || '';
  fields.name.readOnly = Boolean(student);
  fields.surname.readOnly = Boolean(student);
  fields.email.readOnly = readOnly;
  fields.phoneNumber.readOnly = readOnly;

  studentSaveButton.hidden = readOnly;
  studentDeleteButton.hidden = !student || !roles.includes('ADMIN');
  studentModal.showModal();
}

async function saveStudent() {
  if (!roles.includes('ADMIN') || studentSaveButton.hidden) return;

  const fields = studentForm.elements;
  const id = fields.id.value;
  const email = fields.email.value.trim();
  const phoneNumber = fields.phoneNumber.value.trim();

  if (id) {
    await request('/student/' + id, 'PUT', { email, phoneNumber });
  } else {
    const name = fields.name.value.trim();
    const surname = fields.surname.value.trim();
    if (!name || !surname) throw new Error('Укажите имя и фамилию.');

    // При создании студента API принимает телефон как phone_number.
    await request('/student/save', 'POST', { name, surname, email, phone_number: phoneNumber });
  }
  studentModal.close();
  await loadStudents();
}

async function deleteStudent(id, name) {
  if (!roles.includes('ADMIN')) return;
  if (!confirm('Удалить студента ' + name + '?')) return;

  await request('/student/' + id, 'DELETE');
  studentModal.close();
  await loadStudents();
}

async function loadUsers() {
  const data = await request('/users');
  if (!token) return;

  userRows.replaceChildren();
  for (const user of data.responses) {
    const row = userRows.insertRow();
    row.insertCell().textContent = user.id;
    row.insertCell().textContent = user.email;
    row.insertCell().textContent = user.roles.join(', ');
    const actions = row.insertCell();

    addButton(actions, 'Изменить', function () {
      showUser(user);
    });
    addButton(actions, 'Посмотреть', function () {
      showUser(user, true);
    });
    addButton(actions, 'Удалить', function () {
      return deleteUser(user.id, user.email);
    });
  }
  if (!data.responses.length) {
    userRows.insertRow().insertCell().textContent = 'Список пуст.';
  }
}

function showUser(user = null, viewOnly = false) {
  userForm.reset();
  userForm.querySelector('.form-message').textContent = '';
  userForm.querySelector('h3').textContent = viewOnly ? 'Просмотр пользователя' : 'Данные пользователя';

  const fields = userForm.elements;
  fields.id.value = user?.id || '';
  fields.email.value = user?.email || '';
  fields.email.readOnly = Boolean(user);
  fields.password.required = !user;
  document.getElementById('user-password').hidden = Boolean(user);

  for (const checkbox of userForm.querySelectorAll('input[name="roles"]')) {
    checkbox.checked = user ? user.roles.includes(checkbox.value) : checkbox.value === 'TEACHER';
    checkbox.disabled = viewOnly;
  }
  userSaveButton.hidden = viewOnly;
  userDeleteButton.hidden = !user || !roles.includes('SUPER_ADMIN');
  userModal.showModal();
}

async function saveUser() {
  if (!roles.includes('SUPER_ADMIN') || userSaveButton.hidden) return;

  const fields = userForm.elements;
  const id = fields.id.value;
  const data = {
    email: fields.email.value.trim(),
    roles: new FormData(userForm).getAll('roles'),
  };
  if (!data.roles.length) throw new Error('Выберите хотя бы одну роль.');

  if (id) {
    // API обновляет роли по email и возвращает пустой ответ.
    await request('/users/' + id, 'PUT', data);
  } else {
    data.password = fields.password.value;
    await request('/users/save', 'POST', data);
  }
  userForm.reset();
  userModal.close();

  if (id && data.email === email) {
    logout();
    message.textContent = 'Роли изменены. Войдите заново.';
  } else {
    await loadUsers();
  }
}

async function deleteUser(id, userEmail) {
  if (!roles.includes('SUPER_ADMIN')) return;
  if (!confirm('Удалить пользователя ' + userEmail + '?')) return;

  await request('/users/' + id, 'DELETE');
  userModal.close();
  if (userEmail === email) logout();
  else await loadUsers();
}

bindSubmit(loginForm, login);
bindSubmit(studentForm, saveStudent);
bindSubmit(userForm, saveUser);

bindClick('logout', logout);
bindClick('refresh-students', loadStudents);
bindClick('refresh-users', loadUsers);
bindClick('add-student', function () { showStudent(); });
bindClick('add-user', function () { showUser(); });
bindClick('close-student', function () { studentModal.close(); });
bindClick('close-user', function () { userModal.close(); });
bindClick('delete-student', function () {
  const fields = studentForm.elements;
  return deleteStudent(fields.id.value, fields.name.value + ' ' + fields.surname.value);
});
bindClick('delete-user', function () {
  const fields = userForm.elements;
  return deleteUser(fields.id.value, fields.email.value);
});
