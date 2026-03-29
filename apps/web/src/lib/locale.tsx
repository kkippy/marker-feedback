import type { AnnotationTool } from '@marker/shared';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type SupportedLocale = 'en' | 'zh-CN';
export type LocalePreference = 'system' | SupportedLocale;

const STORAGE_KEY = 'marker.locale.preference';

export const localePreferences: LocalePreference[] = ['system', 'zh-CN', 'en'];

export interface WebMessages {
  common: {
    you: string;
  };
  language: {
    label: string;
    selectAriaLabel: string;
    options: Record<LocalePreference, string>;
  };
  topBar: {
    annotations: (count: number) => string;
    threads: (count: number) => string;
    zoom: (percent: number) => string;
    currentMode: (label: string) => string;
    zoomOutAriaLabel: string;
    zoomInAriaLabel: string;
    reset: string;
    exportPng: string;
    saveDraft: string;
    createShareLink: string;
  };
  editor: {
    intakeEyebrow: string;
    intakeTitle: string;
    intakeDescription: string;
    uploadImage: string;
    openLatestDraft: string;
    recentDraftsTitle: string;
    recentDraftsDescription: string;
    noDrafts: string;
    draftSummary: (annotationCount: number, hasAsset: boolean) => string;
    replaceImage: string;
    undo: string;
    redo: string;
  };
  comments: {
    title: string;
    description: string;
    selectedAnnotation: (annotationId: string) => string;
    noAnnotationSelected: string;
    composerPlaceholder: string;
    addComment: string;
    noComments: string;
    linkedTo: (annotationId: string) => string;
    generalFeedbackLabel: string;
    annotationFeedbackTitle: string;
    generalFeedbackTitle: string;
    statusOpen: string;
    statusResolved: string;
    replyPlaceholder: string;
    reply: string;
  };
  tools: {
    title: string;
    labels: Record<AnnotationTool, string>;
  };
  contextMenu: {
    addText: string;
    rectangle: string;
    arrow: string;
    highlight: string;
    marker: string;
    callout: string;
    imageCallout: string;
    editText: string;
    replaceImage: string;
    copy: string;
    delete: string;
    bringToFront: string;
  };
  annotation: {
    textPromptTitle: string;
    textPromptDefault: string;
  };
  share: {
    loading: string;
    missingTitle: string;
    missingDescription: string;
    openEditor: string;
    eyebrow: string;
    token: (token: string) => string;
    description: string;
    backToEditor: string;
  };
}

