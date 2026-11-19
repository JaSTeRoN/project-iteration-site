import { makeRng } from "../rng.js"

export const GENRES = {
  fantasy: { label: "Фэнтези" },
  cyberpunk: { label: "Киберпанк" },
  detective: { label: "Детектив" },
}

export const TONES = {
  heroic: { label: "Героический" },
  grim: { label: "Мрачный" },
  comic: { label: "Комедийный" },
}

export const LENGTHS = {
  short: { label: "Короткая", types: ["call", "goal", "obstacle", "climax", "resolution"] },
  medium: { label: "Средняя", types: ["call", "goal", "obstacle", "helper", "falseLead", "climax", "resolution"] },
  long: { label: "Длинная", types: ["call", "goal", "obstacle", "helper", "falseLead", "twist", "climax", "resolution"] },
}

export const RELATIONSHIPS = {
  friend: { label: "Друг", line: "старый друг, который всегда рядом" },
  rival: { label: "Соперник", line: "соперник, которому нельзя доверять до конца" },
  debt: { label: "Долг", line: "тот, кому герой должен и не может отказать" },
  secret: { label: "Тайна", line: "хранитель тайны, известной только им двоим" },
}

export const NODE_LABELS = {
  call: "Завязка",
  goal: "Цель",
  obstacle: "Препятствие",
  helper: "Помощник",
  falseLead: "Ложный след",
  twist: "Поворот",
  climax: "Развязка",
  resolution: "Итог",
}

const TONE_LINES = {
  heroic: {
    call: "Так начинается легенда.",
    obstacle: "Но герой не отступает.",
    resolution: "Победа достаётся тем, кто решился.",
  },
  grim: {
    call: "Никто не выйдет из этой истории прежним.",
    obstacle: "Цена будет выше, чем кажется.",
    resolution: "Рассвет не приносит облегчения.",
  },
  comic: {
    call: "Что может пойти не так?",
    obstacle: "План разваливается красиво и с грохотом.",
    resolution: "День спасён, но сапог потерян навсегда.",
  },
}

const DATA = {
  fantasy: {
    places: ["замок на скале", "зачарованный лес", "шахты под городом"],
    objects: ["похищенный артефакт", "книга мёртвых", "ключ от врат"],
    goals: ["вернуть украденный артефакт", "снять проклятие с деревни", "закрыть врата до полуночи"],
    obstacles: ["дракон кружит над долиной", "культисты перекрыли дорогу", "туман стирает память"],
    falseLeads: ["фальшивая карта", "след, оставленный специально", "письмо без подписи"],
    climaxes: ["на мосту над пропастью", "в храме у алтаря", "в горящей библиотеке"],
    twists: ["артефакт был частью самого героя", "союзник вёл двойную игру", "проклятие держится на страхе"],
    events: ["предательство союзника", "погоня по крышам", "сделка с духом", "пожар в библиотеке"],
    title: ["Тень: {place}", "Последний {object}", "Клятва: {place}"],
    heroes: [{ name: "Орн", role: "рыцарь" }, { name: "Мира", role: "ведьма" }, { name: "Тейл", role: "следопыт" }],
    allies: [{ name: "Эйд", role: "старый маг" }, { name: "Крук", role: "говорящий ворон" }, { name: "Брон", role: "кузнец" }],
    villains: [{ name: "Ашар", role: "дракон" }, { name: "Грим", role: "барон теней" }, { name: "Шёпот", role: "культ" }],
    placesGoal: ["замок", "лес", "шахты"],
  },
  cyberpunk: {
    places: ["нижний город", "корпоративная башня", "рынок дронов"],
    objects: ["украденный чип", "прототип ИИ", "ключ-карта"],
    goals: ["вынести чип из корпорации", "найти пропавшего курьера", "остановить утечку данных"],
    obstacles: ["дроны патрулируют каждый этаж", "система распознала вторжение", "наёмники уже внизу"],
    falseLeads: ["фальшивый сервер", "подставной курьер", "сообщение от мёртвого контакта"],
    climaxes: ["в серверной, где пахнет озоном", "на крыше под прожекторами", "в лифте между этажами"],
    twists: ["заказчик и был утечкой", "ИИ проснулся раньше срока", "чип содержал не данные, а личность"],
    events: ["взлом на живую", "погоня по эстакаде", "предательство заказчика", "отключение города"],
    title: ["Сбой: {place}", "Протокол: {object}", "Ночь: {place}"],
    heroes: [{ name: "Кай", role: "хакер" }, { name: "Рика", role: "курьер" }, { name: "Ноль", role: "андроид" }],
    allies: [{ name: "Мокс", role: "механик" }, { name: "Векс", role: "фиксер" }, { name: "Ада", role: "ИИ" }],
    villains: [{ name: "Холден", role: "директор корпорации" }, { name: "Стикс", role: "наёмник" }, { name: "Глаз", role: "сетевой страж" }],
    placesGoal: ["город", "башня", "рынок"],
  },
  detective: {
    places: ["старый особняк", "портовый склад", "театр на окраине"],
    objects: ["пропавшая реликвия", "письмо без подписи", "ключ от архива"],
    goals: ["найти пропавшую реликвию", "доказать невиновность клиента", "раскрыть дело до утра"],
    obstacles: ["свидетели путаются в показаниях", "кто-то убирает улики", "дверь заперта изнутри"],
    falseLeads: ["след, подброшенный убийцей", "лжесвидетель", "записка, написанная не тем человеком"],
    climaxes: ["в комнате, где остановились часы", "на сцене перед пустым залом", "в порту под дождём"],
    twists: ["жертва сама инсценировала похищение", "улика была на виду с самого начала", "детектив был частью старой тайны"],
    events: ["вторая улика", "ложное алиби", "ночной визит", "исчезновение свидетеля"],
    title: ["Дело: {object}", "Тень: {place}", "Последний свидетель"],
    heroes: [{ name: "Марло", role: "детектив" }, { name: "Ада", role: "журналистка" }, { name: "Рей", role: "страховой агент" }],
    allies: [{ name: "Нора", role: "патологоанатом" }, { name: "Сэм", role: "полицейский" }, { name: "Тень", role: "информатор" }],
    villains: [{ name: "Кроу", role: "коллекционер" }, { name: "Мисс Вейл", role: "наследница" }, { name: "Доктор Пирс", role: "врач" }],
    placesGoal: ["особняк", "склад", "театр"],
  },
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)]
}

