import { Injectable, signal, computed, effect, untracked } from '@angular/core';
import { Track, PlayerState, PlayerStatus } from '../models/track.model';

@Injectable({
  providedIn: 'root'
})
export class AudioPlayerService {
  private audioElement: HTMLAudioElement;

  // Signals pour l'état du lecteur
  private currentTrackSignal = signal<Track | null>(null);
  private statusSignal = signal<PlayerStatus>('stopped');
  private currentTimeSignal = signal<number>(0);
  private volumeSignal = signal<number>(0.7);
  private isMutedSignal = signal<boolean>(false);
  private queueSignal = signal<Track[]>([]);
  private currentIndexSignal = signal<number>(-1);
  private isShuffledSignal = signal<boolean>(false);
  private isRepeatingSignal = signal<boolean>(false);
  private originalQueueSignal = signal<Track[]>([]);
  private errorSignal = signal<string>('');
  private isLoadingSignal = signal<boolean>(false);

  // Computed signals
  readonly currentTrack = computed(() => this.currentTrackSignal());
  readonly status = computed(() => this.statusSignal());
  readonly currentTime = computed(() => this.currentTimeSignal());
  readonly volume = computed(() => this.volumeSignal());
  readonly isMuted = computed(() => this.isMutedSignal());
  readonly queue = computed(() => this.queueSignal());
  readonly currentIndex = computed(() => this.currentIndexSignal()); // AJOUTEZ CETTE LIGNE
  readonly originalQueue = computed(() => this.originalQueueSignal());
  readonly isShuffled = computed(() => this.isShuffledSignal());
  readonly isRepeating = computed(() => this.isRepeatingSignal());
  readonly error = computed(() => this.errorSignal());
  readonly isLoading = computed(() => this.isLoadingSignal());

  readonly duration = computed(() => this.audioElement?.duration || 0);
  readonly progress = computed(() => {
    const duration = this.duration();
    return duration > 0 ? (this.currentTimeSignal() / duration) * 100 : 0;
  });

  readonly hasNext = computed(() => {
    if (this.isRepeatingSignal()) return true;
    return this.currentIndexSignal() < this.queueSignal().length - 1;
  });

  readonly hasPrevious = computed(() => {
    return this.currentIndexSignal() > 0 || this.currentTimeSignal() > 3;
  });

  readonly queueInfo = computed(() => ({
    current: this.currentIndexSignal() + 1,
    total: this.queueSignal().length,
    duration: this.queueSignal().reduce((sum, track) => sum + track.duration, 0)
  }));

  constructor() {
    this.audioElement = new Audio();
    this.setupAudioListeners();
    this.setupEffects();

    // Restaurer le volume depuis localStorage
    const savedVolume = localStorage.getItem('music-stream-volume');
    if (savedVolume) {
      this.volumeSignal.set(parseFloat(savedVolume));
    }
  }

  // ============ SETUP ============

  private setupAudioListeners(): void {
    this.audioElement.addEventListener('timeupdate', () => {
      this.currentTimeSignal.set(this.audioElement.currentTime);
    });

    this.audioElement.addEventListener('playing', () => {
      this.statusSignal.set('playing');
      this.isLoadingSignal.set(false);
    });

    this.audioElement.addEventListener('pause', () => {
      this.statusSignal.set('paused');
    });

    this.audioElement.addEventListener('waiting', () => {
      this.statusSignal.set('buffering');
      this.isLoadingSignal.set(true);
    });

    this.audioElement.addEventListener('ended', () => {
      this.handleTrackEnd();
    });

    this.audioElement.addEventListener('error', (event) => {
      console.error('Audio error:', event);
      this.errorSignal.set('Erreur de lecture audio');
      this.statusSignal.set('stopped');
      this.isLoadingSignal.set(false);
    });

    this.audioElement.addEventListener('canplay', () => {
      this.isLoadingSignal.set(false);
    });

    this.audioElement.addEventListener('loadstart', () => {
      this.isLoadingSignal.set(true);
    });
  }