const messages: Record<SupportedLocale, WebMessages> = {
  en: {
    common: {
      you: 'You',
    },
    language: {
      label: 'Language',
      selectAriaLabel: 'Choose interface language',
      options: {
        system: 'Follow system',
        'zh-CN': 'Simplified Chinese',
        en: 'English',
      },
    },
    topBar: {
      annotations: (count) => `${count} annotations`,
      threads: (count) => `${count} threads`,
      zoom: (percent) => `Zoom ${percent}%`,
      currentMode: (label) => `Mode: ${label}`,
      zoomOutAriaLabel: 'Zoom out',
      zoomInAriaLabel: 'Zoom in',
      reset: 'Reset',
      exportPng: 'Export PNG',
      saveDraft: 'Save Draft',
      createShareLink: 'Create Share Link',
    },
    editor: {
      intakeEyebrow: 'Asset intake',
      intakeTitle: 'Start a feedback session',
      intakeDescription:
        'Upload a local image, open a recent draft, or let the extension open this page with a captured tab image.',
      uploadImage: 'Upload image',
      openLatestDraft: 'Open latest draft',
      recentDraftsTitle: 'Recent drafts',
      recentDraftsDescription: 'Resume previous edits without re-uploading the image.',
      noDrafts: 'No drafts yet.',
      draftSummary: (annotationCount, hasAsset) =>
        `${annotationCount} annotations · ${hasAsset ? 'image ready' : 'missing asset'}`,
      replaceImage: 'Replace image',
      undo: 'Undo',
      redo: 'Redo',
    },
    comments: {
      title: 'Discussion',
      description: 'Create general comments or attach feedback to the selected annotation.',
      selectedAnnotation: (annotationId) => `Selected annotation: ${annotationId}`,
      noAnnotationSelected: 'No annotation selected',
      composerPlaceholder: 'Describe the issue, suggestion, or approval note...',
      addComment: 'Add comment',
      noComments: 'No comments yet.',
      linkedTo: (annotationId) => `Linked to ${annotationId}`,
      generalFeedbackLabel: 'General feedback',
      annotationFeedbackTitle: 'Annotation feedback',
      generalFeedbackTitle: 'General feedback',
      statusOpen: 'Open',
      statusResolved: 'Resolved',
      replyPlaceholder: 'Reply to this thread...',
      reply: 'Reply',
    },
    tools: {
      title: 'Tools',
      labels: {
        select: 'Select',
        rectangle: 'Rect',
        arrow: 'Arrow',
        highlight: 'Highlight',
        text: 'Text',
        blur: 'Blur',
        marker: 'Marker',
        callout: 'Callout',
        'image-callout': 'Image Callout',
      },
    },
    contextMenu: {
      addText: 'Add text',
      rectangle: 'Rectangle',
      arrow: 'Arrow',
      highlight: 'Highlight',
      marker: 'Marker',
      callout: 'Callout',
      imageCallout: 'Image callout',
      editText: 'Edit text',
      replaceImage: 'Replace image',
      copy: 'Copy',
      delete: 'Delete',
      bringToFront: 'Bring to front',
    },
    annotation: {
      textPromptTitle: 'Text note',
      textPromptDefault: 'Add note',
    },
    share: {
      loading: 'Loading shared feedback...',
      missingTitle: 'Share link not found',
      missingDescription:
        'This token does not exist in local storage. Create a share link from the editor first.',
      openEditor: 'Open editor',
      eyebrow: 'Shared review',
      token: (token) => `Token: ${token}`,
      description: 'Anonymous collaborators can reply and toggle issue status.',
      backToEditor: 'Back to editor',
    },
  },
  'zh-CN': {
    common: {
      you: '你',
    },
    language: {
      label: '语言',
      selectAriaLabel: '选择界面语言',
      options: {
        system: '跟随系统',
        'zh-CN': '简体中文',
        en: 'English',
      },
    },
    topBar: {
      annotations: (count) => `${count} 个标注`,
      threads: (count) => `${count} 条讨论`,
      zoom: (percent) => `缩放 ${percent}%`,
      currentMode: (label) => `当前模式：${label}`,
      zoomOutAriaLabel: '缩小',
      zoomInAriaLabel: '放大',
      reset: '重置',
      exportPng: '导出 PNG',
      saveDraft: '保存草稿',
      createShareLink: '创建分享链接',
    },
    editor: {
      intakeEyebrow: '素材导入',
      intakeTitle: '开始一轮反馈',
      intakeDescription:
        '上传本地图像、打开最近草稿，或让扩展携带当前标签页截图直接进入编辑器。',
      uploadImage: '上传图片',
      openLatestDraft: '打开最新草稿',
      recentDraftsTitle: '最近草稿',
      recentDraftsDescription: '无需重新上传图片，继续之前的编辑。',
      noDrafts: '还没有草稿。',
      draftSummary: (annotationCount, hasAsset) =>
        `${annotationCount} 个标注 · ${hasAsset ? '图片已就绪' : '缺少图片资源'}`,
      replaceImage: '替换图片',
      undo: '撤销',
      redo: '重做',
    },
    comments: {
      title: '讨论',
      description: '可以创建通用评论，或把反馈关联到当前选中的标注。',
      selectedAnnotation: (annotationId) => `当前选中标注：${annotationId}`,
      noAnnotationSelected: '当前未选中标注',
      composerPlaceholder: '描述问题、建议，或确认说明...',
      addComment: '添加评论',
      noComments: '还没有评论。',
      linkedTo: (annotationId) => `关联到 ${annotationId}`,
      generalFeedbackLabel: '通用反馈',
      annotationFeedbackTitle: '标注反馈',
      generalFeedbackTitle: '通用反馈',
      statusOpen: '待处理',
      statusResolved: '已解决',
      replyPlaceholder: '回复这条讨论...',
      reply: '回复',
    },
    tools: {
      title: '工具',
      labels: {
        select: '选择',
        rectangle: '矩形',
        arrow: '箭头',
        highlight: '高亮',
        text: '文本',
        blur: '模糊',
        marker: '编号',
        callout: '引出',
        'image-callout': '图引出',
      },
    },
    contextMenu: {
      addText: '添加文本',
      rectangle: '矩形',
      arrow: '箭头',
      highlight: '高亮',
      marker: '编号',
      callout: '引出区域',
      imageCallout: '图引出',
      editText: '编辑文本',
      replaceImage: '替换图片',
      copy: '复制',
      delete: '删除',
      bringToFront: '置于顶层',
    },
    annotation: {
      textPromptTitle: '文本备注',
      textPromptDefault: '输入备注内容',
    },
    share: {
      loading: '正在加载分享反馈...',
      missingTitle: '未找到分享链接',
      missingDescription: '这个 token 不存在于本地存储中，请先在编辑器里创建分享链接。',
      openEditor: '打开编辑器',
      eyebrow: '共享评审',
      token: (token) => `令牌：${token}`,
      description: '匿名协作者可以回复评论，并切换问题状态。',
      backToEditor: '返回编辑器',
    },
  },
};

const resolveStoredPreference = (value: string | null): LocalePreference =>
  localePreferences.includes(value as LocalePreference) ? (value as LocalePreference) : 'system';

export const resolveLocale = (language?: string | null): SupportedLocale =>
  language?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';

const getNavigatorLanguage = () => (typeof navigator === 'undefined' ? 'en-US' : navigator.language);

interface LocaleContextValue {
  locale: SupportedLocale;
  preference: LocalePreference;
  setPreference: (preference: LocalePreference) => void;
  messages: WebMessages;
  formatDateTime: (value: string | number | Date) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<LocalePreference>(() => {
    if (typeof window === 'undefined') {
      return 'system';
    }

    return resolveStoredPreference(window.localStorage.getItem(STORAGE_KEY));
  });
  const [systemLocale, setSystemLocale] = useState<SupportedLocale>(() =>
    resolveLocale(getNavigatorLanguage()),
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleLanguageChange = () => {
      setSystemLocale(resolveLocale(getNavigatorLanguage()));
    };

    window.addEventListener('languagechange', handleLanguageChange);
    return () => window.removeEventListener('languagechange', handleLanguageChange);
  }, []);

  const locale = preference === 'system' ? systemLocale : preference;

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (preference === 'system') {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, preference);
  }, [preference]);

  const value = useMemo<LocaleContextValue>(() => {
    const localeMessages = messages[locale];
    const formatter = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    return {
      locale,
      preference,
      setPreference,
      messages: localeMessages,
      formatDateTime: (value) => {
        const date = value instanceof Date ? value : new Date(value);

        if (Number.isNaN(date.getTime())) {
          return String(value);
        }

        return formatter.format(date);
      },
    };
  }, [locale, preference]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }

  return context;
}
