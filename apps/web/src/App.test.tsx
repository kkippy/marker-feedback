import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

describe('app routes', () => {
  it('renders editor intake on /editor', async () => {
    render(<MemoryRouter initialEntries={['/editor']}><App /></MemoryRouter>);
    expect(await screen.findByText('Start a feedback session')).toBeInTheDocument();
  });
});
