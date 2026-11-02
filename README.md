# Запуск

Нужны Java 21+, Node.js 20+ и PostgreSQL.

1. Запустите PostgreSQL на `localhost:5432` и создайте базу `student-db`. Логин и пароль должны соответствовать `src/main/resources/application.yml`.

2. Из папки проекта запустите бэкенд:

   ```sh
   sh mvnw -Dmaven.compiler.proc=full spring-boot:run
   ```

3. В другом терминале из той же папки запустите фронтенд:

   ```sh
   node frontend/server.mjs
   ```

4. Откройте http://127.0.0.1:3000.

Начальные учётные записи:

| Роль | Email | Пароль |
| --- | --- | --- |
| Преподаватель (`TEACHER`) | `teacher@example.com` | `teacher` |
| Администратор (`ADMIN`) | `admin@example.com` | `admin` |
| Суперадминистратор (`SUPER_ADMIN`) | `superadmin@example.com` | `superAdmin` |
