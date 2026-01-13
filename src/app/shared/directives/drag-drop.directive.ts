import { Directive, ElementRef, EventEmitter, HostListener, Output, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appDragDrop]',
  standalone: true
})
export class DragDropDirective {
  @Output() filesDropped = new EventEmitter<FileList>();
  @Output() dragOver = new EventEmitter<boolean>();
  @Output() dragEnter = new EventEmitter<void>();
  @Output() dragLeave = new EventEmitter<void>();

  private isDragging = false;
  private dragCounter = 0;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2
  ) {}

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.isDragging) {
      this.isDragging = true;
      this.dragOver.emit(true);
      this.renderer.addClass(this.el.nativeElement, 'drag-over');
    }

    // Ajouter l'effet de copie
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  @HostListener('dragenter', ['$event'])
  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.dragCounter++;
    this.dragEnter.emit();

    if (!this.isDragging) {
      this.isDragging = true;
      this.renderer.addClass(this.el.nativeElement, 'drag-over');
    }
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.dragCounter--;

    if (this.dragCounter === 0) {
      this.isDragging = false;
      this.dragOver.emit(false);
      this.dragLeave.emit();
      this.renderer.removeClass(this.el.nativeElement, 'drag-over');
    }
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.isDragging = false;
    this.dragCounter = 0;
    this.renderer.removeClass(this.el.nativeElement, 'drag-over');
    this.dragOver.emit(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      // Filtrer les fichiers acceptés
      const files = event.dataTransfer.files;
      const acceptedFiles = this.filterAcceptedFiles(files);

      if (acceptedFiles.length > 0) {
        this.filesDropped.emit(acceptedFiles);
      }
    }
  }

  private filterAcceptedFiles(files: FileList): FileList {
    // Créer un DataTransfer pour pouvoir filtrer
    const dataTransfer = new DataTransfer();

    const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a'];
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const acceptedTypes = [...audioTypes, ...imageTypes];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Vérifier le type de fichier
      if (acceptedTypes.includes(file.type)) {
        // Vérifier la taille
        if (file.type.startsWith('audio/') && file.size <= 10 * 1024 * 1024) {
          dataTransfer.items.add(file);
        } else if (file.type.startsWith('image/') && file.size <= 2 * 1024 * 1024) {
          dataTransfer.items.add(file);
        }
      }
    }

    return dataTransfer.files;
  }

  // Méthode pour simuler le drag & drop
  simulateDragStart(): void {
    this.renderer.addClass(this.el.nativeElement, 'drag-over');
    this.isDragging = true;
    this.dragOver.emit(true);
  }

  simulateDragEnd(): void {
    this.renderer.removeClass(this.el.nativeElement, 'drag-over');
    this.isDragging = false;
    this.dragOver.emit(false);
  }
}
