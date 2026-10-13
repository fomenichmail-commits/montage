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

---

# SportCardsSPB — оформление канала

Стиль ТВ-трансляции: тёмно-синий фон с лучами прожекторов, красный, золотой и синий акценты, шрифты Oswald и Inter (лежат в `public/fonts/`, лицензия OFL). Звуковые эффекты в `public/sfx/` синтезированы кодом, поэтому проблем с правами нет.

| Композиция | Что это | Длительность | Рендер |
|---|---|---|---|
| `SportCardsIntro` | Заставка: голо-карта, удар, название канала | 6 с | MP4 |
| `CardInfo` | Плашка внизу кадра: игрок, сет, параллель, номер `/50` | 5 с | MOV с прозрачностью |
| `Hit` | Вспышка «HIT!» для лучшей карты | 2.5 с | MOV с прозрачностью |
| `Stinger` | Переход-шторка: монтажная склейка под 12-м кадром | 0.8 с | MOV с прозрачностью |
| `SportCardsIntroLight` | Заставка в светлых тонах: поле, летающие голо-карты | 6 с | MP4, 4K через `--scale=2` |
| `SportCardsBackdropLight` | Светлый фон без текста, бесшовно зацикливается | 10 с | MP4, 4K через `--scale=2` |
| `EndScreen` | Финальная заставка с местами под конечные заставки YouTube | 10 с | MP4 |
| `SampleBroadcast`, `SampleLight`, `SampleEnergy` | Образцы трёх стилей монтажа на одном фрагменте | 10 с | MP4 |
| `FullLight` | Полный эпизод «Светлый премиум»: заставка, мастер, субтитры, плашки, бейджи, концовка | по `props` | MP4 |
| `Short` | Вертикальный Short 1080×1920: заголовок, кадр с картой, субтитры с подсветкой слова | по `props` | MP4 |

```bash
B=--browser-executable=/путь/к/chrome   # только если нет интернета
ALPHA="--image-format=png --pixel-format=yuva444p10le --codec=prores --prores-profile=4444"

npx remotion render SportCardsIntro out/intro.mp4
npx remotion render CardInfo out/card.mov $ALPHA \
  --props='{"player":"Lamine Yamal","details":"Topps Chrome UCL 2025/26 • Gold Refractor","serial":"/50","tag":"CARD"}'
npx remotion render Hit out/hit.mov $ALPHA --props='{"title":"HIT!","subtitle":"Автограф /25"}'
npx remotion render Stinger out/stinger.mov $ALPHA
npx remotion render EndScreen out/end.mp4
npx remotion render SportCardsIntroLight out/intro-light-4k.mp4 --scale=2 --crf=14
npx remotion render SportCardsBackdropLight out/backdrop-4k.mp4 --scale=2 --crf=14 --muted
```

Тексты меняются через `--props` или прямо в Remotion Studio (`npm run dev`).

### Полный эпизод и Shorts

`FullLight` и `Short` берут видео из `public/master.mp4` (укороченный мастер, в git не попадает) и всё остальное из `--props`:

```bash
npx remotion render FullLight out/episode.mp4 --props=props-full.json --crf=18
npx remotion render Short out/short.mp4 --props=shorts/01-beckham.json --crf=18
```

- `props-full.json`: `duration`, `cuts` (склейки), `words` (слова с таймкодами), `plates` (игроки), `badges` (редкость).
- `shorts/*.json`: `title`, `segments` (куски мастера в секундах), `words`, `plates`, `badges`, `cropX` (сдвиг кадра по горизонтали, 420 — центр).
