/** Curated sleeping bases. Coordinates, visit times and stay ranges are planning estimates.
 * References support destination/heritage descriptions, not opening hours, fares or availability. */
export const destinationSeeds = [
  {
    "id": "suz",
    "name": "Сучжоу",
    "en": "Suzhou",
    "cn": "苏州",
    "region": "Цзянсу",
    "interest": "city",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      120.59,
      31.3
    ],
    "stay": [
      2,
      4
    ],
    "season": "Сады, каналы и традиционные кварталы; летом жарко и влажно.",
    "source": "https://whc.unesco.org/en/list/813/",
    "places": [
      {
        "id": "suz-humble",
        "name": "Сад Скромного чиновника",
        "category": "Культура",
        "point": [
          120.63,
          31.32
        ],
        "minutes": 150,
        "description": "Садовые павильоны и водоёмы."
      },
      {
        "id": "suz-lingering",
        "name": "Сад Лююань",
        "category": "Культура",
        "point": [
          120.58,
          31.32
        ],
        "minutes": 120,
        "description": "Садовые композиции и крытые галереи."
      },
      {
        "id": "suz-museum",
        "name": "Музей Сучжоу",
        "category": "Музей",
        "point": [
          120.63,
          31.32
        ],
        "minutes": 150,
        "description": "История и декоративное искусство; вариант для дождливого дня."
      },
      {
        "id": "suz-pingjiang",
        "name": "Улица Пинцзян",
        "category": "Квартал",
        "point": [
          120.64,
          31.31
        ],
        "minutes": 120,
        "description": "Прогулка вдоль канала."
      },
      {
        "id": "suz-tiger",
        "name": "Холм Тигра",
        "category": "Парк",
        "point": [
          120.58,
          31.34
        ],
        "minutes": 180,
        "description": "Парковые дорожки и историческая пагода."
      }
    ]
  },
  {
    "id": "nan",
    "name": "Нанкин",
    "en": "Nanjing",
    "cn": "南京",
    "region": "Цзянсу",
    "interest": "city",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      118.8,
      32.06
    ],
    "stay": [
      3,
      5
    ],
    "season": "История бывшей столицы, музеи и озеро; летом нужен отдых от жары.",
    "source": "https://www.gotonanjing.com/what-to-do/attractions",
    "places": [
      {
        "id": "nan-museum",
        "name": "Нанкинский музей",
        "category": "Музей",
        "point": [
          118.83,
          32.04
        ],
        "minutes": 180,
        "description": "Археология и художественные коллекции."
      },
      {
        "id": "nan-xuanwu",
        "name": "Озеро Сюаньу",
        "category": "Парк",
        "point": [
          118.8,
          32.08
        ],
        "minutes": 180,
        "description": "Прогулки по островкам и берегу."
      },
      {
        "id": "nan-confucius",
        "name": "Храм Конфуция и Циньхуай",
        "category": "Культура",
        "point": [
          118.79,
          32.02
        ],
        "minutes": 180,
        "description": "Исторические кварталы у реки."
      },
      {
        "id": "nan-wall",
        "name": "Городская стена Нанкина",
        "category": "История",
        "point": [
          118.8,
          32.08
        ],
        "minutes": 120,
        "description": "Выберите один открытый участок стены."
      },
      {
        "id": "nan-sun",
        "name": "Мавзолей Сунь Ятсена",
        "category": "История",
        "point": [
          118.85,
          32.06
        ],
        "minutes": 240,
        "description": "Отдельный выезд к лесистым холмам."
      }
    ]
  },
  {
    "id": "wux",
    "name": "Уси",
    "en": "Wuxi",
    "cn": "无锡",
    "region": "Цзянсу",
    "interest": "nature",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      120.31,
      31.49
    ],
    "stay": [
      2,
      4
    ],
    "season": "Озеро Тайху, сады и каналы; цветение зависит от конкретного сезона.",
    "source": "https://crtt.wuxi.gov.cn/doc/2024/09/24/4272307.shtml",
    "places": [
      {
        "id": "wux-turtle",
        "name": "Полуостров Юаньтоучжу",
        "category": "Природа",
        "point": [
          120.22,
          31.52
        ],
        "minutes": 240,
        "description": "Берега Тайху и парковые маршруты."
      },
      {
        "id": "wux-huishan",
        "name": "Старый город Хуэйшань",
        "category": "Культура",
        "point": [
          120.27,
          31.59
        ],
        "minutes": 180,
        "description": "Исторические дворы и прогулка у холмов."
      },
      {
        "id": "wux-lingshan",
        "name": "Комплекс Линшань",
        "category": "История",
        "point": [
          120.1,
          31.42
        ],
        "minutes": 300,
        "description": "Загородный храмовый комплекс, нужен трансфер."
      },
      {
        "id": "wux-museum",
        "name": "Музей Уси",
        "category": "Музей",
        "point": [
          120.3,
          31.55
        ],
        "minutes": 150,
        "description": "История региона и выставочные залы."
      },
      {
        "id": "wux-canal",
        "name": "Канал Цинминцяо",
        "category": "Квартал",
        "point": [
          120.32,
          31.55
        ],
        "minutes": 120,
        "description": "Вечерняя прогулка вдоль старого канала."
      }
    ]
  },
  {
    "id": "nin",
    "name": "Нинбо",
    "en": "Ningbo",
    "cn": "宁波",
    "region": "Чжэцзян",
    "interest": "city",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      121.55,
      29.87
    ],
    "stay": [
      2,
      4
    ],
    "season": "Библиотеки, старые набережные и озеро; побережье подвержено сильным дождям.",
    "source": "https://english.shanghai.gov.cn/en-144-hourtransfer-stayinShanghai/20240104/a615bdccbbc94da98bd6ca3d34afa0da.html",
    "places": [
      {
        "id": "nin-tianyi",
        "name": "Библиотека Тяньи",
        "category": "Музей",
        "point": [
          121.54,
          29.87
        ],
        "minutes": 120,
        "description": "Историческая библиотека и дворы."
      },
      {
        "id": "nin-moon",
        "name": "Парк озера Юэху",
        "category": "Парк",
        "point": [
          121.54,
          29.87
        ],
        "minutes": 120,
        "description": "Неспешные прогулки у воды."
      },
      {
        "id": "nin-dongqian",
        "name": "Озеро Дунцянь",
        "category": "Природа",
        "point": [
          121.65,
          29.78
        ],
        "minutes": 300,
        "description": "Выезд к озеру, выберите участок берега."
      },
      {
        "id": "nin-bund",
        "name": "Старая набережная Нинбо",
        "category": "Квартал",
        "point": [
          121.56,
          29.88
        ],
        "minutes": 120,
        "description": "Речные виды и городская архитектура."
      },
      {
        "id": "nin-xikou",
        "name": "Сикоу и Тэнтоу",
        "category": "Природа",
        "point": [
          121.28,
          29.69
        ],
        "minutes": 420,
        "description": "Отдельный дневной выезд из базы в Нинбо."
      }
    ]
  },
  {
    "id": "shx",
    "name": "Шаосин",
    "en": "Shaoxing",
    "cn": "绍兴",
    "region": "Чжэцзян",
    "interest": "city",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      120.58,
      30.0
    ],
    "stay": [
      2,
      3
    ],
    "season": "Каналы, литературная история и скальные озёра; дождь меняет прогулочную программу.",
    "source": "https://www.ezhejiang.gov.cn/shaoxing/2020-10/01/c_462269.htm",
    "places": [
      {
        "id": "shx-luxun",
        "name": "Квартал Лу Синя",
        "category": "Культура",
        "point": [
          120.58,
          29.99
        ],
        "minutes": 180,
        "description": "Дома и улицы, связанные с писателем."
      },
      {
        "id": "shx-shen",
        "name": "Сад Шэнь",
        "category": "Культура",
        "point": [
          120.59,
          29.99
        ],
        "minutes": 120,
        "description": "Классический сад и литературные сюжеты."
      },
      {
        "id": "shx-east",
        "name": "Восточное озеро Шаосина",
        "category": "Природа",
        "point": [
          120.64,
          30.0
        ],
        "minutes": 180,
        "description": "Скалы и водоёмы за центром города."
      },
      {
        "id": "shx-keyan",
        "name": "Ландшафтный парк Кэянь",
        "category": "Природа",
        "point": [
          120.48,
          30.04
        ],
        "minutes": 300,
        "description": "Выезд к каменным ландшафтам и воде."
      },
      {
        "id": "shx-orchid",
        "name": "Павильон орхидей Ланьтин",
        "category": "История",
        "point": [
          120.49,
          29.91
        ],
        "minutes": 180,
        "description": "Загородное место, связанное с каллиграфией."
      }
    ]
  },
  {
    "id": "fuz",
    "name": "Фучжоу",
    "en": "Fuzhou",
    "cn": "福州",
    "region": "Фуцзянь",
    "interest": "city",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      119.3,
      26.08
    ],
    "stay": [
      2,
      4
    ],
    "season": "Исторические переулки, река Минь и лесистые холмы; возможны тайфуны.",
    "source": "https://www.fjczwh.com/",
    "places": [
      {
        "id": "fuz-lanes",
        "name": "Саньфанцисян",
        "category": "Квартал",
        "point": [
          119.29,
          26.08
        ],
        "minutes": 180,
        "description": "Исторические переулки и традиционные дома."
      },
      {
        "id": "fuz-gushan",
        "name": "Гора Гушань",
        "category": "Природа",
        "point": [
          119.39,
          26.06
        ],
        "minutes": 300,
        "description": "Тропы и монастырская территория; учитывайте подъём."
      },
      {
        "id": "fuz-west",
        "name": "Западное озеро Фучжоу",
        "category": "Парк",
        "point": [
          119.29,
          26.1
        ],
        "minutes": 120,
        "description": "Городской парк у воды."
      },
      {
        "id": "fuz-fujian",
        "name": "Музей Фуцзяни",
        "category": "Музей",
        "point": [
          119.29,
          26.1
        ],
        "minutes": 180,
        "description": "История и культура провинции."
      },
      {
        "id": "fuz-ship",
        "name": "Музей судостроения Мавэй",
        "category": "Музей",
        "point": [
          119.45,
          25.99
        ],
        "minutes": 240,
        "description": "Выезд к комплексу морской промышленной истории."
      }
    ]
  },
  {
    "id": "qua",
    "name": "Цюаньчжоу",
    "en": "Quanzhou",
    "cn": "泉州",
    "region": "Фуцзянь",
    "interest": "city",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      118.68,
      24.87
    ],
    "stay": [
      2,
      4
    ],
    "season": "Морской Шёлковый путь, храмовые дворы и каменные мосты; лето влажное.",
    "source": "https://www.fujian.gov.cn/english/news/202402/t20240207_6393886.htm",
    "places": [
      {
        "id": "qua-kaiyuan",
        "name": "Храм Кайюань",
        "category": "История",
        "point": [
          118.58,
          24.91
        ],
        "minutes": 150,
        "description": "Дворы и каменные пагоды."
      },
      {
        "id": "qua-west",
        "name": "Западная улица Сицзе",
        "category": "Квартал",
        "point": [
          118.59,
          24.91
        ],
        "minutes": 120,
        "description": "Прогулка по историческому центру."
      },
      {
        "id": "qua-maritime",
        "name": "Музей морских связей",
        "category": "Музей",
        "point": [
          118.61,
          24.92
        ],
        "minutes": 180,
        "description": "История торговли и мореплавания."
      },
      {
        "id": "qua-bridge",
        "name": "Мост Лоян в Цюаньчжоу",
        "category": "История",
        "point": [
          118.67,
          24.96
        ],
        "minutes": 180,
        "description": "Выезд к историческому каменному мосту."
      },
      {
        "id": "qua-qingyuan",
        "name": "Гора Цинъюань",
        "category": "Природа",
        "point": [
          118.6,
          24.95
        ],
        "minutes": 240,
        "description": "Тропы и каменная скульптура Лаоцзы."
      }
    ]
  },
  {
    "id": "gua",
    "name": "Гуанчжоу",
    "en": "Guangzhou",
    "cn": "广州",
    "region": "Гуандун",
    "interest": "city",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      113.26,
      23.13
    ],
    "stay": [
      3,
      5
    ],
    "season": "Кантонская культура, музеи и парки; летом жарко, влажно и дождливо.",
    "source": "https://wglj.gz.gov.cn/ggfw/lyl/lydwcx/content/post_10878689.html",
    "places": [
      {
        "id": "gua-chen",
        "name": "Храм предков клана Чэнь",
        "category": "Музей",
        "point": [
          113.24,
          23.13
        ],
        "minutes": 150,
        "description": "Традиционные ремёсла и резной декор."
      },
      {
        "id": "gua-nanyue",
        "name": "Музей правителя Наньюэ",
        "category": "Музей",
        "point": [
          113.26,
          23.14
        ],
        "minutes": 180,
        "description": "Археология древнего царства."
      },
      {
        "id": "gua-baiyun",
        "name": "Гора Байюнь",
        "category": "Природа",
        "point": [
          113.3,
          23.19
        ],
        "minutes": 300,
        "description": "Парковые тропы и городские виды."
      },
      {
        "id": "gua-yuexiu",
        "name": "Парк Юэсю",
        "category": "Парк",
        "point": [
          113.27,
          23.14
        ],
        "minutes": 150,
        "description": "Холмы, озёра и городские памятники."
      },
      {
        "id": "gua-shamian",
        "name": "Остров Шамянь",
        "category": "Квартал",
        "point": [
          113.24,
          23.11
        ],
        "minutes": 120,
        "description": "Исторические улицы у Жемчужной реки."
      }
    ]
  },
  {
    "id": "she",
    "name": "Шэньчжэнь",
    "en": "Shenzhen",
    "cn": "深圳",
    "region": "Гуандун",
    "interest": "city",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      114.06,
      22.54
    ],
    "stay": [
      3,
      5
    ],
    "season": "Современный город, музеи, парки и берег; пляжные выезды требуют отдельного времени.",
    "source": "https://www.zs.gov.cn/zjj/spypaqxxgk/aqxf/xfzs/content/post_2609468.html",
    "places": [
      {
        "id": "she-bay",
        "name": "Парк залива Шэньчжэнь",
        "category": "Парк",
        "point": [
          113.98,
          22.51
        ],
        "minutes": 180,
        "description": "Городская набережная, прогулка без купания."
      },
      {
        "id": "she-museum",
        "name": "Музей Шэньчжэня",
        "category": "Музей",
        "point": [
          114.06,
          22.55
        ],
        "minutes": 180,
        "description": "История города и региона."
      },
      {
        "id": "she-lianhua",
        "name": "Парк Ляньхуашань",
        "category": "Парк",
        "point": [
          114.05,
          22.56
        ],
        "minutes": 150,
        "description": "Зелёный холм рядом с центром."
      },
      {
        "id": "she-dapeng",
        "name": "Крепость Дапэн",
        "category": "История",
        "point": [
          114.52,
          22.6
        ],
        "minutes": 300,
        "description": "Выезд в восточную часть города."
      },
      {
        "id": "she-dameisha",
        "name": "Пляж Дамэйша",
        "category": "Море",
        "point": [
          114.3,
          22.6
        ],
        "minutes": 240,
        "description": "Дневной пляжный выезд; доступность зависит от погоды."
      }
    ]
  },
  {
    "id": "zhu",
    "name": "Чжухай",
    "en": "Zhuhai",
    "cn": "珠海",
    "region": "Гуандун",
    "interest": "sea",
    "experiences": [
      "sea",
      "city",
      "nature"
    ],
    "point": [
      113.58,
      22.27
    ],
    "stay": [
      3,
      5
    ],
    "season": "Прогулки у Южно-Китайского моря и парки; при шторме морские занятия исключают.",
    "source": "https://www.eguangzhou.gov.cn/gzspecialreports/intlblocks/fun/travel/content/post_44332.html",
    "places": [
      {
        "id": "zhu-lovers",
        "name": "Дорога влюблённых",
        "category": "Море",
        "point": [
          113.59,
          22.27
        ],
        "minutes": 180,
        "description": "Прогулка вдоль городского побережья."
      },
      {
        "id": "zhu-opera",
        "name": "Оперный театр Жиюэбэй",
        "category": "Культура",
        "point": [
          113.59,
          22.29
        ],
        "minutes": 120,
        "description": "Архитектура театра и вид с набережной; спектакль отдельно."
      },
      {
        "id": "zhu-jingshan",
        "name": "Парк Цзиншань в Чжухае",
        "category": "Парк",
        "point": [
          113.58,
          22.27
        ],
        "minutes": 180,
        "description": "Зелёные склоны и обзор города."
      },
      {
        "id": "zhu-yuanming",
        "name": "Парк Юаньминсиньюань",
        "category": "Культура",
        "point": [
          113.54,
          22.24
        ],
        "minutes": 180,
        "description": "Садовые композиции и архитектурные реконструкции."
      },
      {
        "id": "zhu-qiao",
        "name": "Остров Циао",
        "category": "Природа",
        "point": [
          113.63,
          22.4
        ],
        "minutes": 300,
        "description": "Отдельный выезд к островным кварталам и зелёным зонам."
      }
    ]
  },
  {
    "id": "hai",
    "name": "Хайкоу",
    "en": "Haikou",
    "cn": "海口",
    "region": "Хайнань",
    "interest": "sea",
    "experiences": [
      "sea",
      "city",
      "nature"
    ],
    "point": [
      110.33,
      20.04
    ],
    "stay": [
      3,
      5
    ],
    "season": "Тропический берег, старые аркады и вулканический парк; сезон дождей требует гибкого плана.",
    "source": "https://en.hainan.gov.cn/englishsite/mr8/202506/ed6ec0dd0699439ebcb503732ba166cc.shtml",
    "places": [
      {
        "id": "hai-qilou",
        "name": "Аркадные улицы Цилоу",
        "category": "Квартал",
        "point": [
          110.34,
          20.05
        ],
        "minutes": 180,
        "description": "Исторические торговые улицы."
      },
      {
        "id": "hai-holiday",
        "name": "Пляж Холидей",
        "category": "Море",
        "point": [
          110.21,
          20.03
        ],
        "minutes": 240,
        "description": "Отдых на берегу; открытие пляжа и море уточняются отдельно."
      },
      {
        "id": "hai-volcano",
        "name": "Вулканический геопарк Хайкоу",
        "category": "Природа",
        "point": [
          110.21,
          19.93
        ],
        "minutes": 300,
        "description": "Выезд к вулканическим формам рельефа."
      },
      {
        "id": "hai-museum",
        "name": "Музей Хайнаня",
        "category": "Музей",
        "point": [
          110.38,
          20.0
        ],
        "minutes": 180,
        "description": "История и культура острова."
      },
      {
        "id": "hai-evergreen",
        "name": "Парк Ваньлюй",
        "category": "Парк",
        "point": [
          110.32,
          20.03
        ],
        "minutes": 150,
        "description": "Прогулка по приморскому городскому парку."
      }
    ]
  },
  {
    "id": "dal",
    "name": "Далянь",
    "en": "Dalian",
    "cn": "大连",
    "region": "Ляонин",
    "interest": "sea",
    "experiences": [
      "sea",
      "city",
      "nature"
    ],
    "point": [
      121.61,
      38.91
    ],
    "stay": [
      3,
      5
    ],
    "season": "Северное морское побережье; летом пляжи, зимой городские прогулки.",
    "source": "https://www.mct.gov.cn/wlbphone/wlbydd/xxfb/qglb/ln/202205/t20220516_932980.html",
    "places": [
      {
        "id": "dal-xinghai",
        "name": "Площадь Синхай",
        "category": "Море",
        "point": [
          121.59,
          38.88
        ],
        "minutes": 150,
        "description": "Открытое пространство у залива."
      },
      {
        "id": "dal-bang",
        "name": "Побережье Банчуйдао",
        "category": "Море",
        "point": [
          121.72,
          38.89
        ],
        "minutes": 240,
        "description": "Выезд к берегу с лесистыми холмами."
      },
      {
        "id": "dal-laohu",
        "name": "Океанический парк Лаохутань",
        "category": "Культура",
        "point": [
          121.68,
          38.87
        ],
        "minutes": 300,
        "description": "Комплекс экспозиций; программа и билеты проверяются отдельно."
      },
      {
        "id": "dal-forest",
        "name": "Лесной зоопарк Даляня",
        "category": "Парк",
        "point": [
          121.62,
          38.89
        ],
        "minutes": 300,
        "description": "Большая территория, нужен запас на перемещения."
      },
      {
        "id": "dal-binhai",
        "name": "Прогулочный участок Биньхай",
        "category": "Море",
        "point": [
          121.64,
          38.87
        ],
        "minutes": 180,
        "description": "Выберите короткий участок прибрежной дороги."
      }
    ]
  },
  {
    "id": "qhd",
    "name": "Циньхуандао",
    "en": "Qinhuangdao",
    "cn": "秦皇岛",
    "region": "Хэбэй",
    "interest": "sea",
    "experiences": [
      "sea",
      "city",
      "nature"
    ],
    "point": [
      119.6,
      39.94
    ],
    "stay": [
      3,
      5
    ],
    "season": "Северное побережье, Бэйдайхэ и Великая стена; купание сезонное.",
    "source": "https://whc.unesco.org/en/list/438/",
    "places": [
      {
        "id": "qhd-pass",
        "name": "Перевал Шаньхайгуань",
        "category": "История",
        "point": [
          119.75,
          40.01
        ],
        "minutes": 240,
        "description": "Выезд к восточному укреплению Великой стены."
      },
      {
        "id": "qhd-dragon",
        "name": "Лаолунтоу",
        "category": "История",
        "point": [
          119.8,
          39.97
        ],
        "minutes": 180,
        "description": "Участок стены на морском берегу."
      },
      {
        "id": "qhd-beidaihe",
        "name": "Берег Бэйдайхэ",
        "category": "Море",
        "point": [
          119.49,
          39.82
        ],
        "minutes": 240,
        "description": "Пляжная прогулка и отдых при подходящей погоде."
      },
      {
        "id": "qhd-dove",
        "name": "Парк Голубиное гнездо",
        "category": "Природа",
        "point": [
          119.53,
          39.83
        ],
        "minutes": 150,
        "description": "Прибрежные виды и наблюдение за птицами."
      },
      {
        "id": "qhd-harbour",
        "name": "Набережная Хайган",
        "category": "Море",
        "point": [
          119.63,
          39.92
        ],
        "minutes": 120,
        "description": "Прогулка в городском прибрежном районе."
      }
    ]
  },
  {
    "id": "yan",
    "name": "Яньтай",
    "en": "Yantai",
    "cn": "烟台",
    "region": "Шаньдун",
    "interest": "sea",
    "experiences": [
      "sea",
      "city",
      "nature"
    ],
    "point": [
      121.45,
      37.46
    ],
    "stay": [
      3,
      5
    ],
    "season": "Берег Жёлтого моря и исторические кварталы; для пляжного отдыха выбирают тёплый сезон.",
    "source": "https://whlyj.yantai.gov.cn/art/2024/8/8/art_42223_2923389.html",
    "places": [
      {
        "id": "yan-hill",
        "name": "Холм Яньтайшань",
        "category": "Парк",
        "point": [
          121.4,
          37.54
        ],
        "minutes": 180,
        "description": "Парковые дорожки и история портового города."
      },
      {
        "id": "yan-gold",
        "name": "Золотой пляж Яньтая",
        "category": "Море",
        "point": [
          121.25,
          37.57
        ],
        "minutes": 240,
        "description": "Отдых у моря зависит от ветра и сезона."
      },
      {
        "id": "yan-penglai",
        "name": "Павильон Пэнлай",
        "category": "История",
        "point": [
          120.75,
          37.83
        ],
        "minutes": 360,
        "description": "Дневной выезд из городской базы."
      },
      {
        "id": "yan-yangma",
        "name": "Остров Янма",
        "category": "Море",
        "point": [
          121.61,
          37.47
        ],
        "minutes": 300,
        "description": "Выезд к островному побережью."
      },
      {
        "id": "yan-wine",
        "name": "Музей винной культуры Чжанъюй",
        "category": "Музей",
        "point": [
          121.41,
          37.53
        ],
        "minutes": 150,
        "description": "История местного виноделия, дегустация не включена."
      }
    ]
  },
  {
    "id": "wei",
    "name": "Вэйхай",
    "en": "Weihai",
    "cn": "威海",
    "region": "Шаньдун",
    "interest": "sea",
    "experiences": [
      "sea",
      "city",
      "nature"
    ],
    "point": [
      122.12,
      37.51
    ],
    "stay": [
      3,
      5
    ],
    "season": "Бухты, островная история и морские прогулки; зимой холодно и ветрено.",
    "source": "https://www.weihai.gov.cn/art/2024/6/18/art_103324_31124.html",
    "places": [
      {
        "id": "wei-liugong",
        "name": "Остров Люгундао",
        "category": "История",
        "point": [
          122.19,
          37.5
        ],
        "minutes": 360,
        "description": "Требуется паром и отдельная проверка билетов."
      },
      {
        "id": "wei-beach",
        "name": "Международный пляж Вэйхая",
        "category": "Море",
        "point": [
          122.05,
          37.53
        ],
        "minutes": 240,
        "description": "Сезонный отдых у моря."
      },
      {
        "id": "wei-huancui",
        "name": "Парк Хуаньцуй",
        "category": "Парк",
        "point": [
          122.11,
          37.51
        ],
        "minutes": 150,
        "description": "Городские дорожки и обзорные виды."
      },
      {
        "id": "wei-coast",
        "name": "Прибрежная дорога Хуаньхай",
        "category": "Море",
        "point": [
          122.09,
          37.56
        ],
        "minutes": 180,
        "description": "Выберите участок для прогулки."
      },
      {
        "id": "wei-museum",
        "name": "Музей Вэйхая",
        "category": "Музей",
        "point": [
          122.14,
          37.45
        ],
        "minutes": 150,
        "description": "История региона, альтернатива прогулке в непогоду."
      }
    ]
  },
  {
    "id": "luo",
    "name": "Лоян",
    "en": "Luoyang",
    "cn": "洛阳",
    "region": "Хэнань",
    "interest": "city",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      112.45,
      34.62
    ],
    "stay": [
      3,
      4
    ],
    "season": "Буддийское искусство, музеи и древний центр; весенние сады требуют проверки цветения.",
    "source": "https://whc.unesco.org/en/list/1003/",
    "places": [
      {
        "id": "luo-longmen",
        "name": "Гроты Лунмэнь",
        "category": "История",
        "point": [
          112.48,
          34.56
        ],
        "minutes": 300,
        "description": "Отдельный выезд к скальным храмам."
      },
      {
        "id": "luo-horse",
        "name": "Храм Белой лошади",
        "category": "История",
        "point": [
          112.6,
          34.72
        ],
        "minutes": 240,
        "description": "Загородный храмовый комплекс."
      },
      {
        "id": "luo-museum",
        "name": "Музей Лояна",
        "category": "Музей",
        "point": [
          112.46,
          34.63
        ],
        "minutes": 180,
        "description": "Археология древних столиц."
      },
      {
        "id": "luo-old",
        "name": "Старый город Лояна",
        "category": "Квартал",
        "point": [
          112.48,
          34.68
        ],
        "minutes": 150,
        "description": "Прогулка по историческим улицам."
      },
      {
        "id": "luo-suitang",
        "name": "Сады Суй и Тан",
        "category": "Парк",
        "point": [
          112.46,
          34.63
        ],
        "minutes": 180,
        "description": "Зелёные маршруты и сезонные посадки."
      }
    ]
  },
  {
    "id": "dat",
    "name": "Датун",
    "en": "Datong",
    "cn": "大同",
    "region": "Шаньси",
    "interest": "city",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      113.3,
      40.08
    ],
    "stay": [
      2,
      4
    ],
    "season": "Скальные храмы и старый центр; зимой холодно, выезды планируют отдельно.",
    "source": "https://whc.unesco.org/en/list/1039/",
    "places": [
      {
        "id": "dat-yungang",
        "name": "Гроты Юньган",
        "category": "История",
        "point": [
          113.13,
          40.11
        ],
        "minutes": 300,
        "description": "Выезд к комплексу пещерного искусства."
      },
      {
        "id": "dat-huayan",
        "name": "Монастырь Хуаянь",
        "category": "История",
        "point": [
          113.29,
          40.09
        ],
        "minutes": 180,
        "description": "Храмовая архитектура старого города."
      },
      {
        "id": "dat-dragons",
        "name": "Стена девяти драконов",
        "category": "История",
        "point": [
          113.3,
          40.09
        ],
        "minutes": 90,
        "description": "Керамический рельеф в центре."
      },
      {
        "id": "dat-wall",
        "name": "Городская стена Датуна",
        "category": "Прогулка",
        "point": [
          113.31,
          40.09
        ],
        "minutes": 150,
        "description": "Прогулка по доступному участку."
      },
      {
        "id": "dat-hanging",
        "name": "Висячий монастырь Сюанькун",
        "category": "История",
        "point": [
          113.71,
          39.66
        ],
        "minutes": 420,
        "description": "Дальний дневной выезд; доступ зависит от условий."
      }
    ]
  },
  {
    "id": "pin",
    "name": "Пинъяо",
    "en": "Pingyao",
    "cn": "平遥",
    "region": "Шаньси",
    "interest": "city",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      112.18,
      37.19
    ],
    "stay": [
      2,
      3
    ],
    "season": "Компактный исторический город, стены и купеческие дворы; зимой холодно.",
    "source": "https://whc.unesco.org/en/list/812/",
    "places": [
      {
        "id": "pin-wall",
        "name": "Стены Пинъяо",
        "category": "История",
        "point": [
          112.18,
          37.2
        ],
        "minutes": 150,
        "description": "Прогулка по открытым участкам стены."
      },
      {
        "id": "pin-risheng",
        "name": "Банк Жишэнчан",
        "category": "Музей",
        "point": [
          112.18,
          37.2
        ],
        "minutes": 120,
        "description": "История переводных банков и купеческих домов."
      },
      {
        "id": "pin-mingqing",
        "name": "Улица Мин и Цин",
        "category": "Квартал",
        "point": [
          112.18,
          37.19
        ],
        "minutes": 120,
        "description": "Исторические торговые кварталы."
      },
      {
        "id": "pin-shuanglin",
        "name": "Храм Шуанлинь",
        "category": "История",
        "point": [
          112.13,
          37.16
        ],
        "minutes": 240,
        "description": "Выезд к храмовой скульптуре."
      },
      {
        "id": "pin-zhenguo",
        "name": "Храм Чжэньго",
        "category": "История",
        "point": [
          112.25,
          37.29
        ],
        "minutes": 240,
        "description": "Отдельная поездка к деревянной храмовой архитектуре."
      }
    ]
  },
  {
    "id": "kun",
    "name": "Куньмин",
    "en": "Kunming",
    "cn": "昆明",
    "region": "Юньнань",
    "interest": "nature",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      102.83,
      24.88
    ],
    "stay": [
      3,
      5
    ],
    "season": "Озёра и парки высокогорного плато; сезон дождей влияет на выезды.",
    "source": "https://chinakunming.travel/html/scenicattractions/index_7.html",
    "places": [
      {
        "id": "kun-green",
        "name": "Парк Цуйху",
        "category": "Парк",
        "point": [
          102.7,
          25.05
        ],
        "minutes": 150,
        "description": "Прогулка вокруг городского озера."
      },
      {
        "id": "kun-dianchi",
        "name": "Озеро Дяньчи",
        "category": "Природа",
        "point": [
          102.66,
          24.96
        ],
        "minutes": 240,
        "description": "Выберите прогулочный участок берега."
      },
      {
        "id": "kun-stone",
        "name": "Каменный лес Шилинь",
        "category": "Природа",
        "point": [
          103.33,
          24.81
        ],
        "minutes": 420,
        "description": "Дальний выезд к карстовым ландшафтам."
      },
      {
        "id": "kun-museum",
        "name": "Музей Юньнани",
        "category": "Музей",
        "point": [
          102.76,
          24.95
        ],
        "minutes": 180,
        "description": "Культура народов и история провинции."
      },
      {
        "id": "kun-gold",
        "name": "Парк Золотого храма",
        "category": "Культура",
        "point": [
          102.77,
          25.1
        ],
        "minutes": 180,
        "description": "Храмовый комплекс и парковые дорожки."
      }
    ]
  },
  {
    "id": "dli",
    "name": "Дали",
    "en": "Dali",
    "cn": "大理",
    "region": "Юньнань",
    "interest": "nature",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      100.27,
      25.61
    ],
    "stay": [
      3,
      5
    ],
    "season": "Озеро Эрхай, старые кварталы и горы Цаншань; дневные выезды разделяют.",
    "source": "https://whc.unesco.org/en/statesparties/cn/",
    "places": [
      {
        "id": "dli-old",
        "name": "Старый город Дали",
        "category": "Квартал",
        "point": [
          100.16,
          25.69
        ],
        "minutes": 180,
        "description": "Прогулки по историческим кварталам."
      },
      {
        "id": "dli-erhai",
        "name": "Берег озера Эрхай",
        "category": "Природа",
        "point": [
          100.2,
          25.73
        ],
        "minutes": 300,
        "description": "Планируйте отдельный участок большого озера."
      },
      {
        "id": "dli-pagodas",
        "name": "Три пагоды",
        "category": "История",
        "point": [
          100.15,
          25.71
        ],
        "minutes": 180,
        "description": "Храмовый комплекс у подножия гор."
      },
      {
        "id": "dli-cangshan",
        "name": "Горы Цаншань",
        "category": "Природа",
        "point": [
          100.12,
          25.68
        ],
        "minutes": 360,
        "description": "Выезд к горным тропам; высоту и канатную дорогу уточняют."
      },
      {
        "id": "dli-xizhou",
        "name": "Посёлок Сичжоу",
        "category": "Культура",
        "point": [
          100.14,
          25.85
        ],
        "minutes": 240,
        "description": "Дневной выезд к архитектуре народа бай."
      }
    ]
  },
  {
    "id": "lij",
    "name": "Лицзян",
    "en": "Lijiang",
    "cn": "丽江",
    "region": "Юньнань",
    "interest": "nature",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      100.23,
      26.87
    ],
    "stay": [
      3,
      5
    ],
    "season": "Старый город наси и горные пейзажи; большие высоты требуют бережного темпа.",
    "source": "https://whc.unesco.org/en/list/811/",
    "places": [
      {
        "id": "lij-old",
        "name": "Старый город Лицзяна",
        "category": "Квартал",
        "point": [
          100.24,
          26.87
        ],
        "minutes": 180,
        "description": "Каналы и историческая застройка."
      },
      {
        "id": "lij-black",
        "name": "Парк Чёрного дракона",
        "category": "Парк",
        "point": [
          100.24,
          26.89
        ],
        "minutes": 150,
        "description": "Водоёмы и виды на горы при ясной погоде."
      },
      {
        "id": "lij-shuhe",
        "name": "Посёлок Шухэ",
        "category": "Культура",
        "point": [
          100.21,
          26.92
        ],
        "minutes": 180,
        "description": "Прогулка по традиционным кварталам."
      },
      {
        "id": "lij-baisha",
        "name": "Посёлок Байша",
        "category": "Культура",
        "point": [
          100.22,
          26.95
        ],
        "minutes": 240,
        "description": "Выезд к местной культуре и настенной живописи."
      },
      {
        "id": "lij-jade",
        "name": "Гора Нефритового дракона",
        "category": "Природа",
        "point": [
          100.18,
          27.1
        ],
        "minutes": 420,
        "description": "Высокогорный выезд, условия и допустимая нагрузка проверяются отдельно."
      }
    ]
  },
  {
    "id": "shr",
    "name": "Шангри-Ла",
    "en": "Shangri-La",
    "cn": "香格里拉",
    "region": "Юньнань",
    "interest": "nature",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      99.7,
      27.83
    ],
    "stay": [
      3,
      4
    ],
    "season": "Высокогорные луга и тибетская культура; нужен запас на акклиматизацию и погоду.",
    "source": "https://whc.unesco.org/en/list/1083/",
    "places": [
      {
        "id": "shr-duk",
        "name": "Старый город Дукэцзун",
        "category": "Квартал",
        "point": [
          99.71,
          27.81
        ],
        "minutes": 150,
        "description": "Лёгкая прогулка по историческому центру."
      },
      {
        "id": "shr-songzan",
        "name": "Монастырь Сунцзаньлинь",
        "category": "История",
        "point": [
          99.7,
          27.86
        ],
        "minutes": 240,
        "description": "Выезд к тибетскому монастырскому комплексу."
      },
      {
        "id": "shr-pudacuo",
        "name": "Парк Пудацо",
        "category": "Природа",
        "point": [
          99.96,
          27.84
        ],
        "minutes": 420,
        "description": "Дневной выезд к озёрам и высокогорным ландшафтам."
      },
      {
        "id": "shr-napa",
        "name": "Озеро Напахай",
        "category": "Природа",
        "point": [
          99.64,
          27.9
        ],
        "minutes": 300,
        "description": "Сезонные водно-болотные ландшафты."
      },
      {
        "id": "shr-guishan",
        "name": "Холм Гуйшань",
        "category": "Парк",
        "point": [
          99.71,
          27.81
        ],
        "minutes": 120,
        "description": "Короткая прогулка с видом на город; учитывайте высоту."
      }
    ]
  },
  {
    "id": "cho",
    "name": "Чунцин",
    "en": "Chongqing",
    "cn": "重庆",
    "region": "Чунцин",
    "interest": "city",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      106.55,
      29.56
    ],
    "stay": [
      3,
      5
    ],
    "season": "Холмистый мегаполис, реки и скальные храмы; летом жарко, город требует частых пауз.",
    "source": "https://whc.unesco.org/en/list/912/",
    "places": [
      {
        "id": "cho-hongya",
        "name": "Хунъядун",
        "category": "Квартал",
        "point": [
          106.58,
          29.56
        ],
        "minutes": 150,
        "description": "Городские ярусы и вечерние виды."
      },
      {
        "id": "cho-three",
        "name": "Музей Трёх ущелий",
        "category": "Музей",
        "point": [
          106.55,
          29.56
        ],
        "minutes": 180,
        "description": "Культура региона и история Янцзы."
      },
      {
        "id": "cho-ciqikou",
        "name": "Квартал Цыцикоу",
        "category": "Квартал",
        "point": [
          106.45,
          29.58
        ],
        "minutes": 180,
        "description": "Исторические торговые улицы."
      },
      {
        "id": "cho-eling",
        "name": "Парк Элин",
        "category": "Парк",
        "point": [
          106.53,
          29.55
        ],
        "minutes": 150,
        "description": "Обзорные площадки над городом."
      },
      {
        "id": "cho-dazu",
        "name": "Скальные рельефы Дацзу",
        "category": "История",
        "point": [
          105.79,
          29.75
        ],
        "minutes": 420,
        "description": "Дальний дневной выезд; это не пешая прогулка по центру."
      }
    ]
  },
  {
    "id": "guy",
    "name": "Гуйян",
    "en": "Guiyang",
    "cn": "贵阳",
    "region": "Гуйчжоу",
    "interest": "city",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      106.63,
      26.65
    ],
    "stay": [
      2,
      4
    ],
    "season": "Парки, исторические кварталы и выезды; влажная погода требует запасных занятий.",
    "source": "https://www.eguizhou.gov.cn/guiyang/",
    "places": [
      {
        "id": "guy-jiaxiu",
        "name": "Башня Цзясю",
        "category": "История",
        "point": [
          106.72,
          26.57
        ],
        "minutes": 120,
        "description": "Городская историческая архитектура у реки."
      },
      {
        "id": "guy-qianling",
        "name": "Парк Цяньлиншань",
        "category": "Природа",
        "point": [
          106.69,
          26.6
        ],
        "minutes": 240,
        "description": "Городские холмы и лесные дорожки."
      },
      {
        "id": "guy-qingyan",
        "name": "Старый город Цинъянь",
        "category": "Культура",
        "point": [
          106.68,
          26.33
        ],
        "minutes": 300,
        "description": "Отдельный выезд к укреплённому историческому поселению."
      },
      {
        "id": "guy-museum",
        "name": "Музей Гуйчжоу",
        "category": "Музей",
        "point": [
          106.65,
          26.65
        ],
        "minutes": 180,
        "description": "История и культура провинции."
      },
      {
        "id": "guy-huaxi",
        "name": "Парк Хуаси",
        "category": "Парк",
        "point": [
          106.67,
          26.43
        ],
        "minutes": 240,
        "description": "Выезд к речным и парковым ландшафтам."
      }
    ]
  },
  {
    "id": "ans",
    "name": "Аньшунь",
    "en": "Anshun",
    "cn": "安顺",
    "region": "Гуйчжоу",
    "interest": "nature",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      105.95,
      26.25
    ],
    "stay": [
      3,
      4
    ],
    "season": "Водопады, пещеры и укреплённые деревни; ливни могут менять доступность троп.",
    "source": "https://whc.unesco.org/en/tentativelists/6380/",
    "places": [
      {
        "id": "ans-waterfall",
        "name": "Водопад Хуангошу",
        "category": "Природа",
        "point": [
          105.67,
          25.99
        ],
        "minutes": 420,
        "description": "Отдельный дневной выезд к водопадам."
      },
      {
        "id": "ans-dragon",
        "name": "Пещера Лунгун",
        "category": "Природа",
        "point": [
          105.87,
          26.1
        ],
        "minutes": 300,
        "description": "Выезд к карстовой пещерной системе; лодки зависят от условий."
      },
      {
        "id": "ans-tunbao",
        "name": "Деревня Тяньлун-Туньбао",
        "category": "Культура",
        "point": [
          106.25,
          26.33
        ],
        "minutes": 240,
        "description": "Выезд к каменной застройке и местным традициям."
      },
      {
        "id": "ans-wenmiao",
        "name": "Храм Конфуция в Аньшуне",
        "category": "История",
        "point": [
          105.93,
          26.25
        ],
        "minutes": 120,
        "description": "Историческая архитектура городской базы."
      },
      {
        "id": "ans-hongshan",
        "name": "Озеро Хуншань",
        "category": "Парк",
        "point": [
          105.94,
          26.25
        ],
        "minutes": 120,
        "description": "Лёгкая прогулка по городу между выездами."
      }
    ]
  },
  {
    "id": "les",
    "name": "Лэшань",
    "en": "Leshan",
    "cn": "乐山",
    "region": "Сычуань",
    "interest": "nature",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      103.77,
      29.55
    ],
    "stay": [
      3,
      5
    ],
    "season": "Большой Будда, реки и отдельный выезд к Эмэйшань; горы зависят от погоды.",
    "source": "https://whc.unesco.org/en/list/779/",
    "places": [
      {
        "id": "les-buddha",
        "name": "Большой Будда Лэшаня",
        "category": "История",
        "point": [
          103.77,
          29.54
        ],
        "minutes": 300,
        "description": "Скальный комплекс у слияния рек."
      },
      {
        "id": "les-emei",
        "name": "Горный парк Эмэйшань",
        "category": "Природа",
        "point": [
          103.38,
          29.58
        ],
        "minutes": 480,
        "description": "Полный дневной выезд; весь горный парк за день не охватить."
      },
      {
        "id": "les-river",
        "name": "Набережная Лэшаня",
        "category": "Прогулка",
        "point": [
          103.77,
          29.56
        ],
        "minutes": 120,
        "description": "Прогулка у рек без нового переезда базы."
      },
      {
        "id": "les-jiazhou",
        "name": "Старые улицы Цзячжоу",
        "category": "Квартал",
        "point": [
          103.76,
          29.56
        ],
        "minutes": 150,
        "description": "Городские кварталы и местная культура."
      },
      {
        "id": "les-wuyou",
        "name": "Храм Ую",
        "category": "История",
        "point": [
          103.77,
          29.53
        ],
        "minutes": 180,
        "description": "Храмовая территория рядом со скальным комплексом."
      }
    ]
  },
  {
    "id": "wuy",
    "name": "Уишань",
    "en": "Wuyishan",
    "cn": "武夷山",
    "region": "Фуцзянь",
    "interest": "nature",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      118.04,
      27.76
    ],
    "stay": [
      3,
      4
    ],
    "season": "Скальные ландшафты, чайные районы и река; прогулки и сплав зависят от осадков.",
    "source": "https://whc.unesco.org/en/list/911/",
    "places": [
      {
        "id": "wuy-tianyou",
        "name": "Пик Тянью",
        "category": "Природа",
        "point": [
          117.95,
          27.65
        ],
        "minutes": 300,
        "description": "Пеший маршрут с подъёмом."
      },
      {
        "id": "wuy-nine",
        "name": "Река Девяти изгибов",
        "category": "Природа",
        "point": [
          117.94,
          27.65
        ],
        "minutes": 240,
        "description": "Прогулка или сплав только при доступной официальной программе."
      },
      {
        "id": "wuy-tea",
        "name": "Чайный район Дахунпао",
        "category": "Природа",
        "point": [
          117.97,
          27.67
        ],
        "minutes": 240,
        "description": "Дорожки среди чайных склонов."
      },
      {
        "id": "wuy-palace",
        "name": "Дворец Уигун",
        "category": "История",
        "point": [
          117.97,
          27.64
        ],
        "minutes": 120,
        "description": "Историческая часть у входа в ландшафтный район."
      },
      {
        "id": "wuy-song",
        "name": "Улица Сунцзе",
        "category": "Культура",
        "point": [
          117.97,
          27.64
        ],
        "minutes": 120,
        "description": "Прогулка в традиционной торговой застройке."
      }
    ]
  },
  {
    "id": "jin",
    "name": "Цзинань",
    "en": "Jinan",
    "cn": "济南",
    "region": "Шаньдун",
    "interest": "city",
    "experiences": [
      "city",
      "nature"
    ],
    "point": [
      117.12,
      36.65
    ],
    "stay": [
      2,
      4
    ],
    "season": "Родники, озёра и старые улицы; летом жарко, зимой прогулки короче.",
    "source": "https://english.jinan.gov.cn/col/col108322/art/2026/art_abca361b6e22434680a807485a3b4566.html",
    "places": [
      {
        "id": "jin-baotu",
        "name": "Родник Баоту",
        "category": "Парк",
        "point": [
          117.01,
          36.66
        ],
        "minutes": 150,
        "description": "Парковые маршруты вокруг источников."
      },
      {
        "id": "jin-daming",
        "name": "Озеро Даминху",
        "category": "Природа",
        "point": [
          117.02,
          36.68
        ],
        "minutes": 180,
        "description": "Прогулка вдоль озера и садов."
      },
      {
        "id": "jin-buddha",
        "name": "Гора Тысячи Будд",
        "category": "Природа",
        "point": [
          117.04,
          36.64
        ],
        "minutes": 240,
        "description": "Подъём по парковым дорожкам."
      },
      {
        "id": "jin-wulong",
        "name": "Парк Улунтань",
        "category": "Парк",
        "point": [
          117.01,
          36.67
        ],
        "minutes": 120,
        "description": "Родники и спокойные прогулки."
      },
      {
        "id": "jin-museum",
        "name": "Музей Шаньдуна",
        "category": "Музей",
        "point": [
          117.1,
          36.66
        ],
        "minutes": 180,
        "description": "Археология и искусство провинции."
      }
    ]
  }
] as const;
export type ExpansionCityId = typeof destinationSeeds[number]["id"];
