import React from 'react';
import { LabelConfig, WidgetStyle } from '../../types/visualization';

interface VisuLabelProps {
  config: LabelConfig;
  style: WidgetStyle;
}

export const VisuLabel: React.FC<VisuLabelProps> = ({
  config,
  style
}) => {
  return (
    <div
      className="flex items-center h-full"
      style={{
        fontSize: config.fontSize || 16,
        fontWeight: config.fontWeight || 'normal',
        color: style.textColor || '#e2e8f0',
        textAlign: config.textAlign || 'left',
        justifyContent: config.textAlign === 'center' ? 'center' : config.textAlign === 'right' ? 'flex-end' : 'flex-start'
      }}
    >
      {config.text}
    </div>
  );
};
