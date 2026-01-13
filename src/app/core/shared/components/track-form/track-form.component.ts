import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Track, MusicCategory } from '../../../models/track.model';
import { DragDropDirective } from '../../directives/drag-drop.directive';

@Component({
  selector: 'app-track-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DragDropDirective],
  templateUrl: './track-form.component.html',
  styleUrls: ['./track-form.component.css']
})
export class TrackFormComponent implements OnInit, OnDestroy {
  @Input() track?: Track;
  @Input() isEditing = false;

  @Output() submitTrack = new EventEmitter<{
    trackData: Partial<Track>;
    audioFile: File;
    imageFile?: File;
  }>();

  @Output() cancel = new EventEmitter<void>();

  // Signals
  trackForm: FormGroup;
  audioFile = signal<File | null>(null);
  imageFile = signal<File | null>(null);
  audioError = signal<string>('');
  imageError = signal<string>('');
  isDragging = signal<boolean>(false);
  audioDuration = signal<number>(0);
  audioLoading = signal<boolean>(false);

  // Catégories
  categories = Object.values(MusicCategory);

  private subscriptions: Subscription[] = [];

  constructor(private fb: FormBuilder) {
    this.trackForm = this.fb.group({
      title: ['', [
        Validators.required,
        Validators.maxLength(50),
        Validators.minLength(1)
      ]],
      artist: ['', [
        Validators.required,
        Validators.maxLength(50),
        Validators.minLength(1)
      ]],
      description: ['', Validators.maxLength(200)],
      category: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    if (this.track && this.isEditing) {
      this.trackForm.patchValue({
        title: this.track.title,
        artist: this.track.artist,
        description: this.track.description || '',
        category: this.track.category
      });
    }

    // Écouter les changements pour validation en temps réel
    this.subscriptions.push(
      this.trackForm.valueChanges.subscribe(() => {
        this.clearErrors();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ============ FILE HANDLING ============

  onAudioSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleAudioFile(input.files[0]);
    }
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleImageFile(input.files[0]);
    }
  }

  onFilesDropped(files: FileList): void {
    this.isDragging.set(false);

    // Séparer les fichiers audio et images
    const audioFiles: File[] = [];
    const imageFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.type.startsWith('audio/')) {
        audioFiles.push(file);
      } else if (file.type.startsWith('image/')) {
        imageFiles.push(file);
      }
    }

    // Traiter le premier fichier audio
    if (audioFiles.length > 0) {
      this.handleAudioFile(audioFiles[0]);
    }

    // Traiter le premier fichier image
    if (imageFiles.length > 0) {
      this.handleImageFile(imageFiles[0]);
    }
  }

  onDragOver(isDragging: boolean): void {
    this.isDragging.set(isDragging);
  }

  private handleAudioFile(file: File): void {
    // Validation taille
    if (file.size > 10 * 1024 * 1024) {
      this.audioError.set('Fichier trop volumineux (max 10MB)');
      this.audioFile.set(null);
      return;
    }

    // Validation format
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a'];
    if (!allowedTypes.includes(file.type)) {
      this.audioError.set('Format non supporté (MP3, WAV, OGG, M4A uniquement)');
      this.audioFile.set(null);
      return;
    }

    this.audioError.set('');
    this.audioFile.set(file);
    this.loadAudioDuration(file);

    // Extraire les métadonnées si possible
    this.extractMetadataFromFile(file);
  }

  private handleImageFile(file: File): void {
    // Validation taille
    if (file.size > 2 * 1024 * 1024) {
      this.imageError.set('Image trop volumineuse (max 2MB)');
      this.imageFile.set(null);
      return;
    }

    // Validation format
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.imageError.set('Format non supporté (JPG, PNG, WebP uniquement)');
      this.imageFile.set(null);
      return;
    }

    // Validation dimensions (optionnel)
    this.validateImageDimensions(file).then(isValid => {
      if (isValid) {
        this.imageError.set('');
        this.imageFile.set(file);
      } else {
        this.imageError.set('Image trop grande (max 2000x2000px)');
        this.imageFile.set(null);
      }
    }).catch(() => {
      // Si la validation échoue, accepter quand même le fichier
      this.imageError.set('');
      this.imageFile.set(file);
    });
  }

