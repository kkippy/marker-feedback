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
    line: string;
    arrow: string;
    highlight: string;
    marker: string;
    editText: string;
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
        'zh-CN': '\u7b80\u4f53\u4e2d\u6587',
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
        'Upload a local image, open the latest draft, or jump in from the extension with the current tab capture.',
      uploadImage: 'Upload image',
      openLatestDraft: 'Open latest draft',
      recentDraftsTitle: 'Recent drafts',
      recentDraftsDescription: 'Resume previous work without re-uploading your screenshot.',
      noDrafts: 'No drafts yet.',
      draftSummary: (annotationCount, hasAsset) =>
        `${annotationCount} annotations \u00b7 ${hasAsset ? 'asset ready' : 'missing asset'}`,
      replaceImage: 'Replace image',
      undo: 'Undo',
      redo: 'Redo',
    },
    comments: {
      title: 'Comments',
      description: 'Create general comments or attach feedback to the selected annotation.',
      selectedAnnotation: (annotationId) => `Selected annotation: ${annotationId}`,
      noAnnotationSelected: 'No annotation selected',
      composerPlaceholder: 'Describe the issue, suggestion, or confirmation...',
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
        line: 'Line',
        arrow: 'Arrow',
        highlight: 'Highlight',
        text: 'Text',
        blur: 'Blur',
        marker: 'Marker',
      },
    },
    contextMenu: {
      addText: 'Add text',
      rectangle: 'Rectangle',
      line: 'Line',
      arrow: 'Arrow',
      highlight: 'Highlight',
      marker: 'Marker',
      editText: 'Edit text',
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
      you: '\u4f60',
    },
    language: {
      label: '\u8bed\u8a00',
      selectAriaLabel: '\u9009\u62e9\u754c\u9762\u8bed\u8a00',
      options: {
        system: '\u8ddf\u968f\u7cfb\u7edf',
        'zh-CN': '\u7b80\u4f53\u4e2d\u6587',
        en: 'English',
      },
    },
    topBar: {
      annotations: (count) => `${count} \u6761\u6807\u6ce8`,
      threads: (count) => `${count} \u6761\u8ba8\u8bba`,
      zoom: (percent) => `\u7f29\u653e ${percent}%`,
      currentMode: (label) => `\u5f53\u524d\uff1a${label}`,
      zoomOutAriaLabel: '\u7f29\u5c0f',
      zoomInAriaLabel: '\u653e\u5927',
      reset: '\u91cd\u7f6e',
      exportPng: '\u5bfc\u51fa PNG',
      saveDraft: '\u4fdd\u5b58\u8349\u7a3f',
      createShareLink: '\u521b\u5efa\u5206\u4eab\u94fe\u63a5',
    },
    editor: {
      intakeEyebrow: '\u7d20\u6750\u5bfc\u5165',
      intakeTitle: '\u5f00\u59cb\u4e00\u8f6e\u53cd\u9988',
      intakeDescription:
        '\u4e0a\u4f20\u672c\u5730\u56fe\u7247\u3001\u6253\u5f00\u6700\u8fd1\u8349\u7a3f\uff0c\u6216\u7531\u6269\u5c55\u643a\u5e26\u5f53\u524d\u6807\u7b7e\u9875\u622a\u56fe\u76f4\u63a5\u8fdb\u5165\u3002',
      uploadImage: '\u4e0a\u4f20\u56fe\u7247',
      openLatestDraft: '\u6253\u5f00\u6700\u65b0\u8349\u7a3f',
      recentDraftsTitle: '\u6700\u8fd1\u8349\u7a3f',
      recentDraftsDescription:
        '\u65e0\u9700\u91cd\u65b0\u4e0a\u4f20\u56fe\u7247\uff0c\u7ee7\u7eed\u4e4b\u524d\u7684\u7f16\u8f91\u3002',
      noDrafts: '\u8fd8\u6ca1\u6709\u8349\u7a3f\u3002',
      draftSummary: (annotationCount, hasAsset) =>
        `${annotationCount} \u6761\u6807\u6ce8 \u00b7 ${
          hasAsset ? '\u56fe\u7247\u5df2\u5c31\u7eea' : '\u7f3a\u5c11\u56fe\u7247\u8d44\u6e90'
        }`,
      replaceImage: '\u66ff\u6362\u56fe\u7247',
      undo: '\u64a4\u9500',
      redo: '\u91cd\u505a',
    },
    comments: {
      title: '\u8ba8\u8bba',
      description:
        '\u53ef\u4ee5\u521b\u5efa\u901a\u7528\u8bc4\u8bba\uff0c\u6216\u628a\u53cd\u9988\u5173\u8054\u5230\u5f53\u524d\u9009\u4e2d\u7684\u6807\u6ce8\u3002',
      selectedAnnotation: (annotationId) => `\u5f53\u524d\u9009\u4e2d\u6807\u6ce8\uff1a${annotationId}`,
      noAnnotationSelected: '\u6682\u672a\u9009\u4e2d\u6807\u6ce8',
      composerPlaceholder: '\u63cf\u8ff0\u95ee\u9898\u3001\u5efa\u8bae\uff0c\u6216\u786e\u8ba4\u8bf4\u660e\u2026',
      addComment: '\u6dfb\u52a0\u8bc4\u8bba',
      noComments: '\u8fd8\u6ca1\u6709\u8bc4\u8bba\u3002',
      linkedTo: (annotationId) => `\u5173\u8054\u5230 ${annotationId}`,
      generalFeedbackLabel: '\u901a\u7528\u53cd\u9988',
      annotationFeedbackTitle: '\u6807\u6ce8\u53cd\u9988',
      generalFeedbackTitle: '\u901a\u7528\u53cd\u9988',
      statusOpen: '\u5f85\u5904\u7406',
      statusResolved: '\u5df2\u89e3\u51b3',
      replyPlaceholder: '\u56de\u590d\u8fd9\u6761\u8ba8\u8bba\u2026',
      reply: '\u56de\u590d',
    },
    tools: {
      title: '\u5de5\u5177',
      labels: {
        select: '\u9009\u62e9',
        rectangle: '\u77e9\u5f62',
        line: '\u76f4\u7ebf',
        arrow: '\u7bad\u5934',
        highlight: '\u9ad8\u4eae',
        text: '\u6587\u672c',
        blur: '\u6a21\u7cca',
        marker: '\u7f16\u53f7',
      },
    },
    contextMenu: {
      addText: '\u6dfb\u52a0\u6587\u672c',
      rectangle: '\u77e9\u5f62',
      line: '\u76f4\u7ebf',
      arrow: '\u7bad\u5934',
      highlight: '\u9ad8\u4eae',
      marker: '\u7f16\u53f7',
      editText: '\u7f16\u8f91\u6587\u672c',
      copy: '\u590d\u5236',
      delete: '\u5220\u9664',
      bringToFront: '\u7f6e\u4e8e\u9876\u5c42',
    },
    annotation: {
      textPromptTitle: '\u6587\u672c\u5907\u6ce8',
      textPromptDefault: '\u8f93\u5165\u5907\u6ce8\u5185\u5bb9',
    },
    share: {
      loading: '\u6b63\u5728\u52a0\u8f7d\u5171\u4eab\u53cd\u9988...',
      missingTitle: '\u672a\u627e\u5230\u5206\u4eab\u94fe\u63a5',
      missingDescription:
        '\u8fd9\u4e2a token \u4e0d\u5b58\u5728\u4e8e\u672c\u5730\u5b58\u50a8\u4e2d\uff0c\u8bf7\u5148\u5728\u7f16\u8f91\u5668\u91cc\u521b\u5efa\u5206\u4eab\u94fe\u63a5\u3002',
      openEditor: '\u6253\u5f00\u7f16\u8f91\u5668',
      eyebrow: '\u5171\u4eab\u8bc4\u5ba1',
      token: (token) => `\u4ee4\u724c\uff1a${token}`,
      description:
        '\u533f\u540d\u534f\u4f5c\u8005\u53ef\u4ee5\u56de\u590d\u8bc4\u8bba\uff0c\u5e76\u5207\u6362\u95ee\u9898\u72b6\u6001\u3002',
      backToEditor: '\u8fd4\u56de\u7f16\u8f91\u5668',
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
