import styled from "@emotion/styled";
import React from "react";
import YouTube from "react-youtube";

interface BackgroundVideoProps {
  videoId?: string;
  startTime?: number; // サビ開始時間（秒）
}

const VideoContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  overflow: hidden;
  opacity: 0.3;
  pointer-events: none;
`;

const StyledYouTube = styled(YouTube)`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100vw;
  height: 100vh;
  transform: translate(-50%, -50%) scale(1.5); // Scale up to cover borders

  iframe {
    width: 100%;
    height: 100%;
  }
`;

export const BackgroundVideo: React.FC<BackgroundVideoProps> = ({
  videoId,
  startTime,
}) => {
  if (!videoId) return null;

  const opts = {
    height: "100%",
    width: "100%",
    playerVars: {
      autoplay: 1,
      controls: 0,
      mute: 1, // Mute for background
      loop: 1,
      playlist: videoId, // Required for loop
      start: startTime || 0, // サビ開始時間を設定（デフォルトは0秒から）
    },
  };

  return (
    <VideoContainer>
      <StyledYouTube videoId={videoId} opts={opts} />
    </VideoContainer>
  );
};
