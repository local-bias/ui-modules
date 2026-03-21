import styled from '@emotion/styled';
import { ComponentProps } from 'react';

type Props = { size?: string | number } & ComponentProps<'div'>;

const LoaderStyle = styled.div<Props>`
  font-size: ${({ size = '60px' }) => (typeof size === 'number' ? `${size}px` : size)};
  width: 1em;
  height: 1em;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px #3b82f633;
  position: relative;
  > div {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 0.5em;
    height: 1em;
    margin-left: -0.5em;
    margin-top: -0.5em;
    overflow: hidden;
    transform-origin: 0.5em 0.5em;
    mask-image: linear-gradient(top, #000f, #0000);
    -webkit-mask-image: -webkit-linear-gradient(top, #000f, #0000);
    animation: rotate 1.2s infinite linear;

    > div {
      width: 1em;
      height: 1em;
      border-radius: 50%;
      box-shadow: inset 0 0 0 1px #3b82f6;
    }
  }

  @keyframes rotate {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

export function Loader({ size, ...divProps }: Props) {
  return (
    <LoaderStyle size={size} {...divProps}>
      <div>
        <div></div>
      </div>
    </LoaderStyle>
  );
}
