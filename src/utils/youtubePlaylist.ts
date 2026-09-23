const youtubeScope = 'https://www.googleapis.com/auth/youtube.force-ssl';
let identityScript: Promise<void> | null = null;

export function loadGoogleIdentity(): Promise<void> {
  if (typeof google !== 'undefined' && google.accounts?.oauth2) return Promise.resolve();
  if (identityScript) return identityScript;
  const pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google の認証画面を読み込めませんでした'));
    document.head.appendChild(script);
  });
  identityScript = pending.catch(error => {
    identityScript = null;
    throw error;
  });
  return identityScript;
}

function requestYoutubeToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: youtubeScope,
      callback: response => {
        if (response.error || !response.access_token
          || !google.accounts.oauth2.hasGrantedAllScopes(response, youtubeScope)) {
          reject(new Error(response.error_description || 'YouTube へのアクセスが許可されませんでした'));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: error => reject(new Error(error.type === 'popup_closed'
        ? 'Google の認証画面が閉じられました' : 'Google の認証画面を開けませんでした')),
    });
    client.requestAccessToken();
  });
}

async function youtubePost(path: string, token: string, body: object): Promise<{ id: string }> {
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || !result.id) {
    throw new Error(result.error?.message || 'YouTube への保存に失敗しました');
  }
  return result;
}

export class PlaylistSaveError extends Error {
  constructor(message: string, public playlistId: string, public savedCount: number) {
    super(message);
  }
}

export async function saveYoutubePlaylist(
  clientId: string,
  title: string,
  videoIds: string[],
  onProgress: (saved: number, total: number) => void,
): Promise<string> {
  await loadGoogleIdentity();
  const token = await requestYoutubeToken(clientId);
  const { id: playlistId } = await youtubePost('playlists?part=snippet,status', token, {
    snippet: { title, description: 'VSingerXrossPlayer の XMB から作成' },
    status: { privacyStatus: 'private' },
  });

  let savedCount = 0;
  try {
    for (const videoId of videoIds) {
      await youtubePost('playlistItems?part=snippet', token, {
        snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } },
      });
      savedCount += 1;
      onProgress(savedCount, videoIds.length);
    }
  } catch (error) {
    throw new PlaylistSaveError(error instanceof Error ? error.message : '動画の追加に失敗しました', playlistId, savedCount);
  }
  return playlistId;
}
