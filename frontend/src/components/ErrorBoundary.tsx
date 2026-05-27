import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8 text-center">
          <p className="text-5xl mb-4">💥</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-500 mb-6 max-w-xs">
            Try refreshing the page. If the problem persists, check the browser console for errors.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-brand-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Refresh page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
