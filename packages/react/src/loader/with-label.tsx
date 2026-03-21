import styled from '@emotion/styled';
import { FC } from 'react';
import { Loader } from './animation';

type WithClassName<T> = T & { className?: string };
type Props = Readonly<{ label: string; size?: number }>;

const Component: FC<WithClassName<Props>> = ({ className, label, size }) => (
  <div {...{ className }}>
    <Loader size={size} />
    <p>{label}</p>
  </div>
);

const StyledComponent = styled(Component)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 32px;
  padding: 32px 8px;

  > p {
    color: #0007;
    margin: 0;
  }
`;

export const LoaderWithLabel = StyledComponent;
