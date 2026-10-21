// Тестовые вопросы для «Своей игры»
// Замените эти вопросы на реальные позже.
// Формат: { price, question, answer, image }
// image: null — без фото; 'images/1.1' — фото images/1.1.jpg (или .png/.jpeg/.webp).
//   Название фото: <номер категории>.<номер вопроса>, например 1.1, 1.2 … 2.1, 2.2 (последний вопрос категории — без фото).
//   Если файла нет, фото просто не показывается.
// answerImage: фото, которое показывается вместе с ответом (у ведущего — сразу, на проекторе — после «Показать ответ»).
//   Фото ищется в папке images или рядом с index.html.
// Варианты ответов пишите прямо в тексте вопроса, с новой строки (\n).

const QUESTIONS = {
  round1: [
    {
      category: "В мире юрского периода",
      questions: [
        { price: 200, question: "Кто с точки зрения современной науки является прямым потомком динозавров и их единственным выжившим видом?\n\nа) Крокодилы\nб) Птицы\nв) Ящерицы\nг) Млекопитающие", answer: "б) Птицы", image: null, answerImage: "images/1.1" },
        { price: 404, question: "Что за динозавр засветился на фотокарточке?\n\nа) Аллозавр\nб) Овираптор\nв) Карнотавр\nг) Цератозавр", answer: "в) Карнотавр", image: "images/1.2" },
        { price: 607, question: "У какого динозавра был мозг с сосиску/лайм?\n\nа) Трицератопс\nб) Анкилозавр\nв) Брахиозавр\nг) Стегозавр", answer: "г) Стегозавр", image: "images/1.3" },
        { price: 777, question: "Футболка с каким принтом стала главным мемом лета 2021 года?", answer: "Пивозавр", image: null, answerImage: "images/1.4" },
        { price: 869, question: "Если бы гадрозавр держал район, его бы кличкой было: «Самый зубастый». Сколько зубов было у гадрозавра?", answer: "Более 980 зубов — он постоянно отращивал новые взамен изношенных.", image: "images/1.5" },
        { price: 1007, question: "В середине XX века в научных кругах и музеях мира прочно укоренилось мнение, что самым крупным динозавром был Ультразавр (длиной до 30 метров). Однако позже выяснилось, что это была ошибка палеонтологов. В чем именно она заключалась?\n\nа) Это был скелет детёныша, который вырос бы ещё больше\nб) Кости оказались окаменевшими стволами деревьев\nв) Останки принадлежали сразу нескольким разным динозаврам\nг) Ультразавр оказался морской рептилией, а не динозавром", answer: "в) Останки принадлежали сразу нескольким разным динозаврам", image: null },
      ],
    },
    {
      category: "676-767 млн лет",
      questions: [
        { price: 200, question: "Вопрос 2.1 — впишите текст в questions.js", answer: "—", image: "images/2.1" },
        { price: 404, question: "Вопрос 2.2 — впишите текст в questions.js", answer: "—", image: "images/2.2" },
        { price: 607, question: "Вопрос 2.3 — впишите текст в questions.js", answer: "—", image: "images/2.3" },
        { price: 777, question: "Вопрос 2.4 — впишите текст в questions.js", answer: "—", image: "images/2.4" },
        { price: 869, question: "Вопрос 2.5 — впишите текст в questions.js", answer: "—", image: "images/2.5" },
        { price: 1007, question: "Вопрос 2.6 — впишите текст в questions.js", answer: "—", image: null },
      ],
    },
    {
      category: "ХЗ",
      questions: [
        { price: 200, question: "Вопрос 3.1 — впишите текст в questions.js", answer: "—", image: "images/3.1" },
        { price: 404, question: "Вопрос 3.2 — впишите текст в questions.js", answer: "—", image: "images/3.2" },
        { price: 607, question: "Вопрос 3.3 — впишите текст в questions.js", answer: "—", image: "images/3.3" },
        { price: 777, question: "Вопрос 3.4 — впишите текст в questions.js", answer: "—", image: "images/3.4" },
        { price: 869, question: "Вопрос 3.5 — впишите текст в questions.js", answer: "—", image: "images/3.5" },
        { price: 1007, question: "Вопрос 3.6 — впишите текст в questions.js", answer: "—", image: null },
      ],
    },
    {
      category: "Интересный факт динозаврика",
      questions: [
        { price: 200, question: "Вопрос 4.1 — впишите текст в questions.js", answer: "—", image: "images/4.1" },
        { price: 404, question: "Вопрос 4.2 — впишите текст в questions.js", answer: "—", image: "images/4.2" },
        { price: 607, question: "Вопрос 4.3 — впишите текст в questions.js", answer: "—", image: "images/4.3" },
        { price: 777, question: "Вопрос 4.4 — впишите текст в questions.js", answer: "—", image: "images/4.4" },
        { price: 869, question: "Вопрос 4.5 — впишите текст в questions.js", answer: "—", image: "images/4.5" },
        { price: 1007, question: "Вопрос 4.6 — впишите текст в questions.js", answer: "—", image: null },
      ],
    },
    {
      category: "Газозавр",
      questions: [
        { price: 200, question: "Вопрос 5.1 — впишите текст в questions.js", answer: "—", image: "images/5.1" },
        { price: 404, question: "Вопрос 5.2 — впишите текст в questions.js", answer: "—", image: "images/5.2" },
        { price: 607, question: "Вопрос 5.3 — впишите текст в questions.js", answer: "—", image: "images/5.3" },
        { price: 777, question: "Вопрос 5.4 — впишите текст в questions.js", answer: "—", image: "images/5.4" },
        { price: 869, question: "Вопрос 5.5 — впишите текст в questions.js", answer: "—", image: "images/5.5" },
        { price: 1007, question: "Вопрос 5.6 — впишите текст в questions.js", answer: "—", image: null },
      ],
    },
  ],
  round2: [
    {
      category: "Литература",
      questions: [
        { price: 200, question: "Кто написал «Войну и мир»?", answer: "Лев Толстой", image: null },
        { price: 400, question: "Назовите главного героя романа «Преступление и наказание».", answer: "Родион Раскольников", image: null },
        { price: 600, question: "Кто автор пьесы «Гамлет»?", answer: "Уильям Шекспир", image: null },
        { price: 800, question: "В каком городе происходит действие «Ромео и Джульетты»?", answer: "Верона", image: null },
        { price: 1000, question: "Кто написал поэму «Мёртвые души»?", answer: "Николай Гоголь", image: null },
      ],
    },
    {
      category: "Спорт",
      questions: [
        { price: 200, question: "Сколько игроков в футбольной команде на поле?", answer: "11", image: null },
        { price: 400, question: "В каком виде спорта используется ракетка и волан?", answer: "Бадминтон", image: null },
        { price: 600, question: "Сколько колец на олимпийском флаге?", answer: "5", image: null },
        { price: 800, question: "В каком городе пройдут Олимпийские игры 2024?", answer: "Париж", image: null },
        { price: 1000, question: "Кто выиграл больше всего медалей на Олимпиадах?", answer: "Майкл Фелпс", image: null },
      ],
    },
    {
      category: "Музыка",
      questions: [
        { price: 200, question: "Сколько струн у классической гитары?", answer: "6", image: null },
        { price: 400, question: "Кто написал «Лунную сонату»?", answer: "Людвиг ван Бетховен", image: null },
        { price: 600, question: "Какая группа исполнила «Bohemian Rhapsody»?", answer: "Queen", image: null },
        { price: 800, question: "Сколько клавиш у стандартного пианино?", answer: "88", image: null },
        { price: 1000, question: "Кто композитор оперы «Евгений Онегин»?", answer: "Пётр Чайковский", image: null },
      ],
    },
    {
      category: "Технологии",
      questions: [
        { price: 200, question: "Кто основал компанию Apple?", answer: "Стив Джобс и Стив Возняк", image: null },
        { price: 400, question: "Что означает аббревиатура HTML?", answer: "HyperText Markup Language", image: null },
        { price: 600, question: "В каком году был создан первый iPhone?", answer: "2007", image: null },
        { price: 800, question: "Кто создал язык программирования Python?", answer: "Гвидо ван Россум", image: null },
        { price: 1000, question: "Что означает аббревиатура CPU?", answer: "Central Processing Unit", image: null },
      ],
    },
    {
      category: "Природа",
      questions: [
        { price: 200, question: "Какое самое крупное наземное животное?", answer: "Африканский слон", image: null },
        { price: 400, question: "Что изучает ботаника?", answer: "Растения", image: null },
        { price: 600, question: "Какая птица не умеет летать, но быстро бегает?", answer: "Страус", image: null },
        { price: 800, question: "Какой газ выделяют растения при фотосинтезе?", answer: "Кислород", image: null },
        { price: 1000, question: "Какое животное имеет самую длинную продолжительность жизни?", answer: "Гренландская полярная акула", image: null },
      ],
    },
  ],
  round3: [
    {
      category: "Мифология",
      questions: [
        { price: 300, question: "Кто из богов в греческой мифологии владеет трезубцем?", answer: "Посейдон", image: null },
        { price: 600, question: "Какое чудовище имеет тело льва и голову человека?", answer: "Сфинкс", image: null },
        { price: 900, question: "Что происходило с теми, кто смотрел в глаза Медузе Горгоне?", answer: "Превращались в камень", image: null },
        { price: 1200, question: "Назовите бога войны в римской мифологии (греческий аналог — Арес).", answer: "Марс", image: null },
        { price: 1500, question: "Какой герой древнегреческих мифов совершил 12 подвигов?", answer: "Геракл (Геркулес)", image: null },
      ],
    },
    {
      category: "Космос",
      questions: [
        { price: 300, question: "Какая планета самая большая в Солнечной системе?", answer: "Юпитер", image: null },
        { price: 600, question: "Как называется наша галактика?", answer: "Млечный Путь", image: null },
        { price: 900, question: "Кто первым ступил на Луну?", answer: "Нил Армстронг", image: null },
        { price: 1200, question: "Что такое чёрная дыра простыми словами?", answer: "Область с такой сильной гравитацией, что её не покидает даже свет", image: null },
        { price: 1500, question: "Как называется самая яркая звезда на ночном небе?", answer: "Сириус", image: null },
      ],
    },
    {
      category: "Еда и кулинария",
      questions: [
        { price: 300, question: "Из чего делают суши?", answer: "Рис и морепродукты (рыба)", image: null },
        { price: 600, question: "Какой гриб называют царём грибов?", answer: "Белый гриб (боровик)", image: null },
        { price: 900, question: "Что такое тофу и из чего его делают?", answer: "Соевый творог из соевого молока", image: null },
        { price: 1200, question: "Какая страна считается родиной пиццы?", answer: "Италия", image: null },
        { price: 1500, question: "Что такое ферментация в кулинарии?", answer: "Процесс превращения веществ под действием микроорганизмов", image: null },
      ],
    },
    {
      category: "Языки",
      questions: [
        { price: 300, question: "Сколько официальных языков в ООН?", answer: "6 (английский, арабский, испанский, китайский, русский, французский)", image: null },
        { price: 600, question: "Какой язык самый распространённый в мире по числу носителей?", answer: "Китайский (мандаринский)", image: null },
        { price: 900, question: "Что такое эсперанто?", answer: "Искусственный международный язык, созданный Л. Заменгофом", image: null },
        { price: 1200, question: "Какой алфавит используется в русском языке?", answer: "Кириллица", image: null },
        { price: 1500, question: "Какое английское слово-палиндром означает «гражданский»?", answer: "civic", image: null },
      ],
    },
    {
      category: "Животные",
      questions: [
        { price: 300, question: "Какое животное имеет самую длинную шею?", answer: "Жираф", image: null },
        { price: 600, question: "Какой инстинкт позволяет лососю возвращаться в реку рождения?", answer: "Хоминг (инстинкт возвращения)", image: null },
        { price: 900, question: "Какое млекопитающее умеет летать?", answer: "Летучая мышь", image: null },
        { price: 1200, question: "Какое животное имеет три сердца?", answer: "Осьминог", image: null },
        { price: 1500, question: "Какое насекомое может поднять вес в 50 раз больше своего?", answer: "Муравей", image: null },
      ],
    },
  ],
  final: {
    question: "Этот учёный разработал периодическую систему химических элементов, которая стала основой современной химии. Назовите его имя.",
    answer: "Дмитрий Менделеев",
    image: null,
  },
};
