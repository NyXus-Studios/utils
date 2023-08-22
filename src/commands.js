/**
 * Share command metadata from a common spot to be used for both runtime
 * and registration.
 */

export const PLAYLIST_COMMAND = {
  name: 'playlist',
  description: 'YouTube playlist',
  options: [
    {
      type: 3,
      name: 'ID',
      description: 'YouTube Playlist ID',
      required: true,
    },
  ],
};
