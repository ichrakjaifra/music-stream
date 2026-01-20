import { Component, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Track } from '../../core/models/track.model';
import { TrackService } from '../../core/services/track.service';
import { AudioPlayerService } from '../../core/services/audio-player.service';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';

@Component({
  selector: 'app-track-detail',
  standalone: true,
  imports: [CommonModule, DurationPipe, FileSizePipe],
  templateUrl: './track-detail.component.html',
  styleUrls: ['./track-detail.component.css']
})
export class TrackDetailComponent implements OnInit, OnDestroy {
  // État local
  track = signal<Track | null>(null);
  isLoading = signal(true);
  error = signal('');
  showWaveform = signal(false);
  showLyrics = signal(false);
  showSimilarTracks = signal(true);

  // État du lecteur
  isPlaying = computed(() =>
    this.playerService.currentTrack()?.id === this.track()?.id &&
    this.playerService.status() === 'playing'
  );

  currentTime = computed(() => this.playerService.currentTime());
  duration = computed(() => this.playerService.duration());
  progress = computed(() => this.playerService.progress());

  // Tracks similaires
  similarTracks = signal<Track[]>([]);

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private trackService: TrackService,
    private playerService: AudioPlayerService
  ) {}

  ngOnInit(): void {
    this.loadTrack();

    // Écouter les changements de route
    const routeSub = this.route.params.subscribe(() => {
      this.loadTrack();
    });

    this.subscriptions.push(routeSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ============ LOADING ============

  private loadTrack(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.error.set('ID de piste manquant');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.error.set('');

    // Chercher dans les tracks déjà chargés
    const track = this.trackService.getTrackById(id);

    if (track) {
      this.track.set(track);
      this.isLoading.set(false);
      this.loadSimilarTracks(track);
    } else {
      // Si la piste n'est pas trouvée, charger depuis le service
      this.trackService.loadTracks().then(() => {
        const loadedTrack = this.trackService.getTrackById(id);

        if (loadedTrack) {
          this.track.set(loadedTrack);
          this.loadSimilarTracks(loadedTrack);
        } else {
          this.error.set('Piste non trouvée');
        }

        this.isLoading.set(false);
      }).catch(error => {
        this.error.set('Erreur lors du chargement de la piste');
        this.isLoading.set(false);
        console.error('Error loading track:', error);
      });
    }
  }

  private loadSimilarTracks(track: Track): void {
    const allTracks = this.trackService.tracks();
    const similar = allTracks.filter(t =>
      t.id !== track.id &&
      (t.category === track.category || t.artist === track.artist)
    ).slice(0, 5);

    this.similarTracks.set(similar);
  }

  // ============ PLAYBACK CONTROLS ============

  playTrack(): void {
    const track = this.track();
    if (!track) return;

    if (this.isPlaying()) {
      this.playerService.pause();
    } else {
      if (this.playerService.currentTrack()?.id === track.id) {
        this.playerService.play();
      } else {
        this.playerService.setQueue([track], 0);
        this.playerService.play();
      }
    }
  }

  addToQueue(): void {
    const track = this.track();
    if (track) {
      this.playerService.addToQueue(track);
    }
  }

  playSimilarTrack(similarTrack: Track): void {
    this.playerService.setQueue([similarTrack], 0);
    this.playerService.play();
    this.router.navigate(['/track', similarTrack.id]);
  }

  // ============ TRACK ACTIONS ============

  async likeTrack(): Promise<void> {
    const track = this.track();
    if (track) {
      const newLikes = await this.trackService.likeTrack(track.id);
      this.track.update(t => t ? { ...t, likes: newLikes } : null);
    }
  }

  editTrack(): void {
    const track = this.track();
    if (track) {
      this.router.navigate(['/library'], {
        queryParams: { edit: track.id }
      });
    }
  }

  async deleteTrack(): Promise<void> {
    const track = this.track();
    if (!track) return;

    if (confirm(`Supprimer "${track.title}" ? Cette action est irréversible.`)) {
      try {
        await this.trackService.deleteTrack(track.id);

        // Si la piste supprimée est en cours de lecture, arrêter la lecture
        if (this.playerService.currentTrack()?.id === track.id) {
          this.playerService.stop();
        }

        // Retourner à la bibliothèque
        this.router.navigate(['/library']);

      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        this.error.set('Erreur lors de la suppression de la piste');
      }
    }
  }

  // ============ UI CONTROLS ============

  toggleWaveform(): void {
    this.showWaveform.update(show => !show);
  }

  toggleLyrics(): void {
    this.showLyrics.update(show => !show);
  }

  toggleSimilarTracks(): void {
    this.showSimilarTracks.update(show => !show);
  }

  // ============ UTILITIES ============

  formatDate(date: Date | string | null | undefined): string {
    if (!date) {
      return 'Date inconnue';
    }

    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Vérifier si la date est valide
    if (isNaN(dateObj.getTime())) {
      return 'Date invalide';
    }

    return dateObj.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  // AJOUTER CETTE MÉTHODE
  getFileUrlDisplay(): string {
    const fileUrl = this.track()?.fileUrl;
    if (!fileUrl) {
      return 'N/A';
    }

    if (fileUrl.length > 100) {
      return fileUrl.slice(0, 100) + '...';
    }

    return fileUrl;
  }

  getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
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

    return colors[category] || '#E50914';
  }

  goBack(): void {
    this.router.navigate(['/library']);
  }

  // ============ KEYBOARD SHORTCUTS ============

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.goBack();
    } else if (event.key === ' ') {
      event.preventDefault();
      this.playTrack();
    } else if (event.key === 'l' || event.key === 'L') {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        this.likeTrack();
      }
    }
  }
}
