import { Component, OnInit, OnDestroy, signal, computed, viewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription, debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { Track, MusicCategory } from '../../core/models/track.model';
import { SortBy, SortOrder } from '../../core/models/player-state.enum';
import { TrackService } from '../../core/services/track.service';
import { AudioPlayerService } from '../../core/services/audio-player.service';
import { TrackCardComponent } from '../../shared/components/track-card/track-card.component';
import { TrackFormComponent } from '../../shared/components/track-form/track-form.component';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';
import { SearchFilterPipe } from '../../shared/pipes/search-filter.pipe';
import { DragDropDirective } from '../../shared/directives/drag-drop.directive';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TrackCardComponent,
    TrackFormComponent,
    DurationPipe,
    FileSizePipe,
    SearchFilterPipe,
    DragDropDirective
  ],
  templateUrl: 'library.component.html',
  styleUrls: ['library.component.css']
})
export class LibraryComponent implements OnInit, OnDestroy {
  // View Children
  trackForm = viewChild.required(TrackFormComponent);

  // État local
  showForm = signal(false);
  editingTrack = signal<Track | null>(null);
  selectedTracks = signal<Set<string>>(new Set());
  viewMode = signal<'grid' | 'list'>('grid');
  searchTerm = signal('');
  selectedCategory = signal('all');
  sortBy = signal<SortBy>(SortBy.DATE);
  sortOrder = signal<SortOrder>(SortOrder.DESC);
  isDragging = signal(false);
  showStats = signal(false);
  showImportExport = signal(false);

  // Pagination
  currentPage = signal(1);
  itemsPerPage = signal(12);

  // Subjects pour la recherche
  private searchSubject = new Subject<string>();

  // État depuis les services
  tracks = this.trackService.tracks;
  isLoading = this.trackService.isLoading;
  error = this.trackService.error;
  categories = this.trackService.categories;
  stats = this.trackService.stats;

  // État du lecteur
  currentPlayingId = computed(() => this.playerService.currentTrack()?.id);
  isPlaying = computed(() => this.playerService.status() === 'playing');

  // Computed values
  filteredTracks = computed(() => {
    let filtered = [...this.tracks()];

    // Recherche
    if (this.searchTerm()) {
      filtered = filtered.filter(track =>
        track.title.toLowerCase().includes(this.searchTerm().toLowerCase()) ||
        track.artist.toLowerCase().includes(this.searchTerm().toLowerCase()) ||
        track.description?.toLowerCase().includes(this.searchTerm().toLowerCase()) ||
        track.category.toLowerCase().includes(this.searchTerm().toLowerCase())
      );
    }

    // Filtrage par catégorie
    if (this.selectedCategory() !== 'all') {
      filtered = filtered.filter(track => track.category === this.selectedCategory());
    }

    // Tri
    const sortBy = this.sortBy();
    const sortOrder = this.sortOrder();

    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case SortBy.TITLE:
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case SortBy.ARTIST:
          aValue = a.artist.toLowerCase();
          bValue = b.artist.toLowerCase();
          break;
        case SortBy.DATE:
          aValue = new Date(a.addedDate).getTime();
          bValue = new Date(b.addedDate).getTime();
          break;
        case SortBy.DURATION:
          aValue = a.duration;
          bValue = b.duration;
          break;
        case SortBy.PLAYS:
          aValue = a.plays || 0;
          bValue = b.plays || 0;
          break;
        case SortBy.LIKES:
          aValue = a.likes || 0;
          bValue = b.likes || 0;
          break;
        default:
          return 0;
      }

      if (sortOrder === SortOrder.ASC) {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  });