  private setupEffects(): void {
    // Synchroniser le volume
    effect(() => {
      this.audioElement.volume = this.volumeSignal();
      localStorage.setItem('music-stream-volume', this.volumeSignal().toString());
    });

    // Synchroniser le mute
    effect(() => {
      this.audioElement.muted = this.isMutedSignal();
    });

    // Sauvegarder l'état dans localStorage
    effect(() => {
      const state: Partial<PlayerState> = {
        currentTrack: this.currentTrackSignal(),
        status: this.statusSignal(),
        volume: this.volumeSignal(),
        isMuted: this.isMutedSignal(),
        isShuffled: this.isShuffledSignal(),
        isRepeating: this.isRepeatingSignal(),
        queue: this.queueSignal(),
        currentIndex: this.currentIndexSignal()
      };

      localStorage.setItem('music-stream-player-state', JSON.stringify(state));
    });
  }

  // ============ PLAYBACK CONTROLS ============

  async play(track?: Track): Promise<void> {
    try {
      if (track) {
        await this.loadTrack(track);
      }

      if (this.currentTrackSignal()) {
        await this.audioElement.play();
        this.statusSignal.set('playing');
      }
    } catch (error) {
      console.error('Play error:', error);
      this.errorSignal.set('Impossible de lire la piste');
      this.statusSignal.set('stopped');
    }
  }

  pause(): void {
    this.audioElement.pause();
    this.statusSignal.set('paused');
  }

  togglePlay(): void {
    if (this.statusSignal() === 'playing') {
      this.pause();
    } else {
      this.play();
    }
  }

  stop(): void {
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.statusSignal.set('stopped');
    this.currentTimeSignal.set(0);
  }

  next(): void {
    const currentIndex = this.currentIndexSignal();
    const queue = this.queueSignal();

    if (currentIndex < queue.length - 1) {
      const nextTrack = queue[currentIndex + 1];
      this.loadTrack(nextTrack);
      this.currentIndexSignal.set(currentIndex + 1);
      this.play();
    } else if (this.isRepeatingSignal()) {
      // Recommencer depuis le début
      this.loadTrack(queue[0]);
      this.currentIndexSignal.set(0);
      this.play();
    }
  }

  previous(): void {
    const currentIndex = this.currentIndexSignal();
    const queue = this.queueSignal();
    const currentTime = this.currentTimeSignal();

    // Si on est au début de la piste, aller à la précédente
    if (currentTime > 3) {
      this.seek(0);
    } else if (currentIndex > 0) {
      const prevTrack = queue[currentIndex - 1];
      this.loadTrack(prevTrack);
      this.currentIndexSignal.set(currentIndex - 1);
      this.play();
    }
  }

  seek(time: number): void {
    if (this.audioElement.duration) {
      const safeTime = Math.max(0, Math.min(time, this.duration()));
      this.audioElement.currentTime = safeTime;
      this.currentTimeSignal.set(safeTime);
    }
  }

  seekPercentage(percentage: number): void {
    const time = (percentage / 100) * this.duration();
    this.seek(time);
  }

