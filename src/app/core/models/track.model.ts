export interface Track {
  id: string;
  title: string;
  artist: string;
  description?: string;
  duration: number;
  category: MusicCategory;
  addedDate: Date;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  coverImage?: string;
  coverImageType?: string;
}

export enum MusicCategory {
  POP = 'pop',
  ROCK = 'rock',
  RAP = 'rap',
  JAZZ = 'jazz',
  CLASSICAL = 'classical',
  ELECTRONIC = 'electronic',
  HIPHOP = 'hiphop',
  RNB = 'rnb',
  COUNTRY = 'country',
  REGGAE = 'reggae'
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  queue: Track[];
  currentIndex: number;
}
