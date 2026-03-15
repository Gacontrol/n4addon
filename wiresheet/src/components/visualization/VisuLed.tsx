import React from 'react';
import { LedConfig, WidgetStyle } from '../../types/visualization';

interface VisuLedProps {
  value: boolean;
  config: LedConfig;
  style: WidgetStyle;
  label: string;
}

export const VisuLed: React.FC<VisuLedProps> = ({
  value,
  config,
  style,
  label
}) => {
  const onColor = config.onColor || '#22c55e';
  const offColor = config.offColor || '#374151';
  const currentColor = value ? onColor : offColor;
  const isCircle = config.shape !== 'square';

  return (
    <div className="flex flex-col items-center gap-1">
      {style.showLabel && style.labelPosition === 'top' && (
        <span className="text-xs truncate max-w-full" style={{ color: style.textColor || '#94a3b8' }}>{label}</span>
      )}
      <div
        className={`w-10 h-10 ${isCircle ? 'rounded-full' : 'rounded-lg'} transition-all duration-200`}
        style={{
          backgroundColor: currentColor,
          boxShadow: value ? `0 0 20px ${onColor}80, 0 0 40px ${onColor}40` : 'none'
        }}
      />
      {style.showLabel && style.labelPosition === 'bottom' && (
        <span className="text-xs truncate max-w-full" style={{ color: style.textColor || '#94a3b8' }}>{label}</span>
      )}
    </div>
  );
};
