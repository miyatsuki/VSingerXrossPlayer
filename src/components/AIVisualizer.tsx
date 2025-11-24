import styled from "@emotion/styled";
import React from "react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts";
import { AIStats } from "../types";

interface AIVisualizerProps {
  stats?: AIStats;
  averageStats?: AIStats;
  title?: string;
  size?: number;
  compact?: boolean;
}

const Container = styled.div<{ size: number; compact?: boolean }>`
  width: ${(props) => props.size}px;
  height: ${(props) => props.size}px;
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
  margin: 0 0 10px 0;
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

export const AIVisualizer: React.FC<AIVisualizerProps> = ({
  stats,
  averageStats,
  title,
  size = 350,
  compact = false,
}) => {
  if (!stats) return null;

  const data = [
    {
      subject: "かっこいい",
      A: stats.cool,
      B: averageStats?.cool || 0,
      fullMark: 100,
    },
    {
      subject: "かわいい",
      A: stats.cute,
      B: averageStats?.cute || 0,
      fullMark: 100,
    },
    {
      subject: "元気",
      A: stats.energetic,
      B: averageStats?.energetic || 0,
      fullMark: 100,
    },
    {
      subject: "意外性",
      A: stats.surprising,
      B: averageStats?.surprising || 0,
      fullMark: 100,
    },
    {
      subject: "エモい",
      A: stats.emotional,
      B: averageStats?.emotional || 0,
      fullMark: 100,
    },
  ];

  const paddingSize = compact ? 0 : 40; // Account for padding
  const chartSize = size - paddingSize;
  const titleHeight = (title && !compact) ? 26 : 0;
  const chartHeight = chartSize - titleHeight; // Subtract title height if present

  return (
    <Container size={size} compact={compact}>
      {title && !compact && <Title>{title}</Title>}
      <div style={{ width: chartSize, height: chartHeight, flex: 1 }}>
        <RadarChart width={chartSize} height={chartHeight} cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.2)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "white", fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />

          {/* Specific Stats */}
          <Radar
            name="This Cover"
            dataKey="A"
            stroke="#8884d8"
            strokeWidth={3}
            fill="#8884d8"
            fillOpacity={0.5}
          />

          {/* Average Stats (Only if available) */}
          {averageStats && (
            <Radar
              name="Song Average"
              dataKey="B"
              stroke="#82ca9d"
              strokeWidth={2}
              fill="#82ca9d"
              fillOpacity={0.3}
              strokeDasharray="5 5"
            />
          )}

          <Legend wrapperStyle={{ color: "white", fontSize: "12px" }} />
        </RadarChart>
      </div>
    </Container>
  );
};
