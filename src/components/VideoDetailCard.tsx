import styled from "@emotion/styled";
import React from "react";
import { Singer, Song } from "../types";
import { formatPublishedDate, formatViewCount } from "../utils/format";
import { AIVisualizer } from "./AIVisualizer";
import { WordCloud } from "./WordCloud";

interface VideoDetailCardProps {
  song: Song;
  singer?: Singer;
}

const CardContainer = styled.div<{ thumbnailUrl?: string }>`
  position: fixed;
  bottom: 5%;
  right: 5%;
  width: 550px; /* Adjusted from 381px for better readability in browser */
  height: 310px; /* Adjusted from 214px, maintaining ~16:9 aspect ratio */
  max-width: 90vw;
  background-image:
    linear-gradient(
      to right,
      rgba(15, 15, 15, 0.95) 0%,
      rgba(15, 15, 15, 0.85) 50%,
      rgba(15, 15, 15, 0.75) 100%
    ),
    ${props => props.thumbnailUrl ? `url(${props.thumbnailUrl})` : 'none'};
  background-size: cover;
  background-position: center;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  z-index: 100;
  position: relative;
`;

// Word cloud area (left side)
const WordCloudArea = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  width: 280px;
  height: 180px;
`;

// Killer phrase overlay (center-left, prominent)
const KillerPhrase = styled.div`
  position: absolute;
  top: 50%;
  left: 30px;
  transform: translateY(-50%);
  font-size: 28px;
  font-weight: bold;
  color: white;
  text-shadow: 0 4px 8px rgba(0, 0, 0, 0.9), 0 2px 4px rgba(0, 0, 0, 0.8);
  max-width: 250px;
  line-height: 1.3;
  z-index: 10;
  pointer-events: none;
`;

// Singer avatar (top-right)
const AvatarContainer = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  width: 74px;
  height: 74px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
`;

const AvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

// Radar chart (right side, below avatar)
const RadarChartContainer = styled.div`
  position: absolute;
  top: 105px;
  right: 15px;
  width: 140px;
  height: 140px;
`;

// Metadata box (bottom-left, compact)
const MetadataBox = styled.div`
  position: absolute;
  bottom: 15px;
  left: 15px;
  width: 300px;
  min-height: 80px;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
`;

const MetadataLine = styled.div`
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  strong {
    color: white;
    font-weight: 600;
  }
`;

// Thumbnail (bottom-right)
const ThumbnailContainer = styled.div`
  position: absolute;
  bottom: 15px;
  right: 15px;
  width: 145px;
  height: 82px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
`;

const ThumbnailImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const VideoDetailCard: React.FC<VideoDetailCardProps> = ({ song, singer }) => {
  // Fallback to singer avatar if song thumbnail is missing
  const backgroundUrl = song.thumbnail_url || singer?.avatar_url;

  // Get killer phrase: prefer dedicated field, fallback to highest priority comment word
  const killerPhrase = song.killer_phrase
    || (song.comment_cloud && song.comment_cloud.length > 0 ? song.comment_cloud[0].word : null);

  return (
    <CardContainer thumbnailUrl={backgroundUrl}>
      {/* Word cloud in background */}
      <WordCloudArea>
        <WordCloud words={song.comment_cloud} compact={true} />
      </WordCloudArea>

      {/* Killer phrase overlay */}
      {killerPhrase && (
        <KillerPhrase>{killerPhrase}</KillerPhrase>
      )}

      {/* Singer avatar */}
      <AvatarContainer>
        <AvatarImage
          src={singer?.avatar_url || song.thumbnail_url || "/default-avatar.png"}
          alt={singer?.name || "Channel"}
        />
      </AvatarContainer>

      {/* Radar chart */}
      <RadarChartContainer>
        <AIVisualizer
          stats={song.ai_stats}
          averageStats={song.average_stats}
          size={140}
          compact={true}
        />
      </RadarChartContainer>

      {/* Metadata box */}
      <MetadataBox>
        <MetadataLine>
          <strong>動画名:</strong> {song.title}
        </MetadataLine>
        <MetadataLine>
          <strong>チャンネル:</strong> {song.channel_title || singer?.name || "不明"}
        </MetadataLine>
        {song.published_at && (
          <MetadataLine>
            <strong>投稿日:</strong> {formatPublishedDate(song.published_at)}
          </MetadataLine>
        )}
        {song.view_count !== undefined && (
          <MetadataLine>
            <strong>再生数:</strong> {formatViewCount(song.view_count)}回
          </MetadataLine>
        )}
      </MetadataBox>

      {/* Thumbnail */}
      <ThumbnailContainer>
        <ThumbnailImage
          src={song.thumbnail_url || singer?.avatar_url || "/default-thumbnail.png"}
          alt="Video thumbnail"
        />
      </ThumbnailContainer>
    </CardContainer>
  );
};
