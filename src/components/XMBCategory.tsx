import styled from '@emotion/styled';
import { Typography } from '@mui/material';
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
  font-size: 24px;
  margin-bottom: 10px;
  width: 60px;
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

export const XMBCategory: React.FC<XMBCategoryProps> = ({ category, isActive }) => {
  return (
    <CategoryContainer isActive={isActive}>
      <IconPlaceholder>
        {category.icon || '📁'}
      </IconPlaceholder>
      <Typography variant="subtitle2" color="white" fontWeight={isActive ? 'bold' : 'normal'}>
        {category.title}
      </Typography>
    </CategoryContainer>
  );
};
