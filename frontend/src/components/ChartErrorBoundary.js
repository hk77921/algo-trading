// ChartErrorBoundary.js - Error boundary for chart components
import React from 'react';

class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Store error details
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Log error for debugging
    console.error('Chart Error Boundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-[400px] border-2 border-red-300 rounded-lg bg-red-50 flex items-center justify-center">
          <div className="text-center p-6 max-w-md">
            <div className="text-red-600 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Chart Error
            </h3>
            <p className="text-red-700 mb-4">
              The trading chart encountered an error and couldn't render properly.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Retry Chart ({this.state.retryCount} attempts)
              </button>
              
              <details className="text-left">
                <summary className="text-sm text-red-600 cursor-pointer hover:text-red-800">
                  Show Error Details
                </summary>
                <div className="mt-2 p-3 bg-white border border-red-200 rounded text-xs">
                  <div className="font-medium mb-2">Error:</div>
                  <div className="text-red-800 mb-3">
                    {this.state.error && this.state.error.toString()}
                  </div>
                  
                  <div className="font-medium mb-2">Stack Trace:</div>
                  <pre className="text-gray-600 overflow-auto max-h-32">
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                  </pre>
                </div>
              </details>
              
              <div className="text-xs text-gray-600">
                Try refreshing the page if the error persists
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChartErrorBoundary;