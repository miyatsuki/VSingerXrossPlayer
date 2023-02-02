import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import YouTube, { YouTubeEvent } from 'react-youtube';
import Video from "../types/video";

const shuffleVideos = (videos: Video[]) => {
  const copiedVideos = [...videos]
  for (let i = copiedVideos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = { ...copiedVideos[j] }
    copiedVideos[j] = { ...copiedVideos[i] }
    copiedVideos[i] = { ...tmp }
  }

  return copiedVideos
}

// Create a single supabase client for interacting with your database
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL!
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY!

const start = () => {
  // 2. Initialize the JavaScript client library.
  gapi.client.init({
    'apiKey': GOOGLE_API_KEY,
  }).then(() => {
    gapi.client.load("https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest")
  })
};
let client: null | ReturnType<typeof google.accounts.oauth2.initTokenClient> = null



const handleClick = (client: ReturnType<typeof google.accounts.oauth2.initTokenClient>) => {
  // Conditionally ask users to select the Google Account they'd like to use,
  // and explicitly obtain their consent to fetch their Calendar.
  // NOTE: To request an access token a user gesture is necessary.
  if (gapi.client.getToken() === null) {
    // Prompt the user to select a Google Account and asked for consent to share their data
    // when establishing a new session.
    client.requestAccessToken({ prompt: 'consent' });
  } else {
    // Skip display of account chooser and consent dialog for an existing session.
    client.requestAccessToken({ prompt: '' });
  }
}

const fetchAllVideos = async () => {
  let allVideos: Video[] = []
  for (let i = 0; ; i++) {
    const res = await supabase.from('videos').select("video_id, video_title, song_title, identifier, singers, tags").range(i * 1000, (i + 1) * 1000)
    if (res.data === null) {
      break
    }

    const videos = res.data.map(r => {
      const metas: string[] = []
      const song_title = r.identifier ? `${r.song_title} (${r.identifier})` : r.song_title

      if (song_title !== null) {
        metas.push(song_title)
      }

      if (r.singers.length > 0) {
        metas.push(...r.singers)
      }

      if (r.tags !== null && r.tags.length > 0) {
        metas.push(...r.tags)
      }

      return {
        id: r.video_id,
        title: r.video_title,
        song: song_title,
        singers: r.singers,
        tags: r.tags,
        metas: metas
      }
    })
    allVideos = allVideos.concat(videos)

    if (res.data.length < 1000) {
      break
    }
  }

  return shuffleVideos(allVideos)
}

const allMetas = (allVideos: Video[]) => {
  const ans: Set<string> = new Set()

  allVideos.forEach(video => {
    video.metas.forEach(meta => {
      ans.add(meta)
    })
  })

  return [...ans].sort()
}

const filterVideos = (allVideos: Video[], positiveTags: string[], negativeTags: string[]) => {
  const videos = [...allVideos]

  return videos
    // 検索条件に一つでもマッチしたら返す
    .filter(v => positiveTags.some(t => v.metas.includes(t)))
    // 除外条件に一つでもマッチしたら却下する
    .filter(v => !negativeTags.some(t => v.metas.includes(t)))
    // 100件以上返ってきたらフィルタする
    .filter((v, i) => i < 100)
}


interface YouTubeComponentProps {
  video: Video | undefined
  onEnd: (event: YouTubeEvent<number>) => void
}

const YouTubeComponent: React.FC<YouTubeComponentProps> = ({ video, onEnd }) => {
  const [isPlaying, setIsPlaying] = useState(false)

  if (video === undefined) {
    return <></>
  }

  return (
    <YouTube
      // keyを刺すことによって、videoId変えたのに更新されない問題を回避できる
      // https://github.com/barmej/react-native-youtube-player/issues/33
      key={video.id}
      videoId={video.id}
      opts={{
        height: "390",
        width: "640",
        playerVars: {
          // https://developers.google.com/youtube/player_parameters
          autoplay: isPlaying ? 1 : 0,
        }
      }}
      onPlay={() => {
        setIsPlaying(true)
      }}
      onPause={() => {
        setIsPlaying(false)
      }}
      onEnd={onEnd}
    />
  )
}

interface VideoInfoComponentProps {
  video: Video | undefined
  handleSingerChipClick: (singer: string) => void
  handleSongChipClick: (song: string) => void
}

