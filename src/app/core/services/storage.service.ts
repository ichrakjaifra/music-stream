import { Injectable, signal, computed } from '@angular/core';
import { Track, Playlist } from '../models/track.model';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly DB_NAME = 'MusicStreamDB';
  private readonly DB_VERSION = 2;
  private readonly TRACKS_STORE = 'tracks';
  private readonly PLAYLISTS_STORE = 'playlists';
  private readonly SETTINGS_STORE = 'settings';

  private db: IDBDatabase | null = null;

  // Signals pour le suivi de l'état
  private dbInitialized = signal<boolean>(false);
  private storageError = signal<string | null>(null);
  private storageUsage = signal<number>(0);

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        this.storageError.set('Erreur lors de l\'ouverture de la base de données');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.dbInitialized.set(true);
        this.calculateStorageUsage();
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Créer le store pour les tracks
        if (!db.objectStoreNames.contains(this.TRACKS_STORE)) {
          const trackStore = db.createObjectStore(this.TRACKS_STORE, { keyPath: 'id' });
          trackStore.createIndex('title', 'title', { unique: false });
          trackStore.createIndex('artist', 'artist', { unique: false });
          trackStore.createIndex('category', 'category', { unique: false });
          trackStore.createIndex('addedDate', 'addedDate', { unique: false });
          trackStore.createIndex('plays', 'plays', { unique: false });
          trackStore.createIndex('likes', 'likes', { unique: false });
        }

        // Créer le store pour les playlists
        if (!db.objectStoreNames.contains(this.PLAYLISTS_STORE)) {
          const playlistStore = db.createObjectStore(this.PLAYLISTS_STORE, { keyPath: 'id' });
          playlistStore.createIndex('name', 'name', { unique: false });
          playlistStore.createIndex('createdDate', 'createdDate', { unique: false });
        }

        // Créer le store pour les settings
        if (!db.objectStoreNames.contains(this.SETTINGS_STORE)) {
          db.createObjectStore(this.SETTINGS_STORE, { keyPath: 'key' });
        }
      };
    });
  }

  // ============ TRACKS ============

  async saveTrack(track: Track): Promise<string> {
    await this.waitForDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.TRACKS_STORE], 'readwrite');
      const store = transaction.objectStore(this.TRACKS_STORE);
      const request = store.put(track);

      request.onsuccess = () => {
        this.calculateStorageUsage();
        resolve(track.id);
      };

      request.onerror = () => {
        this.storageError.set('Erreur lors de la sauvegarde de la piste');
        reject(request.error);
      };
    });
  }

  async getTrack(id: string): Promise<Track | null> {
    await this.waitForDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.TRACKS_STORE], 'readonly');
      const store = transaction.objectStore(this.TRACKS_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        this.storageError.set('Erreur lors de la récupération de la piste');
        reject(request.error);
      };
    });
  }

  async getAllTracks(): Promise<Track[]> {
    await this.waitForDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.TRACKS_STORE], 'readonly');
      const store = transaction.objectStore(this.TRACKS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        this.storageError.set('Erreur lors de la récupération des pistes');
        reject(request.error);
      };
    });
  }

  async deleteTrack(id: string): Promise<void> {
    await this.waitForDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.TRACKS_STORE], 'readwrite');
      const store = transaction.objectStore(this.TRACKS_STORE);
      const request = store.delete(id);

      request.onsuccess = () => {
        this.calculateStorageUsage();
        resolve();
      };

      request.onerror = () => {
        this.storageError.set('Erreur lors de la suppression de la piste');
        reject(request.error);
      };
    });
  }

  async incrementTrackPlays(id: string): Promise<void> {
    const track = await this.getTrack(id);
    if (track) {
      track.plays = (track.plays || 0) + 1;
      await this.saveTrack(track);
    }
  }

  async toggleTrackLike(id: string): Promise<number> {
    const track = await this.getTrack(id);
    if (track) {
      track.likes = (track.likes || 0) + 1;
      await this.saveTrack(track);
      return track.likes;
    }
    return 0;
  }

  // ============ PLAYLISTS ============

  async savePlaylist(playlist: Playlist): Promise<string> {
    await this.waitForDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.PLAYLISTS_STORE], 'readwrite');
      const store = transaction.objectStore(this.PLAYLISTS_STORE);
      const request = store.put(playlist);

      request.onsuccess = () => {
        resolve(playlist.id);
      };

      request.onerror = () => {
        this.storageError.set('Erreur lors de la sauvegarde de la playlist');
        reject(request.error);
      };
    });
  }

  async getPlaylist(id: string): Promise<Playlist | null> {
    await this.waitForDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.PLAYLISTS_STORE], 'readonly');
      const store = transaction.objectStore(this.PLAYLISTS_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        this.storageError.set('Erreur lors de la récupération de la playlist');
        reject(request.error);
      };
    });
  }

  async getAllPlaylists(): Promise<Playlist[]> {
    await this.waitForDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.PLAYLISTS_STORE], 'readonly');
      const store = transaction.objectStore(this.PLAYLISTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        this.storageError.set('Erreur lors de la récupération des playlists');
        reject(request.error);
      };
    });
  }

  // ============ SEARCH & FILTER ============

  async searchTracks(query: string): Promise<Track[]> {
    const tracks = await this.getAllTracks();
    const searchTerm = query.toLowerCase().trim();

    if (!searchTerm) return tracks;

    return tracks.filter(track =>
      track.title.toLowerCase().includes(searchTerm) ||
      track.artist.toLowerCase().includes(searchTerm) ||
      track.description?.toLowerCase().includes(searchTerm) ||
      track.category.toLowerCase().includes(searchTerm)
    );
  }

  async getTracksByCategory(category: string): Promise<Track[]> {
    const tracks = await this.getAllTracks();
    return tracks.filter(track => track.category === category);
  }

  async getMostPlayedTracks(limit: number = 10): Promise<Track[]> {
    const tracks = await this.getAllTracks();
    return tracks
      .sort((a, b) => (b.plays || 0) - (a.plays || 0))
      .slice(0, limit);
  }

  async getMostLikedTracks(limit: number = 10): Promise<Track[]> {
    const tracks = await this.getAllTracks();
    return tracks
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, limit);
  }

  async getRecentTracks(limit: number = 10): Promise<Track[]> {
    const tracks = await this.getAllTracks();
    return tracks
      .sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime())
      .slice(0, limit);
  }

  // ============ FILE MANAGEMENT ============

  async saveAudioFile(file: File): Promise<string> {
    // Validation taille
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Le fichier audio ne doit pas dépasser 10MB');
    }

    // Validation format
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Format audio non supporté. Utilisez MP3, WAV, OGG ou M4A');
    }

    return this.fileToDataURL(file);
  }

  async saveImageFile(file: File): Promise<string> {
    // Validation taille
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('L\'image ne doit pas dépasser 2MB');
    }

    // Validation format
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Format d\'image non supporté. Utilisez JPEG, PNG ou WebP');
    }

    return this.fileToDataURL(file);
  }

  private fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        resolve(event.target?.result as string);
      };

      reader.onerror = () => {
        reject(new Error('Erreur lors de la lecture du fichier'));
      };

      reader.readAsDataURL(file);
    });
  }

  // ============ UTILITIES ============

  async clearAllData(): Promise<void> {
    await this.waitForDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.TRACKS_STORE, this.PLAYLISTS_STORE], 'readwrite');

      transaction.objectStore(this.TRACKS_STORE).clear();
      transaction.objectStore(this.PLAYLISTS_STORE).clear();

      transaction.oncomplete = () => {
        this.calculateStorageUsage();
        resolve();
      };

      transaction.onerror = () => {
        this.storageError.set('Erreur lors du nettoyage des données');
        reject(transaction.error);
      };
    });
  }

  async exportData(): Promise<Blob> {
    const tracks = await this.getAllTracks();
    const playlists = await this.getAllPlaylists();

    const data = {
      tracks,
      playlists,
      exportDate: new Date(),
      version: '1.0'
    };

    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  }

  async importData(file: File): Promise<void> {
    const text = await file.text();
    const data = JSON.parse(text);

    if (data.tracks) {
      for (const track of data.tracks) {
        await this.saveTrack(track);
      }
    }

    if (data.playlists) {
      for (const playlist of data.playlists) {
        await this.savePlaylist(playlist);
      }
    }
  }

  // ============ PRIVATE METHODS ============

  private async waitForDB(): Promise<void> {
    if (!this.dbInitialized()) {
      await this.initDB();
    }
  }

  private async calculateStorageUsage(): Promise<void> {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage ? (estimate.usage / (1024 * 1024)) : 0;
        this.storageUsage.set(parseFloat(usage.toFixed(2)));
      }
    } catch (error) {
      console.warn('Impossible de calculer l\'utilisation du stockage:', error);
    }
  }

  // ============ GETTERS ============

  getStorageError() {
    return this.storageError();
  }

  getStorageUsage() {
    return this.storageUsage();
  }

  isDBInitialized() {
    return this.dbInitialized();
  }
}
