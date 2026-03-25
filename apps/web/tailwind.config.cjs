module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: '#e5e7eb',
        background: '#f8fafc',
        foreground: '#0f172a',
        primary: '#2563eb',
        muted: '#64748b',
        accent: '#f59e0b'
      },
      boxShadow: {
        soft: '0 16px 40px rgba(15, 23, 42, 0.08)'
      }
    }
  },
  plugins: []
};