const VideoInfoComponent: React.FC<VideoInfoComponentProps> = ({ video, handleSingerChipClick, handleSongChipClick }) => {
  if (video === undefined) {
    return <></>
  }

  const singerNameChips = video.singers.map(
    singer => (
      <Chip
        key={singer}
        label={singer}
        variant="outlined"
        onClick={(e) => { handleSingerChipClick(singer) }}
      />
    )
  )

  const songChip = <Chip
    key={video.song}
    label={video.song}
    variant="outlined"
    onClick={(e) => { handleSongChipClick(video.song) }}
  />

  return <>
    <Grid container spacing={2} justifyContent="flex-start">
      <Grid item xs={1} />
      <Grid item xs={1}>
        url:
      </Grid>
      <Grid item xs={10} style={{ "display": "inherit", "justifyContent": "left" }}>
        <a href={"https://www.youtube.com/watch?v=" + video.id}>{"https://www.youtube.com/watch?v=" + video.id}</a>
      </Grid>

      <Grid item xs={1} />
      <Grid item xs={1}>
        歌:
      </Grid>
      <Grid item xs={10} style={{ "display": "inherit", "justifyContent": "left" }}>
        {singerNameChips}
      </Grid>

      <Grid item xs={1} />
      <Grid item xs={1}>
        曲:
      </Grid>
      <Grid item xs={10} style={{ "display": "inherit", "justifyContent": "left" }}>
        {songChip}
      </Grid>

      <Grid item xs={1} />
      <Grid item xs={1}>
        タグ:
      </Grid>
      <Grid item xs={10} style={{ "display": "inherit", "justifyContent": "left" }}>
        {video.tags?.toString()}
      </Grid>
    </Grid>
  </>
}


const insertPlaylist = (playlistId: string, videoId: string) => {
  const request = gapi.client.youtube.playlistItems.insert({
    part: 'snippet',
    resource: {
      snippet: {
        playlistId: playlistId,
        resourceId: {
          kind: "youtube#video",
          videoId: videoId
        }
      }
    }
  });
  return new Promise<void>((resolve, reject) => {
    request.execute((response) => {
      const r = response as (typeof response) | { code: number, error: { message: string } }
      if ("code" in r) {
        reject(r)
      } else {
        resolve()
      }
    })
  })
}

const PlaylistProgressBar: React.FC<{ left: number, total: number }> = ({ left, total }) => {
  return (<>
    <LinearProgress variant="determinate" value={100 - left / total * 100} />
    <span>
      {left} / {total}
    </span>
  </>
  )
}

async function* insertVideos(playlistId: string, videos: Video[]) {
  const queue = [...videos]
  while (queue.length > 0) {
    yield {
      waitingQueueCounts: queue.length
    }
    const video = queue.shift()!
    try {
      await insertPlaylist(playlistId, video.id)
    } catch (err) {
      const e = err as { code: number, error: { message: string } }
      if (e.code === 500) {
        queue.push(video)
      }
    }
  }
  return {
    waitingQueueCounts: queue.length,
  }
}

