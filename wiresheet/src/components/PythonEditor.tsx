import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AlertCircle, CheckCircle, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';

interface PythonEditorProps {
  value: string;
  onChange: (value: string) => void;
  inputs: string[];
  outputs: string[];
  liveInputValues?: Record<string, unknown>;
  liveOutputValues?: Record<string, unknown>;
}

interface SyntaxError {
  line: number;
  message: string;
}

const PYTHON_KEYWORDS = [
  'if', 'else', 'elif', 'for', 'while', 'def', 'return', 'and', 'or', 'not',
  'True', 'False', 'None', 'in', 'is', 'try', 'except', 'finally', 'with',
  'as', 'from', 'import', 'class', 'pass', 'break', 'continue', 'lambda'
];

const PYTHON_BUILTINS = [
  'abs', 'all', 'any', 'bool', 'dict', 'enumerate', 'filter', 'float',
  'int', 'len', 'list', 'map', 'max', 'min', 'print', 'range', 'round',
  'set', 'sorted', 'str', 'sum', 'tuple', 'type', 'zip', 'pow', 'isinstance'
];

export const PythonEditor: React.FC<PythonEditorProps> = ({
  value,
  onChange,
  inputs,
  outputs,
  liveInputValues = {},
  liveOutputValues = {}
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [errors, setErrors] = useState<SyntaxError[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, col: 1 });
  const [showTips, setShowTips] = useState(true);

  const validatePython = useCallback((code: string) => {
    const newErrors: SyntaxError[] = [];
    const lines = code.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      if (trimmed.includes('then') && !trimmed.startsWith('#')) {
        newErrors.push({ line: lineNum, message: 'Python verwendet kein "then" - entfernen Sie es' });
      }

      if (trimmed.match(/^end\s*(if|for|while|def)/i) && !trimmed.startsWith('#')) {
        newErrors.push({ line: lineNum, message: 'Python verwendet kein "end" - Einrueckung bestimmt Bloecke' });
      }

      if (trimmed.match(/;\s*$/) && !trimmed.startsWith('#')) {
        newErrors.push({ line: lineNum, message: 'Semikolon am Zeilenende ist nicht noetig' });
      }

      if (trimmed.match(/^(if|elif|while|for|def|class|with|try|except)\s+.*[^:]$/)) {
        if (!trimmed.endsWith(':') && !trimmed.includes('#')) {
          newErrors.push({ line: lineNum, message: 'Doppelpunkt ":" am Ende fehlt' });
        }
      }

      const openParens = (line.match(/\(/g) || []).length;
      const closeParens = (line.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        newErrors.push({ line: lineNum, message: 'Ungleiche Anzahl Klammern' });
      }

      if (trimmed.match(/=\s*=\s*=/)) {
        newErrors.push({ line: lineNum, message: 'Zu viele Gleichzeichen - verwende "==" fuer Vergleich' });
      }

      if (trimmed.match(/[^=!<>]=(?!=)/)) {
        const beforeEqual = trimmed.split(/[^=!<>]=(?!=)/)[0];
        if (beforeEqual && beforeEqual.match(/\s*(and|or)\s*$/)) {
          newErrors.push({ line: lineNum, message: 'Verwende "==" fuer Vergleich, "=" ist Zuweisung' });
        }
      }
    });

    let indentStack: number[] = [0];
    let inMultilineString = false;

    lines.forEach((line, idx) => {
      if (line.includes('"""') || line.includes("'''")) {
        const count = (line.match(/"""|'''/g) || []).length;
        if (count % 2 === 1) inMultilineString = !inMultilineString;
      }
      if (inMultilineString) return;

      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) return;

      const currentIndent = line.search(/\S/);
      if (currentIndent === -1) return;

      const lastIndent = indentStack[indentStack.length - 1];
      if (currentIndent > lastIndent) {
        if (currentIndent - lastIndent !== 4 && currentIndent - lastIndent !== 2) {
        }
        indentStack.push(currentIndent);
      } else if (currentIndent < lastIndent) {
        while (indentStack.length > 1 && indentStack[indentStack.length - 1] > currentIndent) {
          indentStack.pop();
        }
      }
    });

    setErrors(newErrors);
  }, []);

  useEffect(() => {
    validatePython(value);
  }, [value, validatePython]);

  const getCurrentWord = useCallback(() => {
    if (!textareaRef.current) return '';
    const pos = textareaRef.current.selectionStart;
    const textBefore = value.slice(0, pos);
    const match = textBefore.match(/[\w]+$/);
    return match ? match[0] : '';
  }, [value]);

  const updateSuggestions = useCallback(() => {
    const word = getCurrentWord().toLowerCase();
    if (word.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const allSuggestions = [
      ...inputs.map(i => i),
      ...outputs.map(o => o),
      ...PYTHON_KEYWORDS,
      ...PYTHON_BUILTINS
    ];

    const filtered = allSuggestions.filter(s =>
      s.toLowerCase().startsWith(word) && s.toLowerCase() !== word
    );

    setSuggestions(filtered.slice(0, 8));
    setShowSuggestions(filtered.length > 0);
    setSuggestionIndex(0);
  }, [getCurrentWord, inputs, outputs]);

  const applySuggestion = useCallback((suggestion: string) => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart;
    const word = getCurrentWord();
    const newValue = value.slice(0, pos - word.length) + suggestion + value.slice(pos);
    onChange(newValue);
    setShowSuggestions(false);

    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = pos - word.length + suggestion.length;
        textareaRef.current.selectionStart = newPos;
        textareaRef.current.selectionEnd = newPos;
        textareaRef.current.focus();
      }
    }, 0);
  }, [value, onChange, getCurrentWord]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex(prev => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        applySuggestion(suggestions[suggestionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Tab' && !showSuggestions) {
      e.preventDefault();
      const start = textareaRef.current?.selectionStart || 0;
      const end = textareaRef.current?.selectionEnd || 0;
      const newValue = value.slice(0, start) + '    ' + value.slice(end);
      onChange(newValue);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 4;
          textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
  };

  const handleInput = () => {
    updateSuggestions();
    if (textareaRef.current) {
      const pos = textareaRef.current.selectionStart;
      const textBefore = value.slice(0, pos);
      const lines = textBefore.split('\n');
      setCursorPosition({ line: lines.length, col: lines[lines.length - 1].length + 1 });
    }
  };

  const lineNumbers = value.split('\n').map((_, i) => i + 1);

  const hasAnyLiveValue = Object.keys(liveInputValues).length > 0 || Object.keys(liveOutputValues).length > 0;

  return (
    <div className="space-y-2">
      {hasAnyLiveValue && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400 font-semibold">Live-Werte</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] text-blue-400 uppercase tracking-wide mb-1">Eingaenge</div>
              {inputs.map(inp => {
                const val = liveInputValues[inp];
                const hasVal = val !== undefined && val !== null;
                return (
                  <div key={inp} className="flex items-center justify-between py-0.5">
                    <span className="text-xs font-mono text-blue-300">{inp}</span>
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${hasVal ? 'bg-blue-900/50 text-blue-200' : 'text-slate-500'}`}>
                      {hasVal ? String(val) : '-'}
                    </span>
                  </div>
                );
              })}
              {inputs.length === 0 && <span className="text-[10px] text-slate-500">-</span>}
            </div>
            <div>
              <div className="text-[10px] text-emerald-400 uppercase tracking-wide mb-1">Ausgaenge</div>
              {outputs.map(out => {
                const val = liveOutputValues[out];
                const hasVal = val !== undefined && val !== null;
                return (
                  <div key={out} className="flex items-center justify-between py-0.5">
                    <span className="text-xs font-mono text-emerald-300">{out}</span>
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${hasVal ? 'bg-emerald-900/50 text-emerald-200' : 'text-slate-500'}`}>
                      {hasVal ? String(val) : '-'}
                    </span>
                  </div>
                );
              })}
              {outputs.length === 0 && <span className="text-[10px] text-slate-500">-</span>}
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <div className="flex rounded-lg overflow-hidden border border-slate-600 focus-within:border-blue-500 transition-colors">
          <div className="bg-slate-950 text-slate-500 text-xs font-mono py-2 px-2 select-none text-right border-r border-slate-700 flex-shrink-0" style={{ minWidth: 32 }}>
            {lineNumbers.map(num => (
              <div
                key={num}
                className={`leading-5 ${errors.some(e => e.line === num) ? 'text-red-400 font-bold' : ''}`}
              >
                {num}
              </div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleInput}
            onClick={handleInput}
            className="flex-1 bg-slate-900 text-white font-mono text-xs py-2 px-3 outline-none resize-none"
            style={{ minHeight: 200, lineHeight: '20px' }}
            spellCheck={false}
            placeholder="# Python Code hier eingeben..."
          />
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto" style={{ left: 40 }}>
            {suggestions.map((s, idx) => (
              <button
                key={s}
                onClick={() => applySuggestion(s)}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors ${
                  idx === suggestionIndex ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {inputs.includes(s) && <span className="text-blue-400 mr-2">IN</span>}
                {outputs.includes(s) && <span className="text-emerald-400 mr-2">OUT</span>}
                {PYTHON_KEYWORDS.includes(s) && <span className="text-amber-400 mr-2">KEY</span>}
                {PYTHON_BUILTINS.includes(s) && <span className="text-cyan-400 mr-2">FN</span>}
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
        <span>Zeile {cursorPosition.line}, Spalte {cursorPosition.col}</span>
        <span>Tab = Einruecken | Ctrl+Space = Vorschlaege</span>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-950/50 border border-red-800/50 rounded-lg p-2 space-y-1">
          <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errors.length} Fehler gefunden</span>
          </div>
          {errors.slice(0, 3).map((err, idx) => (
            <div key={idx} className="text-xs text-red-300 pl-5">
              <span className="text-red-400 font-mono">Zeile {err.line}:</span> {err.message}
            </div>
          ))}
          {errors.length > 3 && (
            <div className="text-xs text-red-400 pl-5">...und {errors.length - 3} weitere</div>
          )}
        </div>
      )}

      {errors.length === 0 && value.trim() && (
        <div className="flex items-center gap-1.5 text-emerald-400 text-xs px-1">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Keine Syntaxfehler erkannt</span>
        </div>
      )}

      <div className="border border-slate-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowTips(!showTips)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-amber-400">
            <Lightbulb className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Hilfe & Beispiele</span>
          </div>
          {showTips ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showTips && (
          <div className="p-3 bg-slate-900/50 space-y-3 text-xs">
            <div>
              <p className="text-slate-400 font-semibold mb-1">Verfuegbare Variablen:</p>
              <div className="flex flex-wrap gap-1">
                {inputs.map(i => (
                  <span key={i} className="bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded font-mono">{i}</span>
                ))}
                {outputs.map(o => (
                  <span key={o} className="bg-emerald-900/50 text-emerald-300 px-1.5 py-0.5 rounded font-mono">{o}</span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-slate-400 font-semibold mb-1">Beispiel - Einfache Bedingung:</p>
              <pre className="bg-slate-950 p-2 rounded text-slate-300 font-mono overflow-x-auto">
{`if in1 >= 1:
    out1 = 1
else:
    out1 = 0`}
              </pre>
            </div>

            <div>
              <p className="text-slate-400 font-semibold mb-1">Beispiel - Berechnung:</p>
              <pre className="bg-slate-950 p-2 rounded text-slate-300 font-mono overflow-x-auto">
{`# Durchschnitt berechnen
out1 = (in1 + in2) / 2

# Begrenzen auf 0-100
out1 = max(0, min(100, out1))`}
              </pre>
            </div>

            <div>
              <p className="text-slate-400 font-semibold mb-1">Beispiel - Mehrere Ausgaenge:</p>
              <pre className="bg-slate-950 p-2 rounded text-slate-300 font-mono overflow-x-auto">
{`# in1 aufteilen
out1 = in1 > 50
out2 = in1 * 2
out3 = "Hoch" if in1 > 75 else "Normal"`}
              </pre>
            </div>

            <div className="text-slate-500 border-t border-slate-700 pt-2 mt-2">
              <p className="font-semibold text-slate-400 mb-1">Wichtige Python-Regeln:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Einrueckung mit 4 Leerzeichen (Tab-Taste)</li>
                <li>Doppelpunkt ":" nach if, else, for, while</li>
                <li>"==" fuer Vergleich, "=" fuer Zuweisung</li>
                <li>Kein "then", kein "end if" - nur Einrueckung</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
