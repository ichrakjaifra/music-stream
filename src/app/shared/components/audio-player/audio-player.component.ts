import { Component, OnInit, OnDestroy, signal, computed, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DurationPipe } from '../../pipes/duration.pipe';
import { FileSizePipe } from '../../pipes/file-size.pipe';
import { TitleCasePipe } from '../../pipes/titlecase.pipe';
import { AudioPlayerService } from '../../../core/services/audio-player.service';
import { TrackService } from '../../../core/services/track.service';

@Component({
  selector: 'app-audio-player',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DurationPipe,
    FileSizePipe,
    TitleCasePipe
  ],
  templateUrl: './audio-player.component.html',
  styleUrls: ['./audio-player.component.css']
})
export class AudioPlayerComponent implements OnInit, OnDestroy {
  // État local
  showVolumeSlider = signal(false);
  showQueue = signal(false);
  isSeeking = signal(false);
  seekPreviewTime = signal<number | null>(null);

  // État depuis le service
  currentTrack = computed(() => this.playerService.currentTrack());
  isPlaying = computed(() => this.playerService.status() === 'playing');
  isLoading = computed(() => this.playerService.isLoading());
  currentTime = computed(() => this.playerService.currentTime());
  volume = computed(() => this.playerService.volume());
  isMuted = computed(() => this.playerService.isMuted());
  isShuffled = computed(() => this.playerService.isShuffled());
  isRepeating = computed(() => this.playerService.isRepeating());
  progress = computed(() => this.playerService.progress());
  duration = computed(() => this.playerService.duration());
  hasNext = computed(() => this.playerService.hasNext());
  hasPrevious = computed(() => this.playerService.hasPrevious());
  queue = computed(() => this.playerService.queue());
  currentIndex = computed(() => this.playerService.currentIndex());
  queueInfo = computed(() => this.playerService.queueInfo());

  // Formattage
  currentTimeFormatted = computed(() => this.playerService.getCurrentTimeFormatted());
  durationFormatted = computed(() => this.playerService.getDurationFormatted());
  remainingTimeFormatted = computed(() => this.playerService.getRemainingTimeFormatted());

  // Computed signals pour les valeurs sécurisées
  currentCategory = computed(() => this.currentTrack()?.category || '');
  currentFileSize = computed(() => this.currentTrack()?.fileSize || 0);
  currentDuration = computed(() => this.currentTrack()?.duration || 0);
  currentLikes = computed(() => this.currentTrack()?.likes || 0);
  currentPlays = computed(() => this.currentTrack()?.plays || 0);
  currentTitle = computed(() => this.currentTrack()?.title || '');
  currentArtist = computed(() => this.currentTrack()?.artist || '');
  currentCoverImage = computed(() => this.currentTrack()?.coverImage || 'assets/images/default-cover.png');

  constructor(
    public playerService: AudioPlayerService,
    private trackService: TrackService
  ) {
    // Restaurer l'état au démarrage
    effect(() => {
      if (this.currentTrack()) {
        this.playerService.saveState();
      }
    });
  }

  ngOnInit(): void {
    this.playerService.restoreState();

    // Pour les erreurs
    effect(() => {
      const error = this.playerService.error();
      if (error) {
        console.error('Player error:', error);
      }
    });

    // Pour les changements de piste
    effect(() => {
      const track = this.playerService.currentTrack();
      if (track) {
        this.trackService.playTrack(track.id).catch(error => {
          console.error('Error incrementing plays:', error);
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.playerService.saveState();
  }

  // ============ PLAYBACK CONTROLS ============

  togglePlay(): void {
    if (this.isPlaying()) {
      this.playerService.pause();
    } else {
      this.playerService.play();
    }
  }

  previous(): void {
    this.playerService.previous();
  }

  next(): void {
    this.playerService.next();
  }

  toggleShuffle(): void {
    this.playerService.toggleShuffle();
  }

  toggleRepeat(): void {
    this.playerService.toggleRepeat();
  }

  // ============ VOLUME CONTROLS ============

  toggleMute(): void {
    this.playerService.toggleMute();
  }

  onVolumeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const volume = parseFloat(input.value);
    this.playerService.setVolume(volume);
  }

  increaseVolume(): void {
    this.playerService.increaseVolume();
  }

  decreaseVolume(): void {
    this.playerService.decreaseVolume();
  }

  toggleVolumeSlider(): void {
    this.showVolumeSlider.update(show => !show);
  }

  // ============ SEEKING CONTROLS ============

  onSeekStart(event: MouseEvent): void {
    this.isSeeking.set(true);
    this.updateSeekPreview(event);
  }

  onSeeking(event: MouseEvent): void {
    if (this.isSeeking()) {
      this.updateSeekPreview(event);
    }
  }

  onSeekEnd(event: MouseEvent): void {
    if (this.isSeeking()) {
      this.isSeeking.set(false);
      this.seekToPosition(event);
      this.seekPreviewTime.set(null);
    }
  }

  private updateSeekPreview(event: MouseEvent): void {
    const progressBar = event.currentTarget as HTMLElement;
    const rect = progressBar.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const time = percentage * this.duration();
    this.seekPreviewTime.set(time);
  }

  private seekToPosition(event: MouseEvent): void {
    const progressBar = event.currentTarget as HTMLElement;
    const rect = progressBar.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    this.playerService.seekPercentage(percentage * 100);
  }

  // ============ QUEUE MANAGEMENT ============

  toggleQueue(): void {
    this.showQueue.update(show => !show);
  }

  playFromQueue(index: number): void {
    if (index >= 0 && index < this.queue().length) {
      const track = this.queue()[index];
      this.playerService.setQueue(this.queue(), index);
      this.playerService.play(track);
    }
  }

  removeFromQueue(index: number): void {
    this.playerService.removeFromQueue(index);
  }

  clearQueue(): void {
    if (confirm('Vider toute la file d\'attente ?')) {
      this.playerService.clearQueue();
    }
  }

  // ============ TRACK ACTIONS ============

  async likeCurrentTrack(): Promise<void> {
    const track = this.currentTrack();
    if (track) {
      await this.trackService.likeTrack(track.id);
    }
  }

  // ============ UTILITIES ============

  getSeekPreviewFormatted(): string {
    const time = this.seekPreviewTime();
    if (time === null) return '';

    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  getTrackColor(): string {
    const track = this.currentTrack();
    return track?.coverColor || '#E50914';
  }

  // ============ KEYBOARD SHORTCUTS ============

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    // Ignorer si on est dans un input
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (event.key) {
      case ' ':
        event.preventDefault();
        this.togglePlay();
        break;
      case 'ArrowLeft':
        if (event.ctrlKey) {
          event.preventDefault();
          this.playerService.seek(this.playerService.currentTime() - 10);
        }
        break;
      case 'ArrowRight':
        if (event.ctrlKey) {
          event.preventDefault();
          this.playerService.seek(this.playerService.currentTime() + 10);
        }
        break;
      case 'm':
      case 'M':
        if (event.ctrlKey) {
          event.preventDefault();
          this.toggleMute();
        }
        break;
      case 's':
      case 'S':
        if (event.ctrlKey) {
          event.preventDefault();
          this.toggleShuffle();
        }
        break;
      case 'r':
      case 'R':
        if (event.ctrlKey) {
          event.preventDefault();
          this.toggleRepeat();
        }
        break;
    }
  }
}
