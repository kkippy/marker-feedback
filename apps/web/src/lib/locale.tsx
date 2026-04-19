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
    currentProject: (name: string) => string;
    currentMode: (label: string) => string;
    zoomOutAriaLabel: string;
    zoomInAriaLabel: string;
    home: string;
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
    homepageBrandLine: string;
    homepageEyebrow: string;
    homepageTitle: string;
    homepageDescription: string;
    homepageUploadImage: string;
    homepageOpenLatestDraft: string;
    homepageNewProject: string;
    homepageAllProjects: string;
    homepageHint: string;
    homepageRecentTitle: string;
    homepageRecentSummary: string;
    homepageRecentContinue: string;
    homepageRecentEmpty: string;
    homepageDraftEmpty: string;
    projectListEmpty: string;
    projectListTitle: string;
    projectListDescription: string;
    projectListBackHome: string;
    projectNameLabel: string;
    screenshotLabel: string;
    createProjectTitle: string;
    createProjectDescription: string;
    createProjectSubmit: string;
    createProjectCancel: string;
    projectUntitledFallback: string;
    openProject: (name: string) => string;
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
    calloutGroup?: string;
    labels: Record<AnnotationTool, string>;
  };
  contextMenu: {
    addText: string;
    rectangle: string;
    polygon: string;
    line: string;
    arrow: string;
    highlight: string;
    blur: string;
    marker: string;
    calloutGroup?: string;
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
    mosaicIntensity: string;
    mosaicIntensityScrub: string;
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
      currentProject: (name) => `Project: ${name}`,
      currentMode: (label) => `Mode: ${label}`,
      zoomOutAriaLabel: 'Zoom out',
      zoomInAriaLabel: 'Zoom in',
      home: 'Home',
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
      homepageBrandLine: 'Make visual feedback feel more natural',
      homepageEyebrow: 'Upload a screenshot to start',
      homepageTitle: 'Make screenshot feedback lighter.',
      homepageDescription: 'Keep ideas on the image, and let feedback flow more naturally.',
      homepageUploadImage: 'Upload image and start',
      homepageOpenLatestDraft: 'Open latest draft',
      homepageNewProject: 'New project',
      homepageAllProjects: 'All projects',
      homepageHint: 'Upload a local image, or continue the feedback you left unfinished.',
      homepageRecentTitle: 'Recent project',
      homepageRecentSummary: 'Continue from where you left off.',
      homepageRecentContinue: 'Continue this project',
      homepageRecentEmpty:
        'No recent project yet. Starting from a single screenshot is a good place to begin.',
      homepageDraftEmpty: 'No draft yet. Your progress will be kept after you upload an image.',
      projectListEmpty: 'No projects yet. Create one to keep related screenshot feedback together.',
      projectListTitle: 'All projects',
      projectListDescription: 'Browse every project and jump back into the latest related draft.',
      projectListBackHome: 'Back to home',
      projectNameLabel: 'Project name',
      screenshotLabel: 'Screenshot',
      createProjectTitle: 'Create a new project',
      createProjectDescription: 'Give the project a clear name and upload the first screenshot to start editing.',
      createProjectSubmit: 'Create and start',
      createProjectCancel: 'Cancel',
      projectUntitledFallback: 'Imported project',
      openProject: (name) => `Open project ${name}`,
      recentDraftsTitle: 'Recent drafts',
      recentDraftsDescription: 'Resume previous work without re-uploading your screenshot.',
      noDrafts: 'No drafts yet.',
      draftSummary: (annotationCount, hasAsset) =>
        `${annotationCount} annotations · ${hasAsset ? 'asset ready' : 'missing asset'}`,
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
      calloutGroup: 'Callout',
      labels: {
        select: 'Select',
        rectangle: 'Rect',
        polygon: 'Irregular Area',
        line: 'Line',
        arrow: 'Arrow',
        highlight: 'Highlight',
        text: 'Text',
        blur: 'Mosaic',
        marker: 'Marker',
        callout: 'Text Callout',
        'image-callout': 'Image Callout',
      },
    },
    contextMenu: {
      addText: 'Add text',
      rectangle: 'Rectangle',
      polygon: 'Irregular Area',
      line: 'Line',
      arrow: 'Arrow',
      highlight: 'Highlight',
      blur: 'Mosaic',
      marker: 'Marker',
      calloutGroup: 'Callout',
      callout: 'Text callout',
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
      mosaicIntensity: 'Mosaic intensity',
      mosaicIntensityScrub: 'Drag left or right to adjust mosaic intensity',
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
      annotations: (count) => `${count} 条标注`,
      threads: (count) => `${count} 条讨论`,
      zoom: (percent) => `缩放 ${percent}%`,
      currentProject: (name) => `项目：${name}`,
      currentMode: (label) => `当前：${label}`,
      zoomOutAriaLabel: '缩小',
      zoomInAriaLabel: '放大',
      home: '首页',
      exportPng: '导出 PNG',
      saveDraft: '保存草稿',
      createShareLink: '创建分享链接',
    },
    editor: {
      intakeEyebrow: '素材导入',
      intakeTitle: '开始一轮反馈',
      intakeDescription:
        '上传本地图片、打开最近草稿，或由扩展携带当前标签页截图直接进入。',
      uploadImage: '上传图片',
      openLatestDraft: '打开最新草稿',
      homepageBrandLine: '让视觉反馈更自然地发生',
      homepageEyebrow: '上传截图，即可开始',
      homepageTitle: '让截图沟通，更轻松。',
      homepageDescription: '把想法留在画面上，让反馈更自然地被看见。',
      homepageUploadImage: '上传图片并开始',
      homepageOpenLatestDraft: '打开最近草稿',
      homepageNewProject: '新建项目',
      homepageAllProjects: '全部项目',
      homepageHint: '支持本地图片上传，也可继续最近一次未完成的反馈。',
      homepageRecentTitle: '最近项目',
      homepageRecentSummary: '从上一次停下的地方继续。',
      homepageRecentContinue: '继续这个项目',
      homepageRecentEmpty: '还没有最近项目，从一张截图开始也很好。',
      homepageDraftEmpty: '还没有草稿，上传图片后会自动保留你的进度。',
      projectListEmpty: '还没有项目。先创建一个，把相关截图反馈放到一起。',
      projectListTitle: '全部项目',
      projectListDescription: '查看所有项目，并回到对应项目最近一次编辑的草稿。',
      projectListBackHome: '返回首页',
      projectNameLabel: '项目名称',
      screenshotLabel: '截图',
      createProjectTitle: '新建项目',
      createProjectDescription: '填写项目名称并上传第一张截图，随后即可进入编辑。',
      createProjectSubmit: '创建并开始',
      createProjectCancel: '取消',
      projectUntitledFallback: '导入项目',
      openProject: (name) => `打开项目 ${name}`,
      recentDraftsTitle: '最近草稿',
      recentDraftsDescription: '无需重新上传图片，继续之前的编辑。',
      noDrafts: '还没有草稿。',
      draftSummary: (annotationCount, hasAsset) =>
        `${annotationCount} 条标注 · ${hasAsset ? '图片已就绪' : '缺少图片资源'}`,
      replaceImage: '替换图片',
      undo: '撤销',
      redo: '重做',
    },
    comments: {
      title: '讨论',
      description: '可以创建通用评论，或把反馈关联到当前选中的标注。',
      selectedAnnotation: (annotationId) => `当前选中标注：${annotationId}`,
      noAnnotationSelected: '暂未选中标注',
      composerPlaceholder: '描述问题、建议，或确认说明…',
      addComment: '添加评论',
      noComments: '还没有评论。',
      linkedTo: (annotationId) => `关联到 ${annotationId}`,
      generalFeedbackLabel: '通用反馈',
      annotationFeedbackTitle: '标注反馈',
      generalFeedbackTitle: '通用反馈',
      statusOpen: '待处理',
      statusResolved: '已解决',
      replyPlaceholder: '回复这条讨论…',
      reply: '回复',
    },
    tools: {
      title: '工具',
      labels: {
        select: '选择',
        rectangle: '矩形',
        polygon: '不规则区域',
        line: '直线',
        arrow: '箭头',
        highlight: '高亮',
        text: '文本',
        blur: '马赛克',
        marker: '编号',
        callout: '引出',
        'image-callout': '图引出',
      },
    },
    contextMenu: {
      addText: '添加文本',
      rectangle: '矩形',
      polygon: '不规则区域',
      line: '直线',
      arrow: '箭头',
      highlight: '高亮',
      blur: '马赛克',
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
      mosaicIntensity: '马赛克强度',
      mosaicIntensityScrub: '左右拖动调整马赛克强度',
    },
    share: {
      loading: '正在加载分享反馈...',
      missingTitle: '未找到分享链接',
      missingDescription:
        '这个 token 不存在于本地存储中，请先在编辑器里创建分享链接。',
      openEditor: '打开编辑器',
      eyebrow: '共享评审',
      token: (token) => `令牌：${token}`,
      description: '匿名协作者可以回复评论，并切换问题状态。',
      backToEditor: '返回编辑器',
    },
  },
};

messages['zh-CN'].tools.calloutGroup = '引出';
messages['zh-CN'].contextMenu.calloutGroup = '引出';
messages['zh-CN'].tools.labels.callout = '文本引出';
messages['zh-CN'].tools.labels['image-callout'] = '图片引出';
messages['zh-CN'].contextMenu.callout = '文本引出';
messages['zh-CN'].contextMenu.imageCallout = '图片引出';

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
