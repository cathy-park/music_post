import type { DiaryBook, DiaryEntry } from './types';

export const sampleBook: DiaryBook = {
  id: 'demo-book',
  title: '우리의 작은 세계',
  subtitle: '말로 다 못한 날들을 노래로 남겼어',
  recipientName: '용민 오빠',
  senderName: '소연',
  dayCount: 100,
  coverMessage:
    '오빠와 함께한 날들을 돌아보니, 기억하고 싶은 순간마다 노래가 하나씩 생겼어. 거창한 선물보다는 그날의 마음을 그대로 남겨두고 싶었어.',
  shareToken: 'demo-100days',
  published: true,
};

export const sampleEntries: DiaryEntry[] = [
  {
    id: 'entry-stars',
    bookId: 'demo-book',
    title: '별이 많아진 밤',
    subtitle: '우리 처음 만난 날',
    dateLabel: 'DAY 1',
    comment:
      '웃기려고 꺼낸 이야기였는데, 그날 이후 오빠와 나 사이에 궁금한 게 별처럼 하나씩 켜졌어. 이 노래의 주인공은 나보다도 그날의 우리야.',
    lyrics: `[Intro]\n웃기려고 꺼낸 이야기였는데\n그 밤엔 이상하게 별이 많아졌어\n\n[Verse 1]\n낯선 역의 불빛이 조금씩 번지고\n나는 괜히 씩씩한 척 웃었어\n“덕분에 와보네요” 하고 말했을 때\n넌 그 말 하나를 조용히 받아줬지\n\n오래된 캐릭터 하나 보여줬을 뿐인데\n네 얼굴이 잠깐 멈춰 서더라\n“그거 내가 만들었는데”\n그 말이 농담인 줄 알았어\n\n[Chorus]\nMaybe it’s you\nI think I know\n별이 많아진 밤이었어\n자꾸 생각이 나\n\nMaybe it’s true\nI feel it slow\n웃고 넘긴 순간들이\n이상하게 선명해\n\n설명은 못 해도\n편안했던 건 진짜였고\n하나씩 켜진 궁금함이\n마음에 번져가\n\n[Outro]\n웃기려고 꺼낸 이야기였는데\n너는 아직도 내 안에 남아있어\n\n이상하지\n그날 이후로\n내 밤엔 별이 조금 많아졌어`,
    audioUrl: '',
    coverTone: 'night',
    order: 1,
    published: true,
  },
  {
    id: 'entry-rest',
    bookId: 'demo-book',
    title: '쉬어갈 세계',
    subtitle: '오빠가 스스로에게 지치고 실망했던 밤',
    dateLabel: 'DAY 20',
    comment:
      '상황이 힘든 것과 오빠라는 사람은 같은 게 아니라고 말해주고 싶었어. 다른 사람들의 세계를 만드는 오빠도 어딘가에서는 잠깐 쉬었으면 했어.',
    lyrics: `[Verse 1]\n기다리는 일은 괜찮았어\n네 하루가 얼마나 빠른지 아니까\n다만 아무 말 없는 시간 속에서\n혼자 이유를 만들기 싫었어\n\n[Pre-Chorus]\n그래서 오늘은 말하고 싶었어\n우리 사이가 멀어지기 전에\n조금 늦어도 괜찮으니\n네 하루를 조금만 들려달라고\n\n[Chorus]\nCome as you are\nYou don’t have to hide\n\n나는 네가 완벽하지 않아도 돼\n잘해주는 모습만 보고 싶은 게 아냐\n지치고 흔들리고 말이 없어진\n가장 솔직한 네가 궁금해\n\n아직 오지 않은 불안한 내일로\n오늘의 우리를 먼저 지우고 싶진 않아\n\nI’m still here\nBy my own choice\n\n누가 정해준 마음이 아니라\n내가 원해서 여기 있는 거야\n\n[Final Chorus]\nCome as you are\nYou can rest for a while\n\n나는 네가 완벽하지 않아도 돼\n나에게 늘 잘하려 애쓰지 않아도 돼\n다만 말없이 서로 멀어지지 않게\n가끔 네 하루를 들려주면 돼\n\n네가 만든 수많은 세계들 사이\n나와 있을 땐 잠시 쉬어가도 돼\n\n[Outro]\nYou can rest here\nJust for tonight\n\n하루의 끝에 네 목소리를 듣고\n서운했던 마음은 조용히 풀렸어\n잘 자, 오늘도 고생 많았어`,
    audioUrl: '',
    coverTone: 'warm',
    order: 2,
    published: true,
  },
];
