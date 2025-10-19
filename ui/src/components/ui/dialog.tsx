"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface DialogContentProps {
  className?: string;
  children: React.ReactNode;
}

interface DialogHeaderProps {
  children: React.ReactNode;
}

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogFooterProps {
  children: React.ReactNode;
}

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!open || !mounted) return null;

  const dialogContent = (
    <>
      {/* Backdrop - covers entire viewport */}
      <div
        className="fixed inset-0 z-[100] bg-black/60"
        onClick={() => onOpenChange(false)}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* Dialog container - centered in viewport */}
      <div 
        className="fixed z-[110] pointer-events-none" 
        style={{ 
          position: 'fixed', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          maxWidth: '32rem',
          width: '90%',
          maxHeight: '90vh'
        }}
      >
        <div className="relative w-full max-h-[90vh] overflow-auto pointer-events-auto">
          {children}
        </div>
      </div>
    </>
  );

  return createPortal(dialogContent, document.body);
};

const DialogContent = ({ className, children }: DialogContentProps) => (
  <div
    className={cn(
      "relative bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-6 w-full",
      className,
    )}
  >
    {children}
  </div>
);

const DialogHeader = ({ children }: DialogHeaderProps) => (
  <div className="mb-4">{children}</div>
);

const DialogTitle = ({ children, className }: DialogTitleProps) => (
  <h2 className={cn("text-lg font-semibold text-white", className)}>{children}</h2>
);

const DialogDescription = ({ children, className }: DialogDescriptionProps) => (
  <p className={cn("text-sm text-gray-400", className)}>{children}</p>
);

const DialogFooter = ({ children }: DialogFooterProps) => (
  <div className="flex justify-end gap-3 mt-6">{children}</div>
);

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
};
