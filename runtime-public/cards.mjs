export const cards = [
  {
    "key": "flowers",
    "title": "花开有声",
    "english": "FLOWERS SPEAK",
    "artwork": "瓶插花卉图",
    "credit": "都江堰博物馆《瓶插花卉图》",
    "image": "./assets/originals/card.webp",
    "target": "./assets/originals/target.webp",
    "targetIndex": 0,
    "scanSupported": true,
    "trackingValidated": false,
    "source": "https://zevth.work/cards.json?v=20260913-pages",
    "description": "以瓶花纹样为灵感，让纸上的花再次绽放。"
  },
  {
    "key": "peony",
    "title": "牡丹承瑞",
    "english": "PEONY IN BLOOM",
    "artwork": "瓶插牡丹图",
    "credit": "都江堰市博物馆《瓶插牡丹图》",
    "image": "./assets/originals/peony/card-named.webp",
    "target": "./assets/originals/peony/target.webp",
    "targetIndex": 1,
    "scanSupported": true,
    "trackingValidated": false,
    "source": "https://zevth.work/cards.json?v=20260913-pages",
    "description": "保留插瓶、主花与两侧花苞的关系，将石刻线条转化为清晰的花瓣与枝叶色块。"
  },
  {
    "key": "chrysanthemum",
    "title": "菊影流金",
    "english": "GOLDEN CHRYSANTHEMUM",
    "artwork": "摘枝菊花图",
    "credit": "都江堰市博物馆《摘枝菊花图》",
    "image": "./assets/originals/chrysanthemum/card-named.webp",
    "target": "./assets/originals/chrysanthemum/target.webp",
    "targetIndex": 2,
    "scanSupported": true,
    "trackingValidated": false,
    "source": "https://zevth.work/cards.json?v=20260913-pages",
    "description": "从卷曲花瓣与舒展枝叶中提取轮廓，以橙黄花色和青绿枝叶呈现菊花的流动感。"
  },
  {
    "key": "lotus",
    "title": "清荷入梦",
    "english": "LOTUS IN REVERIE",
    "artwork": "荷花图",
    "credit": "都江堰市博物馆《荷花图》",
    "image": "./assets/originals/lotus/card-named.webp",
    "target": "./assets/originals/lotus/target.webp",
    "targetIndex": 3,
    "scanSupported": true,
    "trackingValidated": false,
    "source": "https://zevth.work/cards.json?v=20260913-pages",
    "description": "保留中央荷花、两侧圆叶与下方瓶形，以月白和清蓝重新组织纹样的对称秩序。"
  },
  {
    "key": "leaves",
    "title": "花叶生辉",
    "english": "LEAVES IN RADIANCE",
    "artwork": "芙蓉花图",
    "credit": "都江堰市博物馆《芙蓉花图》",
    "image": "./assets/originals/leaves/card-named.webp",
    "target": "./assets/originals/leaves/target.webp",
    "targetIndex": 4,
    "scanSupported": true,
    "trackingValidated": false,
    "source": "https://zevth.work/cards.json?v=20260913-pages",
    "description": "提取斜向花枝、芙蓉花与五裂叶片，用兰紫花瓣和清爽绿叶延续原型的生长姿态。"
  }
];
export const cardByKey = key => cards.find(card => card.key === key);