  // ============ VOLUME CONTROLS ============

  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.volumeSignal.set(clampedVolume);
  }

  toggleMute(): void {
    this.isMutedSignal.set(!this.isMutedSignal());
  }

  increaseVolume(amount: number = 0.1): void {
    const newVolume = Math.min(1, this.volumeSignal() + amount);
    this.volumeSignal.set(newVolume);
  }

  decreaseVolume(amount: number = 0.1): void {
    const newVolume = Math.max(0, this.volumeSignal() - amount);
    this.volumeSignal.set(newVolume);
  }

  // ============ QUEUE MANAGEMENT ============

  setQueue(tracks: Track[], startIndex: number = 0): void {
    this.originalQueueSignal.set([...tracks]);

    if (this.isShuffledSignal()) {
      this.shuffleQueue(tracks);
    } else {
      this.queueSignal.set([...tracks]);
    }

    if (tracks.length > 0 && startIndex < tracks.length) {
      const track = tracks[startIndex];
      this.loadTrack(track);
      this.currentIndexSignal.set(startIndex);
    }
  }

  addToQueue(track: Track, playNext: boolean = false): void {
    const currentQueue = this.queueSignal();
    const currentIndex = this.currentIndexSignal();

    if (playNext) {
      // Ajouter après la piste actuelle
      const newQueue = [
        ...currentQueue.slice(0, currentIndex + 1),
        track,
        ...currentQueue.slice(currentIndex + 1)
      ];
      this.queueSignal.set(newQueue);
    } else {
      // Ajouter à la fin
      this.queueSignal.update(queue => [...queue, track]);
    }

    // Mettre à jour aussi l'original queue
    this.originalQueueSignal.update(queue => [...queue, track]);
  }

  removeFromQueue(index: number): void {
    if (index >= 0 && index < this.queueSignal().length) {
      const newQueue = this.queueSignal().filter((_, i) => i !== index);
      this.queueSignal.set(newQueue);

      // Ajuster l'index courant si nécessaire
      if (index <= this.currentIndexSignal()) {
        this.currentIndexSignal.update(i => Math.max(0, i - 1));
      }
    }
  }

  clearQueue(): void {
    this.queueSignal.set([]);
    this.originalQueueSignal.set([]);
    this.stop();
    this.currentTrackSignal.set(null);
    this.currentIndexSignal.set(-1);
  }

  // ============ SHUFFLE & REPEAT ============

  toggleShuffle(): void {
    const willShuffle = !this.isShuffledSignal();
    this.isShuffledSignal.set(willShuffle);

    if (willShuffle) {
      this.shuffleQueue(this.queueSignal());
    } else {
      // Restaurer l'ordre original
      this.queueSignal.set([...this.originalQueueSignal()]);

      // Trouver l'index de la piste actuelle dans la queue restaurée
      const currentTrack = this.currentTrackSignal();
      if (currentTrack) {
        const index = this.originalQueueSignal().findIndex(t => t.id === currentTrack.id);
        if (index !== -1) {
          this.currentIndexSignal.set(index);
        }
      }
    }
  }

  toggleRepeat(): void {
    this.isRepeatingSignal.set(!this.isRepeatingSignal());
  }

  private shuffleQueue(tracks: Track[]): void {
    const shuffled = [...tracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    this.queueSignal.set(shuffled);

    // Mettre à jour l'index courant après le shuffle
    const currentTrack = this.currentTrackSignal();
    if (currentTrack) {
      const index = shuffled.findIndex(t => t.id === currentTrack.id);
      if (index !== -1) {
        this.currentIndexSignal.set(index);
      }
    }
  }

  // ============ TRACK LOADING ============

  private async loadTrack(track: Track): Promise<void> {
    this.statusSignal.set('loading');
    this.errorSignal.set('');
    this.isLoadingSignal.set(true);

    try {
      this.currentTrackSignal.set(track);
      this.audioElement.src = track.fileUrl;
      this.audioElement.load();

      // Mettre à jour l'index si dans la file d'attente
      const queue = this.queueSignal();
      const index = queue.findIndex(t => t.id === track.id);
      if (index !== -1) {
        this.currentIndexSignal.set(index);
      }

      // Attendre que l'audio soit prêt
      await new Promise<void>((resolve, reject) => {
        const onCanPlay = () => {
          this.audioElement.removeEventListener('canplay', onCanPlay);
          this.audioElement.removeEventListener('error', onError);
          resolve();
        };

        const onError = (event: Event) => {
          this.audioElement.removeEventListener('canplay', onCanPlay);
          this.audioElement.removeEventListener('error', onError);
          reject(event);
        };

        this.audioElement.addEventListener('canplay', onCanPlay);
        this.audioElement.addEventListener('error', onError);

        // Timeout de sécurité
        setTimeout(() => {
          this.audioElement.removeEventListener('canplay', onCanPlay);
          this.audioElement.removeEventListener('error', onError);
          resolve();
        }, 10000);
      });

    } catch (error) {
      console.error('Load track error:', error);
      this.errorSignal.set('Impossible de charger la piste');
      this.statusSignal.set('stopped');
      throw error;
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  // ============ EVENT HANDLERS ============

  private handleTrackEnd(): void {
    if (this.isRepeatingSignal()) {
      // Répéter la piste actuelle
      this.seek(0);
      this.play();
    } else if (this.hasNext()) {
      // Passer à la piste suivante
      this.next();
    } else {
      // Arrêter
      this.stop();
    }
  }

  // ============ UTILITIES ============

  getCurrentTimeFormatted(): string {
    return this.formatTime(this.currentTimeSignal());
  }

  getDurationFormatted(): string {
    return this.formatTime(this.duration());
  }

  getRemainingTimeFormatted(): string {
    const remaining = this.duration() - this.currentTimeSignal();
    return `-${this.formatTime(remaining)}`;
  }

  private formatTime(seconds: number): string {
    if (!seconds || seconds <= 0) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // ============ STATE MANAGEMENT ============

  saveState(): void {
    const state: Partial<PlayerState> = {
      currentTrack: this.currentTrackSignal(),
      status: this.statusSignal(),
      currentTime: this.currentTimeSignal(),
      volume: this.volumeSignal(),
      isMuted: this.isMutedSignal(),
      isShuffled: this.isShuffledSignal(),
      isRepeating: this.isRepeatingSignal(),
      queue: this.queueSignal(),
      currentIndex: this.currentIndexSignal()
    };

    localStorage.setItem('music-stream-player-state', JSON.stringify(state));
  }

  restoreState(): void {
    try {
      const saved = localStorage.getItem('music-stream-player-state');
      if (saved) {
        const state: Partial<PlayerState> = JSON.parse(saved);

        if (state.volume !== undefined) this.volumeSignal.set(state.volume);
        if (state.isMuted !== undefined) this.isMutedSignal.set(state.isMuted);
        if (state.isShuffled !== undefined) this.isShuffledSignal.set(state.isShuffled);
        if (state.isRepeating !== undefined) this.isRepeatingSignal.set(state.isRepeating);
        if (state.queue) this.queueSignal.set(state.queue);
        if (state.currentIndex !== undefined) this.currentIndexSignal.set(state.currentIndex);

        if (state.currentTrack && state.queue && state.currentIndex !== undefined) {
          this.loadTrack(state.currentTrack);
          if (state.status === 'playing') {
            this.play();
          }
          if (state.currentTime) {
            this.seek(state.currentTime);
          }
        }
      }
    } catch (error) {
      console.error('Error restoring player state:', error);
    }
  }

  // ============ PLAYBACK RATE ============

  setPlaybackRate(rate: number): void {
    this.audioElement.playbackRate = Math.max(0.5, Math.min(4, rate));
  }

  resetPlaybackRate(): void {
    this.audioElement.playbackRate = 1.0;
  }

  // ============ QUALITY & BUFFERING ============

  getBuffered(): { start: number; end: number }[] {
    const buffered = this.audioElement.buffered;
    const result: { start: number; end: number }[] = [];

    for (let i = 0; i < buffered.length; i++) {
      result.push({
        start: buffered.start(i),
        end: buffered.end(i)
      });
    }

    return result;
  }

  getBufferPercentage(): number {
    const duration = this.duration();
    if (duration <= 0) return 0;

    const buffered = this.getBuffered();
    const totalBuffered = buffered.reduce((sum, range) => sum + (range.end - range.start), 0);

    return (totalBuffered / duration) * 100;
  }
}
