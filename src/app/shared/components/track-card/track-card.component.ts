import { Component, Input, Output, EventEmitter, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Track } from '../../../core/models/track.model';
import { AudioPlayerService } from '../../../core/services/audio-player.service';
import { TrackService } from '../../../core/services/track.service';
import { DurationPipe } from '../../pipes/duration.pipe';
import { FileSizePipe } from '../../pipes/file-size.pipe';

@Component({
  selector: 'app-track-card',
  standalone: true,
  imports: [CommonModule, DurationPipe, FileSizePipe],
  templateUrl: './track-card.component.html',
  styleUrls: ['./track-card.component.css']
})
export class TrackCardComponent implements OnInit {
  @Input() track!: Track;
  @Input() showActions = true;
  @Input() compact = false;
  @Input() isPlaying = false;
  @Input() isSelected = false;

  @Output() play = new EventEmitter<Track>();
  @Output() pause = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Track>();
  @Output() delete = new EventEmitter<Track>();
  @Output() addToQueue = new EventEmitter<Track>();
  @Output() like = new EventEmitter<Track>();
  @Output() select = new EventEmitter<Track>();

  // Signals
  isHovered = signal(false);
  isMenuOpen = signal(false);
  isLiking = signal(false);
  likesCount = signal(0);
  playsCount = signal(0);

  // Computed
  cardClass = computed(() => {
    const classes: Record<string, boolean> = {
      'track-card': true,
      'compact': this.compact,
      'selected': this.isSelected,
      'playing': this.isPlaying,
      'hovered': this.isHovered()
    };
    return classes;
  });

  coverColor = computed(() => this.track.coverColor || '#E50914');

  constructor(
    private router: Router,
    private playerService: AudioPlayerService,
    private trackService: TrackService
  ) {}

  ngOnInit(): void {
    this.likesCount.set(this.track.likes || 0);
    this.playsCount.set(this.track.plays || 0);
  }

  // ============ EVENT HANDLERS ============

  onPlayClick(event: Event): void {
    event.stopPropagation();

    if (this.isPlaying) {
      this.pause.emit();
    } else {
      this.play.emit(this.track);
    }
  }

  onEditClick(event: Event): void {
    event.stopPropagation();
    this.edit.emit(this.track);
  }

  onDeleteClick(event: Event): void {
    event.stopPropagation();
    if (confirm(`Êtes-vous sûr de vouloir supprimer "${this.track.title}" ?`)) {
      this.delete.emit(this.track);
    }
  }

  onAddToQueueClick(event: Event): void {
    event.stopPropagation();
    this.addToQueue.emit(this.track);
  }

  async onLikeClick(event: Event): Promise<void> {
    event.stopPropagation();

    if (this.isLiking()) return;

    this.isLiking.set(true);
    try {
      const newLikes = await this.trackService.likeTrack(this.track.id);
      this.likesCount.set(newLikes);
      this.like.emit(this.track);
    } catch (error) {
      console.error('Error liking track:', error);
    } finally {
      this.isLiking.set(false);
    }
  }

  onSelectClick(event: Event): void {
    event.stopPropagation();
    this.select.emit(this.track);
  }

  onCardClick(): void {
    this.router.navigate(['/track', this.track.id]);
  }

  // ============ MENU HANDLERS ============

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.isMenuOpen.set(!this.isMenuOpen());
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  // ============ UTILITIES ============

  getCategoryColor(): string {
    const categoryColors: Record<string, string> = {
      'pop': '#FF6B6B',
      'rock': '#4ECDC4',
      'rap': '#FFD166',
      'jazz': '#06D6A0',
      'classical': '#118AB2',
      'electronic': '#EF476F',
      'hiphop': '#7209B7',
      'rnb': '#F8961E',
      'country': '#43AA8B',
      'reggae': '#577590',
      'metal': '#2D3047',
      'blues': '#264653',
      'folk': '#2A9D8F'
    };

    return categoryColors[this.track.category] || '#E50914';
  }

  formatDate(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  // ============ KEYBOARD NAVIGATION ============

  @HostListener('keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onCardClick();
    }
  }
}
