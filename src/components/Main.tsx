import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import YouTube, { YouTubeEvent } from 'react-youtube';
import Video from "../types/video";


function shuffle(videos: Video[]) {
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

export async function fetchAllVideos() {
  let allVideos: Video[] = []
  for (let i = 0; ; i++) {
    const res = await supabase.from('videos').select("video_id, video_title, song_title, identifier, singers, tags").range(i * 1000, (i + 1) * 1000)
    if (res.data === null) {
      break
    }

    const videos = res.data.map(r => (
      {
        id: r.video_id,
        title: r.video_title,
        song: r.identifier ? `${r.song_title} (${r.identifier})` : r.song_title,
        singers: r.singers,
        tags: r.tags
      }
    ))
    allVideos = allVideos.concat(videos)

    if (res.data.length < 1000) {
      break
    }
  }

  return shuffle(allVideos)
}



export function allSongs(allVideos: Video[]) {
  const songSet: Set<string> = new Set()
  allVideos.forEach(video => {
    songSet.add(video.song)
  })
  return [...songSet].sort()
}

export function allSingers(allVideos: Video[]) {
  const singerSet: Set<string> = new Set()
  allVideos.forEach(video => {
    video.singers.forEach(singer => {
      singerSet.add(singer)
    })
  })
  return [...singerSet].sort()
}

function filterVideos(allVideos: Video[], singer: string | null, song: string | null) {
  let videos = [...allVideos]

  if (singer !== null) {
    videos = videos.filter(video => video.singers.includes(singer))
  }

  if (song !== null) {
    videos = videos.filter(video => video.song === song)
  }

  // 100件以上返ってきたらフィルタする
  return videos.filter((v, i) => i < 100)
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


export const Main = () => {
  const [allVideos, setAllVideos] = useState([] as Video[])
  const [singers, setSingers] = useState([] as string[]);
  const [songs, setSongs] = useState([] as string[]);

  const [selectedSinger, setSelectedSinger] = useState(null as string | null)
  const [selectedSong, setSelectedSong] = useState(null as string | null)

  const [queue, setqueue] = useState([] as Video[])

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
      setSongs(allSongs(v))
      setSingers(allSingers(v))
    })
  }, []);

  useEffect(() => {
    const videos = filterVideos(allVideos, selectedSinger, selectedSong).filter(v => v.id !== queue[0]?.id)
    if (queue[0] !== undefined) {
      setqueue([queue[0], ...videos])
    } else {
      setqueue([...videos])
    }
    // queueが条件に入ってないのは意図的なので、eslintの警告をsuppressする
    //    - queueが消費されただけの時は、queueの再設定不要
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allVideos, selectedSinger, selectedSong]);

  return (<>
    <Stack spacing={3} sx={{ width: 500 }}>
      <Autocomplete
        id="tags-standard"
        options={singers}
        getOptionLabel={(option) => option}
        renderInput={(params) => (
          <TextField
            {...params}
            variant="standard"
            label="歌い手"
          />
        )}
        onChange={(e, v) => {
          setSelectedSinger(v)
        }}
        value={selectedSinger}
      />
      <Autocomplete
        id="tags-standard"
        options={songs}
        getOptionLabel={(option) => option}
        renderInput={(params) => (
          <TextField
            {...params}
            variant="standard"
            label="曲名"
          />
        )}
        onChange={(e, v) => {
          setSelectedSong(v)
        }}
        value={selectedSong}
      />
    </Stack>
    <Grid container spacing={2}>
      <Grid item xs={8}>
        <YouTubeComponent
          video={currentVideo}
          onEnd={() => {
            let newQueue = queue.filter((v, i) => i >= 1)
            if (newQueue.length === 0) {
              newQueue = filterVideos(allVideos, selectedSinger, selectedSong)
            }
            setqueue(newQueue)
          }} />
        <VideoInfoComponent
          video={currentVideo}
          handleSingerChipClick={(singer: string) => {
            setSelectedSinger(singer)
            setSelectedSong(null)
          }}
          handleSongChipClick={(song: string) => {
            setSelectedSong(song)
            setSelectedSinger(null)
          }}
        />
      </Grid>
      <Grid item xs={4}>
        {thumbnailComponentList}
      </Grid>
    </Grid>
  </>)
}