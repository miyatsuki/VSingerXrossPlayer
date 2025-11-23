import styled from "@emotion/styled";
import React, { useEffect } from "react";
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

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  startTime,
  onClose,
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const opts = {
    height: "100%",
    width: "100%",
    playerVars: {
      autoplay: 1,
      controls: 1,
      start: startTime || 0,
    },
  };

  return (
    <ModalOverlay onClick={onClose}>
      <PlayerContainer onClick={(e) => e.stopPropagation()}>
        <CloseButton onClick={onClose}>Close (ESC)</CloseButton>
        <YouTube videoId={videoId} opts={opts} style={{ height: "100%" }} />
      </PlayerContainer>
    </ModalOverlay>
  );
};
