import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import { CardMedia } from "@mui/material";
import AppBar from "@mui/material/AppBar";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";
import * as React from "react";
import { useEffect, useState } from "react";
import { fetchVideos } from "../api/client";
import Video from "../types/video";

export default function ButtonAppBar() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar component="nav">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Vsinger Xross Playlist
          </Typography>
          {client !== null ? (
            <IconButton
              size="large"
              edge="end"
              color="inherit"
              aria-label="playlistAdd"
              onClick={() => {
                handleClick(client!);
              }}
            >
              <PlaylistAddIcon />
            </IconButton>
          ) : null}
        </Toolbar>
      </AppBar>
    </Box>
  );
}

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#fff",
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: "center",
  color: theme.palette.text.secondary,
}));

const shuffleVideos = (videos: Video[]) => {
  const copiedVideos = [...videos];
  for (let i = copiedVideos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = { ...copiedVideos[j] };
    copiedVideos[j] = { ...copiedVideos[i] };
    copiedVideos[i] = { ...tmp };
  }

  return copiedVideos;
};

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY!;

const start = () => {
  // 2. Initialize the JavaScript client library.
  gapi.client
    .init({
      apiKey: GOOGLE_API_KEY,
    })
    .then(() => {
      gapi.client.load(
        "https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest"
      );
    });
};
let client: null | ReturnType<typeof google.accounts.oauth2.initTokenClient> =
  null;

const handleClick = (
  client: ReturnType<typeof google.accounts.oauth2.initTokenClient>
) => {
  // Conditionally ask users to select the Google Account they'd like to use,
  // and explicitly obtain their consent to fetch their Calendar.
  // NOTE: To request an access token a user gesture is necessary.
  if (gapi.client.getToken() === null) {
    // Prompt the user to select a Google Account and asked for consent to share their data
    // when establishing a new session.
    client.requestAccessToken({ prompt: "consent" });
  } else {
    // Skip display of account chooser and consent dialog for an existing session.
    client.requestAccessToken({ prompt: "" });
  }
};

const fetchAllVideos = async () => {
  const apiVideos = await fetchVideos();
  const mapped: Video[] = apiVideos.map((v) => {
    const metas: string[] = [];
    const songTitle = v.song_title ?? null;

    if (songTitle !== null && songTitle !== undefined) {
      metas.push(songTitle);
    }

    const singers = v.singers ?? [];
    if (singers.length > 0) {
      metas.push(...singers);
    }

    const tags = v.tags ?? [];
    if (tags.length > 0) {
      metas.push(...tags);
    }

    return {
      id: v.video_id,
      title: v.video_title,
      song: songTitle,
      singers: singers,
      tags: tags,
      metas: metas,
    };
  });

  return shuffleVideos(mapped);
};

const allMetas = (allVideos: Video[]) => {
  const ans: Set<string> = new Set();

  allVideos.forEach((video) => {
    video.metas.forEach((meta) => {
      ans.add(meta);
    });
  });

  return [...ans].sort();
};

const filterVideos = (
  allVideos: Video[],
  positiveTags: string[],
  negativeTags: string[]
) => {
  const videos = [...allVideos];

  return (
    videos
      // 検索条件に一つでもマッチしたら返す
      .filter((v) => positiveTags.some((t) => v.metas.includes(t)))
      // 除外条件に一つでもマッチしたら却下する
      .filter((v) => !negativeTags.some((t) => v.metas.includes(t)))
      // 100件以上返ってきたらフィルタする
      .filter((v, i) => i < 100)
  );
};

const insertPlaylist = (playlistId: string, videoId: string) => {
  const request = gapi.client.youtube.playlistItems.insert({
    part: "snippet",
    resource: {
      snippet: {
        playlistId: playlistId,
        resourceId: {
          kind: "youtube#video",
          videoId: videoId,
        },
      },
    },
  });
  return new Promise<void>((resolve, reject) => {
    request.execute((response) => {
      const r = response as
        | typeof response
        | { code: number; error: { message: string } };
      if ("code" in r) {
        reject(r);
      } else {
        resolve();
      }
    });
  });
};

const PlaylistProgressBar: React.FC<{ left: number; total: number }> = ({
  left,
  total,
}) => {
  return (
    <>
      <LinearProgress
        variant="determinate"
        value={100 - (left / total) * 100}
      />
      <span>
        {left} / {total}
      </span>
    </>
  );
};

async function* insertVideos(playlistId: string, videos: Video[]) {
  const queue = [...videos];
  while (queue.length > 0) {
    yield {
      waitingQueueCounts: queue.length,
    };
    const video = queue.shift()!;
    try {
      await insertPlaylist(playlistId, video.id);
    } catch (err) {
      const e = err as { code: number; error: { message: string } };
      if (e.code === 500) {
        queue.push(video);
      }
    }
  }
  return {
    waitingQueueCounts: queue.length,
  };
}

