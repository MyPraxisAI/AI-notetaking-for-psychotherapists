"use client"

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@kit/ui/button'
import { withTranslation, WithTranslation } from 'react-i18next'

interface Props extends WithTranslation {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundaryComponent extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    const { t } = this.props;
    
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
          <h2 className="text-2xl font-bold mb-4">{t('mypraxis:errorBoundary.title')}</h2>
          <p className="text-gray-600 mb-6">
            {this.state.error?.message || t('mypraxis:errorBoundary.defaultErrorMessage')}
          </p>
          <Button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
          >
            {t('mypraxis:errorBoundary.tryAgainButton')}
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryComponent);
