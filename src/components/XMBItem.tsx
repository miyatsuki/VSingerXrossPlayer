import styled from '@emotion/styled';
import { Box, Typography } from '@mui/material';
import { Singer, Song } from '../types';

interface XMBItemProps {
  item: Singer | Song & { singer_name?: string; singer_avatar?: string };
  isActive: boolean;
  onClick?: () => void;
}

const ItemContainer = styled.div<{ isActive: boolean }>`
  padding: 10px 20px;
  margin: 5px 0;
  transition: all 0.2s ease;
  transform: ${props => props.isActive ? 'scale(1.1) translateX(20px)' : 'scale(1.0)'};
  opacity: ${props => props.isActive ? 1 : 0.6};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 15px;
  
  &:hover {
    opacity: 1;
  }
`;

const IconWrapper = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%; // Circular for avatars
  overflow: hidden;
  background-color: #333;
  border: 1px solid rgba(255,255,255,0.2);
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

export const XMBItem: React.FC<XMBItemProps> = ({ item, isActive, onClick }) => {
  const isSinger = 'name' in item && !('title' in item); // Strict check
  
  // If it's a Song (Cover), we want to show the Singer's Name
  const title = isSinger 
    ? (item as Singer).name 
    : (item as any).singer_name || (item as Song).title;

  const image = isSinger 
    ? (item as Singer).avatar_url 
    : (item as any).singer_avatar || (item as Song).thumbnail_url;

  return (
    <ItemContainer isActive={isActive} onClick={onClick}>
      {image && (
        <IconWrapper>
          <img src={image} alt={title} />
        </IconWrapper>
      )}
      <Box>
        <Typography variant="body1" color="white" fontWeight={isActive ? 'bold' : 'normal'}>
          {title}
        </Typography>
        {/* If it's a song, maybe show "Cover" or nothing, since the category is the song title */}
      </Box>
    </ItemContainer>
  );
};
