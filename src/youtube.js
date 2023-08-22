export async function getVideoIDsFromPlaylist(apiKey, playlistId, pageToken) {
  const response = await fetch(
    `https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50${
      pageToken ? '&pageToken=' + pageToken : ''
    }&playlistId=${playlistId}&key=${apiKey}`,
    {
      headers: {
        // Authorization: 'Bearer ',
        Accept: 'application/json',
      },
    }
  );
  const data = await response.json();
  const videos = data.items.map((item) => item.contentDetails.videoId);
  if (data.nextPageToken) {
    return videos.concat(
      await getVideoIDsFromPlaylist(apiKey, playlistId, data.nextPageToken)
    );
  }
  return videos;
}

export async function getVideosByID(apiKey, videoIds, pageToken) {
  const response = await fetch(
    `https://youtube.googleapis.com/youtube/v3/videos?part=snippet%2Cstatistics&id=${videoIds}&maxResults=50${
      pageToken ? '&pageToken=' + pageToken : ''
    }&key=${apiKey}`,
    {
      headers: {
        // Authorization: 'Bearer ',
        Accept: 'application/json',
      },
    }
  );
  const data = await response.json();
  const videos = data.items;
  if (data.nextPageToken) {
    return videos.concat(
      await getVideosByID(apiKey, videoIds, data.nextPageToken)
    );
  }
  return videos;
}
