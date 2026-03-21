import { css } from '@emotion/css';
import { ATTRIBUTE_ANIMATION } from '.';

export const containerStyle = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 24px;
  background-color: #fff;
  border-radius: 0;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  border: 1px solid #f3f4f6;
  min-height: 200px;
  position: relative;
  overflow: hidden;
  transition: all 250ms ease;

  @media (min-width: 640px) {
    width: 400px;
    max-width: 90vw;
    border-radius: 4px;
    padding: 32px;
  }
`;

export const getLoaderStyle = () => css`
  font-size: 60px;
  width: 1em;
  height: 1em;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px #3b82f633;
  position: relative;

  animation: none;
  &[${ATTRIBUTE_ANIMATION}] {
    animation: rotate 1.2s infinite linear;
  }

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

export const progressStyle = css`
  position: absolute;
  bottom: 0px;
  left: 0;
  width: 0%;
  height: 2px;
  background-color: #2563eb;
  transition: all 350ms ease;
`;
