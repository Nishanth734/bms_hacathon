import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Reading Room workstation:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0B0E11] text-[#E6EBEF] font-mono-num space-y-4">
          <div className="p-3 bg-[#FF4D4F]/15 border border-[#FF4D4F]/40 rounded-[2px] text-[#FF4D4F] text-[13px] font-semibold">
            Workstation Render Error
          </div>
          <p className="text-[12px] text-[#9AA7B2] max-w-md text-center">
            {this.state.error?.message || 'An unexpected interface exception occurred.'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="px-4 py-1.5 bg-[#1A2127] hover:bg-[#26303A] border border-[#26303A] text-[#8E9AF0] rounded-[2px] text-[12px]"
            >
              RELOAD WORKLIST
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/login';
              }}
              className="px-4 py-1.5 bg-[#1A2127] hover:bg-[#26303A] border border-[#26303A] text-[#9AA7B2] rounded-[2px] text-[12px]"
            >
              RESET SESSION & LOGIN
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
