import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Homies app render error', error, info); }
  render() { return this.state.hasError ? <main className="fatal-error"><div className="eyebrow">Homies Proshop Assistant</div><h1>Something went wrong.</h1><p>The app hit an unexpected display error. Reload the page to try again.</p><button className="button button-primary" onClick={() => window.location.reload()}>Reload app</button></main> : this.props.children; }
}
