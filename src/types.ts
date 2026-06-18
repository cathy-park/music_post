export type DiaryBook = {
  id: string;
  title: string;
  subtitle: string;
  recipientName: string;
  senderName: string;
  dayCount: number;
  coverMessage: string;
  shareToken: string;
  published: boolean;
};

export type DiaryEntry = {
  id: string;
  bookId: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  comment: string;
  lyrics: string;
  audioUrl: string;
  coverTone: 'night' | 'dawn' | 'warm' | 'forest';
  order: number;
  published: boolean;
  icon?: string;
};
