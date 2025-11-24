import styled from '@emotion/styled';
import { MusicNote } from '@mui/icons-material';
import { Category } from '../types';

interface XMBCategoryProps {
  category: Category;
  isActive: boolean;
}

const CategoryContainer = styled.div<{ isActive: boolean }>`
  padding: 10px 30px;
  transition: all 0.3s ease;
  opacity: ${props => props.isActive ? 1 : 0.5};
  transform: ${props => props.isActive ? 'scale(1.2)' : 'scale(1.0)'};
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 120px;
`;

const IconPlaceholder = styled.div`
  font-size: 20px;
  margin-bottom: 10px;
  width: 48px;
  height: 48px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const CategoryTitle = styled.div<{ isActive: boolean }>`
  font-size: 15px;
  color: white;
  font-weight: ${props => props.isActive ? 'bold' : 'normal'};
`;

export const XMBCategory: React.FC<XMBCategoryProps> = ({ category, isActive }) => {
  return (
    <CategoryContainer isActive={isActive}>
      <IconPlaceholder>
        {category.icon || <MusicNote sx={{ fontSize: 48 }} />}
      </IconPlaceholder>
      <CategoryTitle isActive={isActive}>
        {category.title}
      </CategoryTitle>
    </CategoryContainer>
  );
};
