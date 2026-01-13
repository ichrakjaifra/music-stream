import { Component, OnInit, OnDestroy, signal, computed, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AudioPlayerService } from './core/services/audio-player.service';
import { TrackService } from './core/services/track.service';
import { AudioPlayerComponent } from './shared/components/audio-player/audio-player.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, AudioPlayerComponent], // أضف AudioPlayerComponent هنا
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  // État de l'application
  currentRoute = signal('');
  showPlayer = signal(true);
  isLoading = signal(false);
  storageUsage = signal(0);

  // État du lecteur
  hasCurrentTrack = computed(() => !!this.playerService.currentTrack());
  playerStatus = computed(() => this.playerService.status());

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    public playerService: AudioPlayerService,
    private trackService: TrackService
  ) {
    // Utiliser effect pour suivre isLoading
    effect(() => {
      const isLoading = this.trackService.isLoading();
      this.isLoading.set(isLoading);
    });
  }

  ngOnInit(): void {
    // Suivre la navigation
    const routerSub = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute.set(event.urlAfterRedirects);
      this.scrollToTop();
    });

    this.subscriptions.push(routerSub);

    // Restaurer l'état du lecteur
    setTimeout(() => {
      this.playerService.restoreState();
    }, 100);

    // حساب استخدام التخزين
    this.calculateStorageUsage();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.playerService.saveState();
  }

  // ============ NAVIGATION ============

  isActiveRoute(route: string): boolean {
    return this.currentRoute().startsWith(route);
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  // تغيير من private إلى public
  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ============ PLAYER CONTROLS ============

  togglePlayer(): void {
    this.showPlayer.update(show => !show);
  }

  minimizePlayer(): void {
    this.showPlayer.set(false);
  }

  // ============ APP ACTIONS ============

  refreshLibrary(): void {
    this.trackService.loadTracks();
  }

  exportData(): void {
    this.trackService.exportData()
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `music-stream-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(error => {
        console.error('Export error:', error);
      });
  }

  // ============ UTILITY FUNCTIONS ============

  private calculateStorageUsage(): void {
    try {
      // حساب استخدام localStorage
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key) || '';
          totalBytes += key.length + value.length;
        }
      }

      const usagePercent = (totalBytes / (5 * 1024 * 1024)) * 100; // 5MB max
      this.storageUsage.set(Math.min(100, Math.round(usagePercent)));
    } catch (error) {
      console.warn('Could not calculate storage usage:', error);
    }
  }

  // ============ KEYBOARD SHORTCUTS ============

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    // Ignorer si on est dans un input
    if (event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement) {
      return;
    }

    // Ctrl/Cmd + S pour sauvegarder
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      this.exportData();
    }

    // Ctrl/Cmd + R pour rafraîchir
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
      event.preventDefault();
      this.refreshLibrary();
    }

    // Échap pour minimiser le player
    if (event.key === 'Escape' && this.hasCurrentTrack()) {
      this.minimizePlayer();
    }
  }
}
