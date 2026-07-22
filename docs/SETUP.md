# SETUP — деплой на Vercel + Neon з нуля

*Покрокова інструкція (UA). Якщо щось пішло не так — секція «Траблшутінг» внизу.*

## 1. GitHub → Vercel

1. У папці проєкту: `git init && git add -A && git commit -m "scaffold"`.
2. Створи порожній репозиторій на GitHub, `git remote add origin … && git push -u origin main`.
3. [vercel.com](https://vercel.com) → **Add New → Project** → імпортуй репо. Vercel сам бачить Next.js — нічого не міняй, **Deploy**. Перший деплой пройде і без бази (клієнт БД лінивий).

## 2. База Neon

1. У проєкті Vercel → вкладка **Storage** → Create Database → **Neon** → free plan.
2. **Connect Project**: у дропдауні Environments обери **всі три** — Production, Preview, **Development** (важливо: `vercel env pull` без прапорців тягне саме Development; якщо його не обрати — локально приїде порожньо).
   Якщо база вже підключена частково і модалка свариться «already connected» — відключи (⋯ → Disconnect project) і підключи заново з трьома середовищами, або лиши як є і тягни явно (див. крок 3, варіант Б).
3. Локальний `.env` — два способи:
   - **А (CLI):** `npx vercel link`, потім `npx vercel env pull .env` (або `npx vercel env pull .env --environment=production`, якщо Development не підключено).
   - **Б (руками, найпростіший):** [console.neon.tech](https://console.neon.tech) → твій проєкт → кнопка **Connect** → скопіюй connection string (тут він копіюється вільно, без обмежень) → встав у `.env` як `DATABASE_URL="…"`.

> **Чому Vercel «не дає скопіювати»:** змінні від Neon-інтеграції створюються з прапорцем **Sensitive** — після збереження їх значення в UI Vercel не показується взагалі, тільки замінюється зірочками. Це фіча безпеки, а не глюк. Значення все одно доступне через `vercel env pull` або в консолі Neon.

## 3. Решта змінних

Додай у Vercel (Settings → Environment Variables, для всіх середовищ) і в локальний `.env`:

```
BETTER_AUTH_SECRET=   # openssl rand -base64 32
BETTER_AUTH_URL=      # локально http://localhost:3000, на Vercel — прод-URL
ADMIN_TASK_SECRET=    # довільний секрет для запуску імпорту даних (openssl rand -hex 16)
```

## 4. Міграції і сіди

```bash
npm run db:migrate    # застосовує drizzle/-міграції до бази з DATABASE_URL
npm run db:seed       # СІДИ: 38 країн + 26 автобрендів + всі 7 ігор — грати можна одразу
npm run db:studio     # перевірити очима: мають бути topics, games, user, …
```

Сіди — рукописні дані для розробки/дизайну (працюють без Wikidata). Живий імпорт з адмінки (крок 5) просто перезапише їх реальними даними — конфлікту нема.

Міграція б'є напряму в базу — «прокидати» її на Vercel не треба: прод-функції читають ту саму Neon-базу. Правило поки база одна: міняєш схему → `npm run db:generate` → `npm run db:migrate` → пуш.

## 5. Перший імпорт даних — через адмінку

1. У `.env` (і в env на Vercel) вкажи свій email: `ADMIN_EMAILS="твій@email"`.
2. `npm run dev` → зареєструйся на `/auth` під цим email.
3. На головній з'явиться іконка щита → відкриється **`/admin`**.
4. У секції «Теми» натисни **Імпортувати** для «Країни» і «Автобренди». Кнопка покаже прогрес і звіт (скільки сутностей, покриття полів).
5. Ігри створяться автоматично з рівнями складності (по 20 айтемів на рівень, від найвідоміших до рідкісних) і одразу з'являться в каталозі на головній.

> Альтернатива для крону/CI — той самий імпорт по HTTP: `POST /api/admin/import` з хедером `x-admin-secret: $ADMIN_TASK_SECRET` і тілом `{"preset":"countries"}`.

## Траблшутінг

| Симптом | Причина → рішення |
|---|---|
| `env pull` приніс тільки `VERCEL_OIDC_TOKEN` | база не підключена до Development → пункт 2.2, або тягни `--environment=production` |
| У Vercel UI значення змінної не видно / не копіюється | прапорець Sensitive — це норм; бери значення з консолі Neon (пункт 2.3-Б) |
| `db:migrate` падає по конекту | перевір, що URL містить `sslmode=require`; якщо падає через пулер — у `drizzle.config.ts` підстав `DATABASE_URL_UNPOOLED` |
| Модалка Connect: «already connected…» | база вже прив'язана до частини середовищ → Disconnect і підключи заново на всі три |
| Auth кидає помилку секрету | не заданий `BETTER_AUTH_SECRET` (мін. 32 символи) |
| Імпорт відповідає 401 | не збігається `x-admin-secret` з env `ADMIN_TASK_SECRET` |