  private async loadAudioDuration(file: File): Promise<void> {
    this.audioLoading.set(true);

    try {
      const audio = new Audio();
      const url = URL.createObjectURL(file);

      await new Promise<void>((resolve, reject) => {
        audio.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          this.audioDuration.set(audio.duration);
          resolve();
        };

        audio.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Impossible de lire la durée'));
        };

        audio.src = url;
      });
    } catch (error) {
      console.warn('Could not load audio duration:', error);
      this.audioDuration.set(0);
    } finally {
      this.audioLoading.set(false);
    }
  }

  private async validateImageDimensions(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img.width <= 2000 && img.height <= 2000);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(true); // Accepter même si la validation échoue
      };

      img.src = url;
    });
  }

  private extractMetadataFromFile(file: File): void {
    const fileName = file.name;

    // Essayer d'extraire le titre et l'artiste du nom de fichier
    // Format commun: "Artiste - Titre.mp3"
    const match = fileName.match(/^(.*?)\s*-\s*(.*?)(?:\.[^.]*$|$)/);

    if (match) {
      const [, artist, title] = match;

      // Ne remplir que si les champs sont vides
      if (!this.trackForm.get('title')?.value && title) {
        this.trackForm.patchValue({ title: title.trim() });
      }

      if (!this.trackForm.get('artist')?.value && artist) {
        this.trackForm.patchValue({ artist: artist.trim() });
      }
    }
  }

  // ============ FORM SUBMISSION ============

  onSubmit(): void {
    if (this.trackForm.valid && this.audioFile()) {
      const trackData = this.trackForm.value;

      this.submitTrack.emit({
        trackData,
        audioFile: this.audioFile()!,
        imageFile: this.imageFile() || undefined
      });

      if (!this.isEditing) {
        this.resetForm();
      }
    } else {
      this.trackForm.markAllAsTouched();

      if (!this.audioFile()) {
        this.audioError.set('Veuillez sélectionner un fichier audio');
      }
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }

  resetForm(): void {
    this.trackForm.reset();
    this.audioFile.set(null);
    this.imageFile.set(null);
    this.audioDuration.set(0);
    this.clearErrors();
  }

  clearErrors(): void {
    this.audioError.set('');
    this.imageError.set('');
  }

  // ============ VALIDATION HELPERS ============

  getFieldError(fieldName: string): string {
    const field = this.trackForm.get(fieldName);

    if (!field || !field.errors || !field.touched) {
      return '';
    }

    const errors = field.errors;

    if (errors['required']) {
      return 'Ce champ est requis';
    }

    if (errors['maxlength']) {
      const requiredLength = errors['maxlength'].requiredLength;
      return `Maximum ${requiredLength} caractères`;
    }

    if (errors['minlength']) {
      const requiredLength = errors['minlength'].requiredLength;
      return `Minimum ${requiredLength} caractères`;
    }

    return '';
  }

  getFieldClass(fieldName: string): string {
    const field = this.trackForm.get(fieldName);

    if (!field) {
      return '';
    }

    if (field.touched && field.invalid) {
      return 'is-invalid';
    }

    if (field.touched && field.valid) {
      return 'is-valid';
    }

    return '';
  }

  // ============ GETTERS ============

  get title() { return this.trackForm.get('title'); }
  get artist() { return this.trackForm.get('artist'); }
  get description() { return this.trackForm.get('description'); }
  get category() { return this.trackForm.get('category'); }

  get audioDurationFormatted(): string {
    const duration = this.audioDuration();
    if (!duration) return '';

    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  get audioFileName(): string {
    const file = this.audioFile();
    return file ? file.name : '';
  }

  get imageFileName(): string {
    const file = this.imageFile();
    return file ? file.name : '';
  }

  get audioFileSize(): string {
    const file = this.audioFile();
    if (!file) return '';

    const sizeInMB = file.size / (1024 * 1024);
    return `${sizeInMB.toFixed(2)} MB`;
  }

  get imageFileSize(): string {
    const file = this.imageFile();
    if (!file) return '';

    const sizeInMB = file.size / (1024 * 1024);
    return `${sizeInMB.toFixed(2)} MB`;
  }
}
