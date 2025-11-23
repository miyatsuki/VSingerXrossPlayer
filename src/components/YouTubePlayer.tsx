import styled from "@emotion/styled";
import React, { useEffect, useRef } from "react";
import YouTube from "react-youtube";

interface YouTubePlayerProps {
  videoId: string;
  startTime?: number;
  onClose: () => void;
}

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const PlayerContainer = styled.div`
  width: 90vw;
  max-width: 1200px;
  aspect-ratio: 16 / 9;
  position: relative;
`;

const CloseButton = styled.button`
  position: absolute;
  top: -40px;
  right: 0;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 16px;
  border-radius: 4px;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const PRE_START_OFFSET = 5; // サビの何秒前から開始
const FADE_IN_DURATION = 4000; // フェードイン時間（ミリ秒）
const FADE_INTERVAL = 50; // 音量更新間隔（ミリ秒）
const MAX_VOLUME = 100; // 最終音量

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  startTime,
  onClose,
}) => {
  const playerRef = useRef<any>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    // クリーンアップ: コンポーネントアンマウント時にインターバルをクリア
    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, []);

  const handleReady = (event: any) => {
    playerRef.current = event.target;
    const player = playerRef.current;

    // 初期音量を0に設定
    player.setVolume(0);

    // フェードイン処理
    const volumeIncrement = MAX_VOLUME / (FADE_IN_DURATION / FADE_INTERVAL);
    let currentVolume = 0;

    fadeIntervalRef.current = setInterval(() => {
      currentVolume += volumeIncrement;
      if (currentVolume >= MAX_VOLUME) {
        player.setVolume(MAX_VOLUME);
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
        }
      } else {
        player.setVolume(currentVolume);
      }
    }, FADE_INTERVAL);
  };

  const opts = {
    height: "100%",
    width: "100%",
    playerVars: {
      autoplay: 1,
      controls: 1,
      start: Math.max(0, (startTime || 0) - PRE_START_OFFSET), // サビの3秒前から開始（負の値にならないように）
    },
  };

  return (
    <ModalOverlay onClick={onClose}>
      <PlayerContainer onClick={(e) => e.stopPropagation()}>
        <CloseButton onClick={onClose}>Close (ESC)</CloseButton>
        <YouTube
          videoId={videoId}
          opts={opts}
          style={{ height: "100%" }}
          onReady={handleReady}
        />
      </PlayerContainer>
    </ModalOverlay>
  );
};
