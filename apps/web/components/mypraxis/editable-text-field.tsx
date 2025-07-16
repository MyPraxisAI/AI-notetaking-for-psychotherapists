import { useState, useRef, useEffect } from 'react';
import { Textarea } from '@kit/ui/textarea';
import { Button } from '@kit/ui/button';
import { Copy, Check, Edit2, Loader2, Plus } from 'lucide-react';

interface EditableTextFieldProps {
  value: string;
  onSave: (newValue: string) => void | Promise<void>;
  isSaving?: boolean;
  placeholder?: string;
  minHeight?: number;
  onCopy?: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function EditableTextField({
  value,
  onSave,
  isSaving = false,
  placeholder = '',
  minHeight = 150,
  onCopy,
  disabled = false,
  className = '',
}: EditableTextFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [textValueLocal, setTextValueLocal] = useState<string | undefined>(undefined);
  const [isCopied, setIsCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, editValue]);

  // Keep showing the optimistic value until the parent value matches it
  useEffect(() => {
    if (textValueLocal !== undefined && value === textValueLocal) {
      setTextValueLocal(undefined);
    }
  }, [value, textValueLocal]);

  // When entering edit mode, set editValue
  useEffect(() => {
    if (isEditing) {
      setEditValue(textValueLocal ?? value ?? '');
    }
    // Only run this effect when isEditing transitions to true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // In display mode, show textValueLocal if defined, else value
  const displayValue =
    typeof textValueLocal === 'string' && textValueLocal !== value
      ? textValueLocal
      : value;

  // Handle copy
  const handleCopy = () => {
    if (!displayValue) return;
    navigator.clipboard.writeText(displayValue);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1200);
    if (onCopy) onCopy(displayValue);
  };

  // Handle save on blur
  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== value) {
      setTextValueLocal(editValue);
      onSave(editValue);
    }
  };

  return (
    <div className={`relative w-full group ${className}`}>
      {isEditing ? (
        <Textarea
          ref={textareaRef}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={handleBlur}
          style={{ height: 'auto', overflow: 'hidden', minHeight }}
          className="p-6 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:shadow-[0_2px_8px_rgba(0,0,0,0.1)] [&::-webkit-resizer]:appearance-none relative text-[14px] leading-[1.6]"
          autoFocus
          disabled={disabled}
        />
      ) : !displayValue ? (
        <div
          className="w-full min-h-[100px] border border-dashed border-input flex items-center justify-center cursor-pointer bg-[#FFF9E8] rounded-lg"
          onClick={() => setIsEditing(true)}
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <Plus className="h-4 w-4" />
            {placeholder}
          </span>
        </div>
      ) : (
        <>
          <div
            className="w-full h-full min-h-[100px] text-[14px] leading-[1.6] whitespace-pre-wrap cursor-pointer p-6 bg-[#FFF9E8] rounded-lg"
            onClick={() => {
              setEditValue(displayValue || '');
              setIsEditing(true);
            }}
          >
            {displayValue}
          </div>
          <div className="absolute right-2 top-2 flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 transition-opacity cursor-pointer ${isSaving ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              onClick={() => setIsEditing(true)}
              disabled={disabled}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Edit2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-transparent cursor-pointer"
              onClick={handleCopy}
              disabled={disabled}
            >
              {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </>
      )}
    </div>
  );
} 