import styled from "@emotion/styled";
import React from "react";
import { CommentWord } from "../types";

interface WordCloudProps {
  words?: CommentWord[];
  title?: string;
}

const Container = styled.div`
  width: 350px;
  min-height: 200px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 16px;
  padding: 20px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
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

const CloudContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 10px;
`;

interface WordItemProps {
  importance: number;
}

const WordItem = styled.span<WordItemProps>`
  color: ${(props) => `rgba(255, 255, 255, ${0.5 + props.importance / 200})`};
  font-size: ${(props) => `${8 + (props.importance / 100) * 20}px`};
  font-weight: ${(props) => (props.importance > 70 ? "bold" : "normal")};
  transition: all 0.2s ease;
  cursor: default;
  user-select: none;

  &:hover {
    color: #82ca9d;
    transform: scale(1.1);
  }
`;

const EmptyMessage = styled.p`
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  font-size: 14px;
  margin: 20px 0;
`;

export const WordCloud: React.FC<WordCloudProps> = ({ words, title }) => {
  if (!words || words.length === 0) {
    return (
      <Container>
        {title && <Title>{title}</Title>}
        <EmptyMessage>コメントデータがありません</EmptyMessage>
      </Container>
    );
  }

  return (
    <Container>
      {title && <Title>{title}</Title>}
      <CloudContainer>
        {words.map((word, index) => (
          <WordItem key={`${word.word}-${index}`} importance={word.importance}>
            {word.word}
          </WordItem>
        ))}
      </CloudContainer>
    </Container>
  );
};
