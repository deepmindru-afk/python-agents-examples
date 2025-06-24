'use client';

import { ReactNode, useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CaretLeft, CaretRight } from '@phosphor-icons/react/dist/ssr';

interface DemoLayoutProps {
  children: ReactNode;
  codePanel: ReactNode;
  className?: string;
}

const MIN_LEFT_WIDTH = 400;
const MIN_RIGHT_WIDTH = 350;

export function DemoLayout({ children, codePanel, className }: DemoLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [previousLeftWidth, setPreviousLeftWidth] = useState<number | null>(null);

  // Initialize left width based on container size
  useEffect(() => {
    if (containerRef.current && leftWidth === null) {
      const containerWidth = containerRef.current.offsetWidth;
      const savedWidth = localStorage.getItem('demo-layout-left-width');
      if (savedWidth) {
        const width = parseInt(savedWidth, 10);
        // Validate saved width is still reasonable
        if (width >= MIN_LEFT_WIDTH && width <= containerWidth - MIN_RIGHT_WIDTH) {
          setLeftWidth(width);
        } else {
          setLeftWidth(containerWidth * 0.6); // Default to 60%
        }
      } else {
        setLeftWidth(containerWidth * 0.6); // Default to 60%
      }
    }
  }, [leftWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!isCollapsed) {
      setIsResizing(true);
    }
  }, [isCollapsed]);

  const handleToggleCollapse = useCallback(() => {
    if (isCollapsed) {
      // Expand: restore previous width
      if (previousLeftWidth && containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        // Ensure the restored width is still valid
        if (previousLeftWidth <= containerWidth - MIN_RIGHT_WIDTH) {
          setLeftWidth(previousLeftWidth);
        } else {
          setLeftWidth(containerWidth * 0.6);
        }
      }
    } else {
      // Collapse: save current width and maximize left panel
      if (leftWidth && containerRef.current) {
        setPreviousLeftWidth(leftWidth);
        setLeftWidth(containerRef.current.offsetWidth - 48); // 48px for collapsed panel
      }
    }
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed, leftWidth, previousLeftWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newLeftWidth = e.clientX - containerRect.left;
    const containerWidth = containerRect.width;

    // Enforce minimum widths
    if (newLeftWidth >= MIN_LEFT_WIDTH && newLeftWidth <= containerWidth - MIN_RIGHT_WIDTH) {
      setLeftWidth(newLeftWidth);
      localStorage.setItem('demo-layout-left-width', newLeftWidth.toString());
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div 
      ref={containerRef}
      className={cn("flex h-screen overflow-hidden", className)}
    >
      {/* Left side - Demo application */}
      <div 
        className="min-w-0 overflow-hidden flex flex-col"
        style={{ width: leftWidth || '60%' }}
      >
        {children}
      </div>
      
      {/* Resizer and collapse button */}
      <div className="relative flex">
        {/* Resizer */}
        <div
          className={cn(
            "relative w-1 bg-border hover:bg-primary/20 transition-colors",
            !isCollapsed && "cursor-col-resize",
            isResizing && "bg-primary/30",
            isCollapsed && "pointer-events-none"
          )}
          onMouseDown={handleMouseDown}
        >
          <div className={cn(
            "absolute inset-y-0 -left-1 -right-1",
            !isCollapsed && "group-hover:bg-primary/10"
          )} />
        </div>
        
        {/* Collapse toggle button */}
        <button
          onClick={handleToggleCollapse}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-6 h-12 flex items-center justify-center",
            "bg-background border rounded-md shadow-sm",
            "hover:bg-muted transition-colors cursor-pointer z-10",
            isCollapsed ? "left-0" : "-left-3"
          )}
          title={isCollapsed ? "Expand code panel" : "Collapse code panel"}
        >
          {isCollapsed ? (
            <CaretLeft className="w-4 h-4" />
          ) : (
            <CaretRight className="w-4 h-4" />
          )}
        </button>
      </div>
      
      {/* Right side - Code panel */}
      <div 
        className={cn(
          "bg-muted/30 overflow-hidden flex flex-col transition-all duration-300",
          isCollapsed ? "w-0" : "flex-1 min-w-0"
        )}
      >
        {!isCollapsed && codePanel}
      </div>
      
      {/* Overlay to prevent iframe interaction during resize */}
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-col-resize" />
      )}
    </div>
  );
}