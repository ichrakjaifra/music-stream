import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'duration',
  standalone: true
})
export class DurationPipe implements PipeTransform {
  transform(seconds: number | null | undefined, format: 'short' | 'long' = 'short'): string {
    // Handle null, undefined, 0, or invalid values
    if (seconds == null || seconds <= 0 || isNaN(seconds)) {
      return format === 'short' ? '0:00' : '0 minutes';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (format === 'short') {
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
      }
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      if (hours > 0) {
        return `${hours}h ${minutes}min`;
      }
      if (minutes > 0) {
        return `${minutes}min ${remainingSeconds}s`;
      }
      return `${remainingSeconds} secondes`;
    }
  }
}