export const Main = () => {
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [allTags, setTags] = useState<string[]>([]);

  const [positiveTags, setPositiveTags] = useState<string[]>([]);
  const [negativeTags, setNegativeTags] = useState<string[]>([]);
  const [queue, setqueue] = useState<Video[]>([]);

  const [isGsiLoaded, setGsiLoaded] = useState<boolean>(false);
  const [isGapiLoaded, setGapiLoaded] = useState<boolean>(false);

  const [insertCount, setInsertCount] = useState<{
    left: number;
    total: number;
  } | null>(null);

  const thumbnailComponentList = queue.map((video, index) => (
    <Item key={video.id}>
      <Grid container>
        <Grid xs={4} item>
          <CardMedia
            component={"img"}
            image={"https://img.youtube.com/vi/" + video.id + "/hqdefault.jpg"}
            alt={video.title}
            sx={{ width: "100%", objectFit: "cover", aspectRatio: "4/3" }}
            loading="lazy"
          />
        </Grid>
        <Grid xs={8} item>
          <div style={{ textAlign: "left", paddingLeft: "10px" }}>
            <div
              style={{
                textOverflow: "ellipsis",
                overflow: "hidden",
                whiteSpace: "nowrap",
                height: "2em",
              }}
            >
              {video.title}
            </div>
            <div>{video.song}</div>
            <div>{video.singers.join(", ")}</div>
            <div>{video.tags?.map((t) => "#" + t).join(", ")}</div>
          </div>
        </Grid>
      </Grid>
    </Item>
  ));

  useEffect(() => {
    const p = fetchAllVideos();
    p.then((v) => {
      setAllVideos(v);
      setTags(allMetas(v));
    });
  }, []);

  useEffect(() => {
    const gsiElement = document.createElement("script");
    gsiElement.src = "https://accounts.google.com/gsi/client";
    document.body.appendChild(gsiElement);
    gsiElement.onload = () => {
      setGsiLoaded(true);
    };

    const gapiElement = document.createElement("script");
    gapiElement.src = "https://apis.google.com/js/api.js";
    document.body.appendChild(gapiElement);
    gapiElement.onload = () => {
      setGapiLoaded(true);
    };
  }, []);

  useEffect(() => {
    if (isGsiLoaded && isGapiLoaded) {
      gapi.load("client", start);
      client = google.accounts.oauth2.initTokenClient({
        client_id:
          "325517830582-meq7se7gej200p4laqebpb6bboaqcroe.apps.googleusercontent.com",
        scope: "https://www.googleapis.com/auth/youtube",
      });
    }
  }, [isGsiLoaded, isGapiLoaded]);

  useEffect(() => {
    if (client !== null) {
      client.callback = (response) => {
        const request = gapi.client.youtube.playlists.insert({
          part: "snippet,status",
          resource: {
            snippet: {
              title: positiveTags.join(" "),
              description: "VSingerXrossPlayerによる自動生成",
            },
            status: {
              privacyStatus: "private",
            },
          },
        });
        request.execute(async (response) => {
          const copiedRespose = { ...response } as any;

          let queueStatus = { waitingQueueCounts: queue.length };
          setInsertCount({ left: queue.length, total: queue.length });
          const currentStatus = insertVideos(copiedRespose.id, queue);
          while (queueStatus.waitingQueueCounts > 0) {
            const r = currentStatus;
            const p = await r.next();
            queueStatus = { ...p.value };
            setInsertCount({
              left: queueStatus.waitingQueueCounts,
              total: queue.length,
            });
          }
        });
      };
    }
  }, [queue]);

  useEffect(() => {
    const videos = filterVideos(allVideos, positiveTags, negativeTags).filter(
      (v) => v.id !== queue[0]?.id
    );
    setqueue([...videos]);
    // queueが条件に入ってないのは意図的なので、eslintの警告をsuppressする
    //    - queueが消費されただけの時は、queueの再設定不要
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allVideos, positiveTags, negativeTags]);

  return (
    <>
      <CssBaseline />
      <ButtonAppBar />
      <Box component="main" sx={{ p: 2, paddingTop: 10 }}>
        <div>
          {insertCount !== null && insertCount.left > 0 ? (
            <PlaylistProgressBar
              left={insertCount.left}
              total={insertCount.total}
            />
          ) : null}
        </div>
        <Stack spacing={0}>
          <Autocomplete
            id="tags-standard"
            multiple
            options={allTags}
            getOptionLabel={(option) => option}
            renderInput={(params) => (
              <TextField {...params} variant="standard" label="検索条件" />
            )}
            onChange={(e, v) => {
              setPositiveTags(v);
            }}
            value={positiveTags}
          />
          <Autocomplete
            id="tags-standard"
            multiple
            options={allTags}
            getOptionLabel={(option) => option}
            renderInput={(params) => (
              <TextField {...params} variant="standard" label="除外条件" />
            )}
            onChange={(e, v) => {
              setNegativeTags(v);
            }}
            value={negativeTags}
          />
          <Box sx={{ paddingTop: 4 }}>
            <Stack spacing={1}>{thumbnailComponentList}</Stack>
          </Box>
        </Stack>
      </Box>
    </>
  );
};
