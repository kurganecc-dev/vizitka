# ANDROMEDA CRM secure rewrite

Полностью переписанная минимальная версия CRM с безопасной аутентификацией через Supabase Auth.

## Что исправлено

- Убрана авторизация через `profiles.password`.
- Пароли больше не читаются и не сравниваются на клиенте.
- Сессия берётся из `supabase.auth.getSession()`.
- Роль пользователя читается из `profiles` по `auth.uid()`.
- Доступ к данным защищается RLS-политиками из `supabase/schema.sql`.
- API-токены YouTube/Apify не сохраняются в localStorage. Их нужно переносить в Edge Functions/серверную часть.

## Запуск

1. Создайте проект Supabase.
2. Включите Email Auth в Supabase Authentication.
3. Создайте пользователей в Supabase Auth.
4. Выполните SQL из `supabase/schema.sql`.
5. Для каждого auth-пользователя добавьте строку в `profiles` с таким же `id`.
6. В `assets/js/config.example.js` вставьте `supabaseUrl` и `supabaseAnonKey`.
7. Откройте `index.html` через локальный сервер, например:

```bash
python3 -m http.server 8080
```

## Важно

Это фронтенд-версия. Любые секретные интеграции, парсинг внешних API и сервисные ключи должны жить не в браузере, а в Supabase Edge Functions или отдельном backend.
