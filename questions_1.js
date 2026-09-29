// Тестовые вопросы для «Своей игры»
// Замените эти вопросы на реальные позже.
// Формат: { price, question, answer, image (null или URL) }

const QUESTIONS = {
  round1: [
    {
      category: "Динозавры",
      questions: [
        { price: 100, question: "Какой динозавр имел три рога на голове?", answer: "Трицератопс", image: null },
        { price: 200, question: "Как назывался период, в который жили динозавры?", answer: "Мезозойская эра", image: null },
        { price: 300, question: "Какой динозавр считался самым крупным хищником?", answer: "Тираннозавр рекс", image: null },
        { price: 400, question: "Что означает слово «динозавр» в переводе с греческого?", answer: "Ужасный ящер", image: null },
        { price: 500, question: "Какой динозавр имел длинную шею и был одним из крупнейших?", answer: "Диплодок", image: null },
      ],
    },
    {
      category: "История",
      questions: [
        { price: 100, question: "В каком году началась Великая Отечественная война?", answer: "1941", image: null },
        { price: 200, question: "Кто был первым человеком в космосе?", answer: "Юрий Гагарин", image: null },
        { price: 300, question: "Какой город был столицей Древнего Рима?", answer: "Рим", image: null },
        { price: 400, question: "Кто построил Великую Китайскую стену?", answer: "Китайские императоры (династия Цинь)", image: null },
        { price: 500, question: "В каком году распался СССР?", answer: "1991", image: null },
      ],
    },
    {
      category: "Кино",
      questions: [
        { price: 100, question: "Назовите режиссёра фильма «Титаник».", answer: "Джеймс Кэмерон", image: null },
        { price: 200, question: "Какой фильм получил больше всего «Оскаров»?", answer: "Бен-Гур / Титаник / Властелин колец (по 11)", image: null },
        { price: 300, question: "Кто сыграл Джокера в «Тёмном рыцаре»?", answer: "Хит Леджер", image: null },
        { price: 400, question: "В каком году вышел первый «Звёздные войны»?", answer: "1977", image: null },
        { price: 500, question: "Назовите самый кассовый фильм всех времён (на 2023 год).", answer: "Аватар", image: null },
      ],
    },
    {
      category: "Наука",
      questions: [
        { price: 100, question: "Сколько планет в Солнечной системе?", answer: "8", image: null },
        { price: 200, question: "Какой химический элемент обозначается символом O?", answer: "Кислород", image: null },
        { price: 300, question: "Кто сформулировал теорию относительности?", answer: "Альберт Эйнштейн", image: null },
        { price: 400, question: "Какая частица переносит электрический заряд в металлах?", answer: "Электрон", image: null },
        { price: 500, question: "Чему равна скорость света в вакууме (приблизительно)?", answer: "300 000 км/с", image: null },
      ],
    },
    {
      category: "География",
      questions: [
        { price: 100, question: "Какая самая длинная река в мире?", answer: "Нил (или Амазонка)", image: null },
        { price: 200, question: "Столица Австралии?", answer: "Канберра", image: null },
        { price: 300, question: "В какой стране находится гора Эверест?", answer: "Непал (и Китай)", image: null },
        { price: 400, question: "Какое самое глубокое озеро в мире?", answer: "Байкал", image: null },
        { price: 500, question: "Какая пустыня самая большая в мире?", answer: "Сахара (холодная: Антарктида)", image: null },
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
