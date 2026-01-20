import { Injectable, signal, computed, effect } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { Track, MusicCategory } from '../models/track.model';
import { SortBy, SortOrder } from '../models/player-state.enum';
import { StorageService } from './storage.service';

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

@Injectable({
  providedIn: 'root'
})
export class TrackService {
  // Signals pour la gestion d'état
  private tracksSignal = signal<Track[]>([]);
  private loadingState = signal<LoadingState>('idle');
  private errorMessage = signal<string>('');
  private currentFilter = signal<string>('all');
  private sortBySignal = signal<SortBy>(SortBy.DATE);
  private sortOrderSignal = signal<SortOrder>(SortOrder.DESC);

  // Computed signals
  readonly tracks = computed(() => {
    let filtered = [...this.tracksSignal()];

    // Appliquer le filtre
    const filter = this.currentFilter();
    if (filter !== 'all') {
      filtered = filtered.filter(track => track.category === filter);
    }

    // Appliquer le tri
    const sortBy = this.sortBySignal();
    const sortOrder = this.sortOrderSignal();

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

  readonly isLoading = computed(() => this.loadingState() === 'loading');
  readonly error = computed(() => this.errorMessage());
  readonly categories = computed(() => {
    const categories = this.tracksSignal().map(t => t.category);
    const uniqueCategories = Array.from(new Set(categories));
    return ['all', ...uniqueCategories];
  });

  readonly stats = computed(() => {
    const tracks = this.tracksSignal();
    return {
      totalTracks: tracks.length,
      totalDuration: tracks.reduce((sum, track) => sum + track.duration, 0),
      totalPlays: tracks.reduce((sum, track) => sum + (track.plays || 0), 0),
      totalLikes: tracks.reduce((sum, track) => sum + (track.likes || 0), 0),
      byCategory: this.getCategoryStats(tracks)
    };
  });

  constructor(private storageService: StorageService) {
    this.loadTracks();

    // Écouter les changements de stockage
    effect(() => {
      const error = this.storageService.getStorageError();
      if (error) {
        this.errorMessage.set(error);
      }
    });
  }

  // ============ CRUD OPERATIONS ============

  async loadTracks(): Promise<void> {
    this.loadingState.set('loading');
    this.errorMessage.set('');

    try {
      const tracks = await this.storageService.getAllTracks();
      this.tracksSignal.set(tracks);
      this.loadingState.set('success');
    } catch (error) {
      this.errorMessage.set('Erreur lors du chargement des pistes');
      this.loadingState.set('error');
      console.error('Load tracks error:', error);
    }
  }

  async createTrack(
    trackData: Partial<Track>,
    audioFile: File,
    imageFile?: File
  ): Promise<Track> {
    this.loadingState.set('loading');
    this.errorMessage.set('');

    try {
      // Validation
      this.validateTrackData(trackData);

      // Sauvegarder fichiers
      const fileUrl = await this.storageService.saveAudioFile(audioFile);
      let coverImage: string | undefined;

      if (imageFile) {
        coverImage = await this.storageService.saveImageFile(imageFile);
      }

      // Générer une couleur pour le design
      const coverColor = this.generateRandomColor();

      // Créer l'objet Track
      const track: Track = {
        id: uuidv4(),
        title: trackData.title!.trim(),
        artist: trackData.artist!.trim(),
        description: trackData.description?.trim(),
        duration: await this.getAudioDuration(audioFile),
        category: trackData.category as MusicCategory,
        addedDate: new Date(),
        fileUrl,
        fileSize: audioFile.size,
        fileType: audioFile.type,
        coverImage,
        coverColor,
        plays: 0,
        likes: 0
      };

      // Sauvegarder
      await this.storageService.saveTrack(track);

      // Mettre à jour la liste
      this.tracksSignal.update(tracks => [...tracks, track]);
      this.loadingState.set('success');

      return track;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      this.errorMessage.set(message);
      this.loadingState.set('error');
      throw error;
    }
  }

  async updateTrack(id: string, updates: Partial<Track>): Promise<void> {
    this.loadingState.set('loading');

    try {
      // Validation
      if (updates.title && updates.title.length > 50) {
        throw new Error('Le titre ne doit pas dépasser 50 caractères');
      }

      if (updates.description && updates.description.length > 200) {
        throw new Error('La description ne doit pas dépasser 200 caractères');
      }

      // Récupérer la piste existante
      const existingTrack = await this.storageService.getTrack(id);
      if (!existingTrack) {
        throw new Error('Piste non trouvée');
      }

      // Mettre à jour
      const updatedTrack = { ...existingTrack, ...updates };
      await this.storageService.saveTrack(updatedTrack);

      // Mettre à jour la liste
      this.tracksSignal.update(tracks =>
        tracks.map(t => t.id === id ? updatedTrack : t)
      );

      this.loadingState.set('success');

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      this.errorMessage.set(message);
      this.loadingState.set('error');
      throw error;
    }
  }

  async deleteTrack(id: string): Promise<void> {
    this.loadingState.set('loading');

    try {
      await this.storageService.deleteTrack(id);

      // Mettre à jour la liste
      this.tracksSignal.update(tracks =>
        tracks.filter(t => t.id !== id)
      );

      this.loadingState.set('success');

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      this.errorMessage.set(message);
      this.loadingState.set('error');
      throw error;
    }
  }

  // ============ TRACK ACTIONS ============

  async playTrack(id: string): Promise<void> {
    try {
      await this.storageService.incrementTrackPlays(id);

      // Mettre à jour localement
      this.tracksSignal.update(tracks =>
        tracks.map(track =>
          track.id === id
            ? { ...track, plays: (track.plays || 0) + 1 }
            : track
        )
      );
    } catch (error) {
      console.error('Error incrementing plays:', error);
    }
  }

  async likeTrack(id: string): Promise<number> {
    try {
      const likes = await this.storageService.toggleTrackLike(id);

      // Mettre à jour localement
      this.tracksSignal.update(tracks =>
        tracks.map(track =>
          track.id === id
            ? { ...track, likes }
            : track
        )
      );

      return likes;
    } catch (error) {
      console.error('Error toggling like:', error);
      return 0;
    }
  }

  // ============ FILTERING & SORTING ============

  setFilter(category: string): void {
    this.currentFilter.set(category);
  }

  setSort(sortBy: SortBy, sortOrder: SortOrder): void {
    this.sortBySignal.set(sortBy);
    this.sortOrderSignal.set(sortOrder);
  }

  // ============ SEARCH ============

  async searchTracks(query: string): Promise<Track[]> {
    try {
      return await this.storageService.searchTracks(query);
    } catch (error) {
      this.errorMessage.set('Erreur lors de la recherche');
      return [];
    }
  }

  // ============ STATISTICS ============

  async getMostPlayed(limit: number = 10): Promise<Track[]> {
    try {
      return await this.storageService.getMostPlayedTracks(limit);
    } catch (error) {
      console.error('Error getting most played:', error);
      return [];
    }
  }

  async getMostLiked(limit: number = 10): Promise<Track[]> {
    try {
      return await this.storageService.getMostLikedTracks(limit);
    } catch (error) {
      console.error('Error getting most liked:', error);
      return [];
    }
  }

  async getRecent(limit: number = 10): Promise<Track[]> {
    try {
      return await this.storageService.getRecentTracks(limit);
    } catch (error) {
      console.error('Error getting recent:', error);
      return [];
    }
  }

  // ============ UTILITIES ============

  getTrackById(id: string): Track | undefined {
    return this.tracksSignal().find(track => track.id === id);
  }

  getTracksByCategory(category: string): Track[] {
    return this.tracksSignal().filter(track => track.category === category);
  }

  reorderTracks(newOrder: Track[]): void {
    this.tracksSignal.set([...newOrder]);
  }

  // ============ PRIVATE METHODS ============

  private validateTrackData(trackData: Partial<Track>): void {
    if (!trackData.title || trackData.title.trim().length === 0) {
      throw new Error('Le titre est requis');
    }

    if (trackData.title.length > 50) {
      throw new Error('Le titre ne doit pas dépasser 50 caractères');
    }

    if (!trackData.artist || trackData.artist.trim().length === 0) {
      throw new Error('L\'artiste est requis');
    }

    if (trackData.description && trackData.description.length > 200) {
      throw new Error('La description ne doit pas dépasser 200 caractères');
    }

    if (!trackData.category) {
      throw new Error('La catégorie est requise');
    }

    if (!Object.values(MusicCategory).includes(trackData.category as MusicCategory)) {
      throw new Error('Catégorie invalide');
    }
  }

  private getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);

      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Impossible de lire la durée du fichier audio'));
      };

      audio.src = url;
    });
  }

  private generateRandomColor(): string {
    const colors = [
      '#E50914', '#B81D24', '#FF4D4D', '#FF6B6B', '#FF5252',
      '#121212', '#1E1E1E', '#2D2D2D', '#3A3A3A', '#4A4A4A'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private getCategoryStats(tracks: Track[]): Record<string, number> {
    const stats: Record<string, number> = {};

    tracks.forEach(track => {
      stats[track.category] = (stats[track.category] || 0) + 1;
    });

    return stats;
  }

  // ============ DATA MANAGEMENT ============

  async exportData(): Promise<Blob> {
    return await this.storageService.exportData();
  }

  async importData(file: File): Promise<void> {
    this.loadingState.set('loading');

    try {
      await this.storageService.importData(file);
      await this.loadTracks();
      this.loadingState.set('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de l\'importation';
      this.errorMessage.set(message);
      this.loadingState.set('error');
      throw error;
    }
  }

  async clearAllData(): Promise<void> {
    this.loadingState.set('loading');

    try {
      await this.storageService.clearAllData();
      this.tracksSignal.set([]);
      this.loadingState.set('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors du nettoyage';
      this.errorMessage.set(message);
      this.loadingState.set('error');
      throw error;
    }
  }
}