function fill(template, context) {
  return template.replace(/\{(\w+)\}/g, (_, key) => context[key] ?? "")
}

function cap(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

function castFor(genre, rng, overrides = {}) {
  const data = DATA[genre]
  const pickEntity = (pool, selectedName) => {
    if (selectedName) {
      const found = pool.find((item) => item.name === selectedName)
      if (found) return found
    }
    return pick(rng, pool)
  }
  return {
    hero: pickEntity(data.heroes, overrides.hero),
    ally: pickEntity(data.allies, overrides.ally),
    villain: pickEntity(data.villains, overrides.villain),
  }
}

function makeContext(genre, tone, cast, relationship, rng) {
  const data = DATA[genre]
  return {
    hero: `${cap(cast.hero.role)} ${cast.hero.name}`,
    heroName: cast.hero.name,
    heroRole: cast.hero.role,
    ally: `${cast.ally.role} ${cast.ally.name}`,
    allyName: cast.ally.name,
    villain: `${cap(cast.villain.role)} ${cast.villain.name}`,
    villainName: cast.villain.name,
    place: pick(rng, data.places),
    object: pick(rng, data.objects),
    goal: pick(rng, data.goals),
    obstacle: pick(rng, data.obstacles),
    falseLead: pick(rng, data.falseLeads),
    climax: pick(rng, data.climaxes),
    twist: pick(rng, data.twists),
    relationship: RELATIONSHIPS[relationship].line,
    tone: TONES[tone].label.toLowerCase(),
  }
}

function nodeText(type, context, tone, genre, rng, extra) {
  const templates = {
    call: [
      "Место действия — «{place}». Здесь исчезает {object}, и {hero} берётся за дело.",
      "{hero} прибывает в место, которое называют «{place}». Там остались следы: их оставил {villain}.",
      "В месте под названием «{place}» пропадает {object}. За расследование берётся {hero}.",
    ],
    goal: [
      "{hero} должен {goal} — иначе беда придёт в место под названием «{place}».",
      "Цель проста: {goal}. Но чем ближе {hero} к ответу, тем опаснее становится путь.",
      "{hero} обещает вернуть пропажу — {object} — и остановить злодея по имени {villain}. Слово дано при свидетелях.",
    ],
    obstacle: [
      "На пути встаёт {villain}: {obstacle}.",
      "{obstacle}. {villain} явно знает о каждом шаге героя.",
      "Первое препятствие оказывается серьёзнее: {obstacle}.",
    ],
    helper: [
      "На помощь приходит {ally} — {relationship}.",
      "{ally} появляется вовремя: {relationship}.",
      "Помощь рядом: {ally}. Это {relationship}, и без него не обойтись.",
    ],
    falseLead: [
      "След обрывается: {falseLead}. Но это ловушка.",
      "{hero} находит зацепку: {falseLead}. Правда оказывается ложной.",
      "В месте под названием «{place}» обнаруживается {falseLead}; кто-то очень хотел, чтобы герой поверил.",
    ],
    twist: [
      "Неожиданно выясняется: {twist}.",
      "Правда переворачивает всё: {twist}.",
      "{hero} понимает, что {twist}.",
    ],
    climax: [
      "{hero} и {villain} сходятся {climax}.",
      "Финальная встреча происходит {climax}. Отступать некуда.",
      "{climax} — здесь решается судьба {object}.",
    ],
    resolution: [
      "Возвращение: {object} снова в безопасности, а {hero} покидает «{place}».",
      "Дело закрыто. {object} снова в безопасности, а {hero} наконец может выдохнуть.",
      "История заканчивается в «{place}». Но {hero} ещё долго будет вспоминать эту ночь.",
    ],
  }
  let text = fill(pick(rng, templates[type]), context)
  if (extra) text += ` ${extra}`
  if (TONE_LINES[tone]?.[type]) text += ` ${TONE_LINES[tone][type]}`
  return text
}

function titleFor(genre, tone, context, rng) {
  const template = pick(rng, DATA[genre].title)
  const base = fill(template, { ...context, place: cap(context.place) })
  if (tone === "grim") return `${base}. Тёмная сторона`
  if (tone === "comic") return `${base}. Почти по плану`
  return base
}

export function generateStory(options = {}) {
  const genre = GENRES[options.genre] ? options.genre : "fantasy"
  const tone = TONES[options.tone] ? options.tone : "heroic"
  const length = LENGTHS[options.length] ? options.length : "medium"
  const seed = Number.isFinite(options.seed) ? options.seed : 37
  const relationship = RELATIONSHIPS[options.relationship] ? options.relationship : "friend"
  const rng = makeRng(seed)
  const cast = castFor(genre, rng, options.cast || {})
  const context = makeContext(genre, tone, cast, relationship, rng)
  const events = DATA[genre].events
  let requiredEvent = options.requiredEvent || ""
  let forbiddenEvent = options.forbiddenEvent || ""
  if (requiredEvent === forbiddenEvent) forbiddenEvent = ""
  if (requiredEvent && !events.includes(requiredEvent)) requiredEvent = ""
  if (forbiddenEvent && !events.includes(forbiddenEvent)) forbiddenEvent = ""
  const eventPool = events.filter((event) => event !== forbiddenEvent)
  const locked = options.locked || {}
  const types = LENGTHS[length].types
  const nodes = []
  const trace = []
  for (const type of types) {
    if (locked[type]?.text) {
      nodes.push({ ...locked[type], type, locked: true })
      trace.push({ rule: NODE_LABELS[type], node: type, detail: "Узел закреплён — оставлен без изменений." })
      continue
    }
    let extra = ""
    let usedEvent = ""
    if (type === "obstacle") {
      usedEvent = requiredEvent || (eventPool.length ? pick(rng, eventPool) : "")
      if (usedEvent) extra = `Событие на этом пути: ${usedEvent}.`
    }
    const text = nodeText(type, context, tone, genre, rng, extra.trim())
    nodes.push({ id: type, type, label: NODE_LABELS[type], text, locked: false })
    trace.push({
      rule: NODE_LABELS[type],
      node: type,
      detail: type === "call"
        ? `Выбран герой ${cast.hero.name} (${cast.hero.role}) и антагонист ${cast.villain.name}.`
        : type === "goal"
          ? `Цель построена вокруг объекта «${context.object}».`
          : type === "helper"
            ? `Помощник: ${cast.ally.name}; отношение — ${RELATIONSHIPS[relationship].label.toLowerCase()}.`
            : type === "falseLead"
              ? `Ложный след: ${context.falseLead}.`
              : type === "obstacle"
                ? requiredEvent
                  ? `Вставлено обязательное событие: ${requiredEvent}.`
                  : usedEvent
                    ? `Выбрано событие «${usedEvent}»${forbiddenEvent ? `; запрещённое «${forbiddenEvent}» исключено` : ""}.`
                    : "Событие не задано."
                : type === "twist"
                  ? `Поворот добавлен как дополнительный узел длинной истории: ${context.twist}.`
                  : type === "climax"
                    ? `Финал собран вокруг героя, антагониста и места «${context.climax}».`
                    : type === "resolution"
                      ? "Итог замыкает цель и возвращает объект в безопасное место."
                      : "Правило структуры применено.",
    })
  }
  return {
    seed,
    genre,
    tone,
    length,
    relationship,
    cast,
    requiredEvent,
    forbiddenEvent,
    nodes,
    trace,
    title: titleFor(genre, tone, context, rng),
    context,
    options: {
      seed,
      genre,
      tone,
      length,
      relationship,
      cast: { hero: cast.hero.name, ally: cast.ally.name, villain: cast.villain.name },
      requiredEvent,
      forbiddenEvent,
    },
  }
}

export function regenerateStory(story, overrides = {}) {
  return generateStory({
    ...story.options,
    ...overrides,
    seed: overrides.seed ?? story.seed + 1,
    locked: overrides.locked ?? {},
  })
}

export function replaceNode(story, type, seed = story.seed + 1) {
  const locked = {}
  for (const node of story.nodes) {
    if (node.type !== type) locked[node.type] = node
  }
  return generateStory({
    ...story.options,
    seed,
    locked,
  })
}

export function listEvents(genre) {
  return DATA[genre]?.events || []
}

export function castOptions(genre) {
  const data = DATA[genre] || DATA.fantasy
  return {
    heroes: data.heroes.map((item) => ({ ...item })),
    allies: data.allies.map((item) => ({ ...item })),
    villains: data.villains.map((item) => ({ ...item })),
  }
}
