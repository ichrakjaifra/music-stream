export interface Track {
  id: string;
  title: string;
  artist: string;
  description?: string;
  duration: number; // en secondes
  category: MusicCategory;
  addedDate: Date;
  fileUrl: string; // DataURL ou Blob URL
  fileSize: number; // en bytes
  fileType: string;
  coverImage?: string; // DataURL de l'image
  coverColor?: string; // Couleur dominante pour le design
  plays: number; // Nombre de lectures
  likes: number; // Nombre de likes
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
  REGGAE = 'reggae',
  METAL = 'metal',
  BLUES = 'blues',
  FOLK = 'folk'
}

export interface PlayerState {
  currentTrack: Track | null;
  status: PlayerStatus;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  isRepeating: boolean;
  queue: Track[];
  currentIndex: number;
  playlist?: Playlist;
}

export type PlayerStatus = 'playing' | 'paused' | 'buffering' | 'stopped' | 'loading';

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  tracks: Track[];
  coverImage?: string;
  createdDate: Date;
  isPublic: boolean;
}

export interface User {
  id: string;
  username: string;
  avatar?: string;
  favoriteTracks: string[];
  playlists: Playlist[];
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: Date;
}
