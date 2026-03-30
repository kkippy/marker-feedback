export const BASE_TEXT_LINE_HEIGHT = 1.45;
export const TEXT_FRAME_VERTICAL_PADDING = 4;
export const TEXT_FRAME_HORIZONTAL_PADDING = 4;

export interface TextFrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const getMinTextBoxHeight = (fontSize: number, lineHeight = BASE_TEXT_LINE_HEIGHT) =>
  Math.ceil(fontSize * lineHeight) + TEXT_FRAME_VERTICAL_PADDING * 2;

export const getTextContentFrame = (frame: TextFrameRect): TextFrameRect => ({
  x: TEXT_FRAME_HORIZONTAL_PADDING,
  y: TEXT_FRAME_VERTICAL_PADDING,
  width: Math.max(0, frame.width - TEXT_FRAME_HORIZONTAL_PADDING * 2),
  height: Math.max(0, frame.height - TEXT_FRAME_VERTICAL_PADDING * 2),
});
