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

export async function getVideosByID(apiKey, videoIds) {
  const videos = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    // you can only get 50 videos at a time
    const chunk = videoIds.slice(i, i + 50);
    const response = await fetch(
      `https://youtube.googleapis.com/youtube/v3/videos?part=snippet%2Cstatistics&id=${chunk}&key=${apiKey}`,
      {
        headers: {
          // Authorization: 'Bearer ',
          Accept: 'application/json',
        },
      }
    );
    const data = await response.json();
    videos.push(...data.items); // modify the array
  }
  return videos;
}