  paginatedTracks = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.itemsPerPage();
    const endIndex = startIndex + this.itemsPerPage();
    return this.filteredTracks().slice(startIndex, endIndex);
  });

  totalPages = computed(() =>
    Math.ceil(this.filteredTracks().length / this.itemsPerPage())
  );

  selectedCount = computed(() => this.selectedTracks().size);
  hasSelection = computed(() => this.selectedCount() > 0);

  // Définir SortBy comme propriété publique pour le template
  SortBy = SortBy;

  private subscriptions: Subscription[] = [];

  constructor(
    public trackService: TrackService,
    private playerService: AudioPlayerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Setup search avec debounce
    const searchSub = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchTerm.set(term);
      this.currentPage.set(1); // Reset à la première page
    });

    this.subscriptions.push(searchSub);

    // Charger les tracks
    this.trackService.loadTracks();

    // Restaurer les préférences
    this.restorePreferences();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.savePreferences();
  }

  // ============ TRACK ACTIONS ============

  onPlayTrack(track: Track): void {
    const currentTrack = this.playerService.currentTrack();

    if (currentTrack?.id === track.id && this.isPlaying()) {
      this.playerService.pause();
    } else if (currentTrack?.id === track.id && !this.isPlaying()) {
      this.playerService.play();
    } else {
      this.playerService.setQueue([track], 0);
      this.playerService.play();
    }
  }

  onPauseTrack(): void {
    this.playerService.pause();
  }

  onEditTrack(track: Track): void {
    this.editingTrack.set(track);
    this.showForm.set(true);
  }

  async onDeleteTrack(track: Track): Promise<void> {
    if (confirm(`Supprimer "${track.title}" ? Cette action est irréversible.`)) {
      try {
        await this.trackService.deleteTrack(track.id);

        // Si la piste supprimée est en cours de lecture, arrêter la lecture
        if (this.playerService.currentTrack()?.id === track.id) {
          this.playerService.stop();
        }

        // Retirer de la sélection
        const selected = new Set(this.selectedTracks());
        selected.delete(track.id);
        this.selectedTracks.set(selected);

      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }
  }

  onAddToQueue(track: Track): void {
    this.playerService.addToQueue(track);
  }

  onLikeTrack(track: Track): void {
    this.trackService.likeTrack(track.id).catch(console.error);
  }

  onSelectTrack(track: Track, event?: Event): void {
    // Vérifier si c'est un MouseEvent pour avoir accès aux propriétés
    const mouseEvent = event as MouseEvent;

    if (mouseEvent?.ctrlKey || mouseEvent?.metaKey) {
      // Sélection multiple
      const selected = new Set(this.selectedTracks());
      if (selected.has(track.id)) {
        selected.delete(track.id);
      } else {
        selected.add(track.id);
      }
      this.selectedTracks.set(selected);
    } else if (mouseEvent?.shiftKey && this.selectedTracks().size > 0) {
      // Sélection par plage
      const tracks = this.filteredTracks();
      const lastSelected = Array.from(this.selectedTracks()).pop();
      const lastIndex = tracks.findIndex(t => t.id === lastSelected);
      const currentIndex = tracks.findIndex(t => t.id === track.id);

      const start = Math.min(lastIndex, currentIndex);
      const end = Math.max(lastIndex, currentIndex);

      const selected = new Set(this.selectedTracks());
      for (let i = start; i <= end; i++) {
        selected.add(tracks[i].id);
      }
      this.selectedTracks.set(selected);
    } else {
      // Sélection simple
      const selected = new Set<string>();
      selected.add(track.id);
      this.selectedTracks.set(selected);
    }
  }

  // ============ BATCH ACTIONS ============

  async deleteSelectedTracks(): Promise<void> {
    const count = this.selectedCount();
    if (count === 0) return;

    if (confirm(`Supprimer ${count} piste(s) sélectionnée(s) ?`)) {
      const tracksToDelete = Array.from(this.selectedTracks());

      for (const trackId of tracksToDelete) {
        try {
          await this.trackService.deleteTrack(trackId);
        } catch (error) {
          console.error(`Erreur lors de la suppression de la piste ${trackId}:`, error);
        }
      }

      this.selectedTracks.set(new Set());
    }
  }

  addSelectedToQueue(): void {
    const selectedIds = Array.from(this.selectedTracks());
    const selectedTracks = this.tracks().filter(track => selectedIds.includes(track.id));

    selectedTracks.forEach(track => {
      this.playerService.addToQueue(track);
    });

    // Afficher une notification ou feedback
    console.log(`${selectedTracks.length} piste(s) ajoutée(s) à la file`);
  }

  playSelectedTracks(): void {
    const selectedIds = Array.from(this.selectedTracks());
    const selectedTracks = this.tracks().filter(track => selectedIds.includes(track.id));

    if (selectedTracks.length > 0) {
      this.playerService.setQueue(selectedTracks, 0);
      this.playerService.play();
    }
  }

  clearSelection(): void {
    this.selectedTracks.set(new Set());
  }

  selectAll(): void {
    const selected = new Set<string>();
    this.paginatedTracks().forEach(track => {
      selected.add(track.id);
    });
    this.selectedTracks.set(selected);
  }

  // ============ FORM HANDLING ============

  async onTrackSubmit(event: {
    trackData: Partial<Track>;
    audioFile: File;
    imageFile?: File;
  }): Promise<void> {
    try {
      if (this.editingTrack()) {
        await this.trackService.updateTrack(this.editingTrack()!.id, event.trackData);
      } else {
        await this.trackService.createTrack(event.trackData, event.audioFile, event.imageFile);
      }

      this.showForm.set(false);
      this.editingTrack.set(null);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error);
    }
  }

  onFormCancel(): void {
    this.showForm.set(false);
    this.editingTrack.set(null);
  }

  openAddForm(): void {
    this.editingTrack.set(null);
    this.showForm.set(true);
  }

  // ============ SEARCH & FILTER ============

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchSubject.next(input.value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.searchSubject.next('');
  }

  onCategoryChange(category: string): void {
    this.selectedCategory.set(category);
    this.currentPage.set(1);
  }

  onSortChange(sortBy: SortBy): void {
    if (this.sortBy() === sortBy) {
      // Inverser l'ordre si on clique sur la même colonne
      this.sortOrder.set(
        this.sortOrder() === SortOrder.ASC ? SortOrder.DESC : SortOrder.ASC
      );
    } else {
      this.sortBy.set(sortBy);
      this.sortOrder.set(SortOrder.DESC);
    }
  }

  // ============ VIEW CONTROLS ============

  toggleViewMode(): void {
    this.viewMode.set(this.viewMode() === 'grid' ? 'list' : 'grid');
  }

  toggleStats(): void {
    this.showStats.set(!this.showStats());
  }

  toggleImportExport(): void {
    this.showImportExport.set(!this.showImportExport());
  }

  // ============ PAGINATION ============

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.scrollToTop();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(page => page + 1);
      this.scrollToTop();
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(page => page - 1);
      this.scrollToTop();
    }
  }

  getPagesArray(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages(); i++) {
      pages.push(i);
    }
    return pages;
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ============ DRAG & DROP ============

  onFilesDropped(files: FileList): void {
    this.isDragging.set(false);

    // Pour l'instant, on ne gère qu'un seul fichier audio
    const audioFiles = Array.from(files).filter(file =>
      file.type.startsWith('audio/')
    );

    if (audioFiles.length > 0) {
      // Ouvrir le formulaire avec le fichier audio pré-rempli
      this.openAddForm();

      // Simuler la sélection du fichier dans le formulaire
      setTimeout(() => {
        const form = this.trackForm();
        // Note: On ne peut pas directement appeler onAudioSelected depuis ici
        // L'utilisateur devra sélectionner le fichier dans le formulaire
      }, 100);
    }
  }

  onDragOver(isDragging: boolean): void {
    this.isDragging.set(isDragging);
  }

  // ============ IMPORT/EXPORT ============

  async exportData(): Promise<void> {
    try {
      const blob = await this.trackService.exportData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `music-stream-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      alert('Erreur lors de l\'export des données');
    }
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      if (confirm('Importer les données ? Cela écrasera vos données actuelles.')) {
        this.trackService.importData(file)
          .then(() => {
            alert('Données importées avec succès !');
            this.showImportExport.set(false);
          })
          .catch(error => {
            console.error('Erreur lors de l\'import:', error);
            alert('Erreur lors de l\'import des données');
          });
      }
    }
  }

  async clearAllData(): Promise<void> {
    if (confirm('Vider toute la bibliothèque ? Cette action est irréversible.')) {
      try {
        await this.trackService.clearAllData();
        this.selectedTracks.set(new Set());
      } catch (error) {
        console.error('Erreur lors du nettoyage:', error);
        alert('Erreur lors du nettoyage des données');
      }
    }
  }

  // ============ PREFERENCES ============

  private savePreferences(): void {
    const preferences = {
      viewMode: this.viewMode(),
      itemsPerPage: this.itemsPerPage(),
      sortBy: this.sortBy(),
      sortOrder: this.sortOrder()
    };

    localStorage.setItem('music-stream-library-preferences', JSON.stringify(preferences));
  }

  private restorePreferences(): void {
    try {
      const saved = localStorage.getItem('music-stream-library-preferences');
      if (saved) {
        const preferences = JSON.parse(saved);

        if (preferences.viewMode) this.viewMode.set(preferences.viewMode);
        if (preferences.itemsPerPage) this.itemsPerPage.set(preferences.itemsPerPage);
        if (preferences.sortBy) this.sortBy.set(preferences.sortBy);
        if (preferences.sortOrder) this.sortOrder.set(preferences.sortOrder);
      }
    } catch (error) {
      console.error('Erreur lors de la restauration des préférences:', error);
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

    switch (event.key) {
      case 'Escape':
        this.clearSelection();
        break;
      case 'a':
      case 'A':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.selectAll();
        }
        break;
      case 'Delete':
        if (this.hasSelection()) {
          this.deleteSelectedTracks();
        }
        break;
      case ' ':
        if (this.hasSelection()) {
          event.preventDefault();
          this.playSelectedTracks();
        }
        break;
      case '+':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.openAddForm();
        }
        break;
    }
  }
}
