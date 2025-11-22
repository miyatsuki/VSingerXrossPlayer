import styled from '@emotion/styled';
import React from 'react';
import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import { AIStats } from '../types';

interface AIVisualizerProps {
  stats?: AIStats;
  averageStats?: AIStats;
  title?: string;
}

const Container = styled.div`
  width: 350px;
  height: 350px;
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
  margin: 0 0 10px 0;
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

export const AIVisualizer: React.FC<AIVisualizerProps> = ({ stats, averageStats, title }) => {
  if (!stats) return null;

  const data = [
    { 
      subject: 'Energy', 
      A: stats.energy, 
      B: averageStats?.energy || 0, 
      fullMark: 100 
    },
    { 
      subject: 'Mood', 
      A: stats.mood, 
      B: averageStats?.mood || 0, 
      fullMark: 100 
    },
    { 
      subject: 'Vocal', 
      A: stats.vocal, 
      B: averageStats?.vocal || 0, 
      fullMark: 100 
    },
    { 
      subject: 'Inst', 
      A: stats.instrumental, 
      B: averageStats?.instrumental || 0, 
      fullMark: 100 
    },
  ];

  return (
    <Container>
      {title && <Title>{title}</Title>}
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.2)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: 'white', fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          
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
          
          <Legend wrapperStyle={{ color: 'white', fontSize: '12px' }} />
        </RadarChart>
      </ResponsiveContainer>
    </Container>
  );
};
