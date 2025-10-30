"use client";

import React, { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Label } from "./label";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import Image from "next/image";

interface SearchableMarketSelectProps {
  label?: string;
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string; imageUrl?: string | null }>;
  error?: string;
  helperText?: string;
  required?: boolean;
  className?: string;
}

export function SearchableMarketSelect({
  label,
  placeholder = "Select a market...",
  value,
  onValueChange,
  options,
  error,
  helperText,
  required,
  className,
}: SearchableMarketSelectProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    
    const query = searchQuery.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    // Clear search when closing
    if (!open) {
      setSearchQuery("");
    }
  };

  // Get the selected option for displaying with image
  const selectedOption = useMemo(() => {
    return options.find((option) => option.value === value);
  }, [options, value]);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-sm font-medium text-gray-200">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </Label>
      )}
      <Select value={value} onValueChange={onValueChange} open={isOpen} onOpenChange={handleOpenChange}>
        <SelectTrigger className={`w-full ${error ? "border-red-500" : ""}`}>
          {selectedOption ? (
            <div className="flex items-center gap-2">
              {selectedOption.imageUrl && (
                <Image
                  src={selectedOption.imageUrl}
                  alt={selectedOption.label}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              )}
              <span>{selectedOption.label}</span>
            </div>
          ) : (
            <SelectValue placeholder={placeholder} />
          )}
        </SelectTrigger>
        <SelectContent>
          <div className="sticky top-0 z-10 bg-gray-900 p-2 border-b border-gray-700">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search markets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 bg-gray-800 border-gray-700 focus:border-purple-500"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    {option.imageUrl && (
                      <Image
                        src={option.imageUrl}
                        alt={option.label}
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                    )}
                    <span>{option.label}</span>
                  </div>
                </SelectItem>
              ))
            ) : (
              <div className="px-2 py-6 text-center text-sm text-gray-400">
                No markets found
              </div>
            )}
          </div>
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-gray-400">{helperText}</p>
      )}
    </div>
  );
}