export const Main = () => {
  const [allVideos, setAllVideos] = useState<Video[]>([])
  const [allTags, setTags] = useState<string[]>([]);

  const [positiveTags, setPositiveTags] = useState<string[]>([])
  const [negativeTags, setNegativeTags] = useState<string[]>([])
  const [queue, setqueue] = useState<Video[]>([])

  const [isGsiLoaded, setGsiLoaded] = useState<boolean>(false)
  const [isGapiLoaded, setGapiLoaded] = useState<boolean>(false)

  const [insertCount, setInsertCount] = useState<{ left: number, total: number } | null>(null)

  // Video | undefined
  const currentVideo = queue[0]

  const thumbnailComponentList = queue.map((video, index) => (
    <img
      src={"https://img.youtube.com/vi/" + video.id + "/maxresdefault.jpg"}
      alt={video.title}
      style={{ "width": "100%" }}
      key={video.id}
      onClick={(e) => {
        setqueue(queue.filter((v, i) => i >= index))
      }}
      loading="lazy"
    ></img>
  ))

  useEffect(() => {
    const p = fetchAllVideos()
    p.then(v => {
      setAllVideos(v)
      setTags(allMetas(v))
    })
  }, []);

  useEffect(() => {
    const gsiElement = document.createElement("script")
    gsiElement.src = "https://accounts.google.com/gsi/client"
    document.body.appendChild(gsiElement)
    gsiElement.onload = () => {
      setGsiLoaded(true)
    }

    const gapiElement = document.createElement("script")
    gapiElement.src = "https://apis.google.com/js/api.js"
    document.body.appendChild(gapiElement)
    gapiElement.onload = () => {
      setGapiLoaded(true)
    }
  }, []);

  useEffect(() => {
    if (isGsiLoaded && isGapiLoaded) {
      gapi.load('client', start);
      client = google.accounts.oauth2.initTokenClient({
        client_id: '325517830582-meq7se7gej200p4laqebpb6bboaqcroe.apps.googleusercontent.com',
        scope: 'https://www.googleapis.com/auth/youtube'
      });
    }
  }, [isGsiLoaded, isGapiLoaded])

  useEffect(() => {
    if (client !== null) {
      client.callback = (response) => {
        const request = gapi.client.youtube.playlists.insert({
          part: 'snippet,status',
          resource: {
            snippet: {
              title: positiveTags.join(" "),
              description: 'VSingerXrossPlayerによる自動生成'
            },
            status: {
              privacyStatus: 'private'
            }
          }
        });
        request.execute(async (response) => {
          const copiedRespose = { ...response } as any

          let queueStatus = { waitingQueueCounts: queue.length }
          setInsertCount({ left: queue.length, total: queue.length })
          const currentStatus = insertVideos(copiedRespose.id, queue)
          while (queueStatus.waitingQueueCounts > 0) {
            const r = currentStatus
            const p = await r.next()
            queueStatus = { ...p.value }
            setInsertCount({ left: queueStatus.waitingQueueCounts, total: queue.length })
          }
        })
      }
    }
  }, [queue]);


  useEffect(() => {
    const videos = filterVideos(allVideos, positiveTags, negativeTags).filter(v => v.id !== queue[0]?.id)
    if (queue[0] !== undefined) {
      setqueue([queue[0], ...videos])
    } else {
      setqueue([...videos])
    }
    // queueが条件に入ってないのは意図的なので、eslintの警告をsuppressする
    //    - queueが消費されただけの時は、queueの再設定不要
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allVideos, positiveTags, negativeTags]);

  return (<>
    <div>
      {client !== null ? <button onClick={() => handleClick(client!)}>プレイリスト作成</button> : null}
      {insertCount !== null && insertCount.left > 0 ? <PlaylistProgressBar left={insertCount.left} total={insertCount.total} />
        : null}
    </div>
    <Stack spacing={3} sx={{ width: 500 }}>
      <Autocomplete
        id="tags-standard"
        multiple
        options={allTags}
        getOptionLabel={(option) => option}
        renderInput={(params) => (
          <TextField
            {...params}
            variant="standard"
            label="検索条件"
          />
        )}
        onChange={(e, v) => {
          setPositiveTags(v)
        }}
        value={positiveTags}
      />
    </Stack >
    <Stack spacing={3} sx={{ width: 500 }}>
      <Autocomplete
        id="tags-standard"
        multiple
        options={allTags}
        getOptionLabel={(option) => option}
        renderInput={(params) => (
          <TextField
            {...params}
            variant="standard"
            label="除外条件"
          />
        )}
        onChange={(e, v) => {
          setNegativeTags(v)
        }}
        value={negativeTags}
      />
    </Stack>
    <Grid container spacing={2}>
      <Grid item xs={8}>
        <YouTubeComponent
          video={currentVideo}
          onEnd={() => {
            let newQueue = queue.filter((v, i) => i >= 1)
            if (newQueue.length === 0) {
              newQueue = filterVideos(allVideos, positiveTags, negativeTags)
            }
            setqueue(newQueue)
          }} />
        <VideoInfoComponent
          video={currentVideo}
          handleSingerChipClick={(singer: string) => {
            if (!positiveTags.includes(singer)) {
              setPositiveTags([...positiveTags, singer])
            }
          }}
          handleSongChipClick={(song: string) => {
            if (!positiveTags.includes(song)) {
              setPositiveTags([...positiveTags, song])
            }
          }}
        />
      </Grid>
      <Grid item xs={4}>
        {thumbnailComponentList}
      </Grid>
    </Grid>
  </>)
}