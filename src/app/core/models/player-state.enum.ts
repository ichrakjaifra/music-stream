export enum PlayerStateEnum {
  PLAYING = 'playing',
  PAUSED = 'paused',
  BUFFERING = 'buffering',
  STOPPED = 'stopped',
  LOADING = 'loading'
}

export enum RepeatMode {
  NONE = 'none',
  ALL = 'all',
  ONE = 'one'
}

export enum SortBy {
  TITLE = 'title',
  ARTIST = 'artist',
  DATE = 'addedDate',
  DURATION = 'duration',
  PLAYS = 'plays',
  LIKES = 'likes'
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}
