import styled from "@emotion/styled";
import React from "react";
import { WordCloud as IsoterikWordCloud } from "@isoterik/react-word-cloud";
import { CommentWord } from "../types";

interface WordCloudProps {
  words?: CommentWord[];
  title?: string;
  compact?: boolean;
}

const Container = styled.div<{ compact?: boolean }>`
  width: ${(props) => (props.compact ? "100%" : "350px")};
  min-height: ${(props) => (props.compact ? "150px" : "200px")};
  background: ${(props) => (props.compact ? "transparent" : "rgba(0, 0, 0, 0.7)")};
  border-radius: ${(props) => (props.compact ? "0" : "16px")};
  padding: ${(props) => (props.compact ? "0" : "20px")};
  backdrop-filter: ${(props) => (props.compact ? "none" : "blur(10px)")};
  border: ${(props) => (props.compact ? "none" : "1px solid rgba(255, 255, 255, 0.1)")};
  display: flex;
  flex-direction: column;
`;

const Title = styled.h3`
  color: white;
  text-align: center;
  margin: 0 0 16px 0;
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const CloudWrapper = styled.div`
  flex: 1;
  min-height: 120px;
  position: relative;
`;

const EmptyMessage = styled.p`
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  font-size: 14px;
  margin: 20px 0;
`;

export const WordCloud: React.FC<WordCloudProps> = ({ words, title, compact }) => {
  if (!words || words.length === 0) {
    return (
      <Container compact={compact}>
        {title && !compact && <Title>{title}</Title>}
        <EmptyMessage>コメントデータがありません</EmptyMessage>
      </Container>
    );
  }

  // Transform CommentWord[] to format expected by library
  const cloudWords = words.map((w) => ({
    text: w.word,
    value: w.importance,
  }));

  return (
    <Container compact={compact}>
      {title && !compact && <Title>{title}</Title>}
      <CloudWrapper>
        <IsoterikWordCloud
          words={cloudWords}
          options={{
            // Font size range: 10-28px
            fontSizes: [10, 28] as [number, number],

            // No rotation for cleaner look
            rotations: 1,
            rotationAngles: [0] as [number, number],

            // Padding between words
            padding: 3,

            // Enable spiral layout for organic positioning
            spiral: "archimedean",

            // Scale type
            scale: "linear",

            // Font weight based on importance
            fontWeight: (word) => (word.value > 70 ? "bold" : "normal"),

            // Transition duration for animations
            transitionDuration: 200,
          }}
          callbacks={{
            // Color function based on importance
            getWordColor: (word) => {
              const opacity = 0.5 + word.value / 200;
              return `rgba(255, 255, 255, ${opacity})`;
            },

            // Hover effects
            onWordMouseOver: (word, event) => {
              if (event && event.currentTarget) {
                (event.currentTarget as HTMLElement).style.color = "#82ca9d";
                (event.currentTarget as HTMLElement).style.transform = "scale(1.1)";
              }
            },

            onWordMouseOut: (word, event) => {
              if (event && event.currentTarget) {
                const opacity = 0.5 + word.value / 200;
                (event.currentTarget as HTMLElement).style.color = `rgba(255, 255, 255, ${opacity})`;
                (event.currentTarget as HTMLElement).style.transform = "scale(1)";
              }
            },
          }}
        />
      </CloudWrapper>
    </Container>
  );
};
