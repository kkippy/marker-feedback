import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { LocaleProvider } from './lib/locale';

const setNavigatorLanguage = (language: string) => {
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: language,
  });
};

describe('app routes', () => {
  const originalLanguage = window.navigator.language;

  afterEach(() => {
    window.localStorage.clear();
    setNavigatorLanguage(originalLanguage);
  });

  it('renders editor intake on /editor', async () => {
    setNavigatorLanguage('en-US');

    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/editor']}>
          <App />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: /Make screenshot feedback\s*lighter\./ }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('route-transition-editor')).toBeInTheDocument();
  });

  it('follows system language when navigator is Chinese', async () => {
    setNavigatorLanguage('zh-CN');

    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={['/editor']}>
          <App />
        </MemoryRouter>
      </LocaleProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: /\u8ba9\u622a\u56fe\u6c9f\u901a\uff0c\s*\u66f4\u8f7b\u677e\u3002/ }),
    ).toBeInTheDocument();
  });
});
