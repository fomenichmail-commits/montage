# Montage × Remotion

Видео из кода: каждый кадр — это React-компонент, время — номер кадра.
Подходит для заставок, титров, анимированной инфографики и роликов по шаблону.

## Команды

```bash
cd remotion
npm install
npm run dev                                   # Remotion Studio — предпросмотр и правка в браузере
npx remotion render Title out/title.mp4       # 16:9, 1920×1080
npx remotion render TitleVertical out/v.mp4   # 9:16, 1080×1920 (Reels/Shorts)
npx remotion render Title out/my.mp4 --props='{"title":"Привет","subtitle":"Мой ролик","accent":"#ff5a5f"}'
```

При первом рендере Remotion скачает Chrome Headless Shell. Без интернета укажите свой браузер:
`--browser-executable=/путь/к/chrome`.

## Что внутри

- `src/Composition.tsx` — анимированная заставка `TitleCard` и две композиции: `Title` (16:9) и `TitleVertical` (9:16).
- `src/Root.tsx` — список всех композиций.
- `out/` — готовые видео (в git не попадают).

## Работа с Claude Code

В репозитории установлены официальные скиллы Remotion (`.claude/skills/`).
Откройте `montage` в Claude Code и пишите, например:

- `/remotion-create Сделай промо-ролик для магазина пластинок`
- `/remotion-markup Добавь анимированный титр шрифтом Inter`
- `/remotion-render`

Обновить скиллы: `npx skills update -p`.

## Лицензия Remotion

Бесплатно для частных лиц и компаний до 3 человек, дальше нужна
[компанийная лицензия](https://www.remotion.pro/license).
