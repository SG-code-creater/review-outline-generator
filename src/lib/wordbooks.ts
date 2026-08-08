// 内置词书数据：单词背诵功能内置的几本高频词书。
// 每本词书关联到某个备考场景，用户一键"加入背诵"后写入 cards 表（打 vocab 标签）。
// 词条均为精选真实词汇，含音标 / 中文释义 / 例句，可直接背诵。

export interface WordEntry {
  word: string;
  phonetic?: string;
  meaning: string;
  example: string;
}

export interface WordBook {
  key: string;
  name: string;
  scenario: string; // 关联备考场景（与 scenarios.ts 对齐，用于 UI 提示）
  desc: string;
  words: WordEntry[];
}

export const WORD_BOOKS: WordBook[] = [
  {
    key: "kaoyan",
    name: "考研核心词",
    scenario: "考研",
    desc: "考研英语高频核心词汇，侧重学术与长难句语境。",
    words: [
      { word: "abandon", phonetic: "/əˈbændən/", meaning: "v. 放弃，抛弃", example: "He had to abandon his plan due to lack of funds." },
      { word: "abstract", phonetic: "/ˈæbstrækt/", meaning: "adj. 抽象的；n. 摘要", example: "The concept is too abstract for beginners." },
      { word: "accelerate", phonetic: "/əkˈseləreɪt/", meaning: "v. 加速，促进", example: "The car accelerated to pass the truck." },
      { word: "accomplish", phonetic: "/əˈkʌmplɪʃ/", meaning: "v. 完成，实现", example: "She accomplished her goal with hard work." },
      { word: "accurate", phonetic: "/ˈækjərət/", meaning: "adj. 准确的，精确的", example: "The data must be accurate for the study." },
      { word: "acknowledge", phonetic: "/əkˈnɒlɪdʒ/", meaning: "v. 承认，确认", example: "He acknowledged his mistake openly." },
      { word: "acquire", phonetic: "/əˈkwaɪə(r)/", meaning: "v. 获得，习得", example: "Children acquire language quickly." },
      { word: "adequate", phonetic: "/ˈædɪkwət/", meaning: "adj. 足够的，恰当的", example: "We need adequate evidence to support it." },
      { word: "analyze", phonetic: "/ˈænəlaɪz/", meaning: "v. 分析，分解", example: "Scientists analyze the results carefully." },
      { word: "anticipate", phonetic: "/ænˈtɪsɪpeɪt/", meaning: "v. 预期，预料", example: "We anticipate a rise in prices." },
      { word: "apparent", phonetic: "/əˈpærənt/", meaning: "adj. 明显的，表面的", example: "It is apparent that he is lying." },
      { word: "assess", phonetic: "/əˈses/", meaning: "v. 评估，评定", example: "Teachers assess students' progress." },
      { word: "assume", phonetic: "/əˈsjuːm/", meaning: "v. 假定，承担", example: "Let's assume the theory is correct." },
      { word: "attribute", phonetic: "/əˈtrɪbjuːt/", meaning: "v. 归因于；n. 属性", example: "She attributes her success to effort." },
      { word: "advocate", phonetic: "/ˈædvəkeɪt/", meaning: "v. 提倡，主张", example: "They advocate a healthier lifestyle." },
      { word: "allocate", phonetic: "/ˈæləkeɪt/", meaning: "v. 分配，拨出", example: "The government allocated funds for education." },
      { word: "ambiguous", phonetic: "/æmˈbɪɡjuəs/", meaning: "adj. 模糊的，歧义的", example: "The instructions were ambiguous." },
      { word: "arbitrary", phonetic: "/ˈɑːbɪtrəri/", meaning: "adj. 任意的，武断的", example: "The decision seemed arbitrary." },
      { word: "accumulate", phonetic: "/əˈkjuːmjəleɪt/", meaning: "v. 积累，积聚", example: "Dust accumulated on the shelf." },
      { word: "adapt", phonetic: "/əˈdæpt/", meaning: "v. 适应，改编", example: "Plants adapt to the environment." },
      { word: "authentic", phonetic: "/ɔːˈθentɪk/", meaning: "adj. 真正的，可信的", example: "This is an authentic document." },
      { word: "coherent", phonetic: "/kəʊˈhɪərənt/", meaning: "adj. 连贯的，清晰的", example: "His argument is coherent and logical." },
      { word: "compelling", phonetic: "/kəmˈpelɪŋ/", meaning: "adj. 引人注目的，令人信服的", example: "She made a compelling case." },
      { word: "conceivable", phonetic: "/kənˈsiːvəbl/", meaning: "adj. 可想象的，可能的", example: "Every conceivable option was tried." },
    ],
  },
  {
    key: "cet4",
    name: "四级高频词",
    scenario: "通用",
    desc: "大学英语四级考试高频基础词汇，适合日常与期末巩固。",
    words: [
      { word: "ability", phonetic: "/əˈbɪləti/", meaning: "n. 能力，才能", example: "He has the ability to solve problems." },
      { word: "absence", phonetic: "/ˈæbsəns/", meaning: "n. 缺席，缺乏", example: "His absence was noticed by the teacher." },
      { word: "absorb", phonetic: "/əbˈzɔːb/", meaning: "v. 吸收，吸引", example: "The sponge absorbs water quickly." },
      { word: "academic", phonetic: "/ˌækəˈdemɪk/", meaning: "adj. 学术的，学院的", example: "She published an academic paper." },
      { word: "accept", phonetic: "/əkˈsept/", meaning: "v. 接受，同意", example: "I accept your invitation gladly." },
      { word: "access", phonetic: "/ˈækses/", meaning: "n. 通道，使用权", example: "Students have access to the library." },
      { word: "accident", phonetic: "/ˈæksɪdənt/", meaning: "n. 事故，意外", example: "A traffic accident blocked the road." },
      { word: "accompany", phonetic: "/əˈkʌmpəni/", meaning: "v. 陪伴，伴随", example: "She accompanied her friend to the hospital." },
      { word: "account", phonetic: "/əˈkaʊnt/", meaning: "n. 账户，描述", example: "Please open a bank account." },
      { word: "achieve", phonetic: "/əˈtʃiːv/", meaning: "v. 实现，达到", example: "He achieved great success." },
      { word: "active", phonetic: "/ˈæktɪv/", meaning: "adj. 积极的，活跃的", example: "She is active in class." },
      { word: "actual", phonetic: "/ˈæktʃuəl/", meaning: "adj. 实际的，真实的", example: "The actual cost was higher." },
      { word: "adapt", phonetic: "/əˈdæpt/", meaning: "v. 适应，改编", example: "He adapted to the new school." },
      { word: "adequate", phonetic: "/ˈædɪkwət/", meaning: "adj. 足够的，胜任的", example: "The food was adequate for everyone." },
      { word: "adjust", phonetic: "/əˈdʒʌst/", meaning: "v. 调整，适应", example: "Please adjust the seat." },
      { word: "administration", phonetic: "/ədˌmɪnɪˈstreɪʃn/", meaning: "n. 管理，行政", example: "The administration improved the policy." },
      { word: "adopt", phonetic: "/əˈdɒpt/", meaning: "v. 采纳，收养", example: "They adopted a new method." },
      { word: "advantage", phonetic: "/ədˈvɑːntɪdʒ/", meaning: "n. 优势，好处", example: "Practice gives you an advantage." },
      { word: "advertise", phonetic: "/ˈædvətaɪz/", meaning: "v. 广告，宣传", example: "They advertised the product online." },
      { word: "adverse", phonetic: "/ˈædvɜːs/", meaning: "adj. 不利的，相反的", example: "The weather had an adverse effect." },
      { word: "advise", phonetic: "/ədˈvaɪz/", meaning: "v. 建议，劝告", example: "I advise you to rest." },
      { word: "affect", phonetic: "/əˈfekt/", meaning: "v. 影响，感动", example: "Rain affects the harvest." },
      { word: "afford", phonetic: "/əˈfɔːd/", meaning: "v. 负担得起，提供", example: "We can't afford a new car." },
      { word: "accurate", phonetic: "/ˈækjərət/", meaning: "adj. 准确的，精确的", example: "The watch is accurate to the second." },
    ],
  },
  {
    key: "kaogong",
    name: "考公速记词",
    scenario: "考公",
    desc: "公务员考试中常见词汇，侧重政策、行政与申论语境。",
    words: [
      { word: "abolish", phonetic: "/əˈbɒlɪʃ/", meaning: "v. 废除，废止", example: "The law was abolished last year." },
      { word: "abundance", phonetic: "/əˈbʌndəns/", meaning: "n. 丰富，充裕", example: "The region has an abundance of resources." },
      { word: "accelerate", phonetic: "/əkˈseləreɪt/", meaning: "v. 加速，促进", example: "The reform accelerated economic growth." },
      { word: "accommodate", phonetic: "/əˈkɒmədeɪt/", meaning: "v. 容纳，适应", example: "The hotel can accommodate 200 guests." },
      { word: "accomplish", phonetic: "/əˈkʌmplɪʃ/", meaning: "v. 完成，达成", example: "The team accomplished the mission." },
      { word: "accordance", phonetic: "/əˈkɔːdəns/", meaning: "n. 一致，依照", example: "The plan was in accordance with the law." },
      { word: "accumulate", phonetic: "/əˈkjuːmjəleɪt/", meaning: "v. 积累，积聚", example: "He accumulated wealth over years." },
      { word: "accurate", phonetic: "/ˈækjərət/", meaning: "adj. 准确的，无误的", example: "The report must be accurate." },
      { word: "acknowledge", phonetic: "/əkˈnɒlɪdʒ/", meaning: "v. 承认，确认收到", example: "The agency acknowledged the issue." },
      { word: "acquire", phonetic: "/əˈkwaɪə(r)/", meaning: "v. 获得，取得", example: "Citizens acquire rights by law." },
      { word: "adequate", phonetic: "/ˈædɪkwət/", meaning: "adj. 足够的，适当的", example: "Adequate funding is required." },
      { word: "adhere", phonetic: "/ədˈhɪə(r)/", meaning: "v. 坚持，遵守", example: "All must adhere to the rules." },
      { word: "adjacent", phonetic: "/əˈdʒeɪsnt/", meaning: "adj. 相邻的，邻近的", example: "The two buildings are adjacent." },
      { word: "advocate", phonetic: "/ˈædvəkeɪt/", meaning: "v. 提倡，拥护", example: "Officials advocate transparency." },
      { word: "allocate", phonetic: "/ˈæləkeɪt/", meaning: "v. 分配，配给", example: "Funds were allocated to each department." },
      { word: "ambiguous", phonetic: "/æmˈbɪɡjuəs/", meaning: "adj. 模糊的，含混的", example: "The clause is ambiguous." },
      { word: "anticipate", phonetic: "/ænˈtɪsɪpeɪt/", meaning: "v. 预期，预见", example: "We anticipate changes soon." },
      { word: "apparent", phonetic: "/əˈpærənt/", meaning: "adj. 明显的，表面的", example: "The trend is apparent." },
      { word: "assess", phonetic: "/əˈses/", meaning: "v. 评估，估价", example: "Experts assess the situation." },
      { word: "attribute", phonetic: "/əˈtrɪbjuːt/", meaning: "v. 归因于；n. 特征", example: "The success is attributed to reform." },
      { word: "authorize", phonetic: "/ˈɔːθəraɪz/", meaning: "v. 授权，批准", example: "The mayor authorized the project." },
      { word: "automate", phonetic: "/ˈɔːtəmeɪt/", meaning: "v. 使自动化", example: "The process was automated." },
      { word: "coherent", phonetic: "/kəʊˈhɪərənt/", meaning: "adj. 连贯的，有条理的", example: "The policy is coherent." },
      { word: "compensate", phonetic: "/ˈkɒmpenseɪt/", meaning: "v. 补偿，赔偿", example: "The company compensated the victims." },
    ],
  },
];

export function getWordBook(key: string): WordBook | undefined {
  return WORD_BOOKS.find((b) => b.key === key);
}
