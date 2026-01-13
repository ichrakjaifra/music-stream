import { Pipe, PipeTransform } from '@angular/core';
import { Track } from '../../models/track.model';

@Pipe({
  name: 'searchFilter',
  standalone: true
})
export class SearchFilterPipe implements PipeTransform {
  transform(tracks: Track[], searchTerm: string, searchBy: ('title' | 'artist' | 'category')[] = ['title', 'artist']): Track[] {
    if (!tracks || !searchTerm) {
      return tracks;
    }

    const term = searchTerm.toLowerCase().trim();

    return tracks.filter(track => {
      return searchBy.some(field => {
          const value = track[field];
          return value && value.toString().toLowerCase().includes(term);
        }) ||
        (track.description && track.description.toLowerCase().includes(term));
    });
  }
}
