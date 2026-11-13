# Запуск

Нужны Java 21, Node.js 20+ и PostgreSQL.

1. Запустите PostgreSQL на `localhost:5432` и создайте базу `student-db`. Логин и пароль должны соответствовать `src/main/resources/application.yml`.

2. Из папки проекта запустите бэкенд.

   macOS/Linux:

   ```sh
   sh mvnw spring-boot:run
   ```

   Windows (PowerShell):

   ```powershell
   .\mvnw.cmd spring-boot:run
   ```

3. В другом терминале из той же папки запустите фронтенд. Команда одинаковая для macOS/Linux и Windows:

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

# Тесты

macOS/Linux:

```sh
sh mvnw clean verify
```

Windows (PowerShell):

```powershell
.\mvnw.cmd clean verify
```

В `ControllersTest` проверяются вход, CRUD студентов и пользователей, роли и ошибки API. Порог JaCoCo — 80% строк.
