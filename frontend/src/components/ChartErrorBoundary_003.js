// ChartErrorBoundary.js - Error boundary for chart components
import React from 'react';
import TradingChart from './TradingChart';
class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('Chart Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-[400px] border border-red-200 rounded-lg bg-red-50 flex items-center justify-center">
          <div className="text-center p-6">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Chart Error
            </h3>
            <p className="text-red-700 mb-4">
              Something went wrong while loading the chart.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                // Optionally trigger a re-render of the parent component
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Reload Page
            </button>
            
            {/* Development mode: show error details */}
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-red-600 font-medium">
                  Error Details (Development Only)
                </summary>
                <div className="mt-2 p-3 bg-gray-100 rounded text-sm text-gray-800 max-h-48 overflow-auto">
                  <p><strong>Error:</strong> {this.state.error && this.state.error.toString()}</p>
                  <p><strong>Stack Trace:</strong></p>
                  <pre className="whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Enhanced Trading component with error boundary
const TradingWithErrorBoundary = ({ symbol, sessionToken }) => {
  return (
    <ChartErrorBoundary>
      <TradingChart symbol={symbol} sessionToken={sessionToken} />
    </ChartErrorBoundary>
  );
};

export default ChartErrorBoundary;
export { TradingWithErrorBoundary };