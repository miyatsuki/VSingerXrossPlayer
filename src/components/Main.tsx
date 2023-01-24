import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
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

export async function fetchAllVideos() {
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

function filterVideos(allVideos: Video[], positiveTags: string[], negativeTags: string[]) {
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


export const Main = () => {
  const [allVideos, setAllVideos] = useState<Video[]>([])
  const [allTags, setTags] = useState<string[]>([]);

  const [positiveTags, setPositiveTags] = useState<string[]>([])
  const [negativeTags, setNegativeTags] = useState<string[]>([])
  const [queue, setqueue] = useState<Video[]>([])

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
    </Stack>
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