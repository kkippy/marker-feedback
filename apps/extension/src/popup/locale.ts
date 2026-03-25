export type PopupLocale = 'en' | 'zh-CN';

export interface PopupMessages {
  title: string;
  description: string;
  actions: {
    upload: string;
    capture: string;
    latestDraft: string;
  };
  status: {
    ready: string;
    capturing: string;
    captureFailed: string;
    openedCapture: string;
    openedFile: (fileName: string) => string;
  };
}

export const resolvePopupLocale = (language?: string | null): PopupLocale =>
  language?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

export const popupMessages: Record<PopupLocale, PopupMessages> = {
  en: {
    title: 'Quick intake',
    description:
      'Upload a local image or capture the current tab, then continue editing in the web app.',
    actions: {
      upload: 'Upload local image',
      capture: 'Capture current tab',
      latestDraft: 'Open latest draft',
    },
    status: {
      ready: 'Ready',
      capturing: 'Capturing current tab...',
      captureFailed: 'Capture failed',
      openedCapture: 'Opened editor with capture',
      openedFile: (fileName) => `Opened ${fileName}`,
    },
  },
  'zh-CN': {
    title: '快速导入',
    description: '上传本地图片，或截取当前标签页，然后继续在 Web 编辑器里处理。',
    actions: {
      upload: '上传本地图片',
      capture: '截取当前标签页',
      latestDraft: '打开最新草稿',
    },
    status: {
      ready: '准备就绪',
      capturing: '正在截取当前标签页…',
      captureFailed: '截取失败',
      openedCapture: '已打开带截图的编辑器',
      openedFile: (fileName) => `已打开 ${fileName}`,
    },
  },
};
