import { css } from '@emotion/css';
import { ATTRIBUTE_KEY, ATTRIBUTE_SHOWN } from '.';

export const getBodyStyle = () => css`
  overflow: visible;
  &[${ATTRIBUTE_KEY}] {
    overflow: hidden;
  }
`;

export const getRootStyle = () => css`
  font-family: 'Yu Gothic Medium', '游ゴシック', YuGothic, 'メイリオ', 'Hiragino Kaku Gothic ProN',
    Meiryo, sans-serif;
  color: #356;
  font-size: 14px;

  overflow: hidden;
  background-color: #fffb;
  backdrop-filter: blur(4px);
  box-sizing: content-box;

  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;

  display: grid;
  transition: all 250ms ease;
  z-index: 1000;
  opacity: 0;
  transition: all 250ms ease;

  place-items: end stretch;
  @media (min-width: 640px) {
    font-size: 16px;
    place-items: center;
  }

  opacity: 0;
  pointer-events: none;
  &[${ATTRIBUTE_SHOWN}] {
    opacity: 1;
    pointer-events: all;
  }
`;
